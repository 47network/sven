import 'dart:convert';
import 'dart:io';

/// Generates build metadata for release artifacts.
///
/// This tool creates a build.json file with version, git commit, build timestamp,
/// and CI pipeline information for artifact provenance tracking.
void main() {
  final metadata = {
    'version': Platform.environment['APP_VERSION'] ?? 'dev',
    'gitCommit': Platform.environment['GITHUB_SHA'] ?? 'unknown',
    'gitRef': Platform.environment['GITHUB_REF'] ?? 'unknown',
    'buildTimestamp': DateTime.now().toUtc().toIso8601String(),
    'ciPipeline': 'github-actions',
    'ciRunId': Platform.environment['GITHUB_RUN_ID'] ?? 'local',
    'ciRunUrl': Platform.environment['GITHUB_RUN_ID'] != null
        ? 'https://github.com/47network/openclaw-sven/actions/runs/${Platform.environment['GITHUB_RUN_ID']}'
        : 'local-build',
    'buildNumber': Platform.environment['GITHUB_RUN_NUMBER'] ?? '0',
    'platform': Platform.operatingSystem,
  };

  final file = File('build.json');
  file.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(metadata));

  stdout.writeln('✅ Build metadata generated successfully');
  stdout.writeln('');
  stdout.writeln(const JsonEncoder.withIndent('  ').convert(metadata));
}
