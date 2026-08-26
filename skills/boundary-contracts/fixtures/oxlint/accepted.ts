import {
  failure,
  ownedDecoder,
  success,
  tolerantAdapter,
} from "../../references/boundary-contracts.mjs";

type RuntimeStart = Readonly<{
  kind: "runtime-start";
  runId: string;
}>;

type ProviderEvent = Readonly<{
  kind: "provider-event";
  type: string;
}>;

declare const runtimeStartSchema: object;

const inlineSchema = {
  parse(value: object) {
    return value;
  },
};

export const decodeRuntimeStart = ownedDecoder(
  runtimeStartSchema,
  (validated): RuntimeStart => ({
    kind: "runtime-start",
    runId: validated.runId,
  }),
);

export const decodeWithInlineSchema = ownedDecoder(inlineSchema, (validated) => validated);

export const adaptProviderEvent = tolerantAdapter((input: unknown) => {
  if (input === null || typeof input !== "object" || !("type" in input)) {
    return failure("UNSUPPORTED_EVENT");
  }

  const type = input.type;

  if (typeof type !== "string") {
    return failure("UNSUPPORTED_EVENT");
  }

  return success({
    kind: "provider-event",
    type,
  } satisfies ProviderEvent);
});
