# Cirro TypeScript packages

Use Cirro's published packages rather than generating your own client. Both come from [CirroBio/Cirro-client-ts](https://github.com/CirroBio/Cirro-client-ts) and are still pre-1.0, so pin exact versions.

| Package | Version verified | Role |
| --- | --- | --- |
| [@cirrobio/api-client](https://www.npmjs.com/package/@cirrobio/api-client) | 0.13.38 | Generated REST client: typed models, and the API classes `DataService` bundles |
| [@cirrobio/sdk](https://www.npmjs.com/package/@cirrobio/sdk) | 0.13.38 | `DataService`, file access and S3 signing, uploads |

Sign-in isn't in these packages. The [app template](../templates/app) uses [oidc-client-ts](https://www.npmjs.com/package/oidc-client-ts) 3.5.0 for the [authorize flow](authentication.md), and hands `DataService` a token getter.

Call the API through `DataService`, not by constructing API classes; see [calling the API](calling-the-api.md). Use the api-client for its types (`Project`, `Dataset`, enums such as `ProjectAccessType`).

## Coming in the next release

`DataService` in 0.13.38 has no getter for Sheets, notes and discussions, dashboards or app registrations, and its `ApiError` carries no HTTP status. [Cirro-client-ts#158](https://github.com/CirroBio/Cirro-client-ts/pull/158), not yet released, adds `data.sheets`, `data.feed`, `data.dashboards` and `data.appRegistrations` (plus `data.metrics` and `data.sharedFilesystems`), and an `errorCode` on `ApiError`. The kit's examples for those features use the new getters, and need the release that includes it.
