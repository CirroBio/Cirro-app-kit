import type { AppSessionInit } from './protocol';
import { createAppSession } from './session';

const HOUR = 3_600_000;

const init = (accessTokenExpiresAt: number): AppSessionInit => ({
  app: { id: 'cytoweave', name: 'CytoWeave' },
  user: { id: 'u1', email: null, name: null },
  tenant: { id: 't1', name: 'Tenant' },
  apiBasePath: 'https://tenant.example/api',
  portalOrigin: 'https://tenant.example',
  accessToken: 'token-1',
  accessTokenExpiresAt,
  permissions: ['projects:read'],
  launch: {},
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-06T12:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a standalone session', () => {
  it('refreshes its token with the app\'s own sign-in, once for concurrent callers', async () => {
    const refreshToken = jest.fn(async () => ({ accessToken: 'token-2', accessTokenExpiresAt: Date.now() + HOUR }));
    const session = createAppSession({ init: init(Date.now() + 61_000), refreshToken });
    expect(session.mode).toBe('standalone');
    await expect(session.getAccessToken()).resolves.toBe('token-1');
    jest.advanceTimersByTime(1000);
    await expect(Promise.all([session.getAccessToken(), session.getAccessToken()])).resolves.toEqual(['token-2', 'token-2']);
    await expect(session.getAccessToken()).resolves.toBe('token-2');
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('tries again after a failed refresh', async () => {
    const refreshToken = jest.fn()
      .mockRejectedValueOnce(new Error('Signed out'))
      .mockResolvedValueOnce({ accessToken: 'token-2', accessTokenExpiresAt: Date.now() + HOUR });
    const session = createAppSession({ init: init(Date.now()), refreshToken });
    await expect(session.getAccessToken()).rejects.toThrow('Signed out');
    await expect(session.getAccessToken()).resolves.toBe('token-2');
  });

  it('opens portal links itself, and has no host to report its context to', () => {
    const globals = globalThis as unknown as { window?: unknown };
    const open = jest.fn();
    const assign = jest.fn();
    globals.window = { open, location: { assign } };
    try {
      const session = createAppSession({ init: init(Date.now() + HOUR), refreshToken: jest.fn() });
      session.openInPortal({ kind: 'dataset', projectId: 'p1', datasetId: 'd1' });
      session.openInPortal({ kind: 'project', projectId: 'p1' }, { newTab: false });
      session.reportContext({ projectId: 'p1' }, 'Plate 1');
      expect(open).toHaveBeenCalledWith('https://tenant.example/project/p1/dataset/d1', '_blank', 'noopener');
      expect(assign).toHaveBeenCalledWith('https://tenant.example/project/p1/overview');
    } finally {
      delete globals.window;
    }
  });
});
