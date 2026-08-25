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
- Ask one question at a time and provide a recommended answer.
- Resolve questions from the codebase or existing decisions instead of asking the user.
- Label assumptions and ask only when they matter.
- Challenge fuzzy or conflicting terminology.
- Treat statuses, UI states, error presentation, schemas, frameworks, and hosting as refinement unless they pass the question test.

## Output

When asked to output the shape, list the agreed boundary changes:

```markdown
**[Consumer <-> Provider]**
Change: [NEW|MODIFIED|REMOVED] [One-sentence description]
Interface: [...]
Resources and capabilities:

- [NEW|MODIFIED] [Resource or capability]: [Definition]

**Ready for slicing: [YES|NO]**

**Before slicing**

- [Question] — Impact: [perimeter or slicing-strategy impact]

**Can wait**

- [Question] — Reason: [why it can be deferred]
```

## Record decisions

- Use the planning document designated by the user, or create one in `docs/plan`.
- Record relevant design decisions even when they do not alter the boundary model.
