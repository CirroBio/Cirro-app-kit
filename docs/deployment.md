# Deploying a Cirro frontend

## Build-time config

| Variable | Production value |
| --- | --- |
| `VITE_CIRRO_URL` | The tenant's web address, such as `https://app.cirro.bio`. The app calls `/api` and `/authorize` under it |
| `VITE_CIRRO_CLIENT_ID` | Leave unset. The app gets its client ID from the tenant by its callback URL; this variable is only for local development |

`base` in `vite.config.ts` is the app's path, so the production callback URL is the host's address plus that path (for example `https://apps.example.org/qc-review/`); host the app there, and have each tenant register that URL. An app serving several tenants builds once and lists the tenants in a runtime `tenants.json`; see [serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant).

## Hosting

Any static host works (S3 + CloudFront, Netlify, GitHub Pages). Requirements:

- Serve over HTTPS at the registered callback URL: the host's address plus the app's path.
- If the app uses client-side routing, rewrite unknown paths to `index.html`. The sign-in redirect returns to the callback URL, so that path must load the app.

## Content Security Policy

Start from this and tighten it to the hosts you actually see in the network tab:

```
default-src 'self';
script-src 'self';
connect-src 'self' https://<cirro tenant> https://<token server> https://*.s3.amazonaws.com https://*.s3.<region>.amazonaws.com https://*.s3.dualstack.<region>.amazonaws.com;
img-src 'self' data: blob: https://*.s3.amazonaws.com;
style-src 'self';
frame-ancestors 'none';
```

Apps that read files with WebAssembly (h5wasm, DuckDB-WASM, Pyodide) need `'wasm-unsafe-eval'` in `script-src`, and `worker-src 'self' blob:` when the reader runs in a worker.

The Cirro tenant serves the API and the OAuth metadata document; the token server is the host of `token_endpoint` and `revocation_endpoint` in that document (Cirro's authorize page is a navigation, not a request). The SDK's S3 client uses dual-stack endpoints, hence the `s3.dualstack` host; the region is in the tenant's `/api/info/system` response.

## Before the first production deploy

- Connection requested and approved in each tenant the app serves: the production callback URL registered with discovery enabled. See [connecting to tenants](connecting-to-tenants.md).
- Run `python3 tools/scan.py <app dir>` and work through the [security checklist](security-checklist.md).
