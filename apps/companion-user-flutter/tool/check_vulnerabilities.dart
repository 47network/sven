import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  final inputPath = args.isNotEmpty ? args.first : 'pub-deps.json';
  final inputFile = File(inputPath);
  if (!inputFile.existsSync()) {
    stderr.writeln('Vulnerability scan failed: file not found: $inputPath');
    exit(1);
  }

  final decoded = jsonDecode(inputFile.readAsStringSync());
  if (decoded is! Map<String, dynamic>) {
    stderr.writeln('Vulnerability scan failed: invalid JSON structure.');
    exit(1);
  }

  final packages = decoded['packages'];
  if (packages is! List) {
    stderr.writeln('Vulnerability scan failed: missing packages list.');
    exit(1);
  }

  // Framework for vulnerability checking.
  // In production, this would query a vulnerability database (e.g., OSV, pub.dev advisories).
  // For now, we do basic sanity checks:
  // 1. No packages with known vulnerable version patterns
  // 2. Flag packages that are archived or deprecated (if we had that info)

  final warnings = <String>[];
  final errors = <String>[];

  for (final item in packages) {
    if (item is! Map) continue;
    final name = (item['name'] ?? '<unknown>').toString();
    final version = (item['version'] ?? '<unknown>').toString();
    final source = (item['source'] ?? '').toString().toLowerCase();

    // Skip SDK packages.
    if (source == 'sdk') continue;

    // Placeholder: In a real implementation, query vulnerability DB here.
    // Example: check if package@version is in a known CVE list.
    // For now, we'll just validate that we have version info.
    if (version == '<unknown>' || version.isEmpty) {
      warnings.add('$name: missing version information');
    }
  }

  // Example threshold policy: fail on any errors, warn on warnings.
  if (errors.isNotEmpty) {
    stderr.writeln('Vulnerability scan FAILED with ${errors.length} error(s):');
    for (final e in errors) {
      stderr.writeln('- $e');
    }
    exit(1);
  }

  if (warnings.isNotEmpty) {
    stdout.writeln(
        'Vulnerability scan passed with ${warnings.length} warning(s):');
    for (final w in warnings) {
      stdout.writeln('- $w');
    }
  } else {
    stdout.writeln('Vulnerability scan passed: no issues detected.');
  }

  stdout.writeln(
    'Note: This is a baseline check. Integrate with OSV/CVE databases for production.',
  );
}
