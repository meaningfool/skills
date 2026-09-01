const metadataSymbol = Symbol("boundary-contracts.metadata");
const contractVersion = 2;

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
 * Error raised when a strict boundary schema rejects raw input.
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
 * Declare the strict/default transition from raw input to an owned value.
 */
export function boundary(descriptor) {
  if (!hasExactKeys(descriptor, ["schema", "convert"])) {
    throw new BoundaryContractError(
      "BOUNDARY_DESCRIPTOR_REQUIRED",
      "boundary(...) requires exactly schema and convert",
    );
  }
  const { schema, convert } = descriptor;
  if (schema === null || schema === undefined || typeof schema.parse !== "function") {
    throw new BoundaryContractError(
      "SCHEMA_REQUIRED",
      "boundary(...) requires a schema with parse(input)",
    );
  }
  requireFunction(
    convert,
    "CONVERTER_REQUIRED",
    "boundary(...) requires a converter function",
  );

  const decoder = (input) => {
    let validated;
    try {
      validated = schema.parse(input);
    } catch {
      throw new BoundaryValidationError("The boundary schema rejected the input");
    }
    if (validated === undefined) {
      throw new BoundaryContractError(
        "SCHEMA_OUTPUT_REQUIRED",
        "Boundary schemas must return validated data",
      );
    }
    const ownedValue = convert(validated);
    if (ownedValue === undefined) {
      throw new BoundaryContractError(
        "OWNED_OUTPUT_REQUIRED",
        "Boundary converters must return an owned value",
      );
    }
    return ownedValue;
  };

  return declareBoundary(decoder, {
    kind: "strict",
    accepts: "raw",
    returns: "owned",
    schemaBacked: true,
  });
}

function tolerantBoundary(descriptor) {
  if (!hasExactKeys(descriptor, ["source", "variants", "otherwise"])) {
    throw new BoundaryContractError(
      "TOLERANT_DESCRIPTOR_REQUIRED",
      "boundary.tolerant(...) requires a bounded descriptor",
    );
  }
  if (typeof descriptor.source !== "string" || descriptor.source.trim() === "") {
    throw new BoundaryContractError(
      "TOLERANT_SOURCE_REQUIRED",
      "boundary.tolerant(...) requires a non-empty source",
    );
  }
  if (!Array.isArray(descriptor.variants) || descriptor.variants.length === 0) {
    throw new BoundaryContractError(
      "TOLERANT_VARIANTS_REQUIRED",
      "boundary.tolerant(...) requires at least one schema-backed variant",
    );
  }
  if (!isFailureResult(descriptor.otherwise)) {
    throw new BoundaryContractError(
      "TOLERANT_FAILURE_REQUIRED",
      "boundary.tolerant(...) requires an explicit failure(...) fallback",
    );
  }

  const variants = descriptor.variants.map((variant) => {
    if (!hasExactKeys(variant, ["schema", "convert"]) || typeof variant.schema?.parse !== "function") {
      throw new BoundaryContractError(
        "SCHEMA_REQUIRED",
        "Every tolerant variant requires a schema with parse(input)",
      );
    }
    requireFunction(
      variant.convert,
      "CONVERTER_REQUIRED",
      "Every tolerant variant requires a converter function",
    );
    return Object.freeze({ schema: variant.schema, convert: variant.convert });
  });
  const otherwise = descriptor.otherwise;
  const source = descriptor.source.trim();

  const adapter = (input) => {
    for (const variant of variants) {
      let validated;
      try {
        validated = variant.schema.parse(input);
      } catch {
        continue;
      }
      if (validated === undefined) {
        throw new BoundaryContractError(
          "SCHEMA_OUTPUT_REQUIRED",
          "Tolerant boundary schemas must return validated data",
        );
      }

      const ownedValue = variant.convert(validated);
      if (ownedValue === undefined) {
        throw new BoundaryContractError(
          "OWNED_OUTPUT_REQUIRED",
          "Tolerant boundary converters must return an owned value",
        );
      }
      return success(ownedValue);
    }

    return otherwise;
  };

  return declareBoundary(adapter, {
    kind: "tolerant",
    accepts: "raw",
    returns: "owned-or-failure",
    schemaBacked: true,
    source,
  });
}

boundary.tolerant = tolerantBoundary;

/**
 * Build a successful tolerant-boundary result.
 */
export function success(value) {
  if (value === undefined) {
    throw new BoundaryContractError(
      "OWNED_OUTPUT_REQUIRED",
      "success(...) requires an owned value",
    );
  }

  return Object.freeze({ ok: true, value });
}

/**
 * Build a declared tolerant-boundary failure. Keep the public failure narrow;
 * raw provider payloads and arbitrary exception objects must not escape.
 */
export function failure(code, message) {
  if (typeof code !== "string" || code.trim() === "") {
    throw new BoundaryContractError(
      "FAILURE_CODE_REQUIRED",
      "failure(...) requires a non-empty code",
    );
  }
  if (message !== undefined && typeof message !== "string") {
    throw new BoundaryContractError(
      "FAILURE_MESSAGE_INVALID",
      "failure(...) message must be a string when provided",
    );
  }

  const error = { code: code.trim() };
  if (message !== undefined) {
    error.message = message;
  }

  return Object.freeze({ ok: false, error: Object.freeze(error) });
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
      "Raw-input functions must use boundary({...}) or boundary.tolerant({...})",
    );
  }

  return metadata;
}
