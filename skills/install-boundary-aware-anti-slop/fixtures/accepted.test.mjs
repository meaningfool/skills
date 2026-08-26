import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundaryValidationError,
  failure,
  getBoundaryMetadata,
  ownedDecoder,
  success,
  tolerantAdapter,
} from "../references/boundary-contracts.mjs";

function isRecord(value) {
  return value !== null && typeof value === "object";
}

test("accepted: schema-backed owned decoder validates before conversion", () => {
  const schema = {
    parse(input) {
      if (
        !isRecord(input) ||
        typeof input.interviewId !== "string" ||
        typeof input.locale !== "string"
      ) {
        throw new Error("invalid interview start");
      }

      return {
        interviewId: input.interviewId,
        locale: input.locale,
      };
    },
  };

  let converterInput;
  const decodeStart = ownedDecoder(schema, (validated) => {
    converterInput = validated;
    return Object.freeze({
      kind: "interview-start",
      interviewId: validated.interviewId,
      locale: validated.locale,
    });
  });

  assert.deepEqual(decodeStart({ interviewId: "i-1", locale: "en" }), {
    kind: "interview-start",
    interviewId: "i-1",
    locale: "en",
  });
  assert.deepEqual(converterInput, {
    interviewId: "i-1",
    locale: "en",
  });
  assert.deepEqual(getBoundaryMetadata(decodeStart), {
    contract: "boundary-contracts",
    version: 1,
    kind: "owned-decoder",
    accepts: "raw",
    returns: "owned",
    schemaBacked: true,
  });
  assert.throws(
    () => decodeStart({ interviewId: 42, locale: "en" }),
    (error) =>
      error instanceof BoundaryValidationError && error.code === "INVALID_INPUT"
  );
});

test("accepted: tolerant adapter narrows provider input or declares failure", () => {
  const adaptProviderEvent = tolerantAdapter((input) => {
    if (!isRecord(input) || typeof input.type !== "string") {
      return failure("UNSUPPORTED_EVENT");
    }

    if (
      input.type === "message" &&
      isRecord(input.payload) &&
      typeof input.payload.text === "string"
    ) {
      return success(
        Object.freeze({
          kind: "message",
          text: input.payload.text,
        })
      );
    }

    return failure("UNSUPPORTED_EVENT", "Provider event is not supported");
  });

  assert.deepEqual(
    adaptProviderEvent({ type: "message", payload: { text: "hello" } }),
    success({ kind: "message", text: "hello" })
  );
  assert.deepEqual(
    adaptProviderEvent({ type: "presence", payload: { online: true } }),
    failure("UNSUPPORTED_EVENT", "Provider event is not supported")
  );
  assert.deepEqual(getBoundaryMetadata(adaptProviderEvent), {
    contract: "boundary-contracts",
    version: 1,
    kind: "tolerant-adapter",
    accepts: "raw",
    returns: "owned-or-failure",
    schemaBacked: false,
  });
});

test("accepted: ordinary internal functions stay outside the boundary API", () => {
  const addDurations = (left, right) => left + right;

  assert.equal(addDurations(2, 3), 5);
  assert.equal(getBoundaryMetadata(addDurations), null);
});
