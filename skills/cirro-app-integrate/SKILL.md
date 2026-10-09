---
name: cirro-app-integrate
description: Draft. Add a Cirro mode to an existing browser app with @cirrobio/app-kit, so it runs hosted in the Cirro portal and reads and saves Cirro datasets.
---

# Add a Cirro mode to an app (draft)

Read `CONTRACT.md` sections 2, 3, 8 and 11 first.

1. **Find the seams.** List where the app opens files, saves, autosaves and warns before
   leaving. Integrate at those few places; don't rewrite the app.
2. **Detect hosting at boot** with `hostedMode()` from `cirro-app-mode.js`. When it
   returns null, change nothing: the app must work exactly as before.
3. **Connect** with `connectToCirro({ appId, appVersion, mock })`, and supply fixtures
   for `?cirro-app=mock`.
4. **Open from Cirro:**
   - discover items with `createDataIndex` and a detector that recognizes the app's
     files by type;
   - read files through signed URLs, using range reads for large ones.
5. **Save to Cirro:** create a dataset in a project the user picks, under
   `Apps/<App name>/`, tagged with `appTag`.
6. **Keep work safe:**
   - track "saved to Cirro" separately from any local autosave;
   - warn before leaving with unsaved work;
   - store only index details in the browser, keyed by the Cirro user.
7. **Write `cirro-app.json`**, then run `cirro-app validate`.
