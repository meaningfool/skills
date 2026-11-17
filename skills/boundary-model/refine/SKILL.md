---
name: refine
description: Settle the details of a change, its expected behavior and design decisions, until it can be implemented without guessing. Use after shaping or slicing, or when an issue starts, while details are still open, with or without boundary changes.
---

# Refine

## Goal

Settle the details of a change until it can be implemented without guessing. For each change in scope, settle two kinds of details:

- **Expected behavior**: what a consumer can observe once the change works, one falsifiable statement each.
- **Design decision**: a chosen or rejected path that shapes how that behavior is built.

When the change is described as boundary changes, refine each one with the `boundary model` defined in the `use-boundary-model` skill: a capability's output is usually an expected behavior.

## What to do

1. Start from the `Details` list of a shape, a selected slice, a single change, or the issue being started, and restate the change to be refined. If it is not clear, ask the user to clarify it, or to shape it first with the `shape-boundaries` skill.
2. List the open details. Settle from the codebase, existing behavior, and earlier decisions what they answer, and leave to implementation what would change no expected behavior or design decision. If nothing is left, say so and stop.
3. Ask the questions with a real tradeoff one at a time, the highest-leverage first. State the tradeoff in plain words, what is gained and what is given up, and your recommendation.
4. Group the remaining questions, in one or more groups, with your recommended answer to each.
5. Stop when no open question would change an expected behavior or a design decision.

## Guidelines

- If a prototype already exists, ask if it should be used as is, or as a guideline.
- Keep specification statements short and explicit.

## Record Decisions

- Use the planning document designated by the user. If none is designated, ask which file should record the decisions, following the target repository's documentation conventions. When refining an issue as it starts, record them in that issue.
- Record the decisions under Expected behavior and Design decisions once all questions have been answered by the user.
