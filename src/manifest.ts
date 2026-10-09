// The app manifest, cirro-app.json at the root of every bundle (CONTRACT.md section 12).
// The registry reads it when a version is uploaded; the CLI checks it before packing.
import { isAppFolderName, isAppId } from './conventions';
import { AppPermission, isAppPermission } from './permissions';

export const MANIFEST_FILE = 'cirro-app.json';

/** A file type the app opens, offered on matching files in the portal. */
export interface AppFileType {
  /** Lowercase, without the leading dot; may have several parts, e.g. `ome.tiff`. */
  extension: string;
  label?: string;
}

export interface AppManifest {
  id: string;
  name: string;
  /** Semantic version, e.g. `1.4.0` or `2.0.0-beta.1`. */
  version: string;
  /** The page the portal loads, relative to the bundle root. */
  entry: string;
  permissions: AppPermission[];
  opens: AppFileType[];
  description?: string;
  homepage?: string;
  /** An SPDX license id, e.g. `Apache-2.0`, or `commercial`. */
  license?: string;
}

export type ManifestCheck = { ok: true; manifest: AppManifest } | { ok: false; errors: string[] };

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const EXTENSION = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
const KNOWN_FIELDS = new Set(['id', 'name', 'version', 'entry', 'permissions', 'opens', 'description', 'homepage', 'license']);

export function isSemver(value: string): boolean {
  return SEMVER.test(value);
}

/** Negative when `a` is older than `b`; prerelease versions sort before their release. */
export function compareVersions(a: string, b: string): number {
  const [, ...left] = SEMVER.exec(a) ?? [];
  const [, ...right] = SEMVER.exec(b) ?? [];
  if (!left.length || !right.length) throw new Error(`Not a semantic version: "${left.length ? b : a}"`);
  for (let i = 0; i < 3; i++) {
    const difference = Number(left[i]) - Number(right[i]);
    if (difference) return difference;
  }
  const [preA, preB] = [left[3], right[3]];
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return comparePrerelease(preA, preB);
}

function comparePrerelease(a: string, b: string): number {
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    const [x, y] = [left[i], right[i]];
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    const difference = numeric ? Number(x) - Number(y) : x.localeCompare(y);
    if (difference) return difference;
  }
  return 0;
}

function isRelativeEntry(value: string): boolean {
  return value.length > 0 && !value.startsWith('/') && !value.includes('\\')
    && !/^[a-z][a-z0-9+.-]*:/i.test(value) && value.split('/').every((part) => part !== '..' && part !== '');
}

/** Checks a parsed cirro-app.json, reporting every problem rather than the first. */
export function checkManifest(value: unknown): ManifestCheck {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: [`${MANIFEST_FILE} must be a JSON object.`] };
  }
  const fields = value as Record<string, unknown>;
  const errors: string[] = [];
  const optionalString = (key: string): void => {
    if (fields[key] !== undefined && typeof fields[key] !== 'string') errors.push(`"${key}" must be a string.`);
  };

  if (typeof fields.id !== 'string' || !isAppId(fields.id)) {
    errors.push('"id" must be lowercase letters and digits, starting with a letter.');
  }
  if (typeof fields.name !== 'string' || !isAppFolderName(fields.name) || fields.name !== fields.name.trim()) {
    errors.push('"name" must be letters, digits, spaces, "_", "-" and ".", without spaces at either end.');
  }
  if (typeof fields.version !== 'string' || !isSemver(fields.version)) {
    errors.push('"version" must be a semantic version, e.g. 1.0.0.');
  }
  if (typeof fields.entry !== 'string' || !isRelativeEntry(fields.entry)) {
    errors.push('"entry" must be a path inside the bundle, e.g. index.html.');
  }
  if (!Array.isArray(fields.permissions)) {
    errors.push('"permissions" must be a list.');
  } else {
    for (const permission of fields.permissions) {
      if (!isAppPermission(permission)) errors.push(`Unknown permission ${JSON.stringify(permission)}.`);
    }
    if (new Set(fields.permissions).size !== fields.permissions.length) errors.push('"permissions" lists a permission twice.');
  }
  if (!Array.isArray(fields.opens)) {
    errors.push('"opens" must be a list (it may be empty).');
  } else {
    for (const type of fields.opens as unknown[]) {
      const extension = (type as AppFileType | null)?.extension;
      const label = (type as AppFileType | null)?.label;
      if (typeof extension !== 'string' || !EXTENSION.test(extension)) {
        errors.push(`"opens" entry ${JSON.stringify(type)} needs an "extension" in lowercase without the leading dot.`);
      } else if (label !== undefined && typeof label !== 'string') {
        errors.push(`"opens" entry "${extension}" has a "label" that is not a string.`);
      }
    }
  }
  optionalString('description');
  optionalString('homepage');
  optionalString('license');
  for (const key of Object.keys(fields)) {
    if (!KNOWN_FIELDS.has(key)) errors.push(`Unknown field "${key}".`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, manifest: fields as unknown as AppManifest };
}
