/**
 * Paths owned by the companion installation.
 * Keep these patterns narrow: target application and test directories remain
 * part of normal lint and formatting coverage.
 */
export const managedAssetIgnorePatterns = [
  ".agents/external-skills/install-anti-slop/**",
  "tools/oxlint/anti-slop/**",
  "tools/oxlint/boundary-aware/**",
  "tools/boundary-contracts/**",
];

/**
 * Generic rules that the boundary-aware plugin replaces. Every other rule of
 * the pinned generic plugin is part of the policy.
 */
export const supersededGenericRules = [
  "anti-slop/no-unknown-parameters",
  "anti-slop/no-runtime-typeof",
  "anti-slop/no-unsafe-dictionary-type",
];

/**
 * Generic policy enabled at "error": the pinned upstream skill's generic rules,
 * in its order, including the native Oxlint companion rule, minus the
 * superseded rules. A pin update that adds or removes a generic rule must
 * update this list.
 */
export const genericPolicyRules = [
  "oxc/no-accumulating-spread",
  "anti-slop/no-array-filter-map",
  "anti-slop/no-reduce-accumulator-copy",
  "anti-slop/no-chained-type-assertions",
  "anti-slop/no-conditional-empty-object-spread",
  "anti-slop/no-known-value-widening",
  "anti-slop/no-module-mocking",
  "anti-slop/no-object-parameters",
  "anti-slop/no-reflect-apply",
  "anti-slop/no-reflect-get",
  "anti-slop/no-shape-in-symbol-names",
  "anti-slop/no-unknown-returns",
  "anti-slop/no-unknown-type-aliases",
  "anti-slop/no-widen-then-assert",
  "anti-slop/require-readable-spacing",
  "anti-slop/require-safety-comment-for-type-assertion",
];
