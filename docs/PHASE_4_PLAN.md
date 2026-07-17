# Phase 4 Plan — Files, Artifacts, Memory, and Knowledge

## Outcome

Phase 4 turns the remaining knowledge screens into persistent control-plane features. The filesystem is treated as an external boundary, records retain provenance, and the knowledge graph is derived from canonical entities rather than stored as an editable visual fiction.

## Delivered vertical slices

### Bounded filesystem

- Explicit allowlisted roots configured by the server.
- Traversal, absolute paths, blocked directories, and symbolic links are rejected.
- Text extensions are editable; binary files remain metadata-only.
- Reads are limited to 1 MiB and writes to 512 KiB.
- Writes use a same-directory temporary file, file sync, atomic rename, and directory sync.
- Existing content is backed up before replacement.
- Optimistic checksum checks prevent silent overwrites after concurrent changes.
- Backups are listed and can be restored from the UI.

### Unified artifact index

- Workspace text files and durable run artifacts share one searchable index.
- Reindexing replaces the file portion of the index, so deleted files disappear.
- Every entry identifies its source type, source ID, path or run, size, checksum when available, and indexing time.

### Provenance-first memory

- Durable facts, preferences, decisions, and learnings live in SQLite.
- Every memory records its source type and optional source ID/URI.
- Confidence and pinned state are explicit fields rather than inferred UI decoration.
- Updates and archival are audited.

### Hypothesis register and derived knowledge

- Hypotheses retain a falsifiable statement, rationale, status, tags, and provenance.
- Status moves through draft, testing, supported, rejected, or inconclusive.
- The graph is recomputed from agents, teams, runs, artifacts, hypotheses, and memories.
- Edges with missing endpoints are removed instead of rendering broken links.
- The graph is intentionally read-only; changes happen in the source entities.

## Security invariants

- The browser never supplies an arbitrary filesystem root.
- A resolved path must remain inside its configured root.
- Symlinks are not followed.
- `.git`, `.orbit-data`, `dist`, and `node_modules` are excluded from browsing and indexing.
- All mutating routes use same-origin protection, authenticated sessions, bounded schemas, policies, and audit entries.
- Live trading remains denied.

## Exit criteria

- Schema migration reaches version 4 and is idempotent.
- Traversal, symlink, extension, size, binary, conflict, backup, restore, index refresh, search, provenance, and broken-link tests pass.
- The production build and full test suite pass.
- A human can complete the checklist in `PHASE_4_HUMAN_TEST.md` without using a terminal.
