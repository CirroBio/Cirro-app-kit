# Permissions: what the app is allowed, and what the user can do

A Cirro app works under two layers of permission at once. Getting both right is what lets admins approve apps with confidence, and keeps the app usable for people with different roles.

| Layer | Set by | Changes | What the app must do |
| --- | --- | --- | --- |
| **App registration** | Admins, when they register and approve the app | Rarely, with re-approval | Declare exactly which permissions it needs, and why |
| **User** | Project owners and admins, through project roles | Any time, and differs per project | Check before offering an action, and handle being refused |

An action succeeds only when both layers allow it. The app's registration sets a ceiling; each user's role decides how much of that ceiling applies to them, project by project.

## Layer 1: declare what the app needs

Admins can only grant least privilege if the app tells them what that is. Every app should ship a **permission manifest**: a short, checked-in statement of the permissions it uses, which features need each one, and which are optional.

This kit uses a `cirro-permissions.json` file at the root of the app (both templates include one):

```json
{
  "app": "variant-viewer",
  "scope": "project",
  "required": [
    { "permission": "VIEW_PROJECT", "reason": "List the projects the user can open" },
    { "permission": "VIEW_DATASET", "reason": "Show datasets and their files" },
    { "permission": "GENERATE_DOWNLOAD_TOKEN", "reason": "Read VCF and index files for display" }
  ],
  "optional": [
    { "permission": "CREATE_DISCUSSION", "feature": "Save annotations as dataset notes" },
    { "permission": "RUN_ANALYSIS", "feature": "Re-run variant calling with new parameters" }
  ]
}
```

- **`required`**: without these, the app can't do its core job. Admins should grant all of them.
- **`optional`**: each unlocks one feature. The app must keep working without them (see [degrading gracefully](#degrading-gracefully)).
- **`scope`**: `project` if the app should be granted permissions on specific projects (`projectPermissions` in the registration), `global` if it needs them everywhere (`globalPermissions`). Prefer `project`.
- **`reason` / `feature`**: written for the admin reviewing the app. "Read VCF files for display" is reviewable; "file access" isn't.

Keep the manifest in step with the code: when you add a call to a new API, add its permission. The [scanner](../tools/scan.py) and the [security checklist](security-checklist.md) both check for a manifest, and code review should compare it with the calls the app makes. The [capability map](building-on-cirro.md#capability-map) suggests the likely permission for each part of the API.

Resist adding permissions "in case". Every extra permission is something an admin has to trust, and a reason to delay approval.

## Layer 2: the user is not an admin

Users sign in as themselves, so the app inherits their access, no more. The same app, with the same registration, will be able to do different things for different people, and for the same person in different projects. An app must never assume an action is possible because the code path exists or because it worked for the developer.

### Checking before offering an action

Cirro doesn't expose a "can this user do X" endpoint. What the app can read is the user's **role in each project**:

```typescript
import type { ProjectRole } from "@cirrobio/api-client";

const me = await data.users.getUser({ username: (await auth.getCurrentUser()).username });
const roleIn = (projectId: string): ProjectRole | undefined =>
  me.projectAssignments.find((a) => a.projectId === projectId)?.role;
```

Roles are `OWNER`, `ADMIN`, `CONTRIBUTOR`, `COLLABORATOR` and `NONE`. In a React app with `react-auth`, `useAuthenticator().userInfo` already holds this when `fetchUserInfo` is set.

Turn roles into the app's own capabilities in one place, rather than scattering role checks through the UI:

```typescript
type Capability = "view" | "readFiles" | "addNotes" | "createDatasets" | "runPipelines" | "manageShares";

// Example mapping. Cirro does not publish its role-to-permission table yet;
// confirm these with your Cirro admins before relying on them.
const ROLE_CAPABILITIES: Record<ProjectRole, Capability[]> = {
  OWNER:        ["view", "readFiles", "addNotes", "createDatasets", "runPipelines", "manageShares"],
  ADMIN:        ["view", "readFiles", "addNotes", "createDatasets", "runPipelines", "manageShares"],
  CONTRIBUTOR:  ["view", "readFiles", "addNotes", "createDatasets", "runPipelines"],
  COLLABORATOR: ["view", "readFiles", "addNotes"],
  NONE:         [],
};

export const can = (projectId: string, cap: Capability) =>
  ROLE_CAPABILITIES[roleIn(projectId) ?? "NONE"].includes(cap);
```

Then combine it with what the app was granted: a feature behind an optional permission that the admin didn't grant should behave the same as one the user's role doesn't allow.

### The server has the final word

Client-side checks are for a better experience, not for security, and they can be wrong: roles change mid-session, mappings drift, and governance requirements (such as data use agreements) can block access regardless of role. So:

- **Treat a 403 as authoritative.** Catch errors on every action, and when it's a permission failure (detecting a 403 needs the workaround in [calling the API](calling-the-api.md#errors), since the sdk's `ApiError` has no status code), update the UI to match rather than retrying.
- **Explain who can fix it.** A 403 can come from either layer, and the response may not say which. A good message covers both: "You don't have permission to run pipelines in this project. A project owner can change your role, or a Cirro admin can grant this app access."
- **Re-check after errors.** After a 403, refresh the user's details (`useAuthenticator().refresh()` or `getUser` again) so the rest of the UI catches up.

## Degrading gracefully

Design every screen for the user who can only read. Then layer actions on top.

| Situation | Behavior |
| --- | --- |
| User lacks a capability for an action they'd reasonably expect | Show the control disabled, with a one-line reason and who to ask |
| Action would be confusing or irrelevant to them | Hide it |
| App wasn't granted an optional permission | Hide or disable the feature everywhere; say "not enabled for this app" in settings or help, not on every screen |
| User can't access a project at all | Leave it out of pickers; don't show empty or broken pages |
| A required permission is missing | Fail clearly on load: say which permission and that an admin needs to update the registration |
| An action fails with 403 partway through a multi-step flow | Stop, keep what succeeded, and tell the user what did and didn't happen |

Two habits make this manageable:

- **Check at the start of a flow, not the end.** If uploading results then running a pipeline needs both `createDatasets` and `runPipelines`, check both before the user picks files.
- **Test with low-privilege accounts.** Keep a test user with `COLLABORATOR` access to a test project, and walk through the app with it before every release. It catches more permission bugs than any amount of code review.

## For admins approving an app

Connection requests arrive per tenant; see [connecting to tenants](connecting-to-tenants.md) for what a complete request contains.

The manifest is what you review. Check that each required permission has a reason that matches what the app visibly does; grant optional ones only for features your users want; and prefer project-scoped grants. If an app asks for governance permissions (roles, shares), see [trust boundaries](building-on-cirro.md#trust-boundaries).
