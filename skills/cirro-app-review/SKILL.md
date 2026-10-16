---
name: cirro-app-review
description: Review a Cirro frontend app for security and configuration problems before it is deployed or shared. Use this whenever someone asks to review, audit, security-check or "get ready to ship" an app that signs in with Cirro or calls the Cirro API, before a first production deploy, before requesting admin approval for a Cirro OAuth app, or after changing auth, permissions or file-access code.
---

# Reviewing a Cirro app before deployment

The checklist lives in `${CLAUDE_PLUGIN_ROOT}/docs/security-checklist.md`; this skill is how to run it and report.

## 1. Run the scanner

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/scan.py <app dir>
```

Open each finding in the code, confirm it, and drop false positives with a one-line reason. HIGH findings block deployment until fixed or explained.

## 2. Work through the checklist

For each item in the security checklist, record a status and one line of evidence. Where it helps:

- Compare registered permissions with what the code calls: `grep -rn "dataService\.\|data\.\w\+\." src`, against the registration (ask the user, or `data.appRegistrations.getAppRegistration`).
- Compare `cirro-permissions.json` with the API calls in the code: flag permissions used but not declared, and declared but never used.
- Check that features behind optional permissions degrade when those permissions are missing, and that actions handle 403.
- List third-party scripts from `index.html` and runtime imports.
- Check the host's CSP and framing headers if the deploy config is in the repo.

## 3. Report

1. **Verdict** in one line: ready, ready with fixes, or blocked.
2. **Blocking issues:** location, why it matters, fix.
3. **Should fix:** same, briefer.
4. **Confirmed fine:** one line per checklist area.
5. **Needs a person:** things only an admin or the user can confirm (registration contents, bucket CORS, approval).

If the verdict is ready, offer to continue with cirro-app-deploy, which drafts the tenant connection request using the manifest and this review.

Offer to apply code fixes. Don't change registrations or deploy without the user's go-ahead.
