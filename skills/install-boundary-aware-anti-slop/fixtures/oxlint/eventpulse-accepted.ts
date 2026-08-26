import {
  failure,
  ownedDecoder,
  success,
  tolerantAdapter,
} from "../../references/boundary-contracts.mjs";

type RuntimeStart = Readonly<{
  runId: string;
  sdp: string;
}>;

type NormalizedProviderEvent = Readonly<{
  type: string;
  diagnosticSummary: Readonly<{ type: string }>;
}>;

declare const runtimeStartRequestSchema: object;

export const decodeRuntimeStart = ownedDecoder(
  runtimeStartRequestSchema,
  (validated): RuntimeStart => ({
    runId: validated.runId,
    sdp: validated.sdp,
  }),
);

export const normalizeProviderEvent = tolerantAdapter((input: unknown) => {
  if (input === null || typeof input !== "object") {
    return failure("INVALID_PROVIDER_EVENT");
  }

  const type = "type" in input && typeof input.type === "string" ? input.type : null;

  if (type === null) {
    return failure("UNSUPPORTED_PROVIDER_EVENT");
  }

  const normalized: NormalizedProviderEvent = {
    type,
    diagnosticSummary: { type },
  };

  return success(normalized);
});
