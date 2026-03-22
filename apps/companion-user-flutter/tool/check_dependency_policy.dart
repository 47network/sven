import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  final inputPath = args.isNotEmpty ? args.first : 'pub-deps.json';
  final inputFile = File(inputPath);
  if (!inputFile.existsSync()) {
    stderr.writeln('Dependency policy check failed: file not found: $inputPath');
    exit(1);
  }

  final decoded = jsonDecode(inputFile.readAsStringSync());
  if (decoded is! Map<String, dynamic>) {
    stderr.writeln('Dependency policy check failed: invalid JSON structure.');
    exit(1);
  }

  final packages = decoded['packages'];
  if (packages is! List) {
    stderr.writeln('Dependency policy check failed: missing packages list.');
    exit(1);
  }

  final violations = <String>[];

  for (final item in packages) {
    if (item is! Map) continue;
    final name = (item['name'] ?? '<unknown>').toString();
    final source = (item['source'] ?? '').toString().toLowerCase();

    // Production policy: only hosted pub.dev packages + SDK packages.
    if (source != 'hosted' && source != 'sdk') {
      violations.add('$name (source=$source)');
    }
  }

  if (violations.isNotEmpty) {
    stderr.writeln('Dependency policy violations detected:');
    for (final v in violations) {
      stderr.writeln('- $v');
    }
    stderr.writeln(
      'Only hosted/sdk dependencies are allowed for production build paths.',
    );
    exit(1);
  }

  stdout.writeln(
    'Dependency policy check passed: all dependencies use hosted/sdk sources.',
  );
}
