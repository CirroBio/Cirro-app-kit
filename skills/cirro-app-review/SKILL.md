---
name: cirro-app-review
description: Draft. Review a Cirro app against the Cirro Apps contract and the lessons from earlier integrations before it is submitted for review.
---

# Review a Cirro app (draft)

Check each item, citing file:line for every problem.

- **Standalone unchanged:** without `?cirro-app`, nothing new loads and nothing behaves
  differently.
- **Manifest:**
  - `cirro-app validate` passes;
  - `permissions` lists only what the code calls (compare with `permissionForRequest`);
  - `opens` matches what the app can actually open.
- **Requests:** none to the app's own server while hosted (CONTRACT.md section 8). No
  hard-coded tenant URLs.
- **Tokens:** every call goes through the session, which refreshes the token. Nothing
  caches a token or a signed URL past its expiry.
- **Saving:** autosave doesn't count as saved to Cirro, and there's a leave guard for
  unsaved work. Saved datasets go under `Apps/<App name>/` and carry the App tag.
- **Browser storage:** index details only, no file contents, and partitioned by the
  Cirro user.
- **Errors:** they reach the user in plain words; a failed dataset can be retried.
