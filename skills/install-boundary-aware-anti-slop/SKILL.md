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

## Configure Oxlint

Merge the following entries into the target's existing Oxlint configuration,
using its established JSON/JSONC or JavaScript/TypeScript style. Do not replace
the configuration object.

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
Vite+, merge `jsPlugins`, `settings`, and `rules` inside `lint`, and place the
same installed-assets ignores in both `lint.ignorePatterns` and
`fmt.ignorePatterns`.

Keep all existing ignores. Add the installed plugin/runtime paths and the
repository's agent-tooling directories to lint ignores so vendored skill files
are not treated as application source. For Vite+, merge the same ignores into
both `lint.ignorePatterns` and `fmt.ignorePatterns`. Do not ignore broad
dot-directories or application source to hide findings.

## Verify and report

Run the repository's own lint, typecheck, and formatting/check commands using
its package manager. For Vite+, run the full `vp check`. Run the bundled
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
