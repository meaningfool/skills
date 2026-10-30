---
name: shape-boundaries
description: Express an expected change as the boundary changes it leads to, with the boundary model, to clarify what should be built and establish its scope. Use before slicing or refining a change.
---

# Shape Boundaries

## Goal

Express the change the user wants as the boundary changes it leads to, with the `boundary model` from the `use-boundary-model` skill: every boundary, resource, capability, and interface it adds, modifies, or removes, at every level it reaches. Clarify consumers, providers, interactions, interfaces, resources, and capabilities only as needed for that purpose.

Interview the user until no open question could add, remove, or redefine a boundary change. Then give the shape and ask the user to confirm it. Leave how to group or order the changes to slicing, and the details of each change to refinement.

## Choose questions

Before asking a question, state how different plausible answers could add, remove, or redefine a boundary change. If none could, list the question under `Details` instead of asking it.

Prefer questions that do not depend on unresolved shaping questions.

Ask the highest-leverage question first: the one whose answer could add, remove, or redefine the most boundary changes.

## Know when to stop

Keep only two question lists:

- **Open**: questions whose answers could add, remove, or redefine a boundary change.
- **Details**: questions whose answers could not; refinement starts from them.

The shape is complete when `Open` is empty and the user has confirmed the boundary changes. Do not continue with confirmatory or refinement questions after that.

## Guidelines

- Start with external boundaries by default.
- Include internal boundaries or technical choices when they add, remove, or redefine a boundary change.
- Use the current conversation and linked documents as the starting point.
- When a boundary map of the current system exists, start from it: mark each change NEW, MODIFIED, or REMOVED against it, and keep its names.
- Ask one question at a time and provide a recommended answer.
- Resolve questions from the codebase or existing decisions instead of asking the user.
- Label assumptions and ask only when they matter.
- Challenge fuzzy or conflicting terminology.
- Treat exact behavior rules, statuses, UI states, error presentation, schemas, frameworks, and hosting as details unless they pass the question test.

## Output

Before giving the shape, check every capability against `use-boundary-model`: it works on at least one resource and gives its consumer an output of its own. Fold a step into the capability it belongs to, and drop what the provider does on its own.

Give the shape in this form, and ask the user to confirm it:

```markdown
Resources of [Provider]:

- [NEW|MODIFIED|REMOVED] **[Resource]**: [one-line definition]

**[Consumer] <-> [Provider]**: [NEW|MODIFIED|REMOVED], [one-sentence description of the change]

- Interfaces: [interface] · [interface], each marked NEW or REMOVED when it changes
- [Area] (core|supporting)
  - [NEW|MODIFIED|REMOVED] [Capability]: [mode] **[Resource]** · [mode] **[Resource]** [interface, when only one offers it]

**Shape complete: [YES|NO]**

**Open**

- [Question] — Impact: [the boundary change it could add, remove, or redefine]

**Details**

- [Question] — About: [the boundary change it details]
```

## Record decisions

- Use the planning document designated by the user. If none is designated, ask which file should record the decisions, following the target repository's documentation conventions.
- Record the confirmed shape with its `Details` list, which refinement starts from.
- Record relevant design decisions even when they do not alter the boundary model.
