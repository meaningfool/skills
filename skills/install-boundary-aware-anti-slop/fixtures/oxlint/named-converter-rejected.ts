import { boundary } from "../../references/boundary-contracts.mjs";

type Request = Readonly<{ requestId: string }>;
declare const requestSchema: { parse(input: unknown): Request };

function launderRequest(validated: Request): unknown {
  return validated as unknown;
}

export const decodeRequest = boundary({
  schema: requestSchema,
  convert: launderRequest,
});
