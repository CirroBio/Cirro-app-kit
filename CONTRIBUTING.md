# Contributing

## Keep docs as the single source of truth

Facts about Cirro (permission names, redirect rules, package APIs, known issues) belong in `docs/`. The skills in `skills/` should link to docs rather than restate them; if you find yourself copying a fact into a skill, put it in the docs and link instead.

## When the Cirro packages publish a new version

1. Bump the `@cirrobio/*` pins in the app template (exact versions).
2. In the template: `npm install && npm run build`. Read the release notes for anything that replaces code the kit or the template writes by hand, and use it.
3. Regenerate the API reference: `python3 tools/api_surface.py templates/app/node_modules > reference/api-surface.md`, then restore the explanatory header.
4. Update the version table in `docs/packages.md` and "Verified against" in `README.md`.
5. Skim `git diff reference/` for renamed or removed methods and fix any docs that use them.

## When platform behavior changes

Describe how Cirro works on the page a reader would look for it, as guidance: what to do, not a list of what's missing. When the platform changes, update those pages. Questions for the platform team and bugs go to Cirro's issue tracker, not the docs.

## Checks before opening a PR

- The app template builds.
- `python3 tools/scan.py templates/app` reports no findings.
- Relative links in `docs/` resolve (CI checks this).
- The docs site builds without warnings: `pip install "mkdocs==1.6.1" "mkdocs-material==9.7.7" && mkdocs build --strict` (CI checks this; `mkdocs serve` previews it). Add new pages to `nav` in `mkdocs.yml`.

## The docs site

Every push to `main` publishes `README.md`, `docs/`, `reference/`, the app template's README and `CONTRIBUTING.md` as the guide's public website, https://cirrobio.github.io/Cirro-app-kit/ (GitHub Pages; the repository itself stays internal). The pages are the Markdown as written; `site-hooks/pages.py` sends links to code (templates, tools) to GitHub, so write relative links that work on GitHub and the site follows.

`README.md` is both the repository's front page and the site's home page. Wrap text that only belongs on GitHub (repository layout, a pointer to the site) in `<!-- repo-only -->` and `<!-- /repo-only -->`, and put text that only belongs on the site in a `<!-- site-only` … `-->` comment, which GitHub hides and the site shows. Other pages should read the same in both places: say "the repository" and "this guide" rather than "this repo" or "this file".

## Working on the Claude plugin

`.claude-plugin/marketplace.json` makes the repository a marketplace whose one plugin is the repository itself (`plugin.json`, skills in `skills/`). To work on it, add your clone as a local marketplace once:

```text
/plugin marketplace add /path/to/Cirro-app-kit
/plugin install cirro-app-kit@cirro-app-kit
```

Claude Code then loads the skills from your clone, so edits apply to the next session that uses a skill; there's nothing to reinstall. Before opening a PR, run `claude plugin validate .`. Bump `version` in `plugin.json` when skills change, so installs from GitHub pick up the update.
