---
name: install-boundary-aware-anti-slop
description: Install, migrate, audit, or enforce the pinned generic Anti-Slop policy with strict/default and bounded tolerant boundary contracts. Use for TypeScript or JavaScript brownfield checks, remediation inventories, boundary-policy adoption, or upgrades from the former report-based wrapper.
---

# Install boundary-aware Anti-Slop

Complete the installation without asking the user to choose policy, paths, severities, package managers, or replacement
strategies. Infer target
conventions, preserve unrelated work, and stop with an exact conflict when an
existing installation cannot be proven managed.

## Inspect the target

1. Read repository instructions and relevant architecture documents.
2. Check `git status --short` and preserve unrelated changes.
3. Infer the package manager from `packageManager` and lockfiles. The supported managers are npm, pnpm, Yarn, and Bun. Use one manager throughout.
4. Locate standalone Oxlint, Oxfmt, Prettier, or Vite+ configuration and
   preserve its syntax, comments, helpers, order, and unrelated entries.
5. Inspect existing generic and boundary assets before writing.

Treat `tools/oxlint/anti-slop` as managed only when `.upstream.json` identifies
the expected source and records every durable file. Treat the boundary plugin
and runtime as managed only when their `.boundary-aware.json` files identify
the expected components. Reject missing, extra, modified, symlinked, or
unproven assets with the exact path.

Use established target paths when present; otherwise use
`tools/oxlint/boundary-aware/` and `tools/boundary-contracts/`.

## Choose the rollout

Use a brownfield check for audits, assessments, inventories, remediation
planning, or any target with active findings. Keep normal lint unchanged except
for narrow managed-asset ignores. Put the complete policy in a separate
configuration and expose ordinary Oxlint output through an opt-in command.

Use normal enforcement only when the user explicitly requests it or the
complete brownfield check is clean through genuine remediation.

Keep every finding active. Use no baselines, suppressions, lower severities,
generated reports, snapshots, before/after captures, or report workflow.

## Install the pinned generic dependency

Resolve this skill's owning repository, then use
`scripts/install-pinned-skill.mjs` and `dependencies/anti-slop.json`:

1. Create an OS temporary directory outside the target.
2. Run the pinned installer into `<temporary>/install-anti-slop`.
3. Invoke that verified copy's upstream installer with the target as its
   working directory.
4. Compare every installed generic asset with the pinned manifest.
5. Write `tools/oxlint/anti-slop/.upstream.json` only after the exact comparison
   succeeds. Record source, branch, revision, manifest hashes, installed paths,
   and SHA-256 digests.
6. Remove the temporary directory on success and failure.

Never install the upstream skill under the target's `.agents` tree. Audit an
existing managed installation before upgrading it and use upstream `--force`
only after that audit proves every recorded asset unchanged. Leave a current
installation byte- and timestamp-stable.

Enable every generic rule except the three narrowly superseded by the boundary
policy:

```text
anti-slop/no-chained-type-assertions
anti-slop/no-conditional-empty-object-spread
anti-slop/no-known-value-widening
anti-slop/no-module-mocking
anti-slop/no-object-parameters
anti-slop/no-reflect-apply
anti-slop/no-reflect-get
anti-slop/no-shape-in-symbol-names
anti-slop/no-unknown-returns
anti-slop/no-unknown-type-aliases
anti-slop/no-widen-then-assert
anti-slop/require-safety-comment-for-type-assertion
```

The boundary-aware plugin replaces only
`anti-slop/no-unknown-parameters`, `anti-slop/no-runtime-typeof`, and
`anti-slop/no-unsafe-dictionary-type`. Unrelated generic rules remain active
inside boundary declarations.

## Install the boundary assets

Run the bundled installer from the target repository:

```bash
node <this-skill-directory>/scripts/install.mjs
```

Use `--destination`, `--runtime-destination`, or `--skip-runtime` only when the
target already has an established compatible location or runtime.

The installer owns the boundary plugin, four rules, shared helpers, runtime,
declarations, and provenance. A managed v1 upgrade removes only retired files
listed in the old provenance, including the former `assessment.mjs` runner and
`require-schema-for-owned-boundary.mjs` rule. It preserves unrelated files and
rejects locally edited managed assets.

## Configure the target

Append only missing narrow ignores:

```text
.agents/external-skills/install-anti-slop/**
tools/oxlint/anti-slop/**
tools/oxlint/boundary-aware/**
tools/boundary-contracts/**
```

Apply them to every active lint and formatter configuration. For Vite+, add
them to both `lint.ignorePatterns` and `fmt.ignorePatterns`. For Prettier, use
`.prettierignore` only when Prettier is active. Preserve every existing entry
and avoid broad application, test, tool, or dot-directory ignores.

Use this policy overlay:

```json
{
  "jsPlugins": [
    {
      "name": "anti-slop",
      "specifier": "./tools/oxlint/anti-slop/index.ts"
    },
    {
      "name": "boundary-aware",
      "specifier": "./tools/oxlint/boundary-aware/index.mjs"
    }
  ],
  "settings": {
    "boundary-contracts": {
      "failureNames": ["failure"]
    }
  },
  "rules": {
    "boundary-aware/require-declared-boundary": "error",
    "boundary-aware/require-constraining-schema": "error",
    "boundary-aware/require-bounded-tolerant-boundary": "error",
    "boundary-aware/no-raw-boundary-data-escape": "error"
  }
}
```

Add the twelve generic rules above at `"error"`. Preserve any explicitly
selected Effect plugin.

### Brownfield check

Keep only the narrow ignores in normal lint. Create a separate configuration,
defaulting to `.oxlint.anti-slop.json`, that preserves applicable parser and
ignore settings and adds the complete overlay.

Add or reuse a repository-native opt-in command. Default to:

```json
{
  "scripts": {
    "anti-slop:check": "oxlint --config .oxlint.anti-slop.json ."
  }
}
```

Run it through the target package manager. Its non-zero exit while findings
exist is expected. It writes no durable output.

### Normal enforcement

Merge the complete overlay into the target's active lint configuration. For
Vite+, merge it under `lint`. Remove the brownfield-only configuration and
command only when their ownership is clear and the normal policy is clean.

## Migrate the former report wrapper

Let the managed installer retire provenance-owned plugin files. Remove old
configuration entries only when they exactly match the former managed
convention and review the diff first:

- `anti-slop:assessment`;
- `.oxlint.assessment.json`;
- `reports/anti-slop/**` ignores; and
- before/after capture instructions.

Do not automatically delete generated reports or target configuration without
ownership evidence. Report the exact paths for manual cleanup instead.

## Verify and report

Run the target's normal lint, typecheck, and formatting checks. In brownfield
mode, prove those checks remain usable and the opt-in command emits ordinary
non-zero lint findings without creating files. In enforcement mode, prove the
policy is active in normal lint.

Run focused fixtures:

```bash
node --test <this-skill-directory>/fixtures/*.test.mjs
OXLINT_BIN=<target-oxlint> \
  node <this-skill-directory>/fixtures/run-oxlint-fixtures.mjs
node --test <this-skill-directory>/scripts/install.test.mjs
```

Run `scripts/managed-assets.test.mjs` and `scripts/forward-test.mjs` when
validating this skill repository.

Report the pinned revision, provenance status, managed paths, selected rollout,
configuration and command, dependency versions, checks, fixture results,
temporary cleanup, idempotence, and every remaining finding or exact conflict.
List ordinary toolchain failures separately from Anti-Slop findings.
