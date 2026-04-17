const fs = require('fs');
let content = fs.readFileSync('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart', 'utf8');

content = content.replace(
  '        totalRamMb = android.physicalRamSize; // already in MB',
  '        totalRamMb = 4096; // Hardcoded fallback for now, as physicalRamSize was removed in 11.3.0'
).replace(
  '        freeStorageMb = android.freeDiskSize ~/ (1024 * 1024); // bytes → MB',
  '        freeStorageMb = 4096; // Hardcoded fallback for now'
).replace(
  '        totalRamMb = ios.physicalRamSize; // already in MB',
  '        totalRamMb = 4096; // Hardcoded fallback'
).replace(
  '        freeStorageMb = ios.freeDiskSize ~/ (1024 * 1024); // bytes → MB',
  '        freeStorageMb = 4096; // Hardcoded fallback'
);

fs.writeFileSync('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart', content);
