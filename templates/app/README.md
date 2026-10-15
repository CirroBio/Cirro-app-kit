# App template

A React + Vite starter for a Cirro app (portal, dashboard, workflow tool). It signs in with Cirro's login UI, shows which tenant you're in, lists your projects, and lists a project's datasets with their IDs.

```bash
cp .env.example .env      # set VITE_CIRRO_CLIENT_ID and CIRRO_PROXY_TARGET
npm install
npm run dev
```

- You need a client ID from a development registration first; see [getting started](../../docs/getting-started.md). If `.env` is incomplete, the app shows what's missing instead of failing at sign-in.
- In development, `VITE_CIRRO_API=/api` sends API calls through the Vite proxy to `CIRRO_PROXY_TARGET`. In production, set it to the tenant API URL; see [deployment](../../docs/deployment.md).
- `src/config.ts` checks `.env`; `src/main.tsx` wires `AppConfigProvider`, `ConfigGate`, `AuthenticationContextProvider` and `LoginWrapper`; `src/App.tsx` is where your app starts.
- `src/auth.ts` is `CirroAuthProvider`: `AmplifyAuthProvider` asking only for the `openid` scope, without the emailed-link option. See [known issues](../../docs/packages.md#known-issues).
- The app can't read the user's project role under a typical registration, so it offers actions and lets a 403 from the server decide; see [permissions](../../docs/permissions.md#checking-before-offering-an-action).

`cirro-permissions.json` lists the permissions the template uses. Update it whenever you add API calls, and give it to the admin who registers the app; see [permissions](../../docs/permissions.md).

Two deliberate workarounds for [known package issues](../../docs/packages.md#known-issues): `@aws-amplify/auth` is a direct dependency, and `tsconfig.json` sets `strictFunctionTypes: false`. When bumping versions, run `npm install && npm run build` and drop them if they're no longer needed.
