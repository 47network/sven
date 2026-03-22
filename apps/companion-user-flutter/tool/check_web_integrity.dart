import 'dart:io';
import 'package:crypto/crypto.dart';

/// Web build integrity checker.
///
/// Generates SHA-256 checksums for all files in the web build directory
/// and creates a checksums.txt file for artifact verification.
void main(List<String> args) {
  final buildDir = args.isNotEmpty ? args.first : 'build/web';
  final dir = Directory(buildDir);

  if (!dir.existsSync()) {
    stderr.writeln(
        '❌ Web build integrity check failed: directory not found: $buildDir');
    stderr.writeln('Run "flutter build web --release" first.');
    exit(1);
  }

  final checksums = <String, String>{};
  var fileCount = 0;

  void processFile(File file) {
    final relativePath = file.path
        .replaceFirst(dir.absolute.path, '')
        .replaceFirst(RegExp(r'^[\\/]'), '');
    final bytes = file.readAsBytesSync();
    final hash = sha256.convert(bytes);
    checksums[relativePath] = hash.toString();
    fileCount++;
  }

  void scanDirectory(Directory directory) {
    for (final entity in directory.listSync(recursive: false)) {
      if (entity is File) {
        processFile(entity);
      } else if (entity is Directory) {
        scanDirectory(entity);
      }
    }
  }

  scanDirectory(dir);

  // Sort by path for deterministic output
  final sortedEntries = checksums.entries.toList()
    ..sort((a, b) => a.key.compareTo(b.key));

  // Write checksums file (SHA-256 format: hash  filename)
  final outputFile = File('checksums-web.txt');
  final buffer = StringBuffer();
  for (final entry in sortedEntries) {
    buffer.writeln('${entry.value}  ${entry.key}');
  }
  outputFile.writeAsStringSync(buffer.toString());

  stdout.writeln('✅ Web build integrity check complete');
  stdout.writeln('   Files processed: $fileCount');
  stdout.writeln('   Checksums written to: ${outputFile.path}');
  stdout.writeln('');
  stdout.writeln('Verification command:');
  stdout.writeln('  sha256sum -c checksums-web.txt');
}
