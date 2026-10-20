# Permissions: what the app is allowed, and what the user can do

A Cirro app works under two layers of permission at once. Getting both right is what lets admins approve apps with confidence, and keeps the app usable for people with different roles.

| Layer | Set by | Changes | What the app must do |
| --- | --- | --- | --- |
| **App registration** | Admins, when they register and approve the app | Rarely, with re-approval | Declare exactly which permissions it needs, and why |
| **User** | Project owners and admins, through project roles | Any time, and differs per project | Check before offering an action, and handle being refused |

An action succeeds only when both layers allow it. The app's registration sets a ceiling; each user's role decides how much of that ceiling applies to them, project by project.

## Layer 1: declare what the app needs

Admins can only grant least privilege if the app tells them what that is. Every app should ship a **permission manifest**: a short, checked-in statement of the permissions it uses, which features need each one, and which are optional.

This kit uses a `cirro-permissions.json` file at the root of the app (the app template includes one):

```json
{
  "app": "variant-review",
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

Keep the manifest in step with the code: when you add a call to a new API, add its permission. The [scanner](../tools/scan.py) and the [security checklist](security-checklist.md) both check for a manifest, and code review should compare it with the calls the app makes. The [capability map](building-on-cirro.md#capability-map) lists the permission each part of the API needs.

Resist adding permissions "in case". Every extra permission is something an admin has to trust, and a reason to delay approval.

## Layer 2: the user is not an admin

Users sign in as themselves, so the app inherits their access, no more. The same app, with the same registration, will be able to do different things for different people, and for the same person in different projects. An app must never assume an action is possible because the code path exists or because it worked for the developer.

### Checking before offering an action

Cirro has no endpoint that answers "can this user do X", but an app can usually learn the user's **role in each project** from the project's member list: `data.projects.getProjectUsers({ projectId })` returns every member with their `role`, the signed-in user included. It needs `VIEW_PROJECT_MEMBERS` in the app's registration, and the user must be a `CONTRIBUTOR` or above, so for collaborators the role stays unknown. (Reading the user's own record with `getUser` needs `MANAGE_MEMBERS` as a global permission, which governs everyone's membership; don't request it just to read roles.)

```typescript
import { ApiError } from "@cirrobio/sdk";
import type { ProjectRole } from "@cirrobio/api-client";

async function roleIn(projectId: string, username: string): Promise<ProjectRole | undefined> {
  try {
    const members = await data.projects.getProjectUsers({ projectId });
    return members.find((m) => m.username === username)?.role;   // username: the ID token's cognito:username
  } catch (e) {
    if (e instanceof ApiError && e.errorCode === 403) return undefined;   // a collaborator, or no VIEW_PROJECT_MEMBERS
    throw e;
  }
}
```

When the role is unknown, show actions as available, and let the server decide (next section).

Each role includes everything the role before it can do:

| Role | Adds |
| --- | --- |
| `COLLABORATOR` | View the project, its datasets, metadata, references, shares, dashboards and sheets; read files (`GENERATE_DOWNLOAD_TOKEN`); read discussions and post messages in them; run read-only SQL on sheets |
| `CONTRIBUTOR` | Create and edit datasets, metadata, dashboards and sheets; run and stop pipelines and see their tasks, logs and costs; create workspaces, custom pipelines and discussion threads; see project members |
| `ADMIN` | Manage members and shares; edit project settings; delete datasets, workspaces and sheets; start and stop any workspace; manage discussions |
| `OWNER` | Delete the project; open any workspace |

Turn roles into the app's own capabilities in one place, rather than scattering role checks through the UI:

```typescript
type Capability = "view" | "readFiles" | "postNotes" | "createDatasets" | "runPipelines" | "manageShares";

const ROLE_CAPABILITIES: Record<ProjectRole, Capability[]> = {
  OWNER:        ["view", "readFiles", "postNotes", "createDatasets", "runPipelines", "manageShares"],
  ADMIN:        ["view", "readFiles", "postNotes", "createDatasets", "runPipelines", "manageShares"],
  CONTRIBUTOR:  ["view", "readFiles", "postNotes", "createDatasets", "runPipelines"],
  COLLABORATOR: ["view", "readFiles", "postNotes"],
  NONE:         [],
};
```

Then combine it with what the app was granted: a feature behind an optional permission that the admin didn't grant should behave the same as one the user's role doesn't allow.

### The server has the final word

Client-side checks are for a better experience, not for security, and they can be wrong: roles change mid-session, mappings drift, and governance requirements (such as data use agreements) can block access regardless of role. So:

- **Treat a 403 as authoritative.** Catch errors on every action, and when it's a permission failure (`errorCode` 403 on the `ApiError`; see [calling the API](calling-the-api.md#errors)), update the UI to match rather than retrying.
- **Explain who can fix it.** A 403 can come from either layer, and the response doesn't say which: the message is the same ("Not allowed to RUN_ANALYSIS on project …"). A good message covers both: "You don't have permission to run pipelines in this project. A project owner can change your role, or a Cirro admin can grant this app access."
- **Remember refusals.** After a 403, disable that action for that project for the rest of the session, with the explanation, so the user doesn't hit it again.

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
