# Contributing

## Keep docs as the single source of truth

Facts about Cirro (permission names, redirect rules, package APIs, known issues) belong in `docs/`. The skills in `skills/` should link to docs rather than restate them; if you find yourself copying a fact into a skill, put it in the docs and link instead.

## When the Cirro packages publish a new version

1. Bump the `@cirrobio/*` pins in both templates (exact versions).
2. In each template: `npm install && npm run build`. If the [known-issue](docs/packages.md#known-issues) workarounds are no longer needed, remove them and update `docs/packages.md`.
3. Regenerate the API reference: `python3 tools/api_surface.py templates/app/node_modules > reference/api-surface.md` (the viewer template's `node_modules` also works), then restore the explanatory header.
4. Update the version table in `docs/packages.md` and "Verified against" in `README.md`.
5. Skim `git diff reference/` for renamed or removed methods and fix any docs that use them.

## When platform behavior is confirmed

Move the answer from `docs/open-questions.md` into the doc it affects, and remove any "not yet confirmed" caveats that referred to it.

## Checks before opening a PR

- Both templates build.
- `python3 tools/scan.py templates/app` and `templates/viewer` report no findings.
- Relative links in `docs/` resolve (CI checks this).
