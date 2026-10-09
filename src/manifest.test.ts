import { checkManifest, compareVersions, isSemver } from './manifest';

const valid = {
  id: 'cytoweave',
  name: 'CytoWeave',
  version: '1.2.0',
  entry: 'index.html',
  permissions: ['projects:read', 'datasets:read', 'files:read'],
  opens: [{ extension: 'fcs', label: 'Flow cytometry' }, { extension: 'ome.tiff' }],
  license: 'Apache-2.0',
};

const errorsFor = (manifest: unknown): string[] => {
  const result = checkManifest(manifest);
  return result.ok ? [] : result.errors;
};

describe('checkManifest', () => {
  it('accepts a valid manifest', () => {
    expect(checkManifest(valid)).toEqual({ ok: true, manifest: valid });
  });

  it('accepts an app that opens no file types', () => {
    expect(checkManifest({ ...valid, opens: [] }).ok).toBe(true);
  });

  it('reports every problem at once', () => {
    const errors = errorsFor({ ...valid, id: 'Cyto_Weave', version: '1.2', permissions: ['files:delete'] });
    expect(errors).toHaveLength(3);
  });

  it.each([
    ['id', { id: 'cyto-weave' }],
    ['name', { name: 'Cyto/Weave' }],
    ['name', { name: ' CytoWeave' }],
    ['version', { version: 'v1.0.0' }],
    ['entry', { entry: '/index.html' }],
    ['entry', { entry: '../index.html' }],
    ['entry', { entry: 'https://example.com/index.html' }],
    ['permissions', { permissions: 'files:read' }],
    ['permissions', { permissions: ['files:read', 'files:read'] }],
    ['opens', { opens: [{ extension: '.fcs' }] }],
    ['opens', { opens: [{ extension: 'FCS' }] }],
    ['opens', { opens: [{ extension: 'fcs', label: 3 }] }],
    ['license', { license: 2 }]
  ])('rejects a bad %s', (_field, change) => {
    expect(errorsFor({ ...valid, ...change })).toHaveLength(1);
  });

  it('rejects fields it does not know, so typos are caught', () => {
    expect(errorsFor({ ...valid, permission: [] })).toEqual(['Unknown field "permission".']);
  });

  it('rejects what is not an object', () => {
    expect(errorsFor([valid])).toHaveLength(1);
    expect(errorsFor(null)).toHaveLength(1);
  });
});

describe('versions', () => {
  it('recognizes semantic versions', () => {
    expect(isSemver('0.10.3')).toBe(true);
    expect(isSemver('2.0.0-beta.1')).toBe(true);
    expect(isSemver('01.0.0')).toBe(false);
    expect(isSemver('1.0')).toBe(false);
  });

  it.each([
    ['1.0.0', '1.0.1'],
    ['1.9.0', '1.10.0'],
    ['1.0.0-beta.2', '1.0.0-beta.10'],
    ['1.0.0-alpha', '1.0.0-beta'],
    ['1.0.0-rc.1', '1.0.0'],
    ['1.0.0-beta', '1.0.0-beta.1']
  ])('%s is older than %s', (older, newer) => {
    expect(compareVersions(older, newer)).toBeLessThan(0);
    expect(compareVersions(newer, older)).toBeGreaterThan(0);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('1.2.3-rc.1', '1.2.3-rc.1')).toBe(0);
  });

  it('refuses what is not a version', () => {
    expect(() => compareVersions('1.0.0', 'latest')).toThrow('"latest"');
  });
});
