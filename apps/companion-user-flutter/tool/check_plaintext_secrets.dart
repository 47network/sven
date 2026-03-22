import 'dart:io';

void main(List<String> args) {
  final rootPath = args.isNotEmpty ? args.first : 'lib';
  final rootDir = Directory(rootPath);

  if (!rootDir.existsSync()) {
    stderr.writeln('Secrets scan failed: directory not found: $rootPath');
    exit(1);
  }

  // Patterns that indicate potential secrets.
  final secretPatterns = [
    // API keys and tokens
    RegExp("api[_-]?key\\s*[=:]\\s*[\"'][\\w-]{20,}[\"']",
        caseSensitive: false),
    RegExp("token\\s*[=:]\\s*[\"'][A-Za-z0-9._~+/-]{20,}[\"']",
        caseSensitive: false),
    RegExp("secret\\s*[=:]\\s*[\"'][\\w-]{20,}[\"']", caseSensitive: false),

    // Passwords
    RegExp("password\\s*[=:]\\s*[\"'].+[\"']", caseSensitive: false),

    // AWS keys
    RegExp(r'AKIA[0-9A-Z]{16}'),

    // Private keys
    RegExp(r'-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----'),

    // JWT tokens (simplified pattern)
    RegExp(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'),

    // Generic base64 secrets (conservative pattern)
    RegExp("[\"'][A-Za-z0-9+/]{40,}={0,2}[\"']"),
  ];

  // Allowlist patterns (known safe occurrences).
  final allowlistPatterns = [
    // Environment variable reads (safe)
    RegExp(r'String\.fromEnvironment'),
    RegExp("defaultValue:\\s*[\"']https?://"),

    // Test fixtures and examples
    RegExp(r'test.+\.dart'),
    RegExp(r'_test\.dart'),
    RegExp(r'example'),

    // Comments explaining patterns (not actual secrets)
    RegExp(r'//.*token'),
    RegExp(r'/\*.*token.*\*/'),
  ];

  final violations = <String>[];
  final warnings = <String>[];

  void scanFile(File file) {
    final relativePath = file.path.replaceFirst(rootDir.absolute.path, '');
    final lines = file.readAsLinesSync();

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final lineNumber = i + 1;

      // Skip allowlisted patterns.
      var isAllowlisted = false;
      for (final pattern in allowlistPatterns) {
        if (pattern.hasMatch(line)) {
          isAllowlisted = true;
          break;
        }
      }
      if (isAllowlisted) continue;

      // Check for secret patterns.
      for (final pattern in secretPatterns) {
        if (pattern.hasMatch(line)) {
          final match = pattern.firstMatch(line)?.group(0) ?? '(pattern match)';
          final truncated =
              match.length > 50 ? '${match.substring(0, 50)}...' : match;
          violations.add(
            '$relativePath:$lineNumber - Potential secret: $truncated',
          );
        }
      }

      // Additional warnings for suspicious patterns.
      if (line.toLowerCase().contains('hardcoded') &&
          (line.contains('token') || line.contains('password'))) {
        warnings.add(
          '$relativePath:$lineNumber - Suspicious comment mentions hardcoded credentials',
        );
      }
    }
  }

  void scanDirectory(Directory dir) {
    for (final entity in dir.listSync(recursive: false)) {
      if (entity is File && entity.path.endsWith('.dart')) {
        scanFile(entity);
      } else if (entity is Directory && !entity.path.contains('.dart_tool')) {
        scanDirectory(entity);
      }
    }
  }

  scanDirectory(rootDir);

  if (violations.isNotEmpty) {
    stderr.writeln(
        'Secrets scan FAILED: ${violations.length} violation(s) detected');
    stderr.writeln('');
    for (final violation in violations) {
      stderr.writeln('❌ $violation');
    }
    stderr.writeln('');
    stderr.writeln('Policy: No plaintext secrets allowed in source code.');
    stderr.writeln('Use String.fromEnvironment() or secure storage instead.');
    exit(1);
  }

  if (warnings.isNotEmpty) {
    stdout.writeln('Secrets scan passed with ${warnings.length} warning(s):');
    for (final warning in warnings) {
      stdout.writeln('⚠️  $warning');
    }
    stdout.writeln('');
  }

  stdout.writeln('✅ Secrets scan passed: no plaintext secrets detected.');
}
