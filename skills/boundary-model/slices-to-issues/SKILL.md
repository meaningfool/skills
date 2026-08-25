---
name: slices-to-issues
description: Create GitHub issues from refined slice planning material. Use when refined slices are ready to publish and the user wants optional parent grouping, expected behavior, design decisions, critical paths, and checks.
---

# Slices To Issues

Turn refined slice planning material into GitHub issues.

This skill assumes the source material has already been refined.

## What to do

1. Identify the target issue tracking repository and its issue-tracking conventions.
2. Read the designated slice/slices from the conversation or planning document.
3. Search for duplicate or overlapping open issues.
4. Propose an issue topology and ask the user before publishing:
   - use an existing parent issue;
   - create a new parent container issue plus child issues;
   - create one or more standalone issues.

## Guidelines

- Do not add work that is not present in the refined material.
- If the refined topic is still too large, propose multiple issues or recommend another `slice-with-boundaries` pass.
- Keep parent issues optional. Use them only when they help group related work or hold shared context.
- Treat parent issues as containers, not operational work. Do not put verification duties on parent issues.
- Keep each child or standalone issue implementable without rereading the whole planning conversation.
- Never put secret values in GitHub issues, comments, docs, or committed files.
- Use committed language for accepted work: prefer `does`, `does not`, `must`, and `must not`; avoid `should`, `could`, and vague `can` unless describing an optional capability.
- `Expected Behavior` and `Design Decisions` must not overlap. Statements belong to one or the other.
- Remove planning-only identifiers such as `Phase 3A` or `Slice A1` from published issue titles and bodies; they have no meaning without the related plan.
- Compress as much as you can.

## Parent Container Issue

Use a parent issue only when it helps group related implementation issues.

Template:

```markdown
## Problem Statement

[Plain-language outcome.]

## Shared Context

- ...

## Issues

- ...

## Out of Scope

- ...

## References

- ...
```

## Child Or Standalone Issues

Template:

```markdown
## Parent

[Parent issue: #... | None]

## Summary

[2-3 plain-language sentences]

## Type

[AFK | HITL INPUT | HITL VERIF | HITL INPUT+VERIF]

## Human input before work starts

[Exact access, setup, credential name, file, or decision needed. Use None when not needed.]

## Expected Behavior

[Short statements describing consumer-observable outcomes across the boundary.]

## Design Decisions

[Short statements describing chosen or rejected paths that shape how the expected behavior is implemented.]

## Demo / Critical Path

[Smallest end-to-end scenario or scenarios needed to trust the issue from the outside.]

## Blocked by

[Blocking issues | None]
```

## Type

Choose the type by asking what the implementation agent needs from outside the repo:

- `AFK`: the agent can implement and verify without human intervention
- `HITL INPUT`: the agent needs human input before the work can get started: setup, access, credentials...
- `HITL VERIF`: the agent can implement, but the final verification requires human intervention (e.g. the agent cannot access the microphone).
- `HITL INPUT+VERIF`: both pre-work human input and final human verification are required.

## Expected Behavior

- Use `Expected Behavior` as a contract for consumer-observable outcomes across the boundary.
- Write one observable outcome per bullet as a short, plain statement that constitutes a falsifiable claim.
- Ask: would this behavior still be true if the UI widget, storage shape, file path, route, or API changed? If yes, write the Expected Behavior at the role/capability level and put the concrete mechanism in Design Decisions.
- Avoid long clauses joined by `while`, `and`, or multiple exceptions. Each clause must be specific enough that a reader can say what evidence would prove or disprove it.

GOOD:

- `Archived projects are not returned by the projects API.`
- `Password reset links expire after 30 minutes.`
- `Malformed CSV uploads return a row-level validation report without creating contacts.`

## Design Decisions

- Use `Design Decisions` for choices about how the expected behavior must be achieved or constrained.
- Include implementation choices, scope boundaries, rejected alternatives, dependency decisions, storage shape, command shape, and access model decisions when they matter.
- Write decisions as committed statements.
- Do not use this section for tasks.
- Do not use this section for vague quality goals, undecided preferences, or future work.
- Do not repeat consumer-observable outcomes here; those belong in `Expected Behavior`.

GOOD:

- `Use the existing payment provider integration; do not add a second provider.`
- `Keep imported contacts in the current contacts table; do not introduce a staging table.`
- `Calculate report totals from settled invoices, not ledger entries.`
- `Expose admin actions through the existing admin CLI; do not add a hidden HTTP endpoint.`

## Demo / Critical Path

Critical path verification:

- Identify the smallest end-to-end scenario or scenarios needed to trust the issue from the outside.
- Describe each scenario from the perspective of the consumer: the starting state, the sequence of actions, and the observations that prove important behavior.
- Prefer the critical vertical path over exhaustive coverage.

Internal verification:

- Identify the smallest set of automated verification that cannot be observed by the consumer and/or cannot be observed through the critical path verification.

## Publish And Audit

1. Draft the parent and every child or standalone issue locally before creating anything.
2. Run the adversarial review against the complete local draft set:
   - check for contradictions between issues;
   - check Expected Behavior against Design Decisions;
   - check committed language, issue size, dependencies, and verification scope;
   - fix every `high` and `medium` finding;
   - repeat locally until no `high` or `medium` findings remain.
3. Create the approved issues according to the target repository's issue-tracking conventions.
4. Re-fetch the published issues and verify that their content matches the reviewed local drafts.
