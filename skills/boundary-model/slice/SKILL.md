---
name: slice
description: Slice a change into observable work increments, along its boundary changes when it has them. Use when the user needs to consider multiple slicing strategies.
---

# Slice

Help the user compare viable slicing strategies for a change.

## What to do

- Use the user's input: the conversation and/or a designated planning file as the starting point.
- Present 2-3 distinct slicing strategies. Always include at least one vertical strategy. Keep only options that differ in how they divide the work, not merely in ordering or bundle size.
- When the change is described as boundary changes, slice along them: each slice implements whole boundary changes, and describe each slice with the `boundary model` defined in the `use-boundary-model` skill. Split a boundary change only when it is too large, by its capabilities, resources, or interfaces, and say so.
- Name any slicing smells present in each option and explain what causes them.
- Compare the tradeoff the user is choosing, and end with a recommendation.

## Vocabulary

- **Enabling slice**: establishes or changes an internal boundary, routes current behavior through it, and proves that external behavior stays the same. Watch for infrastructure that has no immediate consumer.
- **Parallel change**: expands the contract to support the old and new forms, migrates consumers, then removes the old form. Use it when a contract or persisted representation cannot change for every consumer at once.
- Slicing smells, a reason to question a strategy, not an automatic rejection:
  - **Heavy first slice**: the first slice contains most of the work or risk because later slices reuse the same underlying change.
  - **Invalid intermediate state**: the system would be broken, misleading, or unable to meet its contract between slices.
  - **Duplicate authority**: an intermediate slice leaves two places responsible for the same decision or lifecycle.
  - **Same final verification**: every slice needs the same full-system check, so the split gives no earlier feedback.
  - **Verification-only slice**: a slice carries no work of its own, only checks on work from earlier slices; fold those checks into the slice whose work they verify.

## Output

```markdown
## Option A: Name

Tradeoff: [In 3 sentences max: the main benefit and the main drawback of this option compared to the other options.]

1. Slice name: [what a person or agent can observe once it lands]
   - Boundary changes: [the boundary changes implemented in this slice, when the change has them]
2. ...
```

## Record Decisions

After the user chooses a slicing strategy:

- Use the planning document designated by the user. If none is designated, ask which file should record the decisions, following the target repository's documentation conventions.
- Record the chosen slicing strategy, the selected slices, any out-of-scope notes, and open slicing questions.
