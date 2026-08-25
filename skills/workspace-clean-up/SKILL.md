---
name: workspace-clean-up
description: Audit and clean up Git worktrees, local branches, origin branches, detached agent checkouts, and stashes. Use when the user asks to list, inspect, decide on, or clean workspace branches/worktrees from Codex, Cursor, Conductor, or similar agent-created workspaces.
---

# Workspace Clean Up

Clean up repo workspace state by presenting a worktree-centered decision dashboard, then walking the user through destructive actions one item or group at a time.

Do not treat branches and worktrees as separate worlds. Most agent-created branches exist because a Codex, Cursor, Conductor, or similar thread created a worktree, later created a branch, then may or may not have wrapped up. Start from worktrees, attach branch facts to them, and only list branches separately when they are not attached to any worktree.

## Inventory

Run a fresh inventory before recommending cleanup:

```bash
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
git branch -vv --all
git branch --merged main
git branch --no-merged main
git stash list
```

For each non-primary worktree, also run:

```bash
git status --short --branch
```

When a branch is not obviously merged or abandoned, inspect:

```bash
git rev-list --left-right --count main...BRANCH
git log --oneline --decorate --max-count=20 main..BRANCH
git diff --stat main...BRANCH
```

If GitHub tooling is available and a branch has an origin branch or likely PR, check PR state before recommending deletion.

## Owner and ID

Use compact owner and ID labels instead of full paths in the main tables:

- Repo root: Owner `Primary`, ID `repo root`
- `.codex/worktrees/<id>/<repo>`: Owner `Codex`, ID `<id>`
- `conductor/workspaces/<repo>/<id>`: Owner `Conductor`, ID `<id>`
- Cursor worktree path, when recognized: Owner `Cursor`, ID from the worktree directory
- Unknown pattern: Owner `Other`, ID as the shortest useful path segment

Keep full paths out of the first table unless needed to disambiguate. Put full paths in a short detail section or in the action prompt.

## Output Order

### 1. Workspace Units

Show one row per worktree. Use `Checkout`, not `ref`.

| Owner     |           ID | Checkout              | Worktree State        | Branch State               | Recommendation                  |
| --------- | -----------: | --------------------- | --------------------- | -------------------------- | ------------------------------- |
| Primary   |    repo root | `main`                | clean                 | tracks `origin/main`       | keep                            |
| Codex     |       `9099` | detached `0ce3ff0`    | clean                 | commit contained in `main` | remove worktree                 |
| Codex     |       `b96b` | `codex/example`       | clean                 | local+origin, PR open      | keep until PR resolved          |
| Conductor | `alexandria` | `meaningfool/example` | dirty: untracked docs | local-only, merged         | decide dirty files, then remove |

Column meanings:

- **Checkout**: branch name, or `detached <sha>` when no branch is checked out.
- **Worktree State**: clean, dirty, untracked files, missing path, or blocked.
- **Branch State**: local-only, origin-only, local+origin, tracks origin, merged, unmerged, PR open/merged/closed.
- **Recommendation**: keep, remove worktree, decide dirty files, merge/close PR first, archive/tag, or delete.

### 2. Loose Branches

Only list branches here if they are not attached to a worktree. Group branches when they point to the same commit and have the same recommendation.

| Branch / Group                  | State                                 | Likely Story                | Recommendation                |
| ------------------------------- | ------------------------------------- | --------------------------- | ----------------------------- |
| Boundary aliases: `a`, `b`, `c` | local-only, same merged commit        | leftover agent branch names | delete as group               |
| `codex/spike-x`                 | local-only, merged                    | completed spike branch      | delete                        |
| `codex/wip-y`                   | local-only, unmerged, 1 unique commit | preserved WIP               | decide: archive/tag or delete |

Do not show a noisy one-row-per-branch table for equivalent merged aliases. Expand the group only enough for the user to recognize the names.

### 3. Stashes

Show stashes as saved workspace state:

| Stash                        | Contents             | Recommendation          |
| ---------------------------- | -------------------- | ----------------------- |
| `stash@{0}` automatic backup | generated files only | drop after confirmation |

Use `git stash show --stat stash@{n}` before recommending drop.

### 4. Decision Queue

End the inventory with an ordered queue:

1. Safe clean detached worktrees.
2. Clean worktrees on merged local-only branches.
3. Dirty worktrees that need keep/discard decisions.
4. Worktrees tied to open PRs.
5. Loose merged branch groups.
6. Loose unmerged branches.
7. Stashes.

Then ask about the first item only. After each approved destructive action, verify the relevant state and move to the next item.

## Recommendations

Default recommendations:

- Clean detached worktree whose commit is contained in `main`: remove worktree.
- Clean worktree on a merged local-only branch: remove worktree, then delete branch.
- Dirty worktree: summarize dirty files and ask whether to keep, move, commit, or discard.
- Worktree branch with open PR: keep until PR is merged or closed.
- Local-only branch attached to no worktree and merged into `main`: delete.
- Local-only branch attached to no worktree and unmerged: ask whether to archive/tag, inspect, or delete.
- Remote-only branch: leave alone unless the user is explicitly cleaning remotes.
- Stash containing generated or obsolete backup files: drop after confirmation.

Never remove a dirty worktree, delete an unmerged branch, or drop a stash without explicit user approval for that specific item or group.

## Final Report

Finish with the final state:

- local branches remaining
- remote branches remaining
- registered worktrees remaining
- stashes remaining
- working tree status

Keep it concise.
