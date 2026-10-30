---
name: shape-boundaries
description: Explore an expected change with the boundary model to clarify what should be built and establish its scope. Use before choosing a slicing strategy.
---

# Shape Boundaries

## Goal

Explore the expected change with the `boundary model` from the `use-boundary-model` skill until what should be built is clear enough to express its perimeter as a set of boundary changes. Clarify consumers, providers, interactions, interfaces, resources, and capabilities only as needed for that purpose.

Interview the user until the perimeter is clear and the structural uncertainties that could affect slicing strategies have been resolved. Once the work is ready for slicing, stop questioning and recap the shape and remaining uncertainties.

## Choose questions

Before asking a question, state how different plausible answers could:

- expand, narrow, or redefine the perimeter; or
- change which slicing strategies are viable or preferable, including what must be grouped or ordered together.

If neither applies, defer the question.

Prefer questions that do not depend on unresolved shaping questions. Defer a dependent question unless its answer could still change the perimeter or available slicing strategies.

When several questions qualify, ask the one with the greatest expected impact on the perimeter or slicing strategies. Do not invent an impact to justify asking a question.

## Know when to stop

Keep only two question lists:

- **Before slicing**: questions with an identified perimeter or slicing-strategy impact.
- **Can wait**: questions with no identified impact on the perimeter or slicing strategies.

The work is ready for slicing when:

1. The perimeter can be stated without unresolved alternatives that would add, remove, or redefine boundary changes.
2. `Before slicing` is empty because no identified uncertainty could make a materially different slicing strategy viable or preferable.

Do not continue with confirmatory or refinement questions after these conditions are met.

## Guidelines

- Start with external boundaries by default.
- Include internal boundaries or technical choices when they could affect the perimeter or slicing strategies.
- Use the current conversation and linked documents as the starting point.
- When a boundary map of the current system exists, start from it: mark each change NEW, MODIFIED, or REMOVED against it, and keep its names.
- Ask one question at a time and provide a recommended answer.
- Resolve questions from the codebase or existing decisions instead of asking the user.
- Label assumptions and ask only when they matter.
- Challenge fuzzy or conflicting terminology.
- Treat statuses, UI states, error presentation, schemas, frameworks, and hosting as refinement unless they pass the question test.

## Output

Before giving the shape, check every capability against `use-boundary-model`: it works on at least one resource and gives its consumer an output of its own. Fold a step into the capability it belongs to, and drop what the provider does on its own.

When asked to output the shape, list the agreed boundary changes:

```markdown
Resources of [Provider]:

- [NEW|MODIFIED|REMOVED] **[Resource]**: [one-line definition]

**[Consumer] <-> [Provider]**: [NEW|MODIFIED|REMOVED], [one-sentence description of the change]

- Interfaces: [interface] · [interface], each marked NEW or REMOVED when it changes
- [Area] (core|supporting)
  - [NEW|MODIFIED|REMOVED] [Capability]: [mode] **[Resource]** · [mode] **[Resource]** [interface, when only one offers it]

**Ready for slicing: [YES|NO]**

**Before slicing**

- [Question] — Impact: [perimeter or slicing-strategy impact]

**Can wait**

- [Question] — Reason: [why it can be deferred]
```

## Record decisions

- Use the planning document designated by the user. If none is designated, ask which file should record the decisions, following the target repository's documentation conventions.
- Record relevant design decisions even when they do not alter the boundary model.
