---
name: install-boundary-aware-anti-slop
description: Install the pinned generic anti-slop policy together with the boundary-aware Oxlint plugin and boundary wrappers. Use when a TypeScript or JavaScript repository needs anti-slop enforcement that distinguishes owned schema-backed inputs from tolerant external adapters, or when an existing anti-slop installation must be migrated to that policy.
---

# Install boundary-aware anti-slop

Complete the installation in the current target repository without asking the
user to choose policy, paths, severities, package managers, or replacement
strategies. Infer those choices from the target repository and report the
assumptions. Preserve unrelated work and stop with an exact conflict when an
existing installation cannot be identified as managed.

## Inspect the target

1. Read the target repository's agent instructions and relevant project docs.
2. Check `git status --short`; leave existing changes untouched and keep the
   final diff limited to this installation.
3. Identify the package manager from `packageManager` and lockfiles. The
   supported managers are npm, pnpm, Yarn, and Bun. Use the existing manager
   for every dependency or script command; never create a new lockfile with
   another manager.
4. Find the existing Oxlint setup in `oxlint.config.*`, `.oxlintrc*`, or the
   repository's Vite+ configuration. Support JSON/JSONC, JavaScript/TypeScript
   module, and Vite+ configuration styles. Preserve the file format, module
   style, helper functions, comments, ordering conventions, and unrelated
   entries.
5. Look for an existing `install-anti-slop` installation and boundary runtime or
   plugin. Treat a directory as managed only when its provenance file identifies
   the expected source and content. A directory without provenance is an
   unmanaged collision, not permission to overwrite it.

Do not ask a question when a convention can be inferred. Use the target's
existing tooling directory when one is clear; otherwise use the deterministic
defaults `tools/oxlint/boundary-aware/` and `tools/boundary-contracts/`.

## Compose the pinned dependency

Install Dillon Mulroy's `install-anti-slop` skill from the pinned dependency
owned by `meaningfool/skills`; do not copy its source into this skill or into
the target's owned source tree. Resolve the owning checkout by following this
skill's installation/symlink location to its repository root, where
`scripts/install-pinned-skill.mjs` and `dependencies/anti-slop.json` live.

- On a fresh target, run the owning repository's
  `<skills-root>/scripts/install-pinned-skill.mjs install --destination
  .agents/external-skills/install-anti-slop` command, then invoke the installed
  upstream `install-anti-slop` skill from the target repository.
- When `.agents/external-skills/install-anti-slop/.upstream.json` already names
  the canonical Dillon source and the pinned revision, leave the dependency
  files unchanged and run only the missing boundary-aware steps.
- When that provenance names the canonical source but an older revision, run
  the pinned installer again. It replaces only the managed upstream files and
  leaves the target's configuration and unrelated files intact; the diff is the
  reviewable upgrade.
- When the destination exists without matching provenance, stop the dependency
  step and report the exact path and conflict. Never use `--force` to guess
  whether an unmanaged installation can be replaced.

The upstream skill's copied `tools/oxlint/anti-slop` directory has no separate
provenance file. When it already exists, compare every file and directory entry
with the `assets/anti-slop` tree in the installed pinned skill. An exact copy
with no extra entries is current and must be left untouched. Any changed file,
missing file, or extra entry is an unmanaged conflict: report the exact path
and stop before overwriting it. Do not use the upstream `--force` option as a
shortcut for that review.

Follow the upstream skill's package-manager and configuration guidance. Enable
all of its generic rules except the three rules replaced by the boundary-aware
plugin: `anti-slop/no-unknown-parameters`,
`anti-slop/no-runtime-typeof`, and `anti-slop/no-unsafe-dictionary-type`.
Keep these non-conflicting generic rules at `"error"`, plus any explicitly
opted-in project plugin:

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

## Install the owned boundary assets

Run the bundled deterministic installer from the target repository. The
installer owns the assets in [boundary-contracts.mjs](references/boundary-contracts.mjs),
[boundary-contracts.d.ts](references/boundary-contracts.d.ts), and the
[boundary-aware Oxlint plugin](references/oxlint/index.mjs):

```bash
node <this-skill-directory>/scripts/install.mjs
```

Use `--destination` and `--runtime-destination` only when the target has an
established equivalent tooling layout. The installer copies only the owned
boundary plugin, wrappers, and TypeScript declarations. It records
`.boundary-aware.json` provenance beside each component, stages updates before
replacement, and preserves unrelated files in those directories.

The installer has these safety rules:

- A fresh destination is created.
- A current managed destination is left byte-for-byte and timestamp unchanged.
- An older managed destination is upgraded after verifying that its previously
  managed files were not locally edited; unrelated files remain in place.
- A destination without matching provenance, a different component identity, a
  symlink, or a locally edited managed file is rejected with the exact path.

If the target already owns a compatible boundary runtime, keep that runtime and
configure the plugin's wrapper aliases to match it rather than installing a
second runtime. If the target already owns a compatible boundary plugin, use
its managed path only when its provenance is current; otherwise report the
conflict for review. In that case, pass `--skip-runtime` to the bundled
installer when the existing runtime is the compatible one being retained.

## Configure target checks

Before running any post-install lint or format check, merge the managed paths
into every lint/formatter configuration that the target actually uses. Keep
this exact ordered set of narrow patterns, appending only missing entries:

```text
.agents/external-skills/install-anti-slop/**
tools/oxlint/anti-slop/**
tools/oxlint/boundary-aware/**
tools/boundary-contracts/**
reports/anti-slop/**
```

The first path covers the verified upstream dependency while it is temporarily
installed; it disappears from the target when the dependency installation
workflow is made ephemeral. The final path is the reserved output directory
for machine-readable and human-readable assessment reports. Do not replace
existing ignores, reorder them, or add a broad `tools/**`, dot-directory,
application-directory, or test-directory pattern. Preserve comments and blank
lines in ignore files. A rerun with the same installation must make no file or
ordering changes.

### Standalone Oxlint

Merge the managed paths into `ignorePatterns` in the target's existing
`.oxlintrc.*` or `oxlint.config.*` file, preserving its JSON/JSONC or
JavaScript/TypeScript module style. Do not replace the configuration object.

```json
{
  "jsPlugins": [
    {
      "name": "boundary-aware",
      "specifier": "./tools/oxlint/boundary-aware/index.mjs"
    }
  ],
  "settings": {
    "boundary-contracts": {
      "ownedDecoderNames": ["ownedDecoder"],
      "tolerantAdapterNames": ["tolerantAdapter"],
      "successNames": ["success"],
      "failureNames": ["failure"]
    }
  },
  "rules": {
    "boundary-aware/require-declared-boundary": "error",
    "boundary-aware/require-schema-for-owned-boundary": "error",
    "boundary-aware/no-raw-boundary-data-escape": "error"
  }
}
```

If the plugin was installed at another path, use that path in `specifier` and
in the installed-assets ignore. If aliases already exist in the target,
preserve them and configure the exact names used by the target wrappers. For
Vite+, merge `jsPlugins`, `settings`, and `rules` inside `lint` and place the
managed paths in both `lint.ignorePatterns` and `fmt.ignorePatterns`.

### Standalone Oxfmt

When the target has an Oxfmt configuration (`.oxfmtrc.*` or
`oxfmt.config.*`), merge the managed paths into that configuration's
`ignorePatterns`. When the target's Oxfmt command uses `--ignore-path` (for
example, an established `.formatignore` file), append the same paths to that
ignore file as well. Oxfmt uses Git-style patterns relative to the config or
ignore file; keep the entries exactly as shown so explicit format checks cannot
rewrite installed assets. Create `.formatignore` only when the target already
has a formatter command convention that reads it.

### Prettier

When the target runs Prettier, detect it from its package manifest/scripts or
Prettier configuration. Merge the managed paths into `.prettierignore`,
creating that file only when Prettier is in use and no ignore file exists.
Append missing entries as lines, retaining existing comments, blank lines, and
order. This global ignore is also understood by Oxfmt, but still configure
Oxfmt's own `ignorePatterns` when standalone Oxfmt is present.

### Vite+

When the target uses Vite+, detect the `vite.config.*` file and its `lint` or
`fmt` blocks (or a declared `vite-plus` dependency). Merge the Oxlint plugin,
settings, and rules above inside `lint`; merge the managed paths into both
`lint.ignorePatterns` and `fmt.ignorePatterns`. Preserve the existing module
syntax and unrelated Vite, test, build, and task configuration.

The temporary upstream skill path and the installed plugin/runtime paths must
be in lint ignores so vendored executable files are not treated as application
source. The generic and boundary-aware plugin entries remain active in
`jsPlugins` even when their source paths are in `ignorePatterns`: target-file
selection and plugin loading are separate. For Vite+, the same narrow paths
must be present in `fmt.ignorePatterns` as well.

## Verify and report

Run the repository's own lint, typecheck, and formatting/check commands using
its package manager only after the configuration merge. For Vite+, run the full
`vp check`. Run the bundled
[boundary runtime fixtures](fixtures/accepted.test.mjs) and [Oxlint fixture
runner](fixtures/run-oxlint-fixtures.mjs) as focused checks:

```bash
node --test <this-skill-directory>/fixtures/*.test.mjs
OXLINT_BIN=<target-oxlint> node <this-skill-directory>/fixtures/run-oxlint-fixtures.mjs
```

Do not fix unrelated target findings, weaken rule severity, add suppression
comments, or launder types to make the new checks pass. Report the remaining
findings with their paths and commands.

Report:

- the pinned upstream revision and whether it was fresh, current, or upgraded;
- the managed asset paths and whether each changed;
- the Oxlint configuration file and merged rules/ignores;
- the package manager and dependency versions involved;
- lint, typecheck, formatting, and fixture results;
- any exact conflict or remaining finding that needs human review.

Maintainers can forward-test this entire procedure in disposable repositories
with `node scripts/forward-test.mjs`. That matrix covers npm, pnpm, Yarn, and
Bun; JSON, JSONC, JavaScript/TypeScript module, and Vite+ Oxlint configuration;
missing, current, outdated-managed, and unmanaged-conflict states; idempotent
reruns; and lint, typecheck, format, configuration, fixture, and provenance
evidence. The forward test is validation for this skill repository, not an
extra setup step for a user target.

The focused managed-asset smoke test covers the critical path with real
standalone Oxlint/Oxfmt, Prettier, and Vite+ commands:

```bash
node --test <this-skill-directory>/scripts/managed-assets.test.mjs
```
