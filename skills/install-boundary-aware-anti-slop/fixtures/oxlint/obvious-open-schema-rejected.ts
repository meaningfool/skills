import { boundary } from "../../references/boundary-contracts.mjs";

declare const schema: {
  unknown(): { parse(input: unknown): unknown };
};
declare const unrestrictedRecordSchema: {
  parse(input: unknown): Record<string, string>;
};

export const decodeUnknown = boundary({
  schema: schema.unknown(),
  convert: (validated: unknown) => validated,
});

export const decodeUnrestrictedRecord = boundary({
  schema: unrestrictedRecordSchema,
  convert: (validated: Record<string, string>) => validated,
});
