---
name: wrap-up
description: "Use when the user asks to wrap up repo work: clean up already completed work, or finish validation, PR, merge, and cleanup for pending changes."
---

# Wrap Up

Finish the agreed work with a clean repo, useful paper trail, and minimal back-and-forth.

Treat a wrap-up request as authorization to finish the agreed work and its cleanup,
including retiring completed worktrees through the supported lifecycle. Run only
the remaining applicable steps; acknowledge completed or inapplicable steps
without repeating them. Name any blocked applicable step and its exact blocker.

## Orient and Route

Identify the working tree state, pending changes (including unpushed commits),
branch, base branch, and any related issue or PR. Inspect the diff before staging.
If unrelated changes make the intended scope ambiguous, ask what belongs in scope.
Preserve unrelated work throughout cleanup.

Choose the path from the current state:

| State | Path |
| --- | --- |
| Agreed work is already merged; no pending in-scope changes | Verify merge/issue state and existing completion and validation evidence, then go directly to **Cleanup**. |
| Pending in-scope changes or an unmerged PR | Follow **Finish Pending Work**, performing only its unfinished steps, then **Cleanup**. |
| No implementation happened in this chat, including an orchestration-only chat whose child work is complete | Confirm no owned work remains unfinished, then **Cleanup**. |

For completed work, use the existing implementation/review report and CI results.
Do not install dependencies or rerun validation merely to retire a checkout.

## Newly Discovered Gaps

Keep newly discovered gaps in previously completed work separate from wrap-up.
Report the evidence and limitation in the final response, and continue cleanup
where safe. A wrap-up request alone does not initiate a fresh acceptance audit,
production investigation, remediation project, or follow-up PR.

Address a gap during wrap-up only when the user explicitly includes it in scope,
or when it directly affects preservation of the user's work or the safety of a
pending merge. In the latter case, investigate only what is needed to resolve or
report that blocker; continue independent safe steps. Required failing checks on
a pending PR remain merge blockers.

## Finish Pending Work

1. **Settle the base and documentation**
   - Bring the branch onto its intended base before expensive validation.
   - Inspect durable docs relevant to the pending changes.
   - If durable decisions, terminology, or architecture changed, draft the proposed doc edits in chat before saving them.
   - If no docs need changes, say so briefly and continue.

2. **Validate**
   - Reuse passing validation from implementation/review tasks or CI when it covers the required checks at the same code revision and scope. Honor repository requirements for fresh checks.
   - Run the repo's standard check command when the required validation is missing or invalidated. If no standard command exists, run the narrowest meaningful format/lint/type/test checks.
   - Repeat a check only when a subsequent change, relevant environment change, unresolved failure, or explicit repository requirement invalidates reuse. Base changes must be accounted for before relying on earlier results.
   - Preserve existing commit hooks and required CI gates; validation reuse does not authorize bypassing them.
   - Do not proceed to merge with failing checks unless the user explicitly accepts the risk.

3. **PR**
   - Stage only in-scope files; commit pending changes with a terse message.
   - Push unpublished commits and create or update the PR as needed.
   - Include the summary, findings and decisions, docs changed or intentionally not changed, validation, and linked issue closure text.

4. **Merge**
   - Mark the PR ready and merge once authorized, mergeable, and its required checks allow it.
   - Close the primary issue; if that leaves its parent with no open child issues, close the parent too.
   - Do not ask again unless checks fail, mergeability is blocked, scope is ambiguous, or destructive cleanup would affect unrelated work.

## Cleanup

- Before retiring the workspace, release resources owned by the task and verify cleanup. Follow repository-specific lifecycle instructions when available. Leave resources with unknown ownership untouched and report them.
- Preserve resources and their workspace while they are still needed for review.
- Update the primary checkout to the merged base branch when applicable.
- Delete the merged local branch and the merged remote branch when appropriate.
- Preserve needed ignored files and nested-repository work before retiring a checkout; the app's recovery snapshot does not preserve ignored files.
- Retire completed worktrees through the environment's supported lifecycle. In Codex, use the worktree archive tool for additional attached worktrees. For the conversation's original managed worktree, finish other cleanup and let conversation archival retire it. Its absence from the attachment list is not itself a blocker.
- Archive the conversation only when the user asks to archive it. Otherwise, report readiness and leave that final action to the user.
- Verify primary checkout status and any applicable PR and issue state once. When claiming a worktree was removed, verify its absence from both disk and Git's worktree list.

Conversation archival performs background cleanup after a grace period (about a
minute in the observed Codex app). Account for that delay when verifying an archive;
an immediate remaining checkout is not evidence of failure. Finish wrap-up without
waiting for the user to archive or polling for that action.

## Final Verdict

Lead the final report with exactly one of these two statuses:

- **Ready to archive**: all agreed work is complete and preserved; cleanup is finished, or only conversation archival and its normal automatic cleanup remain. Briefly state which applies.
- **Not ready to archive**: agreed work, required checks, publication, preservation, or a cleanup problem still needs attention. State what remains and the concrete next action.

Keep cleanup details beneath that verdict rather than introducing additional
statuses. Include the applicable PR, merge commit, issue state, and cleanup outcome.
Batch verification and keep the report concise.
