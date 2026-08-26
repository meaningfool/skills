const metadataSymbol = Symbol("boundary-contracts.metadata");
const contractVersion = 1;

/**
 * Error raised when a boundary implementation violates the wrapper contract.
 */
export class BoundaryContractError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = "BoundaryContractError";
    this.code = code;
  }
}

/**
 * Error raised when an owned decoder's schema rejects raw input.
 */
export class BoundaryValidationError extends BoundaryContractError {
  constructor(message) {
    super("INVALID_INPUT", message);
    this.name = "BoundaryValidationError";
  }
}

/**
 * Mark a function with a machine-readable declaration without changing its
 * call signature or exposing the internal metadata symbol to consumers.
 */
function declareBoundary(fn, metadata) {
  const frozenMetadata = Object.freeze({
    contract: "boundary-contracts",
    version: contractVersion,
    ...metadata,
  });

  Object.defineProperty(fn, metadataSymbol, {
    configurable: false,
    enumerable: false,
    value: frozenMetadata,
    writable: false,
  });

  Object.defineProperty(fn, "boundary", {
    configurable: false,
    enumerable: true,
    value: frozenMetadata,
    writable: false,
  });

  return fn;
}

function requireFunction(value, code, message) {
  if (typeof value !== "function") {
    throw new BoundaryContractError(code, message);
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function hasExactKeys(value, expectedKeys) {
  if (!isObject(value)) {
    return false;
  }

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

/**
 * Declare an owned decoder.
 *
 * The schema is intentionally structural so the contract works with any
 * schema library that exposes parse(input: unknown). The converter never sees
 * the raw input; it only receives the schema's validated result.
 */
export function ownedDecoder(schema, convert) {
  if (schema === null || schema === undefined || typeof schema.parse !== "function") {
    throw new BoundaryContractError(
      "SCHEMA_REQUIRED",
      "ownedDecoder requires a schema with parse(input)"
    );
  }
  requireFunction(
    convert,
    "CONVERTER_REQUIRED",
    "ownedDecoder requires a converter function"
  );

  const decoder = (input) => {
    let validated;

    try {
      validated = schema.parse(input);
    } catch {
      throw new BoundaryValidationError("The owned decoder schema rejected the input");
    }

    if (validated === undefined) {
      throw new BoundaryContractError(
        "SCHEMA_OUTPUT_REQUIRED",
        "ownedDecoder schemas must return validated data"
      );
    }

    const ownedValue = convert(validated);

    if (ownedValue === undefined) {
      throw new BoundaryContractError(
        "OWNED_OUTPUT_REQUIRED",
        "ownedDecoder converters must return an owned value"
      );
    }

    return ownedValue;
  };

  return declareBoundary(decoder, {
    kind: "owned-decoder",
    accepts: "raw",
    returns: "owned",
    schemaBacked: true,
  });
}

/**
 * Build a successful tolerant-adapter result.
 */
export function success(value) {
  if (value === undefined) {
    throw new BoundaryContractError(
      "OWNED_OUTPUT_REQUIRED",
      "success(...) requires an owned value"
    );
  }

  return Object.freeze({ ok: true, value });
}

/**
 * Build a declared tolerant-adapter failure. Keep the public failure narrow;
 * raw provider payloads and arbitrary exception objects must not escape.
 */
export function failure(code, message) {
  if (typeof code !== "string" || code.trim() === "") {
    throw new BoundaryContractError(
      "FAILURE_CODE_REQUIRED",
      "failure(...) requires a non-empty code"
    );
  }
  if (message !== undefined && typeof message !== "string") {
    throw new BoundaryContractError(
      "FAILURE_MESSAGE_INVALID",
      "failure(...) message must be a string when provided"
    );
  }

  const error = { code: code.trim() };
  if (message !== undefined) {
    error.message = message;
  }

  return Object.freeze({ ok: false, error: Object.freeze(error) });
}

function isSuccessResult(value) {
  return (
    hasExactKeys(value, ["ok", "value"]) &&
    value.ok === true &&
    value.value !== undefined
  );
}

function isFailureResult(value) {
  return (
    hasExactKeys(value, ["ok", "error"]) &&
    value.ok === false &&
    isObject(value.error) &&
    hasOwn(value.error, "code") &&
    typeof value.error.code === "string" &&
    value.error.code.trim() !== "" &&
    (Object.keys(value.error).length === 1 ||
      (Object.keys(value.error).length === 2 &&
        hasOwn(value.error, "message") &&
        typeof value.error.message === "string"))
  );
}

function assertAdapterResult(result) {
  if (!isSuccessResult(result) && !isFailureResult(result)) {
    throw new BoundaryContractError(
      "ADAPTER_RESULT_REQUIRED",
      "tolerantAdapter callbacks must return success(value) or failure(code, message)"
    );
  }

  return result;
}

/**
 * Declare a tolerant adapter for independently evolving external input.
 *
 * A provider-data conversion exception becomes a declared failure rather than
 * leaking an exception or the provider payload into application code. A
 * malformed callback result is a contract error because it is an implementation
 * defect, not an expected provider variation.
 */
export function tolerantAdapter(adapt) {
  requireFunction(
    adapt,
    "ADAPTER_REQUIRED",
    "tolerantAdapter requires an adapter function"
  );

  const adapter = (input) => {
    let result;

    try {
      result = adapt(input);
    } catch (error) {
      if (error instanceof BoundaryContractError) {
        throw error;
      }

      return failure(
        "ADAPTER_EXCEPTION",
        "The external input could not be converted"
      );
    }

    return assertAdapterResult(result);
  };

  return declareBoundary(adapter, {
    kind: "tolerant-adapter",
    accepts: "raw",
    returns: "owned-or-failure",
    schemaBacked: false,
  });
}

/**
 * Read a declaration for a wrapper-created boundary function.
 */
export function getBoundaryMetadata(value) {
  if (typeof value !== "function") {
    return null;
  }

  return value[metadataSymbol] ?? null;
}

/**
 * Test or fixture helper for code paths that require an explicit declaration.
 * Ordinary internal functions should not call this helper.
 */
export function requireBoundaryDeclaration(value) {
  const metadata = getBoundaryMetadata(value);

  if (metadata === null) {
    throw new BoundaryContractError(
      "DECLARED_BOUNDARY_REQUIRED",
      "Raw-input functions must use ownedDecoder(...) or tolerantAdapter(...)"
    );
  }

  return metadata;
}
