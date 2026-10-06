# @cirrobio/app-kit

The app side of Cirro Apps: what a Cirro-tools app uses to talk to Cirro when the
portal hosts it at `/apps/<appId>`. It receives the user's session from the portal,
calls the Cirro API with `@cirrobio/api-client`, reads and writes dataset files, keeps
the app's own data in per-user tables, and indexes what the user can open.

[`CONTRACT.md`](CONTRACT.md) is the specification shared by the portal (the host), this
kit, Cirro-tools (packaging) and the apps. The portal imports this package for the
protocol types and guards, so both sides of the wire compile against one definition.

## Development

```bash
yarn build       # dist/: cjs + esm + types
yarn test
yarn type-check
```
