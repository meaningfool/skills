export interface Schema<Validated> {
  parse(input: unknown): Validated;
}

export interface BoundaryMetadata {
  readonly contract: "boundary-contracts";
  readonly version: 2;
  readonly kind: "strict" | "tolerant";
  readonly accepts: "raw";
  readonly returns: "owned" | "owned-or-failure";
  readonly schemaBacked: true;
  readonly source?: string;
}

export type StrictBoundary<Owned> = ((input: unknown) => Owned) & {
  readonly boundary: BoundaryMetadata & {
    readonly kind: "strict";
    readonly returns: "owned";
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

export type TolerantBoundary<Owned> =
  ((input: unknown) => AdapterResult<Owned>) & {
    readonly boundary: BoundaryMetadata & {
      readonly kind: "tolerant";
      readonly returns: "owned-or-failure";
      readonly source: string;
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

export interface BoundaryDescriptor<Validated, Owned> {
  readonly schema: Schema<Validated>;
  readonly convert: (validated: Validated) => Owned;
}

export interface TolerantBoundaryVariant<Validated, Owned> {
  readonly schema: Schema<Validated>;
  readonly convert: (validated: Validated) => Owned;
}

export interface TolerantBoundaryDescriptor<
  Variants extends readonly unknown[],
> {
  readonly source: string;
  readonly variants: Variants;
  readonly otherwise: AdapterFailure;
}

export function boundary<Validated, Owned>(
  descriptor: BoundaryDescriptor<Validated, Owned>
): StrictBoundary<Owned>;

export namespace boundary {
  function tolerant<Validated1, Owned1>(
    descriptor: TolerantBoundaryDescriptor<
      readonly [TolerantBoundaryVariant<Validated1, Owned1>]
    >
  ): TolerantBoundary<Owned1>;

  function tolerant<Validated1, Owned1, Validated2, Owned2>(
    descriptor: TolerantBoundaryDescriptor<
      readonly [
        TolerantBoundaryVariant<Validated1, Owned1>,
        TolerantBoundaryVariant<Validated2, Owned2>,
      ]
    >
  ): TolerantBoundary<Owned1 | Owned2>;

  function tolerant<
    Validated1,
    Owned1,
    Validated2,
    Owned2,
    Validated3,
    Owned3,
  >(
    descriptor: TolerantBoundaryDescriptor<
      readonly [
        TolerantBoundaryVariant<Validated1, Owned1>,
        TolerantBoundaryVariant<Validated2, Owned2>,
        TolerantBoundaryVariant<Validated3, Owned3>,
      ]
    >
  ): TolerantBoundary<Owned1 | Owned2 | Owned3>;

  function tolerant<
    Validated1,
    Owned1,
    Validated2,
    Owned2,
    Validated3,
    Owned3,
    Validated4,
    Owned4,
  >(
    descriptor: TolerantBoundaryDescriptor<
      readonly [
        TolerantBoundaryVariant<Validated1, Owned1>,
        TolerantBoundaryVariant<Validated2, Owned2>,
        TolerantBoundaryVariant<Validated3, Owned3>,
        TolerantBoundaryVariant<Validated4, Owned4>,
      ]
    >
  ): TolerantBoundary<Owned1 | Owned2 | Owned3 | Owned4>;

  function tolerant<Validated, Owned>(
    descriptor: TolerantBoundaryDescriptor<
      readonly [
        TolerantBoundaryVariant<Validated, Owned>,
        ...TolerantBoundaryVariant<Validated, Owned>[],
      ]
    >
  ): TolerantBoundary<Owned>;
}

export function success<Owned>(value: Owned): AdapterSuccess<Owned>;

export function failure(code: string, message?: string): AdapterFailure;

export function getBoundaryMetadata(
  value: unknown
): BoundaryMetadata | null;

export function requireBoundaryDeclaration(
  value: unknown
): BoundaryMetadata;
