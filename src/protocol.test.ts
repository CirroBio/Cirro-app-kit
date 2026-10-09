import { hostedModeFromSearch } from './mode';
import {
  AppSessionInit, appMessage, HelloMessage, hostMessage, InitMessage, isAppMessage, isHostMessage,
  launchContextFromSearch, launchContextToSearch, NavigateMessage
} from './protocol';

const session: AppSessionInit = {
  app: { id: 'proteoscope', name: 'Proteoscope', version: '0.7.0' },
  user: { id: 'u1', email: 'u1@example.com', name: null },
  tenant: { id: 't1', name: 'Tenant' },
  apiBasePath: 'https://tenant.example/api',
  portalOrigin: 'https://tenant.example',
  accessToken: 'token',
  accessTokenExpiresAt: 1_700_000_000_000,
  permissions: ['projects:read', 'files:read'],
  launch: { projectId: 'p1' },
};

describe('message guards', () => {
  it('accepts what the builders make', () => {
    expect(isAppMessage(appMessage<HelloMessage>({ type: 'hello', appId: 'proteoscope', appVersion: null, kitVersion: '0.1.0' }))).toBe(true);
    expect(isHostMessage(hostMessage<InitMessage>({ type: 'init', session }))).toBe(true);
  });

  it('rejects the other side\'s messages, other versions and unknown types', () => {
    const hello = appMessage<HelloMessage>({ type: 'hello', appId: 'proteoscope', appVersion: null, kitVersion: '0.1.0' });
    expect(isHostMessage(hello)).toBe(false);
    expect(isAppMessage({ ...hello, version: 2 })).toBe(false);
    expect(isAppMessage({ ...hello, type: 'shutdown' })).toBe(false);
    expect(isAppMessage(null)).toBe(false);
    expect(isAppMessage('hello')).toBe(false);
  });

  it('accepts a hello from an app that does not use the kit', () => {
    expect(isAppMessage(appMessage<HelloMessage>({ type: 'hello', appId: 'cytoweave', appVersion: '0.8.0', kitVersion: null }))).toBe(true);
    expect(isAppMessage(appMessage({ type: 'hello', appId: 'cytoweave', appVersion: '0.8.0', kitVersion: 1 } as never))).toBe(false);
  });

  it('requires the app version in init, which is null only in the dev mock', () => {
    expect(isHostMessage(hostMessage<InitMessage>({ type: 'init', session: { ...session, app: { ...session.app, version: null } } }))).toBe(true);
    const { version: _version, ...withoutVersion } = session.app;
    expect(isHostMessage(hostMessage({ type: 'init', session: { ...session, app: withoutVersion } } as never))).toBe(false);
  });

  it('rejects an init with an unknown permission or a missing token', () => {
    expect(isHostMessage(hostMessage({ type: 'init', session: { ...session, permissions: ['everything'] } } as never))).toBe(false);
    expect(isHostMessage(hostMessage<InitMessage>({ type: 'init', session: { ...session, accessToken: '' } }))).toBe(false);
  });

  it('checks navigate targets', () => {
    expect(isAppMessage(appMessage<NavigateMessage>({ type: 'navigate', target: { kind: 'dataset', projectId: 'p1', datasetId: 'd1' }, newTab: true }))).toBe(true);
    expect(isAppMessage(appMessage({ type: 'navigate', target: { kind: 'dataset', projectId: 'p1' }, newTab: true } as never))).toBe(false);
    expect(isAppMessage(appMessage({ type: 'navigate', target: { kind: 'url', href: 'https://evil.example' }, newTab: true } as never))).toBe(false);
  });
});

describe('launch context', () => {
  it('round-trips through the query string and keeps unrelated parameters', () => {
    const params = launchContextToSearch({ projectId: 'p1', path: 'a/b.cif' }, new URLSearchParams('tab=2&datasetId=old'));
    expect(params.get('tab')).toBe('2');
    expect(params.has('datasetId')).toBe(false);
    expect(launchContextFromSearch(params)).toEqual({ projectId: 'p1', path: 'a/b.cif' });
  });
});

describe('hostedModeFromSearch', () => {
  it.each([
    ['?cirro-app=1', 'portal'],
    ['?x=1&cirro-app=mock', 'mock'],
    ['?cirro-app=0', null],
    ['', null]
  ])('%s → %s', (search, mode) => {
    expect(hostedModeFromSearch(search)).toBe(mode);
  });
});
