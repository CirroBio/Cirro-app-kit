# Cirro TypeScript packages

Use Cirro's published packages rather than generating your own client. All five come from [CirroBio/Cirro-client-ts](https://github.com/CirroBio/Cirro-client-ts) and are still pre-1.0, so pin exact versions.

| Package | Version verified | Role | Depends on |
| --- | --- | --- | --- |
| [@cirrobio/api-client](https://www.npmjs.com/package/@cirrobio/api-client) | 0.13.37 | Generated REST client (openapi-generator `typescript-fetch`): one class per resource, typed models | Nothing |
| [@cirrobio/sdk](https://www.npmjs.com/package/@cirrobio/sdk) | 0.13.37 | `DataService` bundling the API classes, the `AuthenticationProvider` interface, file access and S3 signing | api-client, AWS S3 SDK |
| [@cirrobio/react-core](https://www.npmjs.com/package/@cirrobio/react-core) | 0.0.4 | `AppConfigProvider` (loads tenant config from `/info/system`), `useAppConfig`, `InteractiveAuthenticationProvider` | sdk, React |
| [@cirrobio/react-auth](https://www.npmjs.com/package/@cirrobio/react-auth) | 0.0.8 | `AmplifyAuthProvider`, `useAuthenticator`, login UI (`LoginWrapper`, `LoginModal`, `LoginOptions`) | react-core, aws-amplify, MUI 7 |
| [@cirrobio/react-tool](https://www.npmjs.com/package/@cirrobio/react-tool) | 0.0.10 | `ViewerProvider` for viewers and tools: project, dataset and file state plus services | all of the above, MUI 7 |

## How they fit together

The api-client makes HTTP calls; the sdk adds auth plumbing and file access on top; the React packages wire those into providers and hooks. Pick the lowest layer that fits:

- **Non-React app:** `api-client` + `sdk`.
- **React app with Cirro's login UI:** add `react-core` + `react-auth` ([app template](../templates/app)).
- **Viewer or tool:** start from `react-tool` ([viewer template](../templates/viewer)).

The key extension point is the sdk's `AuthenticationProvider` interface: `configure(systemInfo)`, `getAccessToken()`, `getCurrentUser()` and `forceRefresh()`. Every higher layer asks it for tokens, so any login method that implements those four methods works. The React packages require the extended `InteractiveAuthenticationProvider`; see [authentication](authentication.md).

## Known issues

Verified with clean installs and builds on 2026-10-10. Check whether newer versions have fixed these before applying the workarounds.

- **`react-auth` 0.0.8 imports `@aws-amplify/auth` without declaring it.** npm may nest it under `aws-amplify`, and Vite then fails with "failed to resolve import @aws-amplify/auth". Add it as a direct dependency pinned to the exact version `aws-amplify` uses (`npm ls @aws-amplify/auth`), so only one copy, and one auth state, exists.
- **`react-auth` 0.0.8's login UI crashes if it mounts before the tenant config loads.** `AppConfigProvider` renders its children while `/info/system` is still loading. `AuthenticationContextProvider` then checks the session before the auth provider is configured, never re-checks, and `LoginWrapper`'s login modal throws reading the tenant's login providers ("Cannot read properties of undefined (reading 'some')"), leaving a blank page for signed-out users. Render the auth tree only once `useAppConfig().loadState === "LOADED"`, as the app template's `ConfigGate` does. `ViewerProvider` already gates this way.
- **`AmplifyAuthProvider` requests five OAuth scopes, and Cognito rejects the sign-in if the registration disallows any of them.** Both templates use `CirroAuthProvider` (`src/auth.ts`), which asks for `openid` only. See [authentication](authentication.md#amplifyauthprovider).
- **`AmplifyAuthProvider` fails strict type-checking.** Under TypeScript `strict`, it isn't assignable to `InteractiveAuthenticationProvider` because of a `registerAuthEventHandler` signature mismatch. Set `strictFunctionTypes: false` until the packages fix the signature.
- **`ApiError` drops the HTTP status code.** The sdk's error handler keeps the server's message but not `response.status`, so apps can't distinguish a 403 from other errors. For calls where that matters, use an API class with a plain `Configuration`, which throws `ResponseError` with the response; see [calling the API](calling-the-api.md#errors).
- **`react-tool` 0.0.10's embedded message handler doesn't check `event.origin`.** Any window can post it configuration. Don't patch around it in your tool; report it to the Cirro platform team.

Both templates include the dependency and type-checking workarounds and `CirroAuthProvider`; the app template also includes `ConfigGate`.
