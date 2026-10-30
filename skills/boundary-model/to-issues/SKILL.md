---
name: to-issues
description: Create GitHub issues from planning material, each with its proof of done. Use when slices or changes are ready to publish and the user wants optional parent grouping, expected behavior, design decisions, and a proof of done.
---

# To Issues

Turn planning material into GitHub issues, one per slice or change, with or without boundary changes.

Use material whose expected behavior and design decisions are settled, by refinement or because they already were. Do not settle an open one while drafting: ask the user, or list it under `Before starting` as a decision the issue needs.

## What to do

1. Identify the target issue tracking repository and its issue-tracking conventions.
2. Read the designated slices or changes from the conversation or planning document.
3. Search for duplicate or overlapping open issues.
4. Propose an issue topology and ask the user before publishing:
   - use an existing parent issue;
   - create a new parent container issue plus child issues;
   - create one or more standalone issues.

## Guidelines

- Do not add work that is not present in the planning material.
- If a slice or change is still too large, propose multiple issues or recommend another `slice` pass.
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

## Before Starting

Confirm that each item below is available and works before implementing. If one is not, stop and ask rather than implement work that cannot be proven.

- [Access, setup, credential name, tool, device, environment, or decision that the work or its proof needs from outside the repository | None]

## Expected Behavior

[Short statements describing consumer-observable outcomes, across the boundary when there is one.]

## Design Decisions

[Short statements describing chosen or rejected paths that shape how the expected behavior is implemented.]

## Proof of Done

[The smallest end-to-end check that shows the work is delivered and working: where it runs, what is done, and what is observed.]

## Blocked by

[Blocking issues | None]
```

## Type

Choose the type from `Before Starting` and `Proof of Done`:

- `AFK`: the agent has everything listed under `Before Starting` and can run the proof itself.
- `HITL INPUT`: a person must first provide something listed under `Before Starting`: access, setup, a credential, or a decision.
- `HITL VERIF`: the agent can implement, but a person must run or observe the proof (e.g. the agent cannot access the microphone).
- `HITL INPUT+VERIF`: both.

## Expected Behavior

- Use `Expected Behavior` as a contract for consumer-observable outcomes, across the boundary when there is one.
- Write one observable outcome per bullet as a short, plain statement that constitutes a falsifiable claim.
- Ask: would this behavior still be true if the UI widget, storage shape, file path, route, or API changed? If yes, write the Expected Behavior at the role/capability level and put the concrete mechanism in Design Decisions.

GOOD:

- `Archived projects are not returned by the projects API.`
- `Password reset links expire after 30 minutes.`
- `Malformed CSV uploads return a row-level validation report without creating contacts.`

## Design Decisions

- Use `Design Decisions` for committed choices about how the expected behavior must be achieved or constrained, such as implementation choices, scope boundaries, rejected alternatives, dependencies, storage shape, and access model, when they matter.
- Do not use it for tasks, vague quality goals, undecided preferences, future work, or consumer-observable outcomes.

GOOD:

- `Use the existing payment provider integration; do not add a second provider.`
- `Calculate report totals from settled invoices, not ledger entries.`

## Proof of Done

- Name the smallest end-to-end check that shows the work is delivered and working, from the consumer's side: where it runs, the starting state, what is done, and what is observed.
- Prefer the critical vertical path over exhaustive coverage.
- List everything the proof needs from outside the repository under `Before Starting`, so it is confirmed before implementation starts.

## Publish

1. Draft the parent and every child or standalone issue locally before creating anything.
2. Review the complete draft set once, for contradictions between issues, Expected Behavior against Design Decisions, committed language, issue size, dependencies, and whether each proof of done can be run. Fix what you find.
3. Create the approved issues according to the target repository's issue-tracking conventions.
