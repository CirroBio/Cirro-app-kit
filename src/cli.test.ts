import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { inflateRawSync } from 'zlib';
import { createZip, runCli } from './cli';

const manifest = {
  id: 'demo', name: 'Demo', version: '1.0.0', entry: 'index.html', permissions: ['projects:read'], opens: [],
};

function bundle(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'cirro-app-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

// The kit as init sees it: the real template, with stand-ins for the built files.
const kitRoot = mkdtempSync(join(tmpdir(), 'cirro-kit-'));
cpSync(join(__dirname, '..', 'templates'), join(kitRoot, 'templates'), { recursive: true });
mkdirSync(join(kitRoot, 'dist'));
writeFileSync(join(kitRoot, 'dist', 'cirro-app-mode.js'), '// mode');
writeFileSync(join(kitRoot, 'dist', 'cirro-app-kit.js'), '// kit');

function run(args: string[]): { code: number; logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  const code = runCli(args, { log: (m) => logs.push(m), error: (m) => errors.push(m) }, kitRoot);
  return { code, logs, errors };
}

/** Reads a zip's central directory back: name, method and contents of every entry. */
function unzip(zip: Buffer): Array<{ name: string; method: number; text: string }> {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const offset = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const dataStart = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    const body = zip.subarray(dataStart, dataStart + size);
    entries.push({ name, method, text: (method === 8 ? inflateRawSync(body) : body).toString('utf8') });
    at += 46 + nameLength;
  }
  return entries;
}

describe('createZip', () => {
  it('deflates what compresses and stores what does not', () => {
    const entries = unzip(createZip([
      { name: 'big.txt', data: Buffer.from('a'.repeat(1000)) },
      { name: 'é/x', data: Buffer.from('x') }
    ]));
    expect(entries).toEqual([
      { name: 'big.txt', method: 8, text: 'a'.repeat(1000) },
      { name: 'é/x', method: 0, text: 'x' }
    ]);
  });

  it('makes the same bytes from the same files', () => {
    const files = [{ name: 'a', data: Buffer.from('same') }];
    expect(createZip(files).equals(createZip(files))).toBe(true);
  });

  it('is a zip the system unzip can list', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cirro-zip-'));
    writeFileSync(join(dir, 'x.zip'), createZip([{ name: 'folder/file.txt', data: Buffer.from('hello '.repeat(50)) }]));
    expect(execFileSync('unzip', ['-t', join(dir, 'x.zip')]).toString()).toContain('No errors detected');
  });
});

describe('runCli', () => {
  it('validates a bundle', () => {
    const dir = bundle({ 'cirro-app.json': JSON.stringify(manifest), 'index.html': '<html></html>' });
    expect(run(['validate', dir])).toEqual({ code: 0, logs: ['demo 1.0.0: cirro-app.json is valid; 2 files.'], errors: [] });
  });

  it('reports a missing manifest, bad JSON, a bad field and a missing entry', () => {
    expect(run(['validate', bundle({ 'index.html': '' })]).errors[0]).toMatch(/^No cirro-app.json/);
    expect(run(['validate', bundle({ 'cirro-app.json': '{' })]).errors[0]).toMatch(/not valid JSON/);
    expect(run(['validate', bundle({ 'cirro-app.json': JSON.stringify({ ...manifest, version: 'one' }), 'index.html': '' })]).code).toBe(1);
    expect(run(['validate', bundle({ 'cirro-app.json': JSON.stringify(manifest) })]).errors).toEqual(['"entry" is index.html, which is not in the bundle.']);
  });

  it('packs every file but dotfiles, with the manifest at the root', () => {
    const dir = bundle({
      'cirro-app.json': JSON.stringify(manifest), 'index.html': '<html></html>', 'assets/app.js': 'go()', '.DS_Store': 'x',
    });
    const out = join(dir, 'out.zip');
    expect(run(['pack', dir, '--out', out]).code).toBe(0);
    expect(unzip(readFileSync(out)).map((entry) => entry.name)).toEqual(['assets/app.js', 'cirro-app.json', 'index.html']);
    // Packing again leaves the previous zip out of the new one.
    expect(run(['pack', dir, '--out', out]).code).toBe(0);
    expect(unzip(readFileSync(out))).toHaveLength(3);
  });

  it('starts an app from the template, named for its folder, that validates', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'cirro-init-')), 'Plate-Viewer2');
    expect(run(['init', dir]).code).toBe(0);
    const created = JSON.parse(readFileSync(join(dir, 'cirro-app.json'), 'utf8'));
    expect(created).toMatchObject({ id: 'plateviewer2', name: 'Plate-Viewer2' });
    expect(readFileSync(join(dir, 'main.js'), 'utf8')).toContain(`const APP_ID = 'plateviewer2';`);
    expect(existsSync(join(dir, 'vendor', 'cirro-app-kit.js'))).toBe(true);
    expect(run(['validate', dir]).code).toBe(0);
  });

  it('refuses to init over a folder or with a name that makes no app ID', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cirro-init-'));
    expect(run(['init', parent]).errors[0]).toMatch(/already exists/);
    expect(run(['init', join(parent, '123')]).errors[0]).toMatch(/does not make an app ID/);
  });

  it('says what to do instead for the commands that are not available yet', () => {
    expect(run(['dev'])).toMatchObject({ code: 1, errors: [expect.stringContaining('?cirro-app=mock')] });
    expect(run(['publish'])).toMatchObject({ code: 1, errors: [expect.stringContaining('apps.cirro.bio')] });
  });

  it('prints usage for anything else', () => {
    expect(run([]).code).toBe(2);
    expect(run(['deploy']).code).toBe(2);
    expect(run(['pack', '.', '--out']).code).toBe(2);
  });
});
