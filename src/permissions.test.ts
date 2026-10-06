import { effectivePermissions, permissionForRequest } from './permissions';

describe('permissionForRequest', () => {
  it.each([
    ['GET', '/projects', undefined, 'projects:read'],
    ['GET', '/projects/p1', undefined, 'projects:read'],
    ['GET', '/projects/p1/datasets', undefined, 'datasets:read'],
    ['GET', '/projects/p1/datasets/d1/files', undefined, 'datasets:read'],
    ['GET', '/projects/p1/files', undefined, 'datasets:read'],
    ['GET', '/processes', undefined, 'datasets:read'],
    ['POST', '/projects/p1/s3-token', { accessType: 'PROJECT_DOWNLOAD' }, 'files:read'],
    ['POST', '/projects/p1/s3-token', { accessType: 'SHARED_DATASET_DOWNLOAD', datasetId: 'd1' }, 'files:read'],
    ['POST', '/projects/p1/s3-token', { accessType: 'DATASET_UPLOAD', datasetId: 'd1' }, 'datasets:write'],
    ['POST', '/projects/p1/datasets/upload', {}, 'datasets:write'],
    ['PUT', '/projects/p1/datasets/d1', {}, 'datasets:write'],
    ['POST', '/projects/p1/sheets/s1/data/query', {}, 'sheets:read'],
    ['POST', '/projects/p1/sheets/raw-query', {}, 'sheets:read'],
    ['PATCH', '/projects/p1/sheets/s1/data', {}, 'sheets:write'],
    ['POST', '/projects/p1/execution', {}, 'pipelines:run']
  ])('%s %s needs %s', (method, path, body, permission) => {
    expect(permissionForRequest(method, path, body)).toBe(permission);
  });

  it.each([
    ['DELETE', '/projects/p1/datasets/d1', undefined],
    ['PUT', '/projects/p1', {}],
    ['GET', '/users', undefined],
    ['GET', '/projects/p1/datasets/d1/files/extra', undefined],
    ['POST', '/projects/p1/s3-token', { accessType: 'REFERENCE_UPLOAD' }],
    ['POST', '/projects/p1/s3-token', undefined]
  ])('%s %s is not covered', (method, path, body) => {
    expect(permissionForRequest(method, path, body)).toBeNull();
  });

  it('ignores method case', () => {
    expect(permissionForRequest('get', '/projects')).toBe('projects:read');
  });
});

describe('effectivePermissions', () => {
  it('intersects the request with every allowance, in canonical order', () => {
    expect(effectivePermissions(['datasets:write', 'projects:read', 'files:read'], ['files:read', 'projects:read', 'datasets:write'], ['projects:read', 'datasets:write']))
      .toEqual(['projects:read', 'datasets:write']);
  });

  it('returns the request when no allowance narrows it', () => {
    expect(effectivePermissions(['files:read'])).toEqual(['files:read']);
  });
});
