# Architecture

This kit builds **front-end-only apps**: everything runs in the browser, there is no back-end of your own, and you deploy nothing but static files. The user signs in with their own Cirro account, and the app acts as that user — their existing Cirro permissions and project roles are fully respected.

That constraint is the point, not a limitation. It lets a community of developers build, share and modify Cirro apps seamlessly, because shipping one is just hosting static files — no servers to run, no secrets to guard, no user database to manage. The app template in this repo works this way.

## How a front-end app is wired

```mermaid
flowchart LR
  app["Your app<br/>(browser, tokens in memory)"]
  login["Cirro login<br/>(Cognito)"]
  api["Cirro API"]
  s3["Project S3 bucket"]
  app -- "sign in: code + PKCE" --> login
  app -- "API calls: bearer token" --> api
  app -- "file reads: signed URLs" --> s3
```

The app signs the user in with the authorization code flow and PKCE (no client secret — see [authentication](authentication.md)), calls the Cirro API with the resulting bearer token, and reads files with short-lived signed URLs. Every call is made as the signed-in user. The app is registered as a **Public App**; because the code is shipped to the browser, it holds no secret, and its only security concern is keeping the token safe from XSS on your own page.

## Beyond this kit: apps with a back-end

Cirro also supports apps that run their own back-end. A back-end can hold credentials that never reach the browser, and it can give the app a permission scope of its own, distinct from any individual user's — for example a service that ingests instrument data on a schedule with no user present, or an app that performs actions the signed-in user couldn't perform directly.

That power comes with a different job: once an app has its own identity and permissions, it also has to manage its own authentication and authorization — deciding who may use it and what each person is allowed to do — rather than leaning entirely on Cirro for that. It's a genuinely larger undertaking, and it's why this kit deliberately stops at the front-end-only model. If you need it, treat it as a back-end project and start from the Cirro documentation at [docs.cirro.bio](https://docs.cirro.bio); this kit won't cover it.
