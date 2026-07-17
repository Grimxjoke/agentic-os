# Phase 4 Operations Runbook

## Configuration

The default root is `ORBIT_WORKSPACE`, exposed as `workspace`. Additional roots must be added in trusted server configuration; they cannot be supplied by an HTTP request.

Canonical data:

- SQLite: `$ORBIT_DATA_DIR/orbit.sqlite`
- file backups: `$ORBIT_DATA_DIR/file-backups/<root-id>/`
- database backups: `$ORBIT_DATA_DIR/backups/`

## Deployment

1. Create a database backup.
2. Deploy the new build.
3. Run `npm run db:migrate`; the expected schema is version 4.
4. Restart Orbit.
5. Check `/orbit/healthz` and `/orbit/readyz`.
6. Open Files, Artifacts, Memory, and Knowledge and complete a short smoke pass.

## Diagnostics

- `file_boundary`: traversal, blocked path, or an invalid absolute path.
- `symlink_denied`: a path component is a symbolic link.
- `binary_file`: the file is visible but cannot be edited.
- `extension_denied`: the requested extension is outside the text allowlist.
- `file_too_large`: read or write size exceeded.
- `edit_conflict`: reload the current file, merge changes, and save again.
- `missing_provenance`: provide a source ID or URI for a non-manual record.

## Recovery

Use the file history UI for an individual text file. For canonical database loss, stop Orbit and restore the latest SQLite backup according to the Phase 1 runbook. Never copy a live WAL database as a recovery method.

## Rollback

Application rollback is safe after a pre-deployment database backup. Schema v4 tables are additive, so the Phase 3 application can ignore them. Preserve `$ORBIT_DATA_DIR/file-backups` even during an application rollback.
