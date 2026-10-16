# Cirro TypeScript packages

Use Cirro's published packages rather than generating your own client. Both come from [CirroBio/Cirro-client-ts](https://github.com/CirroBio/Cirro-client-ts) and are still pre-1.0, so pin exact versions.

| Package | Version verified | Role |
| --- | --- | --- |
| [@cirrobio/api-client](https://www.npmjs.com/package/@cirrobio/api-client) | 0.13.39 | Generated REST client: typed models, and the API classes `DataService` bundles |
| [@cirrobio/sdk](https://www.npmjs.com/package/@cirrobio/sdk) | 0.13.39 | `DataService`, file access and S3 signing, uploads |

Sign-in isn't in these packages. The [app template](../templates/app) uses [oidc-client-ts](https://www.npmjs.com/package/oidc-client-ts) 3.5.0 for the [authorize flow](authentication.md), and hands `DataService` a token getter.

Call the API through `DataService`, not by constructing API classes: since 0.13.39 it covers every area an app uses, including Sheets (`data.sheets`), notes (`data.feed`), dashboards and app registrations, and `ApiError` carries the HTTP status as `errorCode`; see [calling the API](calling-the-api.md). Use the api-client for its types (`Project`, `Dataset`, enums such as `ProjectAccessType`).
