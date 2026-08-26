import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundaryContractError,
  failure,
  getBoundaryMetadata,
  ownedDecoder,
  requireBoundaryDeclaration,
  success,
  tolerantAdapter,
} from "../references/boundary-contracts.mjs";

function isRecord(value) {
  return value !== null && typeof value === "object";
}

test("rejected: an undeclared raw-input function is not a boundary", () => {
  const undeclaredRawBoundary = (input) => input;

  assert.equal(getBoundaryMetadata(undeclaredRawBoundary), null);
  assert.throws(
    () => requireBoundaryDeclaration(undeclaredRawBoundary),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "DECLARED_BOUNDARY_REQUIRED"
  );
});

test("rejected: handwritten owned parsing cannot stand in for a declaration", () => {
  const handwrittenDecoder = (input) => {
    if (!isRecord(input) || typeof input.id !== "string") {
      throw new Error("invalid id");
    }

    return { id: input.id };
  };

  assert.throws(
    () => requireBoundaryDeclaration(handwrittenDecoder),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "DECLARED_BOUNDARY_REQUIRED"
  );
});

test("rejected: an owned decoder requires an explicit schema capability", () => {
  assert.throws(
    () => ownedDecoder(null, (value) => value),
    (error) =>
      error instanceof BoundaryContractError && error.code === "SCHEMA_REQUIRED"
  );
});

test("rejected: an owned decoder schema must return validated data", () => {
  const emptySchema = { parse: () => undefined };
  const decodeEmpty = ownedDecoder(emptySchema, (value) => value);

  assert.throws(
    () => decodeEmpty({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "SCHEMA_OUTPUT_REQUIRED"
  );
});

test("rejected: raw adapter output is not a successful adapter result", () => {
  const rawOutputAdapter = tolerantAdapter((input) => input);

  assert.throws(
    () => rawOutputAdapter({ provider: "payload" }),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "ADAPTER_RESULT_REQUIRED"
  );
});

test("rejected: malformed result helpers remain contract errors", () => {
  const malformedFailureAdapter = tolerantAdapter(() => failure(42));
  const malformedSuccessAdapter = tolerantAdapter(() => success(undefined));

  assert.throws(
    () => malformedFailureAdapter({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "FAILURE_CODE_REQUIRED"
  );
  assert.throws(
    () => malformedSuccessAdapter({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "OWNED_OUTPUT_REQUIRED"
  );
});
