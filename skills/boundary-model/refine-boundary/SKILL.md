---
name: refine-boundary
description: Refine a selected boundary change. Use when boundaries have already been shaped but need clearer decisions or specification before creating issues.
---

# Refine Slices

## What to do

The goal is to refine a boundary change to make it ready for implementation. Use the `boundary model` as defined in the `use-boundary-model` skill.

Interview me until we reach a shared understanding on all the implementation details of the boundary change, and agree it is ready for implementation.

## Guidelines

- Use the user's input and/or the designated planning file as the starting point.
- Start by restating the expected boundary change to be refined. If the expected boundary change is not obvious, ask the user to clarify or to use the `shape-boundaries` skill first.
- Ask the questions one at a time, waiting for feedback on each question before continuing. For each question, provide your recommended answer.
- When questions about related details (e.g. a set of interface decisions) can be grouped, group them into a single proposal highlighting which specific aspects of the proposal require feedback.
- If a prototype already exists, ask if it should be used as is, or as a guideline.
- Keep specification statements short, explicit, and grouped under clear headings.

## Record Decisions

- Use the planning document designated by the user.
- If no planning document is designated, ask if a file should record the refinement decisions.
- Record design decisions once all questions have been answered by the user.
