---
name: let-me-see
description: Prepare a ready-to-use environment and manual verification scenarios. Use when the user wants to see results for themselves or manually test completed work.
---

# Let Me See

Prepare both a ready-to-use environment and ready-to-use scenarios so the user can verify that the work produces the expected results.

## Identify critical paths

1. Look for specifications, tickets, or documents that describe critical paths or intended outcomes.
2. Inspect the code changes and infer the expected behavioral changes.
3. List all the critical paths that are human-verifiable.

## Setup the testing environment

Find and follow applicable repository instructions. Set up the testing environment
and verify that the starting state is ready for the user.

Keep resources needed for review and their workspace available. Report how to
access the preview and how to stop resources started for it. Follow
repository-specific lifecycle instructions when available.

## Report

```md
Ready.

Running:

- ...

## Scenario 1: [scenario name]

Do:

1. ...
2. ...

Observe:

- ...

Passes if:

- ...

Watch for:

- ...
```
