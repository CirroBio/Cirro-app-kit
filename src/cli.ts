// The cirro-app command line (CONTRACT.md section 12): starts an app from the template,
// checks a bundle and packs it into the zip the registry accepts. Node only; the browser
// builds never import this module.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { isAppId } from './conventions';
import { AppManifest, checkManifest, MANIFEST_FILE } from './manifest';

export interface ZipEntry {
  /** Path inside the zip, with `/` separators. */
  name: string;
  data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_VERSION = 20;
const UTF8_NAMES = 0x0800;
const STORED = 0;
const DEFLATED = 8;
// 1980-01-01 00:00, the earliest DOS date, so the same files always make the same zip.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const ZIP32_LIMIT = 0xffffffff;

/** A zip of `entries`, deflated where that makes them smaller. No zip64: every size must fit in 32 bits. */
export function createZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const deflated = deflateRawSync(entry.data);
    const method = deflated.length < entry.data.length ? DEFLATED : STORED;
    const body = method === DEFLATED ? deflated : Buffer.from(entry.data);
    if (entry.data.length > ZIP32_LIMIT || offset > ZIP32_LIMIT) throw new Error(`${entry.name} does not fit in a zip without zip64.`);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(ZIP_VERSION, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_HEADER, 0);
    header.writeUInt16LE(ZIP_VERSION, 4);
    header.writeUInt16LE(ZIP_VERSION, 6);
    header.writeUInt16LE(UTF8_NAMES, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);

    parts.push(local, name, body);
    central.push(header, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

/** Every file under `dir`, relative and sorted, skipping dotfiles and dot-folders (.git, .DS_Store). */
function bundleFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder)) {
      if (name.startsWith('.')) continue;
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

export type BundleCheck = { ok: true; manifest: AppManifest; files: string[] } | { ok: false; errors: string[] };

/** Checks the bundle in `dir`: a valid manifest at its root whose `entry` exists. */
export function checkBundle(dir: string): BundleCheck {
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) return { ok: false, errors: [`No ${MANIFEST_FILE} in ${dir}.`] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`${MANIFEST_FILE} is not valid JSON: ${(error as Error).message}`] };
  }
  const check = checkManifest(parsed);
  if (!check.ok) return check;
  const files = bundleFiles(dir);
  if (!files.includes(check.manifest.entry)) {
    return { ok: false, errors: [`"entry" is ${check.manifest.entry}, which is not in the bundle.`] };
  }
  return { ok: true, manifest: check.manifest, files };
}

export interface CliOutput {
  log(message: string): void;
  error(message: string): void;
}

const USAGE = `Usage:
  cirro-app init <dir>               start an app in a new folder from the kit's template
  cirro-app validate [dir]           check dir's ${MANIFEST_FILE} (default: the current folder)
  cirro-app pack [dir] [--out file]  check, then write <id>-<version>.zip for the registry
  cirro-app dev                      not available yet
  cirro-app publish                  not available yet`;

const TEMPLATE = 'templates/vanilla';
const TEMPLATE_ID = 'myapp';
const TEMPLATE_NAME = 'My App';
// The kit builds a new app vendors (CONTRACT.md section 8).
const VENDORED = ['cirro-app-mode.js', 'cirro-app-kit.js'];
const TEMPLATE_TEXT_FILES = [MANIFEST_FILE, 'index.html', 'main.js', 'dev/fixtures.js'];

const NOT_YET: Record<string, string> = {
  dev: 'cirro-app dev is not available yet. Serve your app with any static server and open it with ?cirro-app=mock to run it on the sample data in dev/fixtures.js.',
  publish: 'cirro-app publish is not available yet. Upload the zip from cirro-app pack at the registry, apps.cirro.bio (docs/publishing.md).',
};

/** `init <dir>`: copies the template and the kit's builds into a new folder named for the app. */
function init(target: string, kitRoot: string, output: CliOutput): number {
  const dir = resolve(target);
  const name = basename(dir);
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (existsSync(dir)) {
    output.error(`${dir} already exists; choose a new folder.`);
    return 1;
  }
  if (!isAppId(id)) {
    output.error(`"${name}" does not make an app ID; name the folder with letters and digits, starting with a letter.`);
    return 1;
  }
  const missing = VENDORED.filter((file) => !existsSync(join(kitRoot, 'dist', file)));
  if (missing.length) {
    output.error(`The kit is not built (no ${missing.join(', ')} in ${join(kitRoot, 'dist')}); run its build first.`);
    return 1;
  }
  cpSync(join(kitRoot, TEMPLATE), dir, { recursive: true });
  mkdirSync(join(dir, 'vendor'));
  for (const file of VENDORED) cpSync(join(kitRoot, 'dist', file), join(dir, 'vendor', file));
  for (const file of TEMPLATE_TEXT_FILES) {
    const path = join(dir, file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(TEMPLATE_ID, id).replaceAll(TEMPLATE_NAME, name));
  }
  output.log(`Created ${dir} (app ID ${id}). Serve the folder and open index.html?cirro-app=mock to try it.`);
  return 0;
}

/** Runs one command and returns the process exit code. `kitRoot` is the kit package's folder. */
export function runCli(args: string[], output: CliOutput, kitRoot: string): number {
  const [command, ...rest] = args;
  if (command in NOT_YET && rest.length === 0) {
    output.error(NOT_YET[command]);
    return 1;
  }
  if (command === 'init') {
    if (rest.length !== 1) {
      output.error(USAGE);
      return 2;
    }
    return init(rest[0], kitRoot, output);
  }
  const outIndex = rest.indexOf('--out');
  const out = outIndex >= 0 ? rest[outIndex + 1] : undefined;
  const positional = rest.filter((_arg, i) => outIndex < 0 || (i !== outIndex && i !== outIndex + 1));
  if ((command !== 'validate' && command !== 'pack') || positional.length > 1 || (outIndex >= 0 && !out)) {
    output.error(USAGE);
    return 2;
  }
  const dir = resolve(positional[0] ?? '.');
  const check = checkBundle(dir);
  if (!check.ok) {
    for (const message of check.errors) output.error(message);
    return 1;
  }
  const { manifest, files } = check;
  if (command === 'validate') {
    output.log(`${manifest.id} ${manifest.version}: ${MANIFEST_FILE} is valid; ${files.length} files.`);
    return 0;
  }
  const target = resolve(out ?? `${manifest.id}-${manifest.version}.zip`);
  const entries = files
    .filter((name) => resolve(dir, name) !== target)
    .map((name) => ({ name, data: readFileSync(join(dir, name)) }));
  const zip = createZip(entries);
  writeFileSync(target, zip);
  output.log(`Wrote ${target} (${entries.length} files, ${zip.length} bytes).`);
  return 0;
}
