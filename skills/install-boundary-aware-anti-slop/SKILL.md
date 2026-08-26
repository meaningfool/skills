---
name: install-boundary-aware-anti-slop
description: Install or assess the pinned generic anti-slop policy together with the boundary-aware Oxlint plugin and boundary wrappers. Use when a TypeScript or JavaScript repository needs anti-slop enforcement, an audit or assessment, an inventory, or a remediation plan that distinguishes owned schema-backed inputs from tolerant external adapters, or when an existing anti-slop installation must be migrated to that policy.
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
5. Look for an existing generic `tools/oxlint/anti-slop` installation and
   boundary runtime or plugin. Treat generic assets as managed only when
   `tools/oxlint/anti-slop/.upstream.json` identifies the expected source and
   records every durable installed file. Treat boundary assets as managed only
   when their own provenance files identify the expected source and content. A
   directory without provenance is an unmanaged collision, not permission to
   overwrite it.

Do not ask a question when a convention can be inferred. Use the target's
existing tooling directory when one is clear; otherwise use the deterministic
defaults `tools/oxlint/boundary-aware/` and `tools/boundary-contracts/`.

## Choose the mode

Infer the mode from the request before changing the target configuration:

- Use assessment mode for audit, assessment, inventory, or remediation-planning requests. Assessment reports findings without enabling the policy in normal lint.
- Use enforcement mode only when the user explicitly requests enforcement or when a complete assessment has passed. A target with existing findings remains in assessment mode.
- In assessment mode, add only the narrow managed-asset ignores to the normal checks. Keep its existing plugins, rules, and severities unchanged. Put the complete anti-slop policy in a separate Oxlint configuration.
- In enforcement mode, merge the complete policy into normal lint at its intended severities. Keep the installed assets and their provenance unchanged when they are current.

Do not turn an assessment into a baseline. Every finding remains an active finding until its source is repaired, and assessment mode never adds suppressions, lowers a severity, or records accepted violations.

## Compose the pinned dependency

Install Dillon Mulroy's `install-anti-slop` skill from the pinned dependency
owned by `meaningfool/skills`; do not copy its source into this skill or into
the target's owned source tree. Resolve the owning checkout by following this
skill's installation/symlink location to its repository root, where
`scripts/install-pinned-skill.mjs` and `dependencies/anti-slop.json` live.

- Create an OS temporary directory outside the target repository. Use the
  owning repository's `<skills-root>/scripts/install-pinned-skill.mjs install
  --destination <temporary>/install-anti-slop` command to download and verify
  every file in the authoritative pin.
- Invoke the temporary copy's upstream `install-anti-slop` installer with the
  target repository as its working directory. This writes only the upstream
  `tools/oxlint/anti-slop` assets needed by the target; never install the
  upstream skill under `.agents`, `.agents/skills`, or
  `.agents/external-skills`.
- After the upstream installer returns, compare the installed generic-plugin
  tree and every file digest with the verified temporary
  `assets/anti-slop` tree. Stop with the exact path on any mismatch, and write
  target provenance only after this comparison succeeds.
- Write `tools/oxlint/anti-slop/.upstream.json` beside those durable assets.
  Record the canonical source, branch, revision, manifest hashes, and an
  `installedFiles` entry for every installed generic-plugin file, including its
  source manifest path and SHA-256 digest. Do not copy the upstream skill's
  `SKILL.md`, installer, or temporary provenance into the target.
- Always remove the temporary directory in a cleanup step, including when the
  upstream installer or a later verification step fails. A target `.agents`
  directory may be read-only because this flow must not write there.

When `tools/oxlint/anti-slop` already exists, validate its provenance and
compare every file and directory entry with the recorded `installedFiles`.
Report the exact path for any missing file, extra entry, or changed digest and
stop before overwriting it. If the recorded provenance identifies the
canonical source but an older revision, upgrade it only after that audit passes;
run the pinned temporary installer and write fresh provenance. Use an upstream
`--force` option only for that already-audited, managed upgrade; never use it
as a shortcut for the review. When the provenance
matches the current pin and every installed hash matches, leave the generic
plugin byte-for-byte and timestamp unchanged.

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
[boundary-contracts.d.ts](references/boundary-contracts.d.ts), the
[boundary-aware Oxlint plugin](references/oxlint/index.mjs), and the assessment
runner:

```bash
node <this-skill-directory>/scripts/install.mjs
```

Use `--destination` and `--runtime-destination` only when the target has an
established equivalent tooling layout. The installer copies only the owned
boundary plugin, assessment runner, wrappers, and TypeScript declarations. It records
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

The first path remains a narrow compatibility ignore for legacy external
installs; the ephemeral workflow does not create that directory. The final
path is the reserved output directory for machine-readable and human-readable
assessment reports. Do not replace existing ignores, reorder them, or add a
broad `tools/**`, dot-directory, application-directory, or test-directory
pattern. Preserve comments and blank lines in ignore files. A rerun with the
same installation must make no file or ordering changes.

### Standalone Oxlint

For enforcement, merge the managed paths, plugins, settings, and rules into
the target's existing `.oxlintrc.*` or `oxlint.config.*` file, preserving its
JSON/JSONC or JavaScript/TypeScript module style. Do not replace the
configuration object. For assessment, merge only the managed paths into this
normal configuration and use the separate assessment configuration below.

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
Vite+ enforcement, merge `jsPlugins`, `settings`, and `rules` inside `lint`
and place the managed paths in both `lint.ignorePatterns` and
`fmt.ignorePatterns`. For assessment, put the policy in the standalone
assessment configuration and add only those managed paths to normal checks.

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
`fmt` blocks (or a declared `vite-plus` dependency). In enforcement mode merge
the Oxlint plugin, settings, and rules above inside `lint`; in assessment mode
keep those policy entries in the standalone assessment configuration. In both
modes merge the managed paths into `lint.ignorePatterns` and
`fmt.ignorePatterns`. Preserve the existing module syntax and unrelated Vite,
test, build, and task configuration.

The temporary upstream skill path and the installed plugin/runtime paths must
be in lint ignores so vendored executable files are not treated as application
source. The generic and boundary-aware plugin entries remain active in
`jsPlugins` even when their source paths are in `ignorePatterns`: target-file
selection and plugin loading are separate. For Vite+, the same narrow paths
must be present in `fmt.ignorePatterns` as well.

### Assessment configuration and command

In assessment mode, create `.oxlint.assessment.json` beside the normal
configuration. Preserve the target's applicable existing ignore and parser
settings, then add this complete policy overlay. Keep every policy rule at its
intended `"error"` severity:

```json
{
  "ignorePatterns": [
    ".agents/external-skills/install-anti-slop/**",
    "tools/oxlint/anti-slop/**",
    "tools/oxlint/boundary-aware/**",
    "tools/boundary-contracts/**",
    "reports/anti-slop/**"
  ],
  "jsPlugins": [
    { "name": "anti-slop", "specifier": "./tools/oxlint/anti-slop/index.ts" },
    { "name": "boundary-aware", "specifier": "./tools/oxlint/boundary-aware/index.mjs" }
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
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "boundary-aware/require-declared-boundary": "error",
    "boundary-aware/require-schema-for-owned-boundary": "error",
    "boundary-aware/no-raw-boundary-data-escape": "error"
  }
}
```

For JavaScript/TypeScript and Vite+ configs, use the same module style in the
assessment file and resolve plugin paths relative to the target repository.
For Vite+, keep the assessment policy in the standalone assessment config;
leave the normal `lint` policy unchanged until enforcement is requested.

Add a package script named `anti-slop:assessment` that invokes
`node tools/oxlint/boundary-aware/assessment.mjs` and passes the selected
assessment config with `--config` when it is not the default
`.oxlint.assessment.json`. Invoke it through the detected package manager,
never by creating a second package-manager lockfile. The command runs the
separate config, keeps its exit status non-zero when findings exist, and writes
the stable assessment reports.

Capture the normal toolchain immediately before and after dependency or Oxlint
installation:

```text
<package-manager> run anti-slop:assessment -- --capture before
<package-manager> install …
<package-manager> run anti-slop:assessment -- --capture after
<package-manager> run anti-slop:assessment
```

Use the package manager's native script syntax for Yarn and Bun when their
syntax differs. Capture `lint`, `typecheck`, and `format:check` independently;
an absent script is recorded as not configured. These snapshots describe the
normal toolchain and are not an anti-slop baseline.

The runner writes `reports/anti-slop/assessment.json` and
`reports/anti-slop/assessment.txt`, plus deterministic
`toolchain-before.json` and `toolchain-after.json` snapshots. The machine
report contains sorted finding items and totals by severity, rule, and file.
It puts non-policy Oxlint diagnostics under
`toolchainDiagnostics.oxlint` and after-only diagnostics from the before/after
snapshots under `toolchainDiagnostics.introduced`, classified as
`introduced-by-dependency-or-oxlint-change`. It contains no timestamp or
absolute target path. The readable report is concise and repeats the finding
total, per-rule totals, Oxlint diagnostics, and introduced toolchain diagnostic
count.

## Verify and report

Run the repository's own lint, typecheck, and formatting/check commands using
its package manager after the configuration merge. In assessment mode, prove
that normal lint, typecheck, and formatting remain usable while the package
manager-native assessment command exits non-zero for policy findings. In
enforcement mode, prove that the complete policy is active in normal lint. For
Vite+, run the full `vp check`. Run the bundled
[boundary runtime fixtures](fixtures/accepted.test.mjs) and [Oxlint fixture
runner](fixtures/run-oxlint-fixtures.mjs) as focused checks:

```bash
node --test <this-skill-directory>/fixtures/*.test.mjs
OXLINT_BIN=<target-oxlint> node <this-skill-directory>/fixtures/run-oxlint-fixtures.mjs
```

Do not fix unrelated target findings, weaken rule severity, add suppression
comments, or launder types to make the new checks pass. Report remaining
assessment findings with their paths and commands, and list toolchain
diagnostics separately from policy findings.

Report:

- the pinned upstream revision and whether it was fresh, current, or upgraded;
- the pinned source and per-file hashes recorded in
  `tools/oxlint/anti-slop/.upstream.json`;
- the managed asset paths and whether each changed;
- the Oxlint configuration file and merged rules/ignores;
- the selected mode, separate assessment configuration, package-manager-native
  assessment command, and stable report paths when assessment was selected;
- the package manager and dependency versions involved;
- lint, typecheck, formatting, fixture, temporary-directory cleanup, and
  read-only-`.agents` results;
- assessment totals by rule/severity/file and the before/after toolchain
  diagnostics, including any diagnostics introduced by dependency or Oxlint
  changes;
- any exact conflict or remaining finding that needs human review.

Maintainers can forward-test this entire procedure in disposable repositories
with `node scripts/forward-test.mjs`. That matrix covers npm, pnpm, Yarn, and
Bun; JSON, JSONC, JavaScript/TypeScript module, and Vite+ Oxlint configuration;
fresh, read-only-`.agents`, current, outdated-managed, modified-generic,
unmanaged-generic, and boundary-conflict states; idempotent reruns; exact
generic-plugin hash/conflict checks; and lint, typecheck, format,
configuration, fixture, temporary-cleanup, and provenance evidence. The
forward test is validation for this skill repository, not an extra setup step
for a user target. The assessment critical path covers generic and
boundary-aware findings, normal-check preservation, separate toolchain
diagnostics, report totals, enforcement transition, and idempotent reruns.

The focused managed-asset smoke test covers the critical path with real
standalone Oxlint/Oxfmt, Prettier, and Vite+ commands:

```bash
node --test <this-skill-directory>/scripts/managed-assets.test.mjs
node --test <this-skill-directory>/scripts/assessment.test.mjs
```
