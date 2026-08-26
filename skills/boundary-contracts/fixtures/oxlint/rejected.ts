import {
  ownedDecoder,
  success,
  tolerantAdapter,
} from "../../references/boundary-contracts.mjs";

declare const runtimeStartSchema: object;

type OpenOutput = Record<string, unknown>;

export const undeclaredRawBoundary = (input: unknown) => input;

export const missingSchema = ownedDecoder(null, (validated) => ({
  value: validated,
}));

export const escapedProviderData = tolerantAdapter((input: unknown) => success(input));

export const escapedDefaultProviderData = tolerantAdapter((input: unknown = {}) =>
  success(input),
);

export const openOwnedOutput = ownedDecoder(
  runtimeStartSchema,
  (validated): OpenOutput => validated,
);

export const unknownOwnedOutput = ownedDecoder(
  runtimeStartSchema,
  (validated: unknown) => validated,
);

export const escapedNestedProviderData = tolerantAdapter((input: unknown) =>
  success({
    payload: input,
  }),
);

export const escapedSpreadProviderData = tolerantAdapter((input: unknown) =>
  success({
    ...input,
  }),
);

export const invalidSchemaProperty = ownedDecoder(
  { parse: undefined },
  (validated) => validated,
);

export const invalidOpenOutputAssertion = ownedDecoder(
  runtimeStartSchema,
  (validated) => ({ value: validated } satisfies Record<string, unknown>),
);
