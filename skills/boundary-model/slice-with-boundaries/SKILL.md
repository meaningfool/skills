---
name: slice-with-boundaries
description: Slice boundary changes into observable work increments. Use when the user needs to consider multiple slicing strategies.
---

# Slice With Boundaries

Help the user compare viable slicing strategies for boundary changes.

## What to do

- Read [slicing-strategies.md](references/slicing-strategies.md) before generating options. Use its questions, smells, and strategies for inspiration rather than as a checklist.
- Present 2-3 distinct slicing strategies. Always include at least one vertical strategy. The other options may use different vertical cuts or another strategy from the reference.
- Name any slicing smells present in each option and explain what causes them.
- Keep only options that differ in how they divide the work, not merely in ordering or bundle size.
- Compare what makes the strategies meaningfully different and the tradeoff the user is choosing.
- End with a recommendation.

## Guidelines

- Use the user's input: the conversation and/or a designated planning file as the starting point.
- Describe boundary changes using the `boundary model` defined in the `use-boundary-model` skill.

## Output

Present the user with the options using the following template:

```markdown
## Option A: Name

Tradeoff: [In 3 sentences max: the main design benefit and the main drawback of this option compared to other slicing options.]

1. Slice name
   - Boundary changes: ...
   - Demoable after this: ...
   - Work included: ...
2. ...
```

- `Demoable after this`: the main review anchor: what a person or agent can exercise, inspect, or observe after the slice lands. For a behavior-preserving enabling slice, name the repeatable evidence that current behavior remains unchanged.
- `Boundary changes`: the boundary changes implemented specifically in this slice. For an enabling slice, name the internal boundary and the external behavior that stays unchanged.
- `Work included`: a compact self-check of the work carried by this slice. It may include implementation detail; keep only what helps prove the slice is real and scoped.

## Record Decisions

After the user chooses a slicing strategy:

- Use the planning document designated by the user.
- If no planning document is designated, ask which file should record the slicing decisions.
- Ask the user to confirm the exact file path before writing.
- Record the chosen slicing strategy, the selected slices, any out-of-scope notes, and open slicing questions.
