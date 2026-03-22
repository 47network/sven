DELETE FROM settings_global
WHERE key IN (
  'discovery.natsLeafAutoPeer.enabled',
  'discovery.natsLeafAutoPeer.peers'
);
