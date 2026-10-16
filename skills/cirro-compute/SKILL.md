---
name: cirro-compute
description: Launch and track Cirro pipeline runs and interactive workspaces from a browser app, as the signed-in user. Use this whenever a Cirro app needs to run a pipeline or analysis on datasets (runAnalysis), show run status, tasks, logs or cost, stop a run, ship its own Nextflow or Cromwell pipeline alongside the frontend, or start a JupyterLab, RStudio, VS Code or custom-container workspace with datasets mounted and hand the user into it, including handling boot time, the per-user workspace limit, auto-stop and getting results back. Use it even when the user just says "let users run X from the app" or "open this in a notebook".
---

# Pipelines and workspaces from an app

Both spend the user's project money, so every launch needs a cost note and an explicit confirmation (the trust-boundaries table in `${CLAUDE_PLUGIN_ROOT}/docs/building-on-cirro.md`). Read the docs named below before writing code; look up methods in `${CLAUDE_PLUGIN_ROOT}/reference/api-surface.md` (`ExecutionApi`, `ProcessesApi`, `WorkspacesApi`), checking the installed version first as cirro-data-access describes.

## 1. Which kind of compute

Ask what the work is if it isn't clear:

| Work | Use |
| --- | --- |
| Batch, defined inputs and outputs | Pipeline run; outputs become a new dataset |
| Interactive, too heavy for the browser | Workspace, opened in a new tab |
| Fits in browser memory | Neither; do it in the app |

## 2. Pipeline runs

Read "Capability map" and "An app that ships its own pipeline" in the building-on-cirro doc.

- Which pipeline: an existing Cirro process (find its ID with `ProcessesApi`), or one shipped in the app's repo. Registering a pipeline (`createCustomProcess`, `syncCustomProcess`) is a one-time maintainer step, not something the app does per user; pin it to the same release tag as the frontend.
- Build the form from `getProcessParameters` rather than duplicating the parameter schema.
- Before submitting, show an estimate from recent completed runs' `calculateCost` (load it in the background; it can take ~20 s). `calculatePipelineCost` returned no estimate on dev.cirro.bio, so don't rely on it.
- Submit with `runAnalysis`, setting `tags` to `cirro-app: <APP_ID>` in the request, then add a provenance note to the output dataset ("Provenance by default" in the same doc).
- Track status from Cirro, not app state, so the app can be closed and reopened: `getTasksForExecution` for progress and duration (tasks' `requestedAt`/`stoppedAt`), `getExecutionLogs` on failure. Offer `stopAnalysis` with a confirmation.
- Detect a refused launch from the `ApiError` (message "Not allowed to …", or `errorCode` 403 from the next sdk release), as in "Errors" in `${CLAUDE_PLUGIN_ROOT}/docs/calling-the-api.md`.

## 3. Workspaces

Read `${CLAUDE_PLUGIN_ROOT}/docs/workspaces.md` in full; most of its rules exist because users otherwise think the app is broken.

- Reuse before creating: list workspaces, find the app's by name prefix (`my-app / purpose`; workspaces have no tags) and offer to restart a stopped (`COMPLETED`) one.
- `createWorkspace` starts it by itself; don't call `startWorkspace` after it. Always set `autoStopTimeout` (1-2 hours) and mount only the datasets in use. Pick the environment from `getWorkspaceEnvironments`.
- Say up front that booting takes minutes, then show elapsed time and status while polling every 10-15 s, without blocking the rest of the UI.
- At the per-user limit, list the user's workspaces and offer reuse or deletion of one they pick, with a warning that unsaved files are lost.
- Open it in a new tab: open the tab synchronously in the click handler, then call `connectWorkspace` on every click and set the tab's location (the URL is single-use and expires in about 5 minutes). It can't be iframed.
- While the user is active, `postponeAutoStop` periodically; show the auto-stop time with extend and stop buttons.
- Decide with the user how results come back (saved dataset, a sheet, a known path) and tell the end user.

## 4. Permissions

Add what the code uses to `cirro-permissions.json`, usually as optional permissions tied to the feature: `RUN_ANALYSIS`, `STOP_ANALYSIS`, `VIEW_DATASET_LOGS` for runs; `CREATE_WORKSPACE`, `CONTROL_WORKSPACE`, `OPEN_WORKSPACE` for workspaces. Check them all at the start of a flow, not after the user has filled in a form. See cirro-permissions.
