import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', '..');

describe('Integration skills truthfulness contract (2026-03-12)', () => {
  it('keeps core integration tool migrations present (spotify/notion/trello/gif/weather)', async () => {
    const required = [
      'services/gateway-api/src/db/migrations/072_spotify_tools.sql',
      'services/gateway-api/src/db/migrations/077_notion_tools.sql',
      'services/gateway-api/src/db/migrations/080_trello_tools.sql',
      'services/gateway-api/src/db/migrations/083_gif_tools.sql',
      'services/gateway-api/src/db/migrations/084_weather_tools.sql',
    ];

    for (const rel of required) {
      await expect(fs.access(path.join(ROOT, rel))).resolves.toBeUndefined();
    }
  });
});

