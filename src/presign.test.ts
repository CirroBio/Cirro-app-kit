import { presignS3 } from './presign';

const signature = (url: string) => new URL(url).searchParams.get('X-Amz-Signature');

describe('presignS3', () => {
  it('matches AWS\'s published query-string example (GET examplebucket/test.txt)', async () => {
    const url = await presignS3({
      method: 'GET',
      bucket: 'examplebucket',
      key: 'test.txt',
      host: 'examplebucket.s3.amazonaws.com',
      credentials: { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' },
      expiresInSeconds: 86400,
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(signature(url)).toBe('aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });

  // Expected signatures from @smithy/signature-v4 (the AWS SDK's signer) presigning the same
  // requests with UNSIGNED-PAYLOAD and only `host` signed; it also reproduces the example above.
  const production = {
    bucket: 'project-1234',
    key: 'datasets/d1/data/figures/fig 1 (a).png',
    credentials: { accessKeyId: 'ASIAEXAMPLE', secretAccessKey: 'secret/key+example', sessionToken: 'session/token+==', region: 'us-west-2' },
    expiresInSeconds: 3600,
    now: new Date('2026-10-06T12:34:56Z'),
  };

  it('signs a PUT', async () => {
    expect(signature(await presignS3({ method: 'PUT', ...production }))).toBe('df48325dcf98a12220f7b817b2d1644d06917ac50fec0968c624cf78f301d4a6');
  });

  it('signs a GET of the same object differently', async () => {
    expect(signature(await presignS3({ method: 'GET', ...production }))).toBe('59a3a806523a582eb1910422994f9e51a0d458dc5910f6ad02ae7c4c9987a40f');
  });

  it('uses the dual-stack host of the credentials\' region, a per-segment RFC 3986 path and the session token', async () => {
    const url = new URL(await presignS3({ method: 'GET', ...production, key: 'datasets/abc/data/af3 out/model (1)*.cif' }));
    expect(url.hostname).toBe('project-1234.s3.dualstack.us-west-2.amazonaws.com');
    expect(url.pathname).toBe('/datasets/abc/data/af3%20out/model%20%281%29%2A.cif');
    expect(url.searchParams.get('X-Amz-Security-Token')).toBe('session/token+==');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Credential')).toBe('ASIAEXAMPLE/20261006/us-west-2/s3/aws4_request');
  });

  it('needs the region', async () => {
    await expect(presignS3({ method: 'GET', ...production, credentials: { ...production.credentials, region: undefined } }))
      .rejects.toThrow('region');
  });
});
