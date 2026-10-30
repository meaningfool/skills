# Boundary Model Skills

Use the skill that matches the current decision:

| Need | Skill |
| --- | --- |
| Define or apply the boundary model | `use-boundary-model` |
| Express a change as the boundary changes it leads to | `shape-boundaries` |
| Compare ways to slice a change into pieces of work | `slice` |
| Settle the details of a change | `refine` |
| Publish slices or changes as GitHub issues, each with its proof of done | `to-issues` |

Each skill settles one kind of question:

- `shape-boundaries`: which boundary changes the change leads to. It leaves
  grouping to slicing and details to refinement, in a `Details` list.
- `slice`: how to group and order the changes into pieces of work.
- `refine`: the expected behavior and design decisions of each change.
- `to-issues`: what each issue needs to be implemented without the plan, and
  how to prove it is done.

Skip a skill when it has nothing to settle. Common paths:

- Shape, refine, then issues: the change is one piece of work.
- Shape, slice, refine each slice, then issues.
- Shape, slice, then issues: the details are already settled, for example by
  existing behavior or an earlier delivery.

Refinement can also happen when an issue starts, instead of before issues are
created. `slice`, `refine`, and `to-issues` also work without boundary changes.
