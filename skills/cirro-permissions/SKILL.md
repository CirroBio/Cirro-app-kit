---
name: cirro-permissions
description: Decide which Cirro permissions a browser app needs, write or update its cirro-permissions.json manifest, and make the UI behave correctly when a user or the app's registration can't do something (403s, read-only users, optional permissions an admin didn't grant). Use this whenever someone adds a Cirro API call, asks which permissions to request or register, prepares a permission list for an admin, sees "Not allowed to ..." or a 403 from Cirro, wants to hide or disable actions by role, or asks why a feature works for them but not for a collaborator.
---

# Cirro app permissions

Read `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md` first: it explains the two layers (what the registration allows, what the user's project role allows) and the manifest format. Likely permission names for each API are in the capability map in `${CLAUDE_PLUGIN_ROOT}/docs/building-on-cirro.md`; they are inferred from names, so confirm them against the 403s seen while testing.

## 1. Build or update the manifest

1. List the Cirro calls the code makes: `grep -rn "dataService\.\|data\.\w\+\." src`.
2. Map each to a permission with the capability map (and the doc for Sheets, workspaces or files where it has its own table).
3. Sort them: **required** only if the app can't do its core job without it; everything else is **optional**, tied to one named feature.
4. Write each `reason`/`feature` for an admin reviewing it: what the user sees, not "API access".
5. Default to `"scope": "project"`. Use `global` only with a reason the user agrees to.
6. Flag anything in the trust-boundaries "Govern" row (roles, shares, `MANAGE_MEMBERS`). Don't add `MANAGE_MEMBERS` to read roles; suggest a separate app if governance is really needed.

Then compare the manifest with the code both ways: permissions used but not declared, and declared but unused. Report the diff before editing.

## 2. Handle the user layer

By default the app can't read the user's role (`getUser` and `getProjectUsers` are refused for typical registrations), so:

- Show actions as available and let the server decide. Don't set `fetchUserInfo` on `AuthenticationContextProvider`.
- Catch errors on every action. Recognise a refusal from the `ApiError`: `errorCode` is 403, and the message names the permission ("Errors" in `${CLAUDE_PLUGIN_ROOT}/docs/calling-the-api.md`).
- After a 403, disable that action for that project for the session, with a message covering both layers: a project owner can change the role, or a Cirro admin can grant the app the permission.
- Check every permission a multi-step flow needs at its start.
- If an optional permission wasn't granted, hide the feature everywhere and say "not enabled for this app" once in settings or help.

Only if the registration can read the user record, map roles to the app's capabilities in one place, as in the doc; say the role mapping is unconfirmed.

## 3. Test

Suggest a test user with `COLLABORATOR` access to a test project and walk the main flows with it before each release.

## When the manifest changes

New permissions mean updating the registration in every connected tenant, usually with another review. Tell the user, and offer to draft the update (see cirro-app-deploy).
