import assert from "node:assert/strict";
import test from "node:test";

import {
  boundary,
  BoundaryValidationError,
  failure,
  getBoundaryMetadata,
  success,
} from "../references/boundary-contracts.mjs";

function isRecord(value) {
  return value !== null && typeof value === "object";
}

test("accepted: application-controlled input crosses one strict boundary", () => {
  const decodeRequest = boundary({
    schema: {
      parse(input) {
        if (!isRecord(input) || typeof input.requestId !== "string") {
          throw new Error("invalid request");
        }
        return { requestId: input.requestId };
      },
    },
    convert: (validated) => Object.freeze({
      kind: "request",
      requestId: validated.requestId,
    }),
  });

  assert.deepEqual(decodeRequest({ requestId: "r-1" }), {
    kind: "request",
    requestId: "r-1",
  });
  assert.deepEqual(getBoundaryMetadata(decodeRequest), {
    contract: "boundary-contracts",
    version: 2,
    kind: "strict",
    accepts: "raw",
    returns: "owned",
    schemaBacked: true,
  });
  assert.throws(
    () => decodeRequest({ requestId: 1 }),
    (error) =>
      error instanceof BoundaryValidationError && error.code === "INVALID_INPUT",
  );
});

test("accepted: bounded legacy versions produce owned success or declared failure", () => {
  const adaptStoredEvent = boundary.tolerant({
    source: "persistence:stored-event",
    variants: [
      {
        schema: {
          parse(input) {
            if (!isRecord(input) || input.version !== 1 || typeof input.text !== "string") {
              throw new Error("not version 1");
            }
            return { text: input.text };
          },
        },
        convert: (validated) => ({ kind: "message", text: validated.text }),
      },
      {
        schema: {
          parse(input) {
            if (
              !isRecord(input) ||
              input.version !== 2 ||
              !isRecord(input.message) ||
              typeof input.message.text !== "string"
            ) {
              throw new Error("not version 2");
            }
            return { text: input.message.text };
          },
        },
        convert: (validated) => ({ kind: "message", text: validated.text }),
      },
    ],
    otherwise: failure("UNRECOGNIZED_STORED_EVENT"),
  });

  assert.deepEqual(
    adaptStoredEvent({ version: 2, message: { text: "hello" } }),
    success({ kind: "message", text: "hello" }),
  );
  assert.deepEqual(
    adaptStoredEvent({ version: 3, text: "future" }),
    failure("UNRECOGNIZED_STORED_EVENT"),
  );
  assert.deepEqual(getBoundaryMetadata(adaptStoredEvent), {
    contract: "boundary-contracts",
    version: 2,
    kind: "tolerant",
    accepts: "raw",
    returns: "owned-or-failure",
    schemaBacked: true,
    source: "persistence:stored-event",
  });
});

test("accepted: precisely typed internal functions stay outside the boundary API", () => {
  const addDurations = (left, right) => left + right;

  assert.equal(addDurations(2, 3), 5);
  assert.equal(getBoundaryMetadata(addDurations), null);
});
