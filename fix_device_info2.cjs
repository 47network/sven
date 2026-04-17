const fs = require('fs');
let content = fs.readFileSync('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart', 'utf8');

content = content.replace(
  'final android = await deviceInfo.androidInfo;',
  '// final android = await deviceInfo.androidInfo; (removed to avoid unused var warning)'
).replace(
  'final ios = await deviceInfo.iosInfo;',
  '// final ios = await deviceInfo.iosInfo; (removed to avoid unused var warning)'
);

fs.writeFileSync('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart', content);
