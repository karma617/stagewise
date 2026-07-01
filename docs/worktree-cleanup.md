# Worktree Cleanup

Stagewise only auto-cleans managed worktrees under:

```text
<home>/.stagewise/worktrees
```

When a cleanup candidate has uncommitted changes at deletion time, Stagewise
creates a backup before running forced removal. Backups are stored under:

```text
<home>/.stagewise/worktree-cleanup-backups
```

Each backup directory may contain:

- `metadata.json`: original worktree path, repository id, branch, HEAD, and
  backup file locations.
- `changes.patch`: tracked-file changes exported with `git diff HEAD --binary`.
- `untracked/`: untracked files copied from the worktree.

To restore tracked-file changes, open the repository and apply the patch:

```bash
git apply <path-to-backup>/changes.patch
```

To restore untracked files, copy the contents of `untracked/` back into the
repository.
