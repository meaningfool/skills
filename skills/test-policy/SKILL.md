---
name: test-policy
description: Apply when implementing behavior, writing or changing tests, reviewing test changes, or auditing a test suite. Projects that require this policy load it explicitly through their agent instructions.
---

# Test policy

Read these principles before implementation and apply them again during review. Use the bundled [review procedure](references/review.md) at review time. Read the target repository's behavior contracts and required validation commands; this skill does not define product behavior.

## Behavior and expectations

Apply the quoted guidance together with the owned additions below: consequential forbidden effects, call counts, and relational invariants can provide a distinct behavioral failure signal.

From [pstack: Test Behavior, Not Implementation](https://github.com/cursor/plugins/blob/c47b12849e43f18d5c374c7069c744cc55b0ea00/pstack/skills/principle-test-behavior-not-implementation/SKILL.md), verbatim:

> A test calls the code the way its users do and asserts the result they observe against a literal expected value.

> For a constant, test the mechanism that reads it with one input instead of restating the value. For a mock, assert the payload it received or the state after the call, not that it was called. When no such assertion exists, delete the test.

From the [existing Test Justification Rubric](https://github.com/meaningfool/eventpulse/blob/64482e5f363bddf9a4299f9319368873f52d025a/docs/plans/test-suite-quality-follow-up.md#L479-L502), verbatim except the explicitly marked generalization in item 5:

1. **Behavior:** Name the capability and the consumer that relies on it.
2. **Seam:** Exercise an interface that the consumer or platform can actually use.
3. **Expected result:** Derive the expectation from the contract or a known-good example, not from the production implementation.
4. **Failure signal:** State what regression this test catches that a nearby test does not.
5. **Test doubles:** Control only a system boundary. Prefer a test database over mocking application persistence code. (Generalization: "EventPulse" becomes "application".)
6. **Change resilience:** A private refactor that preserves behavior should not require changing the assertion.

Also verbatim from that rubric:

> Do not preserve a test by extracting a production helper whose only consumer is that test.

## Whether to add a test

From [pstack: TDD Bug Fix](https://github.com/cursor/plugins/blob/c47b12849e43f18d5c374c7069c744cc55b0ea00/pstack/skills/tdd/SKILL.md), verbatim:

> Prefer no new test over a bad test.

> If no practical test path is obvious, do not create one from scratch just to satisfy the workflow.

Additions from this audit:

- A bug fix does not automatically require a new permanent regression test. Use the closest useful verification; name any consequential behavior that remains unverified.
- Use the least costly test boundary that can detect the failure. Pure policy can justify unit tests; orchestration can justify integration tests. A test at another layer must catch a distinct failure.
- External call counts, forbidden side effects, safety properties, and relations between outputs can be behavior. Do not reject an assertion solely because of its matcher or require a literal value for a relational invariant.

## Frontend and browser tests

Additions from this audit:

- Do not test ordinary product wording or styling constants. Test consequential transformations and interactions; machine-readable protocol values are not product copy.
- Locate controls through stable IDs or dedicated test attributes, not product wording or internal CSS structure. Assert relevant accessibility semantics separately.
- Do not add a special input case solely to prove unchanged display of API data. Use representative data-to-render coverage; add cases for distinct transformations, branches, or failure modes.
- Use browser tests for behavior that needs a browser: authentication/navigation integration, focus, permissions, resource lifecycle, and usable layout. Do not repeat component state matrices in the browser without a distinct failure signal.

## Removal and consolidation

Additions from this audit:

- Remove tests with no useful failure signal without requiring replacement. Consolidate tests that protect the same behavior.
- When retiring a distinct failure signal, name the loss and its consequence. Follow the task's accepted risk scope; do not describe it as redundancy.
- Keep tests of current behavior while changing its implementation. Retire superseded implementation assertions after the relevant replacement behavior is demonstrated.
- Measure net reductions including fixtures and replacement tests. Treat reduction targets as planning goals, not grounds to discard consequential protection.

