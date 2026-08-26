---
name: boundary-contracts
description: Define executable owned-decoder and tolerant-adapter boundaries for raw external input. Use when application code needs explicit schema validation, tolerant provider conversion, or a narrow owned result at a system boundary.
---

# Boundary Contracts

Use the reference runtime in [boundary-contracts.mjs](references/boundary-contracts.mjs)
as the portable contract vocabulary. Keep the wrapper implementation in the
target repository's own boundary module when installing this skill; do not make
the target depend on this skill directory at runtime.

## Choose the boundary category

- Use `ownedDecoder(schema, convert)` for stable input whose owned contract is
  controlled by the application. The wrapper calls `schema.parse(input)` before
  it calls `convert(validated)`, and returns the converted owned value.
- Use `tolerantAdapter(adapt)` for independently evolving provider or platform
  input. The adapter receives raw input and returns either `success(ownedValue)`
  or `failure(code, message)`.
- Leave ordinary internal functions unwrapped. Internal values do not cross a
  raw-input boundary and do not need this API.

The schema capability is deliberately small: any object with a
`parse(input: unknown)` method qualifies. Use the target repository's existing
schema library or a local implementation; do not introduce a mandatory schema
dependency.

## Declare and enforce the boundary

1. Keep the raw parameter on the wrapper implementation's callback only.
2. Pass validated data, not raw input, to an owned decoder's converter.
3. Return a narrow owned value from an owned decoder.
4. Return only `success(...)` or `failure(...)` from a tolerant adapter.
5. Keep runtime inspection inside the declared wrapper callback.
6. Keep purely internal functions outside the wrapper API.

The wrapper enforces schema invocation and the adapter result shape at runtime.
The boundary-aware lint rules enforce declarations, output types, and the
absence of open `unknown`/dictionary outputs statically; do not replace those
rules with comments or directory naming conventions.

## Enable the boundary-aware Oxlint rules

Copy the plugin directory from [oxlint](references/oxlint/) into the target
repository's owned tooling directory. The plugin is an ESLint-compatible JS
plugin and has no runtime dependency on this skill directory. Register the
copied `index.mjs` with the target's Oxlint configuration:

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

When this extension replaces Dillon Mulroy's generic policy, disable
`anti-slop/no-unknown-parameters`, `anti-slop/no-runtime-typeof`, and
`anti-slop/no-unsafe-dictionary-type`; keep the other generic rules enabled.
Configure wrapper aliases explicitly instead of relying on directory names or
comments.

The plugin enforces syntax it can prove: direct raw-parameter escapes,
obviously open output annotations, explicit schema-capability expressions, and
the adapter result vocabulary. It cannot prove the implementation behind an
imported schema or whether a selected property is semantically safe; runtime
wrapper checks and the target repository's type checker remain responsible for
those guarantees.

## Verify the contract

Run the executable accepted and rejected fixtures from this skill directory:

```bash
node --test skills/boundary-contracts/fixtures/*.test.mjs
```

With an Oxlint executable available, run the static fixture suite as well:

```bash
OXLINT_BIN=/path/to/oxlint \
  node skills/boundary-contracts/fixtures/run-oxlint-fixtures.mjs
```

The accepted fixtures cover a schema-backed owned decoder, a tolerant provider
adapter, and an ordinary internal function. The rejected fixtures cover an
undeclared raw boundary, handwritten owned-contract parsing, and an adapter
that attempts to return raw data. The Oxlint fixtures also cover the selected
EventPulse runtime-start and provider-event shapes, plus the handwritten
`parseCompletion` shape that should be redirected to an owned decoder.
