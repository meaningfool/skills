# Slicing strategy prompts

Use these prompts to generate distinct options. They are sources of inspiration,
not a required sequence or a complete catalog.

## Vertical slices

Start with vertical slices. Here are questions inspired by Richard Lawrence to
identify vertical slicing options:

- Does the change describe a workflow? Can you take a thin slice through it and
  add more later? If not, can you implement the beginning and end first, then
  add steps from the middle?
- Does the change include multiple operations, such as managing or configuring
  something? Can each operation be a separate slice?
- Does the change contain several rule variations? Can one subset of the rules
  work first, with the remaining rules added later?
- Does the same behavior apply to different kinds of data? Can one kind work
  first, with the others added later?
- Does the same kind of data arrive through several interfaces? Can one
  interface work first, with the others added later?
- Is there a simple core that provides most of the value or learning? Can it
  work first, with more complex cases added later?
- Does much of the complexity come from a quality requirement such as
  performance? Can the change work first and meet that requirement later?
- Does the change have a complex interface? Can a simpler version work first?

Different answers can produce different vertical strategies for the same
change.

## Slicing smells

| Smell | What to look for |
| --- | --- |
| Heavy first slice | The first slice contains most of the work or risk because later slices reuse the same underlying change. |
| Invalid intermediate state | The system would be broken, misleading, or unable to meet its contract between slices. |
| Duplicate authority | An intermediate slice leaves two places responsible for the same decision or lifecycle. |
| Same final verification | Every slice needs the same full-system check, so the split gives no earlier feedback or independently repeatable evidence. |

Use these names in the comparison when they apply. A smell is a reason to
question a strategy, not an automatic rejection.

## Strategies for shared changes

Use these when they fit the change. They may be combined with vertical slices.

### Enabling slice

- **Use when:** The same internal change dominates several outcomes.
- **Sequence:**
  1. Establish or change a named internal boundary.
  2. Route current behavior through it and prove that external behavior stays
     the same.
  3. Follow with slices that use the boundary.
- **Watch for:** Infrastructure that has no immediate consumer.

### Parallel change

- **Use when:** A contract or persisted representation cannot change for every
  consumer at once.
- **Sequence:**
  1. Expand the contract to support the old and new forms.
  2. Migrate consumers.
  3. Remove the old form.
- **Watch for:** A phase that cannot run safely until the next phase lands.
