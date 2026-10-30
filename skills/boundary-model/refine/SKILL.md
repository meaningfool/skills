---
name: refine
description: Refine a selected boundary change. Use when boundaries have already been shaped but need clearer decisions or specification before creating issues.
---

# Refine Boundary

## What to do

Refine the boundary changes of a selected slice, or a single boundary change, until they are ready for implementation. Use the `boundary model` as defined in the `use-boundary-model` skill.

Interview the user until each boundary change in scope has its expected behavior and design decisions settled. Before asking a question, state how plausible answers would change an expected behavior or a design decision; if none would, decide it yourself from the codebase and existing decisions, or leave it to implementation. Stop when no open question would change either.

## Guidelines

- Use the user's input and/or the designated planning file as the starting point.
- Start by restating the expected boundary change to be refined. If the expected boundary change is not obvious, ask the user to clarify or to use the `shape-boundaries` skill first.
- Ask the questions one at a time, waiting for feedback on each question before continuing. For each question, provide your recommended answer.
- When questions about related details (e.g. a set of interface decisions) can be grouped, group them into a single proposal highlighting which specific aspects of the proposal require feedback.
- If a prototype already exists, ask if it should be used as is, or as a guideline.
- Keep specification statements short, explicit, and grouped under clear headings.

## Record Decisions

- Use the planning document designated by the user. If none is designated, ask which file should record the decisions, following the target repository's documentation conventions.
- Record design decisions once all questions have been answered by the user.
