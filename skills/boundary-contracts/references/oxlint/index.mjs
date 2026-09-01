import { noRawBoundaryDataEscapeRule } from "./rules/no-raw-boundary-data-escape.mjs";
import { requireDeclaredBoundaryRule } from "./rules/require-declared-boundary.mjs";
import { requireConstrainingSchemaRule } from "./rules/require-constraining-schema.mjs";
import { requireBoundedTolerantBoundaryRule } from "./rules/require-bounded-tolerant-boundary.mjs";

const boundaryAwarePlugin = {
  meta: {
    name: "boundary-aware",
  },
  rules: {
    "require-bounded-tolerant-boundary": requireBoundedTolerantBoundaryRule,
    "require-constraining-schema": requireConstrainingSchemaRule,
    "require-declared-boundary": requireDeclaredBoundaryRule,
    "no-raw-boundary-data-escape": noRawBoundaryDataEscapeRule,
  },
};

export default boundaryAwarePlugin;
