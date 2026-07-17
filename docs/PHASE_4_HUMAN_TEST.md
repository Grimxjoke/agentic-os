# Phase 4 Human Validation

Use this checklist from the Orbit UI. Keep browser developer tools closed for the primary pass: every workflow should be understandable without inspecting requests.

## 1. Browse and edit a real file

1. Open **Files & Data**.
2. Navigate into `docs` and open `PHASE_4_HUMAN_TEST.md`.
3. Add a harmless line under a temporary heading and click **Save**.
4. Confirm the footer returns to `synchronized` and the file remains changed after a page refresh.
5. Try opening a binary file if one exists. Orbit must show that it is metadata-only, not corrupted text.

Expected: directories and text files are real, saving is explicit, and errors explain the boundary.

## 2. Verify conflict protection

1. Open the same text file in two browser tabs.
2. Change and save it in tab A.
3. Change the older copy in tab B and try to save.

Expected: tab B receives a conflict message instead of overwriting tab A silently.

## 3. Restore a backup

1. Save two visibly different versions of a file.
2. In **Version backups**, click the older timestamp.
3. Confirm the restore dialog.
4. Refresh the page.

Expected: the selected content returns, and the pre-restore content is itself available as a new backup.

## 4. Search and reindex artifacts

1. Create a Markdown file with a unique name from **Files & Data**.
2. Open **Artifacts** and click **Reindex now**.
3. Search for the unique filename and open it from its card.
4. Remove the temporary file from the VPS or repository, reindex again, and confirm the stale card disappears.
5. Complete a Phase 3 team run that produces an artifact, then confirm it appears with source `Run`.

Expected: file and run outputs share one honest index and every card opens its source.

## 5. Create sourced memory

1. Open **Memory** and click **Add memory**.
2. Enter a title and durable learning.
3. Select source type `file` and paste `workspace:docs/PHASE_4_HUMAN_TEST.md` as the source ID.
4. Set confidence below 100%, pin it, and save.
5. Reload the page and search for the title.

Expected: content, kind, confidence, pinned state, and provenance survive reload.

## 6. Register and advance a trading hypothesis

1. Open **Knowledge**.
2. Register a falsifiable hypothesis such as: “A 20-day volatility compression followed by a range breakout improves risk-adjusted returns after costs.”
3. Add rationale and comma-separated tags.
4. Change its status from `draft` to `testing`.
5. Click **Recompute graph** and select the hypothesis node.

Expected: the registry persists the status and the read-only graph derives a node from it.

## 7. Test provenance links

1. Create a memory sourced from the hypothesis ID using the API or a copied identifier when exposed.
2. Recompute the graph.
3. Confirm a relationship is drawn only when both entities exist.
4. Archive the source record and recompute.

Expected: no dangling edge or invented node is displayed.

## 8. Security sanity checks

In the Files path deep link, try values such as `../`, an absolute path, a `.git` path, and a symlink created inside the workspace.

Expected: Orbit rejects or hides every attempt and remains healthy afterward.
