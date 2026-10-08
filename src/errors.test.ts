import { CirroApiError, HostConnectionError, isLastingFailure } from './errors';

describe('isLastingFailure', () => {
  it('counts refusals and unreadable data as lasting, and connection, session and server trouble as passing', () => {
    expect(isLastingFailure(new CirroApiError('Not found', 404, []))).toBe(true);
    expect(isLastingFailure(new CirroApiError('Forbidden', 403, []))).toBe(true);
    expect(isLastingFailure(new Error('Not an FCS file'))).toBe(true);
    expect(isLastingFailure(new CirroApiError('Unavailable', 503, []))).toBe(false);
    expect(isLastingFailure(new CirroApiError('Slow down', 429, []))).toBe(false);
    expect(isLastingFailure(new CirroApiError('Expired', 401, []))).toBe(false);
    expect(isLastingFailure(new HostConnectionError('No token'))).toBe(false);
    expect(isLastingFailure(new TypeError('Failed to fetch'))).toBe(false);
    expect(isLastingFailure(new DOMException('Aborted', 'AbortError'))).toBe(false);
  });
});
