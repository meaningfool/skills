# Review procedure

Apply the principles in SKILL.md; do not create a second policy.

## Changed-work review (default)

1. Inspect added, modified, and deleted tests, changed fixtures/harnesses, and relevant existing coverage for changed production behavior. Do not audit unrelated suites.
2. For each material change, check the subject, independent expected result, owning test boundary, and distinct failure signal against SKILL.md. For deletions, distinguish no-value removal, consolidation, and deliberate loss.
3. Keep expected results derived from the contract rather than adjusting them to reproduce a wrong implementation. For high-consequence consolidation or uncertain overlap, use a focused failing-before check or a deliberate regression to establish that the retained test detects the intended fault; do not require mutation infrastructure or such proof for trivial deletion.
4. Run applicable focused and repository checks. Report existing failures or environmental limits accurately; do not hide them by skipping tests.
5. Record one concise outcome covering protection retained or deliberately removed, material findings, and validation. Use the existing review/fix gate; add no separate reviewer, per-test registry, coverage ledger, or mandatory coverage percentage.

## Full-suite audit (only when requested)

Apply the same principles to the requested area or whole suite. Group candidates by test pattern and code owner. Identify actual source ranges, preserved checks, distinct protection lost, risk, and dependencies on planned refactors. Estimate and then measure net code/runtime changes including fixtures; moving tests or moving fixtures to an uncounted format is not a reduction.

Inspect consumer behavior and existing coverage before proposing replacement tests. Do not impose a deletion quota.

