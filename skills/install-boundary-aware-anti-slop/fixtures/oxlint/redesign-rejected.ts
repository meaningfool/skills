import { boundary, failure, success } from "../../references/boundary-contracts.mjs";

declare const openSchema: {
  parse(input: unknown): unknown;
};
declare const requestSchema: {
  parse(input: unknown): Readonly<{ requestId: string }>;
};

export function inspectUndeclaredRaw(input: unknown): boolean {
  return typeof input === "string";
}

export const decodeOpenValue = boundary({
  schema: openSchema,
  convert: (validated: unknown) => validated,
});

export const unboundedProvider = boundary.tolerant({
  source: "",
  variants: [],
  otherwise: success({ kind: "fallback" }),
});

export const launderedStrictOutput = boundary({
  schema: requestSchema,
  convert: (validated): unknown => validated as unknown,
});

export const launderedTolerantOutput = boundary.tolerant({
  source: "provider:event",
  variants: [
    {
      schema: requestSchema,
      convert: (validated): unknown => validated as unknown,
    },
  ],
  otherwise: failure("UNRECOGNIZED_PROVIDER_EVENT"),
});
