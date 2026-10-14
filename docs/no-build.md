# Apps without a build step

The `@cirrobio` packages need a bundler, and the React ones need React, MUI and Emotion. Some apps can't take them: an existing app written as plain ES modules with no build step, a desktop program that serves its own pages, or a project with a no-dependencies rule. Such an app can still be a Public App and do everything the kit describes, by calling the same endpoints the packages call. It takes about 400 lines.

The working example is [CytoWeave](https://github.com/robert-mcdermott/cytoweave), a flow cytometry workbench that opens files from Cirro projects and saves analyses to them: [`web/lib/cirro.js`](https://github.com/sminot/cytoweave/blob/cirro-integration/web/lib/cirro.js) holds the parts that need no page (PKCE, SigV4, manifest handling), with tests against RFC 7636's and AWS's published examples; [`web/ui/cirro.js`](https://github.com/sminot/cytoweave/blob/cirro-integration/web/ui/cirro.js) holds sign-in and the API session. Both are Apache-2.0. Everything below was checked against dev.cirro.bio on 2026-10-12.

## Signing in

Register the app as a Public App, as for any other app ([app types and registration](app-types-and-registration.md)). Then:

1. `GET https://<tenant>/api/info/system` (no token) gives `auth.endpoint` (the Cognito domain), `region` and `tenantInfo.loginProviders`. Leave out the `COGNITO` provider; its emailed links can't return to an external app ([authentication](authentication.md#amplifyauthprovider)).
2. Make a PKCE verifier (32 random bytes, base64url) and its S256 challenge with `crypto.subtle.digest`.
3. Send the user to `https://<auth.endpoint>/oauth2/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope=openid` (Public Apps allow no other scope), `state`, `code_challenge`, `code_challenge_method=S256` and `identity_provider=<provider id>`.
4. On return, `POST https://<auth.endpoint>/oauth2/token` with a form body: `grant_type=authorization_code`, `client_id`, `code`, `redirect_uri` and `code_verifier`. The token endpoint answers cross-origin requests from the page.
5. Call the API with `Authorization: Bearer <access_token>`. The ID token's claims (`email`, `cognito:username`) name the user. Access tokens last 15 minutes; renew with `grant_type=refresh_token` before then, and keep the refresh token you have if the response carries none.

Keep tokens in memory. A sign-in then lasts until the window closes, and signing in again is quick while the user's Cognito session lasts.

### A pop-up, and what to do when it is blocked

A sign-in window keeps the app's page and its unsaved state. Open it before awaiting anything, so the click still allows a window: `window.open('', name, 'popup')`, then compute the challenge and set its `location`.

If the app's page sends `Cross-Origin-Opener-Policy: same-origin` (needed for `SharedArrayBuffer`), the window loses its link to the app as soon as it leaves for Cognito: `window.opener` is null on its return and the app can't see whether it was closed. Have the return page post `{ state, code }` on a `BroadcastChannel`, which any page of the same origin hears, and give the waiting dialog a Cancel button.

When pop-ups are blocked (`window.open` returns null), offer to sign in in the same window. Save the app's work and put `{ state, verifier, redirect }` in `sessionStorage`, go to the sign-in page, and on return finish the sign-in from that record and reopen the work.

### Apps served from this computer

Cognito accepts plain `http` only for `localhost`, so a desktop app registers `http://localhost:<port>` and must run on that port. An app that opens itself at `127.0.0.1` is a different origin from `localhost`, with its own storage and its own `BroadcastChannel`. Carry the page's host name in `state`, and have the return page at `localhost` move itself to the same path at that host, for loopback names only, so the page that is waiting gets the code. Show the exact sign-in address in the app, so users can pass it to their tenant's admins.

## The API

Call `https://<tenant>/api` + the path ([base path](calling-the-api.md#base-path)). The paths the packages call for the common tasks:

| Task | Request |
| --- | --- |
| Projects | `GET /projects` |
| A project's datasets | `GET /projects/{projectId}/datasets?limit=1000&nextToken=…` → `{ data, nextToken }` |
| One dataset (`share` set for a shared one) | `GET /projects/{projectId}/datasets/{datasetId}` |
| A dataset's files | `GET /projects/{projectId}/datasets/{datasetId}/files?fileOffset=…&fileLimit=…` → `{ domain, files, totalFiles }` |
| A dataset's samples and their metadata | `GET /projects/{projectId}/datasets/{datasetId}/samples` |
| File credentials | `POST /projects/{projectId}/s3-token` with `{ accessType, datasetId }` → `{ accessKeyId, secretAccessKey, sessionToken, expiration, region }` |
| A new dataset to upload to | `POST /projects/{projectId}/datasets/upload` with `{ name, description, processId, expectedFiles, tags }` → `{ id, uploadPath, bucket }` |
| A note on a dataset | `POST /discussions` with `{ name, description, entity: { type: 'DATASET', id }, type: 'NOTES', projectId }`, then `POST /discussions/{id}/messages` with `{ message }` |

Some successful calls return an empty body (posting a message), so parse the body only when there is one. A 401 means the sign-in ended; a 403 is a refusal by the user's role or the app's registration ([permissions](permissions.md)), and its `message` can be empty.

## Files

`accessType` is `PROJECT_DOWNLOAD` to read a project's files, `SHARED_DATASET_DOWNLOAD` with the `datasetId` for a dataset shared from another project, and `DATASET_UPLOAD` with the `datasetId` to upload to a new dataset. Keep download credentials until shortly before `expiration` and let concurrent reads share one request; the endpoint answers 429 to several at once ([files](files.md)).

Sign each request with SigV4 query-string authentication: method, the key's path with each segment encoded, the `X-Amz-*` parameters including `X-Amz-Security-Token`, `host` as the only signed header, and `UNSIGNED-PAYLOAD`. The host is `<bucket>.s3.dualstack.<region>.amazonaws.com`; a file's bucket and key come from the manifest's `domain` (`s3://<bucket>/datasets/<datasetId>`) and the file's `path`. Read with a GET (never HEAD; take sizes from the manifest), and upload each file with one PUT to `uploadPath` + `/` + its name (S3 takes up to 5 GB in one PUT).

## Content Security Policy

The page connects to the tenant, its Cognito domain and S3: `connect-src 'self' https://<tenant> https://*.amazoncognito.com https://*.amazonaws.com`, or `https://*.cirro.bio` for every tenant under cirro.bio. A program that serves its own pages to users who must keep data on their computer can offer a switch that sets `connect-src 'self'` and hides the Cirro features, as CytoWeave's `--no-cirro` does.
