import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  final inputPath = args.isNotEmpty ? args.first : 'pub-deps.json';
  final outputPath = args.length > 1 ? args[1] : 'license-inventory.txt';

  final inputFile = File(inputPath);
  if (!inputFile.existsSync()) {
    stderr.writeln('License inventory failed: file not found: $inputPath');
    exit(1);
  }

  final decoded = jsonDecode(inputFile.readAsStringSync());
  if (decoded is! Map<String, dynamic>) {
    stderr.writeln('License inventory failed: invalid JSON structure.');
    exit(1);
  }

  final packages = decoded['packages'];
  if (packages is! List) {
    stderr.writeln('License inventory failed: missing packages list.');
    exit(1);
  }

  final inventory = <String>[];
  inventory.add('Flutter User App - License Inventory');
  inventory.add('Generated: ${DateTime.now().toIso8601String()}');
  inventory.add('=' * 80);
  inventory.add('');

  for (final item in packages) {
    if (item is! Map) continue;
    final name = (item['name'] ?? '<unknown>').toString();
    final version = (item['version'] ?? '<unknown>').toString();
    final source = (item['source'] ?? '').toString().toLowerCase();
    final kind = (item['kind'] ?? '').toString();

    // Skip SDK and dev packages from inventory.
    if (source == 'sdk' || kind == 'dev') continue;

    inventory.add('Package: $name');
    inventory.add('Version: $version');
    inventory.add('Source:  $source');
    inventory.add('');
  }

  inventory.add('=' * 80);
  inventory.add('Total packages: ${packages.length}');
  inventory.add('Production dependencies listed above.');

  final outputFile = File(outputPath);
  outputFile.writeAsStringSync(inventory.join('\n'));

  stdout.writeln('License inventory saved to: $outputPath');
  stdout.writeln('Total packages processed: ${packages.length}');
}
