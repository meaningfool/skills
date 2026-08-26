# Skills

Personal agent skills maintained by meaningfool.

Each leaf directory under `skills/` is an installable skill. Directories that
group related skills are categories and do not contain a `SKILL.md`.

## Boundary model

The skills in `skills/boundary-model/` form a related toolkit rather than a
mandatory linear workflow:

- `use-boundary-model` defines the model and its vocabulary.
- `shape-boundaries` explores the perimeter of an expected change.
- `refine-boundary` resolves implementation decisions for a selected change.
- `slice-with-boundaries` compares ways to divide boundary changes into work.
- `slices-to-issues` publishes refined slices as GitHub issues.

## Standalone skills

- `let-me-see` prepares an environment and manual verification scenarios.
- `workspace-clean-up` audits and cleans Git worktrees, branches, and stashes.
- `wrap-up` completes repository work through PR, merge, and cleanup.

## Pinned upstream dependencies

`install-anti-slop` is tracked as an external dependency from Dillon Mulroy's
repository. The [dependency manifest](dependencies/anti-slop.json) pins the
canonical source to an immutable commit and records a SHA-256 digest for every
file in the upstream skill subtree. The repository does not copy that
third-party skill into its owned `skills/` tree.

Check for a newer upstream revision, then explicitly write a reviewable pin
update:

```bash
node scripts/install-pinned-skill.mjs check-update
node scripts/install-pinned-skill.mjs update
```

Install the pinned and verified skill into an external target directory. The
installer validates every declared file before writing anything and records the
same source, revision, and file digests in `.upstream.json`:

```bash
node scripts/install-pinned-skill.mjs install \
  --destination .agents/external-skills/install-anti-slop
```

The install operation is repeatable at the same revision and leaves an
unchanged installation untouched. The focused fixture test covers provenance,
idempotency, and hash-mismatch rejection:

```bash
node scripts/install-pinned-skill.test.mjs
```
