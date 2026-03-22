const path = require('path');
const { execFileSync } = require('child_process');

describe('CLI help snapshot contract', () => {
  it('prints stable help surface', () => {
    const cliPath = path.resolve(__dirname, '..', 'bin', 'sven.js');
    const out = execFileSync(process.execPath, [cliPath, '--help'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });

    const normalized = out
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    expect(normalized).toMatchSnapshot();
  });
});
