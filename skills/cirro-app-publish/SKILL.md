---
name: cirro-app-publish
description: Draft. Release a new version of a Cirro app: bump the version, validate, pack, and register it at the app registry.
---

# Release a version (draft)

Follow `docs/publishing.md`.

1. Bump `version` in `cirro-app.json`. It must be higher than every version already
   uploaded.
2. If the version asks for new permissions, say so in the release notes: each tenant's
   admin must approve it before they move to it.
3. Run `cirro-app validate dist`, then `cirro-app pack dist`.
4. Upload the zip on the app's **Versions** tab at the registry. For a public app, submit
   it for review.
5. To try it with one tenant first, set that tenant's version under **Access → Version
   for each tenant**.

`cirro-app publish` will automate steps 3 and 4. It isn't available yet.
