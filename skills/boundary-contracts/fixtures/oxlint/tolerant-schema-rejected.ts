import { boundary, failure } from "../../references/boundary-contracts.mjs";

declare const openSchema: {
  parse(input: unknown): unknown;
};

export const adaptOpenProvider = boundary.tolerant({
  source: "provider:open",
  variants: [
    {
      schema: openSchema,
      convert: (validated: unknown) => validated,
    },
  ],
  otherwise: failure("UNRECOGNIZED_PROVIDER_VALUE"),
});
