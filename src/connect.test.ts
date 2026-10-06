import { connectToCirro, connectToHost, hostedMode, HostWindows } from './connect';
import { HostConnectionError } from './errors';
import {
  AppMessage, AppSessionInit, ContextMessage, hostMessage, InitMessage, isAppMessage, LaunchContext, TokenErrorMessage, TokenMessage,
  TokenRequestMessage
} from './protocol';
import type { AppSession } from './types';
import { KIT_VERSION } from './version';

const ORIGIN = 'https://tenant.example';
const HOUR = 3_600_000;

function sessionInit(overrides: Partial<AppSessionInit> = {}): AppSessionInit {
  return {
    app: { id: 'proteoscope', name: 'Proteoscope' },
    user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    tenant: { id: 't1', name: 'Tenant' },
    apiBasePath: `${ORIGIN}/api`,
    portalOrigin: ORIGIN,
    accessToken: 'token-1',
    accessTokenExpiresAt: Date.now() + HOUR,
    permissions: ['projects:read'],
    launch: { projectId: 'p1' },
    ...overrides,
  };
}

interface FakeHost {
  windows: HostWindows;
  parent: { postMessage: jest.Mock };
  deliver: (data: unknown, from?: { origin?: string; source?: unknown }) => void;
  sent: () => AppMessage[];
}

/** The app's window (an EventTarget) and a fake portal window that records what the app posts. */
function fakeHost(): FakeHost {
  const parent = { postMessage: jest.fn() };
  const windows: HostWindows = { self: new EventTarget(), parent, origin: ORIGIN };
  const deliver = (data: unknown, { origin = ORIGIN, source = parent as unknown } = {}): void => {
    windows.self.dispatchEvent(Object.assign(new Event('message'), { data, origin, source }));
  };
  const sent = (): AppMessage[] => parent.postMessage.mock.calls.map(([message]) => message);
  return { windows, parent, deliver, sent };
}

async function connected(init = sessionInit()): Promise<FakeHost & { session: AppSession }> {
  const host = fakeHost();
  const connecting = connectToHost(host.windows, { appId: 'proteoscope' });
  host.deliver(hostMessage<InitMessage>({ type: 'init', session: init }));
  return { ...host, session: await connecting };
}

const tokenRequests = (sent: AppMessage[]): TokenRequestMessage[] => sent.filter((m): m is TokenRequestMessage => m.type === 'token-request');

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-06T12:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the handshake', () => {
  it('says hello at once and every 250 ms until init arrives', async () => {
    const host = fakeHost();
    const connecting = connectToHost(host.windows, { appId: 'proteoscope', appVersion: '0.7.0' });
    expect(host.sent()).toEqual([{ source: 'cirro-app', version: 1, type: 'hello', appId: 'proteoscope', appVersion: '0.7.0', kitVersion: KIT_VERSION }]);
    expect(host.parent.postMessage).toHaveBeenCalledWith(expect.anything(), ORIGIN);
    jest.advanceTimersByTime(750);
    expect(host.sent()).toHaveLength(4);

    host.deliver(hostMessage<InitMessage>({ type: 'init', session: sessionInit() }));
    const session = await connecting;
    expect(session.mode).toBe('portal');
    expect(session.app).toEqual({ id: 'proteoscope', name: 'Proteoscope' });
    expect(session.launch).toEqual({ projectId: 'p1' });
    expect(session.can('projects:read')).toBe(true);
    expect(session.can('files:read')).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(host.sent()).toHaveLength(4);
  });

  it('ignores messages from another origin or window, and malformed ones', async () => {
    const host = fakeHost();
    let session: AppSession | null = null;
    connectToHost(host.windows, { appId: 'proteoscope' }).then((s) => { session = s; });
    const init = hostMessage<InitMessage>({ type: 'init', session: sessionInit() });
    host.deliver(init, { origin: 'https://evil.example' });
    host.deliver(init, { source: {} });
    host.deliver({ ...init, session: { ...init.session, accessToken: '' } });
    host.deliver({ ...init, version: 2 });
    await jest.advanceTimersByTimeAsync(0);
    expect(session).toBeNull();

    host.deliver(init);
    await jest.advanceTimersByTimeAsync(0);
    expect(session).not.toBeNull();
  });

  it('gives up with HostConnectionError when no init arrives in time', async () => {
    const host = fakeHost();
    const connecting = connectToHost(host.windows, { appId: 'proteoscope', timeoutMs: 2000 });
    const outcome = expect(connecting).rejects.toThrow(new HostConnectionError('Cirro did not answer within 2 s.'));
    jest.advanceTimersByTime(2000);
    await outcome;
    const hellos = host.sent().length;
    jest.advanceTimersByTime(1000);
    expect(host.sent()).toHaveLength(hellos);
  });

  it('waits 10 s by default', async () => {
    const host = fakeHost();
    let failure: unknown = null;
    connectToHost(host.windows, { appId: 'proteoscope' }).catch((error) => { failure = error; });
    await jest.advanceTimersByTimeAsync(9999);
    expect(failure).toBeNull();
    await jest.advanceTimersByTimeAsync(1);
    expect(failure).toEqual(new HostConnectionError('Cirro did not answer within 10 s.'));
  });

  it('refuses a session for another app', async () => {
    const host = fakeHost();
    const connecting = connectToHost(host.windows, { appId: 'proteoscope' });
    host.deliver(hostMessage<InitMessage>({ type: 'init', session: sessionInit({ app: { id: 'cytoweave', name: 'CytoWeave' } }) }));
    await expect(connecting).rejects.toThrow('Cirro sent a session for the app "cytoweave", but this is "proteoscope".');
  });
});

describe('access tokens in portal mode', () => {
  it('uses the token from init until 60 s before it expires', async () => {
    const { session, sent } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() + 61_000 }));
    await expect(session.getAccessToken()).resolves.toBe('token-1');
    expect(tokenRequests(sent())).toHaveLength(0);
    jest.advanceTimersByTime(1000);
    void session.getAccessToken();
    expect(tokenRequests(sent())).toHaveLength(1);
  });

  it('asks the host once for concurrent callers and keeps the answer', async () => {
    const { session, sent, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() + 30_000 }));
    const first = session.getAccessToken();
    const second = session.getAccessToken();
    const requests = tokenRequests(sent());
    expect(requests).toHaveLength(1);
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: requests[0].requestId, accessToken: 'token-2', accessTokenExpiresAt: Date.now() + HOUR }));
    await expect(Promise.all([first, second])).resolves.toEqual(['token-2', 'token-2']);
    await expect(session.getAccessToken()).resolves.toBe('token-2');
    expect(tokenRequests(sent())).toHaveLength(1);
  });

  it('uses fresh request ids', async () => {
    const { session, sent, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const first = session.getAccessToken();
    const [request] = tokenRequests(sent());
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: request.requestId, accessToken: 'token-2', accessTokenExpiresAt: Date.now() + 61_000 }));
    await first;
    jest.advanceTimersByTime(2000);
    void session.getAccessToken();
    const ids = tokenRequests(sent()).map((m) => m.requestId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('fails with HostConnectionError after 10 s without an answer, and asks again next time', async () => {
    const { session, sent } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const token = session.getAccessToken();
    const outcome = expect(token).rejects.toThrow(new HostConnectionError('Cirro did not send a fresh access token in time.'));
    jest.advanceTimersByTime(10_000);
    await outcome;
    void session.getAccessToken();
    expect(tokenRequests(sent())).toHaveLength(2);
  });

  it('fails the pending request on token-error', async () => {
    const { session, sent, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const token = session.getAccessToken();
    const [request] = tokenRequests(sent());
    deliver(hostMessage<TokenErrorMessage>({ type: 'token-error', requestId: 'another-request', message: 'ignored' }));
    deliver(hostMessage<TokenErrorMessage>({ type: 'token-error', requestId: request.requestId, message: 'You are signed out.' }));
    await expect(token).rejects.toThrow(new HostConnectionError('You are signed out.'));
  });

  it('accepts tokens the host pushes, but never an older one', async () => {
    const { session, sent, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() + 30_000 }));
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: null, accessToken: 'pushed', accessTokenExpiresAt: Date.now() + HOUR }));
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: null, accessToken: 'older', accessTokenExpiresAt: Date.now() + HOUR / 2 }));
    await expect(session.getAccessToken()).resolves.toBe('pushed');
    expect(tokenRequests(sent())).toHaveLength(0);
  });

  it('settles a pending request with a fresh pushed token', async () => {
    const { session, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const token = session.getAccessToken();
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: null, accessToken: 'pushed', accessTokenExpiresAt: Date.now() + HOUR }));
    await expect(token).resolves.toBe('pushed');
  });

  it('sends API requests with the refreshed token', async () => {
    const { session, sent, deliver } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
    const projects = session.api.projects.getProjects();
    await jest.advanceTimersByTimeAsync(0);
    const [request] = tokenRequests(sent());
    deliver(hostMessage<TokenMessage>({ type: 'token', requestId: request.requestId, accessToken: 'token-2', accessTokenExpiresAt: Date.now() + HOUR }));
    await expect(projects).resolves.toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/projects`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
    fetchMock.mockRestore();
  });
});

describe('a portal-mode session', () => {
  it('links into the portal', async () => {
    const { session } = await connected();
    expect(session.portalUrl({ kind: 'project', projectId: 'p1' })).toBe(`${ORIGIN}/project/p1/overview`);
    expect(session.portalUrl({ kind: 'dataset', projectId: 'p1', datasetId: 'd1' })).toBe(`${ORIGIN}/project/p1/dataset/d1`);
    expect(session.portalUrl({ kind: 'app', appId: 'cytoweave' })).toBe(`${ORIGIN}/apps/cytoweave`);
    expect(session.portalUrl({ kind: 'app', appId: 'cytoweave', launch: { projectId: 'p1', datasetId: 'd1', path: 'data/a b.fcs' } }))
      .toBe(`${ORIGIN}/apps/cytoweave?projectId=p1&datasetId=d1&path=data%2Fa+b.fcs`);
  });

  it('asks the host to navigate and reflect its context', async () => {
    const { session, sent } = await connected();
    session.openInPortal({ kind: 'dataset', projectId: 'p1', datasetId: 'd1' });
    session.openInPortal({ kind: 'project', projectId: 'p1' }, { newTab: false });
    session.reportContext({ projectId: 'p1', datasetId: 'd1', path: 'data/a.cif' }, 'a.cif');
    session.reportContext({});
    expect(sent().slice(-4)).toEqual([
      { source: 'cirro-app', version: 1, type: 'navigate', target: { kind: 'dataset', projectId: 'p1', datasetId: 'd1' }, newTab: true },
      { source: 'cirro-app', version: 1, type: 'navigate', target: { kind: 'project', projectId: 'p1' }, newTab: false },
      { source: 'cirro-app', version: 1, type: 'context', context: { projectId: 'p1', datasetId: 'd1', path: 'data/a.cif' }, title: 'a.cif' },
      { source: 'cirro-app', version: 1, type: 'context', context: {}, title: null }
    ]);
  });

  it('leaves out unset context fields, which the host would refuse', async () => {
    const { session, sent } = await connected();
    // As a plain-JS app passes them.
    session.reportContext({ projectId: 'p1', datasetId: null, path: '' } as unknown as LaunchContext, 'Plate 1');
    session.reportContext({ projectId: undefined, datasetId: 'd1', path: 'data/a.fcs' });
    const messages = sent().slice(-2);
    expect(messages.map((m) => (m as ContextMessage).context)).toEqual([{ projectId: 'p1' }, { datasetId: 'd1', path: 'data/a.fcs' }]);
    expect(messages.every(isAppMessage)).toBe(true);
  });

  it('stops listening on dispose and fails what is pending', async () => {
    const { session, windows } = await connected(sessionInit({ accessTokenExpiresAt: Date.now() }));
    const removeListener = jest.spyOn(windows.self, 'removeEventListener');
    const token = session.getAccessToken();
    session.dispose();
    expect(removeListener).toHaveBeenCalledWith('message', expect.any(Function));
    await expect(token).rejects.toThrow(HostConnectionError);
    await expect(session.getAccessToken()).rejects.toThrow('disposed');
  });
});

describe('hostedMode and connectToCirro', () => {
  const globals = globalThis as unknown as { window?: unknown };

  /** A stand-in for `window` at `search`, framed by a fake portal or top-level. */
  function stubWindow(search: string, framed: boolean): { win: EventTarget; parent: { postMessage: jest.Mock } } {
    const parent = { postMessage: jest.fn() };
    const win: EventTarget & { location: Partial<Location>; parent?: unknown } = Object.assign(new EventTarget(), {
      location: { search, origin: ORIGIN },
    });
    win.parent = framed ? parent : win;
    globals.window = win;
    return { win, parent };
  }

  afterEach(() => {
    delete globals.window;
  });

  it.each([
    ['?cirro-app=1', true, 'portal'],
    ['?cirro-app=1', false, null],
    ['?cirro-app=mock', false, 'mock'],
    ['?cirro-app=mock', true, 'mock'],
    ['', true, null]
  ])('%s, framed: %s → %s', (search, framed, mode) => {
    stubWindow(search, framed);
    expect(hostedMode()).toBe(mode);
  });

  it('connects to the portal that frames the page', async () => {
    const { win, parent } = stubWindow('?cirro-app=1', true);
    const connecting = connectToCirro({ appId: 'proteoscope' });
    expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'hello', appId: 'proteoscope' }), ORIGIN);
    win.dispatchEvent(Object.assign(new Event('message'), {
      data: hostMessage<InitMessage>({ type: 'init', session: sessionInit() }), origin: ORIGIN, source: parent,
    }));
    await expect(connecting).resolves.toMatchObject({ mode: 'portal', user: { id: 'u1' } });
  });

  it('makes a mock session from the app\'s fixtures', async () => {
    stubWindow('?cirro-app=mock', false);
    const session = await connectToCirro({ appId: 'proteoscope', mock: async () => ({ appName: 'Proteoscope', projects: [] }) });
    expect(session.mode).toBe('mock');
    expect(session.app).toEqual({ id: 'proteoscope', name: 'Proteoscope' });
  });

  it('needs fixtures for a mock session', async () => {
    stubWindow('?cirro-app=mock', false);
    await expect(connectToCirro({ appId: 'proteoscope' })).rejects.toThrow('needs fixtures');
  });

  it('throws when the page is not hosted', async () => {
    stubWindow('', false);
    await expect(connectToCirro({ appId: 'proteoscope' })).rejects.toThrow('not hosted');
  });
});
