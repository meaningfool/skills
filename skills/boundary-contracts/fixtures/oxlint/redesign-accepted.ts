import { boundary, failure } from "../../references/boundary-contracts.mjs";

type Request = Readonly<{ requestId: string }>;
type Message = Readonly<{ kind: "message"; text: string }>;

declare const requestSchema: {
  parse(input: unknown): Request;
};
declare const providerV1Schema: {
  parse(input: unknown): Readonly<{ payload: Readonly<{ text: string }> }>;
};
declare const providerV2Schema: {
  parse(input: unknown): Readonly<{ message: string }>;
};

export const decodeRequest = boundary({
  schema: requestSchema,
  convert: (validated): Request => validated,
});

export const adaptProviderMessage = boundary.tolerant({
  source: "provider:message",
  variants: [
    {
      schema: providerV1Schema,
      convert: (validated) => ({
        kind: "message",
        text: validated.payload.text,
      }),
    },
    {
      schema: providerV2Schema,
      convert: (validated) => ({ kind: "message", text: validated.message }),
    },
  ],
  otherwise: failure("UNRECOGNIZED_PROVIDER_MESSAGE"),
});

const providerResult = adaptProviderMessage({});
if (providerResult.ok) {
  const providerMessage: Message = {
    kind: "message",
    text: providerResult.value.text,
  };
  void providerMessage;
}

export function ignoreOptionalError(_error: unknown): void {}

export function addDurations(left: number, right: number): number {
  return left + right;
}
