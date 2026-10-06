import { readFileSync } from 'fs';
import { join } from 'path';
import { KIT_VERSION } from './version';

it('KIT_VERSION is package.json\'s version', () => {
  const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  expect(KIT_VERSION).toBe(version);
});
