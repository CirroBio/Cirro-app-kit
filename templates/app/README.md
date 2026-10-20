# App template

A React + Vite starter for a Cirro app (portal, dashboard, workflow tool). It signs users in through Cirro's authorize page, shows which tenant you're in, lists your projects, and lists a project's datasets with their IDs.

```bash
cp .env.example .env      # set VITE_CIRRO_URL (and VITE_CIRRO_CLIENT_ID for local development)
npm install
npm run dev
```

- The app runs under its own path, `base` in `vite.config.ts` (`/cirro-app/`; rename it to your app's slug), and its callback URL is the origin plus that path, for example `http://localhost:5173/cirro-app/`. The tenant finds the app's registration by that URL.
- Register the callback URL first; see [getting started](../../docs/getting-started.md). With your own App Developer registration, put its client ID in `VITE_CIRRO_CLIENT_ID`. Without one, the app asks the tenant for the client ID of the discoverable registration a tenant admin set up. If `.env` is incomplete, the app shows what's missing instead of failing at sign-in.
- `VITE_CIRRO_URL` is the tenant's web address. The app calls the API at `/api` under it, in development and production alike; see [deployment](../../docs/deployment.md).
- `src/config.ts` checks `.env`; `src/auth.ts` sets up sign-in through Cirro's authorize page with oidc-client-ts; `src/main.tsx` loads the tenant's config, finishes or starts sign-in, and creates the `DataService`; `src/App.tsx` is where your app starts. See [authentication](../../docs/authentication.md).
- The app can't read the user's project role under a typical registration, so it offers actions and lets a 403 from the server decide; see [permissions](../../docs/permissions.md#checking-before-offering-an-action).

`cirro-permissions.json` lists the permissions the template uses. Update it whenever you add API calls, and give it to the tenant admin who approves the app; see [permissions](../../docs/permissions.md).
