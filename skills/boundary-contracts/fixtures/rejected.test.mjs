import assert from "node:assert/strict";
import test from "node:test";

import {
  boundary,
  BoundaryContractError,
  failure,
  requireBoundaryDeclaration,
} from "../references/boundary-contracts.mjs";

test("rejected: an undeclared raw-input function is not a boundary", () => {
  const undeclaredRawBoundary = (input) => input;

  assert.throws(
    () => requireBoundaryDeclaration(undeclaredRawBoundary),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "DECLARED_BOUNDARY_REQUIRED",
  );
});

test("rejected: strict boundary requires an exact schema-backed descriptor", () => {
  assert.throws(
    () => boundary({ convert: (value) => value }),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "BOUNDARY_DESCRIPTOR_REQUIRED",
  );
  assert.throws(
    () => boundary({ schema: null, convert: (value) => value }),
    (error) =>
      error instanceof BoundaryContractError && error.code === "SCHEMA_REQUIRED",
  );
});

test("rejected: strict schemas and converters must return owned data", () => {
  const emptySchemaBoundary = boundary({
    schema: { parse: () => undefined },
    convert: (value) => value,
  });
  const emptyConverterBoundary = boundary({
    schema: { parse: () => ({ id: "x" }) },
    convert: () => undefined,
  });

  assert.throws(
    () => emptySchemaBoundary({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "SCHEMA_OUTPUT_REQUIRED",
  );
  assert.throws(
    () => emptyConverterBoundary({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "OWNED_OUTPUT_REQUIRED",
  );
});

test("rejected: tolerant boundary requires a bounded descriptor", () => {
  assert.throws(
    () => boundary.tolerant({
      source: "",
      variants: [],
      otherwise: failure("UNRECOGNIZED"),
    }),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "TOLERANT_SOURCE_REQUIRED",
  );
  assert.throws(
    () => boundary.tolerant({
      source: "provider:event",
      variants: [],
      otherwise: failure("UNRECOGNIZED"),
    }),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "TOLERANT_VARIANTS_REQUIRED",
  );
});

test("rejected: tolerant variants require schema and owned output", () => {
  assert.throws(
    () => boundary.tolerant({
      source: "provider:event",
      variants: [{ schema: null, convert: (value) => value }],
      otherwise: failure("UNRECOGNIZED"),
    }),
    (error) =>
      error instanceof BoundaryContractError && error.code === "SCHEMA_REQUIRED",
  );

  const emptyConverterBoundary = boundary.tolerant({
    source: "provider:event",
    variants: [{ schema: { parse: () => ({ id: "x" }) }, convert: () => undefined }],
    otherwise: failure("UNRECOGNIZED"),
  });
  assert.throws(
    () => emptyConverterBoundary({}),
    (error) =>
      error instanceof BoundaryContractError &&
      error.code === "OWNED_OUTPUT_REQUIRED",
  );
});
