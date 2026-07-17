# Contributing

## Repository language

English is the canonical language for this repository. Use English for:

- source code, comments, user-facing copy, errors, fixtures, and examples;
- documentation, diagrams, runbooks, and issue references;
- branch names, commit messages, pull-request titles, and pull-request bodies;
- review comments that become part of the permanent project record.

Contributors may discuss the project in another language outside the repository,
but every published repository artifact must remain in English.

## Validation

Before publishing a change:

```bash
npm test
git diff --check
```

For production-facing changes, follow the relevant runbook in `docs/` and keep
the pull request in draft until the production probes have passed.
