// S3 URLs presigned with AWS Signature Version 4 query parameters, using WebCrypto
// (https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html).
// Ported from Cirro-tools tools/proteoscope/cirro-bridge.js.

/** The temporary credentials Cirro's s3-token endpoint returns (`AWSCredentials`). */
export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface PresignRequest {
  method: 'GET' | 'PUT';
  bucket: string;
  key: string;
  credentials: S3Credentials;
  expiresInSeconds: number;
  now?: Date;
  /** Overridable only so tests can use AWS's published example host. */
  host?: string;
}

const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer): string => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

// RFC 3986 encoding, as SigV4 requires.
const encode = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function hmac(key: string | ArrayBuffer, text: string): Promise<ArrayBuffer> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(text));
}

export async function presignS3({ method, bucket, key, credentials, expiresInSeconds, now = new Date(), host }: PresignRequest): Promise<string> {
  const { region } = credentials;
  if (!region) throw new Error('Cirro did not say which AWS region holds these files.');
  const hostname = host ?? `${bucket}.s3.dualstack.${region}.amazonaws.com`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const path = `/${key.split('/').map(encode).join('/')}`;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  if (credentials.sessionToken) query['X-Amz-Security-Token'] = credentials.sessionToken;
  const canonicalQuery = Object.keys(query).sort().map((k) => `${encode(k)}=${encode(query[k])}`).join('&');
  const canonicalRequest = [method, path, canonicalQuery, `host:${hostname}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, toHex(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))].join('\n');
  let signingKey = await hmac(`AWS4${credentials.secretAccessKey}`, day);
  for (const part of [region, 's3', 'aws4_request']) signingKey = await hmac(signingKey, part);
  const signature = toHex(await hmac(signingKey, stringToSign));
  return `https://${hostname}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
