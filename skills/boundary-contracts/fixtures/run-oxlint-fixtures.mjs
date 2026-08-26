import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const pluginPath = resolve(fixtureDirectory, "../references/oxlint/index.mjs");
const oxlintArgumentIndex = process.argv.indexOf("--oxlint");
const oxlintPath =
  oxlintArgumentIndex === -1
    ? process.env.OXLINT_BIN
    : process.argv[oxlintArgumentIndex + 1];

if (!oxlintPath || !existsSync(oxlintPath)) {
  console.error(
    "Set OXLINT_BIN to an installed oxlint executable or pass --oxlint /path/to/oxlint.",
  );
  process.exit(2);
}

const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "boundary-oxlint-fixtures-"));
const configPath = resolve(temporaryDirectory, ".oxlintrc.json");

writeFileSync(
  configPath,
  `${JSON.stringify(
    {
      plugins: [],
      jsPlugins: [pluginPath],
      rules: {
        "boundary-aware/require-declared-boundary": "error",
        "boundary-aware/require-schema-for-owned-boundary": "error",
        "boundary-aware/no-raw-boundary-data-escape": "error",
      },
    },
    null,
  )}\n`,
);

try {
  runExpectedPass("accepted.ts");
  runExpectedPass("eventpulse-accepted.ts");
  runExpectedFailures("rejected.ts", [
    "require-declared-boundary",
    "require-schema-for-owned-boundary",
    "no-raw-boundary-data-escape",
  ]);
  runExpectedFailures("eventpulse-rejected.ts", [
    "require-declared-boundary",
  ]);
  console.log("Boundary-aware Oxlint fixtures passed.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function runExpectedPass(fileName) {
  const result = run(fileName);

  if (result.status !== 0) {
    fail(fileName, "expected no diagnostics", result);
  }
}

function runExpectedFailures(fileName, expectedRules) {
  const result = run(fileName);
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.status === 0) {
    fail(fileName, "expected diagnostics", result);
  }

  for (const rule of expectedRules) {
    if (!output.includes(`boundary-aware(${rule})`)) {
      fail(fileName, `expected diagnostic for boundary-aware/${rule}`, result);
    }
  }
}

function run(fileName) {
  return spawnSync(
    oxlintPath,
    ["--config", configPath, resolve(fixtureDirectory, "oxlint", fileName)],
    { encoding: "utf8" },
  );
}

function fail(fileName, expectation, result) {
  console.error(`Fixture ${fileName} ${expectation}.`);
  console.error(result.stdout);
  console.error(result.stderr);
  throw new Error(`Fixture ${fileName} ${expectation}.`);
}
