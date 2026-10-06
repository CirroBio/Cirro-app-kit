// The app side of the host protocol (CONTRACT.md section 3): the handshake that gets a
// session from the portal, and access tokens refreshed through it.
import { HostConnectionError } from './errors';
import { createMockSession } from './mock';
import { HOSTED_APP_PARAM, hostedMode } from './mode';
import {
  AppMessage, appMessage, AppSessionInit, HelloMessage, HostMessage,
  isHostMessage, TokenRequestMessage
} from './protocol';
import { createSession, isExpiring, SessionWithTokens, TokenGrant } from './session';
import type { AppSession, ConnectOptions } from './types';
import { KIT_VERSION } from './version';

const HELLO_INTERVAL_MS = 250;
const CONNECT_TIMEOUT_MS = 10_000;
const TOKEN_TIMEOUT_MS = 10_000;

/**
 * The session the portal hands this app (or, with `?cirro-app=mock`, a mock session over
 * `options.mock`). Check `hostedMode()` first: a page that is not hosted throws.
 * Rejects with HostConnectionError when the portal does not answer in time.
 */
export async function connectToCirro(options: ConnectOptions): Promise<AppSession> {
  const mode = hostedMode();
  if (mode === 'portal') return connectToHost({ self: window, parent: window.parent, origin: window.location.origin }, options);
  if (mode === 'mock') {
    if (!options.mock) throw new Error(`?${HOSTED_APP_PARAM}=mock needs fixtures: pass them as ConnectOptions.mock.`);
    return createMockSession(options.appId, await options.mock());
  }
  throw new Error('This page is not hosted by Cirro; check hostedMode() before calling connectToCirro().');
}

/** The windows the handshake runs between: `window` and `window.parent` in the browser, fakes in tests. */
export interface HostWindows {
  /** Where the host's messages arrive. */
  self: EventTarget;
  parent: Pick<Window, 'postMessage'>;
  /** This page's origin, which must be the portal's. */
  origin: string;
}

export function connectToHost(host: HostWindows, options: ConnectOptions): Promise<AppSession> {
  const timeoutMs = options.timeoutMs ?? CONNECT_TIMEOUT_MS;
  const post = (message: AppMessage): void => host.parent.postMessage(message, host.origin);
  let receive: (message: HostMessage) => void = () => undefined;
  const onMessage = (event: Event): void => {
    const { origin, source, data } = event as MessageEvent;
    if (origin === host.origin && source === host.parent && isHostMessage(data)) receive(data);
  };
  host.self.addEventListener('message', onMessage);

  return new Promise((resolve, reject) => {
    const hello = (): void => post(appMessage<HelloMessage>({
      type: 'hello', appId: options.appId, appVersion: options.appVersion ?? null, kitVersion: KIT_VERSION,
    }));
    const interval = setInterval(hello, HELLO_INTERVAL_MS);
    const timeout = setTimeout(() => fail(new HostConnectionError(`Cirro did not answer within ${timeoutMs / 1000} s.`)), timeoutMs);
    const fail = (error: unknown): void => {
      clearInterval(interval);
      clearTimeout(timeout);
      host.self.removeEventListener('message', onMessage);
      reject(error);
    };

    receive = (message) => {
      if (message.type !== 'init') return;
      const { session: init } = message;
      if (init.app.id !== options.appId) {
        fail(new HostConnectionError(`Cirro sent a session for the app "${init.app.id}", but this is "${options.appId}".`));
        return;
      }
      clearInterval(interval);
      clearTimeout(timeout);
      try {
        const channel = hostChannel(init, post, () => host.self.removeEventListener('message', onMessage));
        receive = channel.receive;
        resolve(channel.session);
      } catch (error) {
        fail(error);
      }
    };
    hello();
  });
}

interface PendingToken {
  requestId: string;
  resolve: (grant: TokenGrant) => void;
  reject: (error: Error) => void;
}

/** A portal-mode session, and the handler for the host's later messages to it. */
function hostChannel(
  init: AppSessionInit,
  post: (message: AppMessage) => void,
  release: () => void
): { session: SessionWithTokens; receive: (message: HostMessage) => void } {
  let pending: PendingToken | null = null;

  const requestToken = (): Promise<TokenGrant> => new Promise<TokenGrant>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const settle = (): void => {
      clearTimeout(timer);
      pending = null;
    };
    const timer = setTimeout(() => {
      settle();
      reject(new HostConnectionError('Cirro did not send a fresh access token in time.'));
    }, TOKEN_TIMEOUT_MS);
    pending = {
      requestId,
      resolve: (grant) => { settle(); resolve(grant); },
      reject: (error) => { settle(); reject(error); },
    };
    post(appMessage<TokenRequestMessage>({ type: 'token-request', requestId }));
  });

  const session = createSession({
    mode: 'portal',
    init,
    refreshToken: requestToken,
    post,
    onDispose() {
      release();
      pending?.reject(new HostConnectionError('The Cirro session was disposed.'));
    },
  });

  const receive = (message: HostMessage): void => {
    if (message.type === 'token') {
      const grant = { accessToken: message.accessToken, accessTokenExpiresAt: message.accessTokenExpiresAt };
      session.acceptToken(grant);
      // The answer to the pending request, or a fresh token the host pushed.
      if (pending && (message.requestId === pending.requestId || !isExpiring(grant))) pending.resolve(grant);
    } else if (message.type === 'token-error' && message.requestId === pending?.requestId) {
      pending.reject(new HostConnectionError(message.message));
    }
  };

  return { session, receive };
}
