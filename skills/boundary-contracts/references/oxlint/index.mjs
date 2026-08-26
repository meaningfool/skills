import { noRawBoundaryDataEscapeRule } from "./rules/no-raw-boundary-data-escape.mjs";
import { requireDeclaredBoundaryRule } from "./rules/require-declared-boundary.mjs";
import { requireSchemaForOwnedBoundaryRule } from "./rules/require-schema-for-owned-boundary.mjs";

const boundaryAwarePlugin = {
  meta: {
    name: "boundary-aware",
  },
  rules: {
    "require-declared-boundary": requireDeclaredBoundaryRule,
    "require-schema-for-owned-boundary": requireSchemaForOwnedBoundaryRule,
    "no-raw-boundary-data-escape": noRawBoundaryDataEscapeRule,
  },
};

export default boundaryAwarePlugin;
