---
name: wrap-up
description: "Use when the user asks to wrap up completed repo work: review documentation impact, create or update the PR, merge it when authorized, close linked issue(s), and clean up worktrees and branches."
---

# Wrap Up

Finish completed implementation work with a clean repo, useful paper trail, and minimal back-and-forth.

When the user asks to wrap up, treat that as explicit authorization to complete the cleanup path, including removing the completed worktree. Do not silently skip a workflow item. If an item cannot be completed, name it as blocked and explain the exact blocker.

## Completion Checklist

Track every wrap-up with this checklist:

- [ ] Identify branch, issue, PR, base branch, and working tree state.
- [ ] Inspect the diff before staging.
- [ ] Confirm there are no unrelated changes in scope.
- [ ] Check whether durable docs need updates.
- [ ] Run the repo's standard validation.
- [ ] Stage only in-scope files.
- [ ] Commit.
- [ ] Push.
- [ ] Create or update the PR.
- [ ] Merge when authorized by the wrap-up request and mergeability/checks allow it.
- [ ] Update the primary checkout to the merged base branch.
- [ ] Delete the merged local branch.
- [ ] Delete the merged remote branch when appropriate.
- [ ] Remove the completed worktree.
- [ ] Verify primary checkout status, worktree list, PR state, and issue state.

If the completed worktree is the active thread worktree, remove it as the final
cleanup action after all verification that requires the worktree is done. Do not
keep the active completed worktree merely because the thread is still open. If
the environment prevents removing the active worktree safely, say that cleanup is
blocked and provide the exact command or follow-up needed.

## Workflow

1. **Orient**
   - Identify branch, issue, PR, base branch, and working tree state.
   - Inspect the diff before staging.
   - If unrelated changes are present, stop and ask what belongs in scope.

2. **Documentation Checkpoint**
   - Inspect relevant durable docs.
   - If durable decisions, terminology, or architecture changed, draft the proposed doc edits in chat before saving them.
   - If no docs need changes, say so briefly and continue.

3. **Validate**
   - Run the repo’s standard check command.
   - If no standard command exists, run the narrowest meaningful format/lint/type/test checks.
   - Do not proceed to merge with failing checks unless the user explicitly accepts the risk.

4. **PR**
   - Stage only in-scope files.
   - Commit with a terse message.
   - Push the branch.
   - Create or update the PR with:
     - summary
     - findings and decisions
     - docs changed or intentionally not changed
     - validation
     - linked issue closure text

5. **Merge**
   - If the user asked to wrap up/merge, mark the PR ready and merge once it is mergeable.
   - Close the primary issue; if that leaves its parent with no open child issues, close the parent too.
   - Do not ask again unless checks fail, mergeability is blocked, scope is ambiguous, or destructive cleanup would affect unrelated work.

6. **Cleanup**
   - Update the primary checkout to the merged base branch.
   - Remove the completed worktree.
   - Delete the merged local branch.
   - Delete the merged remote branch when appropriate.
   - Verify primary checkout status, worktree list, PR state, and issue state once.

## Style

- Batch checks and cleanup verification; avoid repeated redundant status probes.
- Prefer one concise final report with PR, merge commit, issue state, cleanup performed, and anything left open.
