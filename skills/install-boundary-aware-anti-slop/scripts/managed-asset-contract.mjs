/**
 * Paths owned by the companion installation or its later assessment command.
 * Keep these patterns narrow: target application and test directories remain
 * part of normal lint and formatting coverage.
 */
export const managedAssetIgnorePatterns = [
  ".agents/external-skills/install-anti-slop/**",
  "tools/oxlint/anti-slop/**",
  "tools/oxlint/boundary-aware/**",
  "tools/boundary-contracts/**",
  "reports/anti-slop/**",
];
