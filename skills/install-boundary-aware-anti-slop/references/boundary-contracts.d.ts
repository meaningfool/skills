export interface Schema<Validated> {
  parse(input: unknown): Validated;
}

export interface BoundaryMetadata {
  readonly contract: "boundary-contracts";
  readonly version: 1;
  readonly kind: "owned-decoder" | "tolerant-adapter";
  readonly accepts: "raw";
  readonly returns: "owned" | "owned-or-failure";
  readonly schemaBacked: boolean;
}

export type OwnedDecoder<Owned> = ((input: unknown) => Owned) & {
  readonly boundary: BoundaryMetadata & {
    readonly kind: "owned-decoder";
    readonly returns: "owned";
    readonly schemaBacked: true;
  };
};

export type AdapterSuccess<Owned> = {
  readonly ok: true;
  readonly value: Owned;
};

export type AdapterFailure = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message?: string;
  };
};

export type AdapterResult<Owned> = AdapterSuccess<Owned> | AdapterFailure;

export type TolerantAdapter<Owned> =
  ((input: unknown) => AdapterResult<Owned>) & {
    readonly boundary: BoundaryMetadata & {
      readonly kind: "tolerant-adapter";
      readonly returns: "owned-or-failure";
      readonly schemaBacked: false;
    };
  };

export class BoundaryContractError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string);
}

export class BoundaryValidationError extends BoundaryContractError {
  readonly code: "INVALID_INPUT";
  constructor(message: string);
}

export function ownedDecoder<Validated, Owned>(
  schema: Schema<Validated>,
  convert: (validated: Validated) => Owned
): OwnedDecoder<Owned>;

export function success<Owned>(value: Owned): AdapterSuccess<Owned>;

export function failure(code: string, message?: string): AdapterFailure;

export function tolerantAdapter<Owned>(
  adapt: (input: unknown) => AdapterResult<Owned>
): TolerantAdapter<Owned>;

export function getBoundaryMetadata(
  value: unknown
): BoundaryMetadata | null;

export function requireBoundaryDeclaration(
  value: unknown
): BoundaryMetadata;
