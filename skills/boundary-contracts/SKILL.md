---
name: boundary-contracts
description: Define and enforce strict/default and bounded tolerant trust transitions for raw runtime input. Use when application code needs schema-backed HTTP, service, persistence, version-migration, provider, or platform boundaries that return narrow owned values.
---

# Boundary contracts

Use [boundary-contracts.mjs](references/boundary-contracts.mjs) as the portable
runtime vocabulary. Install a target-owned copy; application code must not
depend on this skill directory at runtime.

## Place the trust transition

A boundary is the one-time transition from an untrusted runtime representation
to an owned application value. Resolve suspicious raw handling by improving an
internal type, moving validation to the real ingress, declaring
`boundary({...})`, or declaring a justified `boundary.tolerant({...})`.

Leave precisely typed internal functions outside this API. A declaration is
not a substitute for improving an internal contract.

### Strict/default boundary

Use `boundary({...})` for application-controlled HTTP, service, current
persistence, and other stable contracts:

```ts
const decodeRequest = boundary({
  schema: requestSchema,
  convert: (validated) => ({
    requestId: validated.requestId,
  }),
});
```

Require a constraining schema that rejects input outside the accepted contract.
The converter receives only validated data and returns a narrow owned value.
Keep the converter inline so lint can inspect its result.
Schemas that return `any`, `unknown`, `object`, `{}`, unrestricted records, or
their input unchanged do not establish a boundary.

### Tolerant boundary

Use `boundary.tolerant({...})` only for a bounded compatibility need:
independently evolving provider data, explicitly supported external versions,
or a time-bounded legacy migration.

```ts
const adaptProviderEvent = boundary.tolerant({
  source: "provider:event",
  variants: [
    {
      schema: providerV1Schema,
      convert: (validated) => ({ kind: "message", text: validated.text }),
    },
    {
      schema: providerV2Schema,
      convert: (validated) => ({ kind: "message", text: validated.message }),
    },
  ],
  otherwise: failure("UNRECOGNIZED_PROVIDER_EVENT"),
});
```

Keep the descriptor declarative: a non-empty static source, a finite non-empty
variant list, a constraining schema and validated converter for every variant,
and an explicit `failure(...)` fallback. The runtime tries variants in order,
returns `success(ownedValue)` for the first recognized value, and returns the
declared failure when none match. Keep converters inline so lint can inspect
their results; no callback receives raw input.

Keep the compatibility justification beside the declaration and add colocated
tests for recognized and unrecognized input.

## Enforce the declaration

Copy [oxlint](references/oxlint/) into the target's owned tooling directory and
register its `index.mjs`:

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

The rules enforce suspicious use of open parameters, constraining schemas,
bounded tolerant descriptors, narrow converter results, and the absence of
assertion laundering. A declaration discharges only the undeclared-boundary
diagnostic; unrelated Anti-Slop rules continue to apply inside it.

When composing with Dillon Mulroy's generic policy, replace only the overlapping
`anti-slop/no-unknown-parameters`, `anti-slop/no-runtime-typeof`, and
`anti-slop/no-unsafe-dictionary-type` rules with the boundary-aware rules above.
Keep every other generic rule at its intended severity.

Prefer named top-level declarations in recognizable boundary or adapter
modules. Treat that placement as review guidance rather than a path-based lint
rule.

## Verify the contract

Run the runtime fixtures:

```bash
node --test skills/boundary-contracts/fixtures/*.test.mjs
```

Run the static fixtures with an installed Oxlint executable:

```bash
OXLINT_BIN=/path/to/oxlint \
  node skills/boundary-contracts/fixtures/run-oxlint-fixtures.mjs
```

The fixtures cover application-controlled input, current and legacy
persistence, independently evolving provider data, precisely typed internal
code, undeclared raw handling, non-constraining schemas, unbounded tolerant
descriptors, unrecognized input, open results, and assertion laundering.
