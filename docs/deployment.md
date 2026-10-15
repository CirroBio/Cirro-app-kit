# Deploying a Cirro frontend

## Build-time config

| Variable | Production value |
| --- | --- |
| `VITE_CIRRO_URL` | The tenant's web address, such as `https://app.cirro.bio`. The app calls `/api` and `/authorize` under it |
| `VITE_CIRRO_CLIENT_ID` | The registered app's client ID for that tenant |

Build once per tenant; client IDs differ between tenants. An app serving several tenants instead ships a runtime `tenants.json` and builds once; see [serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant).

## Hosting

Any static host works (S3 + CloudFront, Netlify, GitHub Pages). Requirements:

- Serve over HTTPS on an origin listed in the registration's redirect URIs.
- If the app uses client-side routing, rewrite unknown paths to `index.html`. The sign-in redirect returns to the registered redirect URI (the template's is the origin root, or Vite's `base` under a path), so that path must load the app.

## Content Security Policy

Start from this and tighten it to the hosts you actually see in the network tab:

```
default-src 'self';
script-src 'self';
connect-src 'self' https://<cirro tenant> https://<cognito domain> https://*.s3.amazonaws.com https://*.s3.<region>.amazonaws.com https://*.s3.dualstack.<region>.amazonaws.com;
img-src 'self' data: blob: https://*.s3.amazonaws.com;
style-src 'self';
frame-ancestors 'none';
```

Apps that read files with WebAssembly (h5wasm, DuckDB-WASM, Pyodide) need `'wasm-unsafe-eval'` in `script-src`, and `worker-src 'self' blob:` when the reader runs in a worker. Range reads from the browser need the project bucket's CORS to allow the `Range` request header.

The Cirro tenant serves the API; the Cognito domain issues and renews tokens (no browser request goes to Cirro's authorize page, which is a navigation). The SDK's S3 client uses dual-stack endpoints, hence the `s3.dualstack` host. The region and Cognito domain come from the tenant's `/info/system` response (`region`, `auth.endpoint`).

## Before the first production deploy

- Connection requested and approved in each tenant the app serves, with the production origin in the redirect URIs. See [connecting to tenants](connecting-to-tenants.md).
- Project bucket CORS allows the production origin (Cirro admin request) if the app reads files directly.
- Run `python3 tools/scan.py <app dir>` and work through the [security checklist](security-checklist.md).
