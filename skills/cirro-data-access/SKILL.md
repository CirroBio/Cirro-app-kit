---
name: cirro-data-access
description: Call the Cirro API and read or upload Cirro files from TypeScript or JavaScript using @cirrobio/sdk and @cirrobio/api-client. Use this whenever code needs to list projects, datasets, processes or pipeline runs, read dataset files or manifests, get presigned S3 URLs, upload files, or handle Cirro API errors in a browser or Node app, even if the user just says "fetch my Cirro data" or "show the files from this dataset". Also use it before writing any call against a Cirro API class, because method names come from a generated client and are easy to guess wrong.
---

# Cirro data access

Use Cirro's published packages, not hand-written `fetch` calls or a newly generated client. Read `${CLAUDE_PLUGIN_ROOT}/docs/calling-the-api.md` for setup, pagination and errors, and `${CLAUDE_PLUGIN_ROOT}/docs/files.md` before writing any file code.

## Before writing a call

Method and field names come from a generated client and are easy to guess wrong.

1. Check installed versions: `npm ls @cirrobio/sdk @cirrobio/api-client`.
2. If they match the version in `${CLAUDE_PLUGIN_ROOT}/reference/api-surface.md`, look up the method there and in `${CLAUDE_PLUGIN_ROOT}/reference/models.md`.
3. If they differ, regenerate: `python3 ${CLAUDE_PLUGIN_ROOT}/tools/api_surface.py node_modules > /tmp/cirro-api.md` and use that. Tell the user the bundled reference was stale.
4. If a name still isn't there: `grep -rn "name" node_modules/@cirrobio/api-client/dist/apis/`.

## Decisions

- **Where the DataService comes from.** Under `AppConfigProvider` (the app template): `useAppConfig().dataService`. Otherwise one module-level instance.
- **Base path.** If the project has no API URL configured, ask which tenant they target rather than guessing; the deployed form is `https://<tenant>/api` (`${CLAUDE_PLUGIN_ROOT}/docs/calling-the-api.md#base-path`), never `https://api.<tenant>`, which browsers can't read.
- **Files.** Pick the access context by what is being read (`datasetDownload` handles shared datasets); store `FileSystemObject`s and sign at the moment of use; keep credentials in memory.
- **Uploads.** Create the dataset with `uploadDataset`, then upload under the returned path, as in the files doc. Ask which data type (process) the user is uploading if it isn't clear.

## Permissions

- When adding a call to a new API, add its permission to `cirro-permissions.json` (required or optional, with a reason or feature), per `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md`.
- Handle a 403 on every action with a message saying who can fix it, and disable that action for the project afterwards. Gate on the user's role only if the registration can read it (usually it can't; see the permissions doc).
- Check every permission a multi-step flow needs at the start of the flow.

## Provenance and cost

- When code creates a dataset, workspace or pipeline run, also add a provenance note, and tag every taggable entity with `cirro-app: <APP_ID>`, following "Provenance by default" and "Tag everything the app creates" in `${CLAUDE_PLUGIN_ROOT}/docs/building-on-cirro.md`. For long-running work, use `${CLAUDE_PLUGIN_ROOT}/docs/workspaces.md`.
- Before code that spends money (pipeline runs, workspaces; see cirro-compute), add a cost estimate and an explicit confirmation step. Treat governance actions (roles, shares) per the trust-boundaries table in the same doc.

## Errors to explain, not retry

A CORS failure on file reads while API calls succeed is a bucket CORS setting (admin task). A 403 is a missing permission on the registration or the user's project role. Explain these to the user instead of changing code.

## Hand-offs

- Records the app creates or curates, or tables people will query: use cirro-sheets rather than an external database or CSVs in datasets.
- Running pipelines or starting workspaces: use cirro-compute.
- Deciding which permissions to declare, or handling 403s across the app: use cirro-permissions.
