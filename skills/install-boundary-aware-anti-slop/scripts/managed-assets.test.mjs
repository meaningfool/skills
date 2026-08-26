import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { installPinnedSkill, readManifest } from "../../../scripts/install-pinned-skill.mjs";
import { installBoundaryAssets } from "./install.mjs";
import { managedAssetIgnorePatterns } from "./managed-asset-contract.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const dependencyManifest = readManifest();
const genericRules = [
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
  "anti-slop/require-safety-comment-for-type-assertion",
];
const boundaryRules = [
  "boundary-aware/require-declared-boundary",
  "boundary-aware/require-schema-for-owned-boundary",
  "boundary-aware/no-raw-boundary-data-escape",
];
const root = mkdtempSync(join(tmpdir(), "boundary-aware-managed-assets-test-"));

assert.equal(managedAssetIgnorePatterns.includes(".agents/**"), false);
assert.equal(managedAssetIgnorePatterns.includes("tools/**"), false);
assert.equal(managedAssetIgnorePatterns.includes("src/**"), false);
assert.equal(managedAssetIgnorePatterns.includes("test/**"), false);
assert.equal(managedAssetIgnorePatterns.includes("tests/**"), false);

test.after(() => {
  if (process.env.KEEP_MANAGED_ASSET_TEST_ARTIFACTS === "1") {
    console.log(`Kept managed-asset test repository at ${root}.`);
    return;
  }
  rmSync(root, { recursive: true, force: true });
});

test("managed assets stay out of target checks while both plugins remain active", async () => {
  const versions = readCurrentVersions();
  const toolRoot = join(root, "toolchain");
  mkdirSync(toolRoot, { recursive: true });
  writeJson(join(toolRoot, "package.json"), {
    name: "managed-assets-toolchain",
    private: true,
    type: "module",
  });
  assertCommand(
    run(
      "npm",
      [
        "install",
        "--prefix",
        toolRoot,
        "--no-save",
        "--package-lock=false",
        `oxlint@${versions.oxlint}`,
        `@oxlint/plugins@${versions.plugins}`,
        `oxfmt@${versions.oxfmt}`,
        `prettier@${versions.prettier}`,
        `vite-plus@${versions.vitePlus}`,
      ],
      repositoryRoot,
    ),
    "install managed-asset smoke-test toolchain",
  );

  await testStandaloneOxlintAndOxfmt({ toolRoot });
  await testPrettier({ toolRoot, versions });
  await testVitePlus({ toolRoot, versions });
});

async function testStandaloneOxlintAndOxfmt({ toolRoot }) {
  const target = await createTarget(toolRoot, "standalone");
  const oxlint = join(toolRoot, "node_modules/.bin/oxlint");
  const oxfmt = join(toolRoot, "node_modules/.bin/oxfmt");
  writeJson(join(target, ".oxlintrc.json"), lintConfig());
  writeJson(join(target, ".oxfmtrc.json"), {
    sortPackageJson: false,
    trailingComma: "none",
  });
  writeText(join(target, ".formatignore"), managedAssetIgnorePatterns.join("\n") + "\n");
  assertCommand(
    run(oxfmt, ["--config", ".oxfmtrc.json", "--write", ".oxlintrc.json"], target),
    "format standalone Oxlint config fixture",
  );
  writeText(join(target, "src/application.ts"), "export const applicationValue = 1;\n");
  writeManagedViolations(target);

  assert.equal(existsSync(oxlint), true, oxlint);
  assert.equal(existsSync(oxfmt), true, oxfmt);

  assertCommand(run(oxlint, ["--config", ".oxlintrc.json", "."], target), "standalone Oxlint");
  assertCommand(
    run(
      oxfmt,
      ["--config", ".oxfmtrc.json", "--ignore-path", ".formatignore", "--check", "."],
      target,
    ),
    "standalone Oxfmt",
  );
  const formatIgnoreBefore = snapshot(target);
  assert.equal(appendMissingIgnorePatterns(join(target, ".formatignore")), false);
  assert.deepEqual(snapshot(target), formatIgnoreBefore);

  writeText(join(target, "src/application.ts"), "const shape = 1;\nexport { shape };\n");
  const violation = run(oxlint, ["--config", ".oxlintrc.json", "."], target);
  assert.notEqual(violation.status, 0, "standalone Oxlint must still check application source");
  assert.match(`${violation.stdout}\n${violation.stderr}`, /no-shape-in-symbol-names/);

  writeText(join(target, "src/application.ts"), "export const applicationValue = 1;\n");
  assertCommand(
    run(oxlint, ["--config", ".oxlintrc.json", "."], target),
    "standalone Oxlint after repair",
  );
  const boundaryRerun = installBoundaryAssets({ cwd: target });
  assert.equal(boundaryRerun.changed, false);
  assert.equal(
    existsSync(join(target, "tools/oxlint/anti-slop/managed-violation.ts")),
    true,
    "asset checks must not delete managed-directory files",
  );
  await assertIdempotentInstallation(target);
}

async function testPrettier({ toolRoot, versions }) {
  const target = await createTarget(toolRoot, "prettier");
  writeJson(join(target, "package.json"), {
    name: "prettier-managed-assets-fixture",
    private: true,
    type: "module",
    devDependencies: { prettier: versions.prettier },
  });
  writeText(
    join(target, ".prettierignore"),
    ["# Existing target ignore", "existing/**", ...managedAssetIgnorePatterns, ""].join("\n"),
  );
  writeText(join(target, "src/application.ts"), "export const applicationValue = 1;\n");
  writeManagedViolations(target);

  const prettier = join(toolRoot, "node_modules/.bin/prettier");
  assertCommand(run(prettier, ["--check", "."], target), "Prettier");
  writeText(join(target, "src/application.ts"), "const shape={broken:true}\n");
  const violation = run(prettier, ["--check", "."], target);
  assert.notEqual(violation.status, 0, "Prettier must still check application source");
  assert.match(`${violation.stdout}\n${violation.stderr}`, /src\/application\.ts/);
  writeText(join(target, "src/application.ts"), "export const applicationValue = 1;\n");
  assertCommand(run(prettier, ["--check", "."], target), "Prettier after repair");
  const prettierIgnoreBefore = snapshot(target);
  assert.equal(appendMissingIgnorePatterns(join(target, ".prettierignore")), false);
  assert.deepEqual(snapshot(target), prettierIgnoreBefore);
  const ignored = readFileSync(join(target, ".prettierignore"), "utf8");
  assert.match(ignored, /# Existing target ignore/);
  assert.equal(new Set(managedAssetIgnorePatterns).size, managedAssetIgnorePatterns.length);
  for (const pattern of managedAssetIgnorePatterns) {
    assert.equal(ignored.split("\n").filter((line) => line === pattern).length, 1, pattern);
  }
}

async function testVitePlus({ toolRoot, versions }) {
  const target = await createTarget(toolRoot, "vite-plus");
  const vp = join(toolRoot, "node_modules/.bin/vp");
  writeJson(join(target, "package.json"), {
    name: "vite-plus-managed-assets-fixture",
    private: true,
    type: "module",
    packageManager: "npm@11.12.1",
    devDependencies: {
      "@oxlint/plugins": versions.plugins,
      oxlint: versions.oxlint,
      oxfmt: versions.oxfmt,
      prettier: versions.prettier,
      "vite-plus": versions.vitePlus,
    },
  });
  writeText(
    join(target, "vite.config.ts"),
    moduleConfig({
      lint: lintConfig(),
      fmt: {
        ignorePatterns: managedAssetIgnorePatterns,
        sortPackageJson: false,
        trailingComma: "none",
      },
    }),
  );
  assertCommand(
    run(vp, ["fmt", "--write", "vite.config.ts"], target),
    "format Vite+ config fixture",
  );
  writeText(join(target, "src/application.ts"), "export const applicationValue = 1;\n");
  writeManagedViolations(target);

  assert.equal(existsSync(vp), true, vp);
  assertCommand(run(vp, ["lint"], target), "Vite+ lint");
  assertCommand(run(vp, ["fmt", "--check"], target), "Vite+ format");
  assertCommand(run(vp, ["check"], target), "Vite+ check");
  const viteConfig = readFileSync(join(target, "vite.config.ts"), "utf8");
  for (const pattern of managedAssetIgnorePatterns) {
    assert.equal(
      viteConfig.split(pattern).length - 1,
      2,
      `${pattern} must be present once per Vite+ check`,
    );
  }

  writeText(join(target, "src/application.ts"), "const shape = 1;\nexport { shape };\n");
  const violation = run(vp, ["lint"], target);
  assert.notEqual(violation.status, 0, "Vite+ must still check application source");
  assert.match(`${violation.stdout}\n${violation.stderr}`, /no-shape-in-symbol-names/);
}

async function createTarget(toolRoot, name) {
  const target = join(toolRoot, name);
  mkdirSync(target, { recursive: true });
  writeJson(join(target, "package.json"), {
    name: `${name}-managed-assets-fixture`,
    private: true,
    type: "module",
  });
  const dependencyDestination = join(target, ".agents/external-skills/install-anti-slop");
  const dependency = await installPinnedSkill(dependencyManifest, dependencyDestination);
  assert.equal(dependency.changed, true, `${name}: pinned dependency installed`);
  const upstreamInstaller = join(dependencyDestination, "scripts/install.mjs");
  assertCommand(
    run(process.execPath, [upstreamInstaller, "tools/oxlint/anti-slop"], target),
    `${name}: generic plugin installation`,
  );
  const boundary = installBoundaryAssets({ cwd: target });
  assert.equal(boundary.changed, true, `${name}: boundary assets installed`);
  return target;
}

function lintConfig() {
  return {
    ignorePatterns: managedAssetIgnorePatterns,
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "boundary-aware", specifier: "./tools/oxlint/boundary-aware/index.mjs" },
    ],
    settings: {
      "boundary-contracts": {
        ownedDecoderNames: ["ownedDecoder"],
        tolerantAdapterNames: ["tolerantAdapter"],
        successNames: ["success"],
        failureNames: ["failure"],
      },
    },
    rules: Object.fromEntries([...genericRules, ...boundaryRules].map((rule) => [rule, "error"])),
  };
}

function moduleConfig({ lint, fmt }) {
  return `export default ${JSON.stringify({ lint, fmt }, null, 2)};\n`;
}

function writeManagedViolations(target) {
  const content = "const shape={broken:true}\n";
  writeText(join(target, "tools/oxlint/anti-slop/managed-violation.ts"), content);
  writeText(join(target, "tools/oxlint/boundary-aware/managed-violation.mjs"), content);
  writeText(join(target, "tools/boundary-contracts/managed-violation.mjs"), content);
  writeText(join(target, "reports/anti-slop/managed-violation.ts"), content);
}

async function assertIdempotentInstallation(target) {
  rmSync(join(target, "tools/oxlint/anti-slop/managed-violation.ts"));
  rmSync(join(target, "tools/oxlint/boundary-aware/managed-violation.mjs"));
  rmSync(join(target, "tools/boundary-contracts/managed-violation.mjs"));
  rmSync(join(target, "reports/anti-slop/managed-violation.ts"));
  const before = snapshot(target);
  const dependency = await installPinnedSkill(
    dependencyManifest,
    join(target, ".agents/external-skills/install-anti-slop"),
  );
  const boundary = installBoundaryAssets({ cwd: target });
  assert.equal(dependency.changed, false);
  assert.equal(boundary.changed, false);
  assert.deepEqual(snapshot(target), before);
}

function readCurrentVersions() {
  return {
    oxlint: npmView("oxlint"),
    plugins: npmView("@oxlint/plugins"),
    oxfmt: npmView("oxfmt"),
    prettier: npmView("prettier"),
    vitePlus: npmView("vite-plus"),
  };
}

function npmView(name) {
  const result = run("npm", ["view", name, "version"], repositoryRoot);
  assertCommand(result, `npm view ${name} version`);
  return result.stdout.trim();
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function appendMissingIgnorePatterns(path) {
  const source = readFileSync(path, "utf8");
  const lines = new Set(source.split(/\r?\n/u));
  const missing = managedAssetIgnorePatterns.filter((pattern) => !lines.has(pattern));
  if (missing.length === 0) return false;
  const separator = source.endsWith("\n") ? "" : "\n";
  writeText(path, `${source}${separator}${missing.join("\n")}\n`);
  return true;
}

function snapshot(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name === ".git" || entry.name === "node_modules") return [];
      const path = join(directory, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return snapshot(path, relativePath);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in test fixture: ${path}`);
      if (!entry.isFile()) return [];
      const stats = lstatSync(path);
      return [
        {
          path: relativePath,
          content: readFileSync(path),
          mode: stats.mode,
          mtimeMs: stats.mtimeMs,
        },
      ];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function assertCommand(result, label) {
  if (result.status === 0) return;
  throw new Error(
    `${label} failed with status ${result.status}:\n${result.stdout}\n${result.stderr}${
      result.error ? `\n${result.error.message}` : ""
    }`,
  );
}
