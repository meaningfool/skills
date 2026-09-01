#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installPinnedSkill, readManifest } from "../../../scripts/install-pinned-skill.mjs";
import { managedAssetIgnorePatterns } from "./managed-asset-contract.mjs";
import { installBoundaryAssets } from "./install.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(scriptDirectory, "../../..");
const companionSkill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
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
  "boundary-aware/require-constraining-schema",
  "boundary-aware/require-bounded-tolerant-boundary",
  "boundary-aware/no-raw-boundary-data-escape",
];
const installedIgnores = managedAssetIgnorePatterns;
const managers = [
  { name: "npm", version: "10.13.1", lockfile: "package-lock.json" },
  { name: "pnpm", version: "10.13.1", lockfile: "pnpm-lock.yaml" },
  { name: "yarn", version: "4.9.1", lockfile: "yarn.lock" },
  { name: "bun", version: "1.2.19", lockfile: "bun.lock" },
];
const configStyles = [
  { name: "json", file: ".oxlintrc.json", kind: "json" },
  { name: "jsonc", file: ".oxlintrc.jsonc", kind: "jsonc" },
  { name: "module", file: "oxlint.config.mjs", kind: "module" },
  { name: "typescript", file: "oxlint.config.ts", kind: "typescript" },
  { name: "vite-plus", file: "vite.config.ts", kind: "vite-plus" },
];
const stateNames = [
  "fresh",
  "read-only-agents",
  "current",
  "outdated-managed",
  "conflicting-modified-generic",
  "conflicting-extra-generic",
  "conflicting-unmanaged-generic",
  "conflicting-unmanaged-boundary",
];
const packageManagerVersion = new Map(managers.map((manager) => [manager.name, manager.version]));
let importNonce = 0;

const rawFetch = globalThis.fetch;
const fetchCache = new Map();
globalThis.fetch = async (url) => {
  const key = String(url);
  if (fetchCache.has(key)) return cachedResponse(fetchCache.get(key));
  const response = await rawFetch(url);
  const content = Buffer.from(await response.arrayBuffer());
  if (!response.ok) return cachedResponse(content, response.status, false);
  fetchCache.set(key, content);
  return cachedResponse(content);
};

try {
  assert.match(
    companionSkill,
    /without asking the\s+user to choose policy, paths, severities, package managers, or replacement\s+strategies/i,
  );
  assert.match(companionSkill, /supported managers are npm, pnpm, Yarn, and Bun/i);

  const root = mkdtempSync(join(tmpdir(), "boundary-aware-forward-test-"));
  const failures = [];
  const results = [];

  try {
    const versions = readCurrentDependencyVersions();
    const fixtureEvidence = runSharedFixtureChecks(root, versions);
    const brownfieldEvidence = await runBrownfieldCriticalPath(root, versions);

    for (const manager of managers) {
      for (const config of configStyles) {
        const combination = `${manager.name}/${config.name}`;
        const freshTarget = createTarget(root, manager, config, "fresh", versions);
        const fresh = await invokeCompanionSkill(freshTarget, versions);
        assert.equal(fresh.inspection.packageManager, manager.name, combination);
        assert.equal(fresh.inspection.configStyle, config.name, combination);
        assert.equal(fresh.dependency.changed, true, combination);
        assert.equal(fresh.dependency.temporaryCleaned, true, combination);
        assert.equal(fresh.boundary.changed, true, combination);
        assertNoExternalInstall(freshTarget, combination);
        assertChecks(fresh, combination);
        const installedOxlint = runInstalledOxlintFixtures(freshTarget, fixtureEvidence.oxlintBinary);
        results.push({
          combination,
          state: "fresh",
          evidence: { ...fresh, fixtureEvidence: { ...fixtureEvidence, installedOxlint } },
        });

        const readOnlyAgentsTarget = createTarget(root, manager, config, "read-only-agents", versions);
        const agentsDirectory = join(readOnlyAgentsTarget, ".agents");
        mkdirSync(agentsDirectory, { recursive: true });
        chmodSync(agentsDirectory, 0o555);
        const readOnlyAgentsBefore = snapshot(agentsDirectory);
        const readOnlyAgents = await invokeCompanionSkill(readOnlyAgentsTarget, versions);
        assert.equal(readOnlyAgents.dependency.changed, true, combination);
        assert.equal(readOnlyAgents.dependency.temporaryCleaned, true, combination);
        assert.equal(readOnlyAgents.boundary.changed, true, combination);
        assert.equal(statMode(agentsDirectory), 0o555, combination);
        assert.deepEqual(snapshot(agentsDirectory), readOnlyAgentsBefore, combination);
        assertNoExternalInstall(readOnlyAgentsTarget, combination);
        assertChecks(readOnlyAgents, combination);
        const readOnlyAgentsRerun = await invokeCompanionSkill(readOnlyAgentsTarget, versions);
        assert.equal(readOnlyAgentsRerun.dependency.changed, false, combination);
        assert.equal(readOnlyAgentsRerun.dependency.temporaryCleaned, true, combination);
        assert.equal(readOnlyAgentsRerun.boundary.changed, false, combination);
        assert.equal(statMode(agentsDirectory), 0o555, combination);
        assert.deepEqual(snapshot(agentsDirectory), readOnlyAgentsBefore, combination);
        results.push({ combination, state: "read-only-agents", evidence: { ...readOnlyAgents, fixtureEvidence } });

        const currentTarget = cloneTarget(root, freshTarget, manager, config, "current");
        const currentBefore = snapshot(currentTarget);
        const current = await invokeCompanionSkill(currentTarget, versions);
        assert.equal(current.dependency.changed, false, combination);
        assert.equal(current.dependency.temporaryCleaned, true, combination);
        assert.equal(current.boundary.changed, false, combination);
        assert.deepEqual(snapshot(currentTarget), currentBefore, combination);
        assertNoExternalInstall(currentTarget, combination);
        assertChecks(current, combination);
        results.push({ combination, state: "current", evidence: { ...current, fixtureEvidence } });

        const outdatedTarget = cloneTarget(root, freshTarget, manager, config, "outdated-managed");
        makeManagedInstallationsOutdated(outdatedTarget);
        const outdated = await invokeCompanionSkill(outdatedTarget, versions);
        assert.equal(outdated.dependency.changed, true, combination);
        assert.equal(outdated.dependency.temporaryCleaned, true, combination);
        assert.equal(outdated.boundary.changed, true, combination);
        assertNoExternalInstall(outdatedTarget, combination);
        assertChecks(outdated, combination);
        const outdatedAfter = snapshot(outdatedTarget);
        const outdatedRerun = await invokeCompanionSkill(outdatedTarget, versions);
        assert.equal(outdatedRerun.dependency.changed, false, combination);
        assert.equal(outdatedRerun.dependency.temporaryCleaned, true, combination);
        assert.equal(outdatedRerun.boundary.changed, false, combination);
        assert.deepEqual(snapshot(outdatedTarget), outdatedAfter, combination);
        assertNoExternalInstall(outdatedTarget, combination);
        results.push({
          combination,
          state: "outdated-managed",
          evidence: { first: { ...outdated, fixtureEvidence }, rerun: outdatedRerun },
        });

        const modifiedGenericTarget = cloneTarget(root, freshTarget, manager, config, "conflicting-modified-generic");
        const modifiedGenericPath = join(modifiedGenericTarget, "tools/oxlint/anti-slop/index.ts");
        writeText(modifiedGenericPath, "// modified by the target\n");
        await expectConflict(
          modifiedGenericTarget,
          "conflicting-modified-generic",
          new RegExp(escapeRegExp(modifiedGenericPath)),
          failures,
        );

        const extraGenericTarget = cloneTarget(root, freshTarget, manager, config, "conflicting-extra-generic");
        const extraGenericPath = join(extraGenericTarget, "tools/oxlint/anti-slop/empty-directory");
        mkdirSync(extraGenericPath, { recursive: true });
        await expectConflict(
          extraGenericTarget,
          "conflicting-extra-generic",
          new RegExp(escapeRegExp(extraGenericPath)),
          failures,
        );

        const unmanagedGenericTarget = cloneTarget(root, freshTarget, manager, config, "conflicting-unmanaged-generic");
        const genericProvenancePath = join(unmanagedGenericTarget, "tools/oxlint/anti-slop/.upstream.json");
        rmSync(genericProvenancePath);
        await expectConflict(
          unmanagedGenericTarget,
          "conflicting-unmanaged-generic",
          /unmanaged generic anti-slop installation.*tools\/oxlint\/anti-slop/,
          failures,
        );

        const boundaryConflictTarget = cloneTarget(
          root,
          freshTarget,
          manager,
          config,
          "conflicting-unmanaged-boundary",
        );
        rmSync(
          join(boundaryConflictTarget, "tools/oxlint/boundary-aware/.boundary-aware.json"),
        );
        await expectConflict(
          boundaryConflictTarget,
          "conflicting-unmanaged-boundary",
          /invalid boundary-aware provenance|unmanaged boundary-aware installation|different managed installation/,
          failures,
        );
      }
    }

    assert.equal(results.length, managers.length * configStyles.length * 4);
    assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
    console.log(
      `Forward-test matrix passed: ${managers.length} package managers x ${configStyles.length} Oxlint styles x ${stateNames.length} installation states.`,
    );
    console.log(`Successful reruns were byte-for-byte stable in ${results.length} state checks.`);
    console.log(`Shared fixture evidence: ${fixtureEvidence.runtime}`);
    console.log(`Oxlint fixture evidence: ${fixtureEvidence.sourceOxlint}`);
    console.log(`Brownfield fixture evidence: ${brownfieldEvidence}`);
    console.log(`Dependency evidence: ${dependencyManifest.source}@${dependencyManifest.revision}`);
    console.log(`Oxlint evidence: oxlint@${versions.oxlint}, @oxlint/plugins@${versions.plugins}`);
  } finally {
    if (process.env.KEEP_FORWARD_TEST_ARTIFACTS === "1") {
      console.log(`Kept disposable forward-test repositories at ${root}.`);
    } else {
      rmSync(root, { recursive: true, force: true });
      console.log("Removed disposable forward-test repositories after diagnosis.");
    }
  }
} finally {
  globalThis.fetch = rawFetch;
}

function cachedResponse(content, status = 200, ok = true) {
  return {
    ok,
    status,
    arrayBuffer: async () => Buffer.from(content),
  };
}

function createTarget(root, manager, config, state, versions) {
  const target = join(root, `${manager.name}-${config.name}-${state}`);
  mkdirSync(target, { recursive: true });
  writeText(join(target, "package.json"), `${JSON.stringify({
    name: `forward-${manager.name}-${config.name}`,
    private: true,
    type: "module",
    packageManager: `${manager.name}@${packageManagerVersion.get(manager.name)}`,
    scripts: {
      lint: "node .forward/checks.mjs lint",
      typecheck: "node .forward/checks.mjs typecheck",
      "format:check": "node .forward/checks.mjs format:check",
    },
    devDependencies: {
      "@oxlint/plugins": versions.plugins,
      oxlint: versions.oxlint,
    },
  }, null, 2)}\n`);
  writeText(join(target, manager.lockfile), lockfileFor(manager));
  writeText(join(target, "AGENTS.md"), "Keep this disposable fixture self-contained.\n");
  writeText(join(target, "src/untouched.ts"), "export const untouched = true;\n");
  writeText(join(target, "notes.md"), "pre-existing unrelated work\n");
  writeInitialConfig(target, config);
  writeForwardChecks(target, config, manager);
  assertCommand(run("git", ["init", "--quiet"], target), "git init disposable target");
  return target;
}

function cloneTarget(root, source, manager, config, state) {
  const target = join(root, `${manager.name}-${config.name}-${state}`);
  cpSync(source, target, { recursive: true });
  return target;
}

function lockfileFor(manager) {
  if (manager.name === "npm") return '{"name":"forward-fixture","lockfileVersion":3}\n';
  if (manager.name === "pnpm") return "lockfileVersion: '9.0'\n";
  if (manager.name === "yarn") return "# This is a disposable Yarn fixture lockfile.\n";
  return "lockfileVersion: 1\n";
}

function writeInitialConfig(target, config) {
  const base = {
    ignorePatterns: ["existing/**"],
    jsPlugins: [{ name: "existing", specifier: "./tools/existing.mjs" }],
    settings: { existing: { enabled: true } },
    rules: { "existing/rule": "warn" },
  };
  if (config.kind === "vite-plus") {
    writeModuleConfig(target, config, {
      lint: base,
      fmt: { ignorePatterns: ["format-existing/**"] },
      unrelated: { preserved: true },
    });
    return;
  }
  writeConfig(target, config, base);
}

function writeForwardChecks(target, config, manager, mode = "enforcement") {
  const configFile = config.file.replaceAll("\\", "/");
  const contract = {
    configFile,
    needles: [
      ...installedIgnores,
      ...(mode === "enforcement" ? [
        ...genericRules,
        ...boundaryRules,
        "anti-slop",
        "boundary-aware",
        "./tools/oxlint/anti-slop/index.ts",
        "./tools/oxlint/boundary-aware/index.mjs",
      ] : []),
    ],
    required: [
      "tools/oxlint/anti-slop/index.ts",
      "tools/oxlint/anti-slop/.upstream.json",
      "tools/oxlint/boundary-aware/index.mjs",
      "tools/boundary-contracts/boundary-contracts.mjs",
      "tools/boundary-contracts/boundary-contracts.d.mts",
      ...(mode === "brownfield" ? [".oxlint.anti-slop.json"] : []),
    ],
    mode,
  };
  writeText(join(target, ".forward/contract.json"), `${JSON.stringify(contract, null, 2)}\n`);
  writeText(
    join(target, ".forward/checks.mjs"),
    `import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2];
const root = process.cwd();
const contract = JSON.parse(readFileSync(join(root, ".forward/contract.json"), "utf8"));
const config = readFileSync(join(root, contract.configFile), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

for (const needle of contract.needles) assert.equal(config.includes(needle), true, needle);
for (const required of contract.required) assert.equal(existsSync(join(root, required)), true, required);
assert.equal(existsSync(join(root, ".agents/external-skills")), false, ".agents/external-skills must not persist");
assert.equal(existsSync(join(root, ".agents/skills")), false, ".agents/skills must not persist");

if (mode === "typecheck") {
  assert.match(readFileSync(join(root, "tools/boundary-contracts/boundary-contracts.d.mts"), "utf8"), /Boundary/);
}
if (mode === "format:check") {
  for (const file of textFiles(root)) assert.equal(readFileSync(file, "utf8").endsWith("\\n"), true, file);
}
if (contract.mode === "brownfield") {
  assert.equal(typeof packageJson.scripts["anti-slop:check"], "string");
  assert.match(readFileSync(join(root, ".oxlint.anti-slop.json"), "utf8"), /anti-slop/);
  assert.equal(existsSync(join(root, "reports/anti-slop")), false);
}
console.log(mode + " passed");

function textFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    if (!entry.isFile() || path.includes("/.forward/bin/")) return [];
    return [path];
  });
}
`,
  );
  if (manager.name === "yarn") writeYarnShim(target);
}

function writeYarnShim(target) {
  const shim = join(target, ".forward/bin/yarn");
  writeText(
    shim,
    `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const script = args[0] === "run" ? args[1] : args[0];
const result = spawnSync(process.execPath, [join(process.cwd(), ".forward/checks.mjs"), script], { stdio: "inherit" });
process.exit(result.status ?? 1);
`,
  );
  chmodSync(shim, 0o755);
}

async function invokeCompanionSkill(target, versions, mode = "enforcement") {
  const inspection = inspectTarget(target);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "boundary-aware-upstream-"));
  const dependencyDestination = join(temporaryRoot, "install-anti-slop");
  const upstreamPlugin = join(target, "tools/oxlint/anti-slop");
  let upstreamAction = "current";
  const dependencyRevision = dependencyManifest.revision;
  let result;

  try {
    await installPinnedSkill(dependencyManifest, dependencyDestination);
    const genericStatus = inspectGenericInstallation(target, dependencyManifest);
    if (!genericStatus.current) {
      const script = join(dependencyDestination, "scripts/install.mjs");
      const installerArgs = [script, "tools/oxlint/anti-slop"];
      if (genericStatus.exists) installerArgs.push("--force");
      const installerResult = run(process.execPath, installerArgs, target);
      assertCommand(installerResult, "upstream install-anti-slop");
      assertGenericAssetsMatch(upstreamPlugin, dependencyManifest);
      writeGenericProvenance(upstreamPlugin, dependencyManifest);
      assert.equal(inspectGenericInstallation(target, dependencyManifest).current, true);
      upstreamAction = genericStatus.exists ? "upgraded" : "fresh";
    }

    const boundary = installBoundaryAssets({ cwd: target });
    await mergeOxlintConfiguration(target, inspection.config, mode);
    const checks = runChecks(target, inspection.packageManager, mode);
    await assertConfiguration(target, inspection.config, mode);
    result = {
      inspection,
      mode,
      dependency: {
        changed: upstreamAction !== "current",
        revision: dependencyRevision,
        temporaryCleaned: false,
      },
      upstream: upstreamAction,
      boundary,
      checks,
      provenance: collectProvenance(target),
      dependencyVersions: versions,
    };
    return result;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
    if (result) result.dependency.temporaryCleaned = !existsSync(temporaryRoot);
  }
}

function genericFiles(manifest) {
  return manifest.files
    .filter((file) => file.path.startsWith("assets/anti-slop/"))
    .map((file) => ({
      path: file.path.slice("assets/anti-slop/".length),
      source: file.path,
      sha256: file.sha256,
    }));
}

function genericProvenance(manifest) {
  return {
    name: manifest.name,
    source: manifest.source,
    branch: manifest.branch,
    revision: manifest.revision,
    path: manifest.path,
    files: manifest.files,
    installedFiles: genericFiles(manifest),
  };
}

function writeGenericProvenance(destination, manifest) {
  writeText(
    join(destination, ".upstream.json"),
    `${JSON.stringify(genericProvenance(manifest), null, 2)}\n`,
  );
}

function inspectGenericInstallation(target, manifest) {
  const destination = join(target, "tools/oxlint/anti-slop");
  if (!existsSync(destination)) return { exists: false, current: false };
  if (!lstatSync(destination).isDirectory()) {
    throw new Error(`Generic anti-slop destination is not a directory: ${destination}.`);
  }
  const provenancePath = join(destination, ".upstream.json");
  if (!existsSync(provenancePath)) {
    throw new Error(
      `Refusing to overwrite an unmanaged generic anti-slop installation at ${destination}; ` +
        `expected provenance at ${provenancePath}.`,
    );
  }

  let provenance;
  try {
    provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  } catch {
    throw new Error(`Refusing to use invalid generic anti-slop provenance at ${provenancePath}.`);
  }
  if (
    provenance?.name !== manifest.name ||
    provenance?.source !== manifest.source ||
    provenance?.branch !== manifest.branch ||
    provenance?.path !== manifest.path ||
    !Array.isArray(provenance.installedFiles) ||
    provenance.installedFiles.length === 0
  ) {
    throw new Error(`Refusing to overwrite a different generic anti-slop installation at ${destination}.`);
  }

  const recorded = new Map(
    provenance.installedFiles.map((file) => {
      if (
        !file ||
        typeof file.path !== "string" ||
        typeof file.source !== "string" ||
        file.source !== `assets/anti-slop/${file.path}` ||
        !/^[0-9a-f]{64}$/.test(file.sha256) ||
        file.path.startsWith("/") ||
        file.path.includes("\\") ||
        file.path.split("/").includes("..") ||
        !file.path
      ) {
        throw new Error(`Refusing to use invalid generic anti-slop file metadata at ${provenancePath}.`);
      }
      return [file.path, file];
    }),
  );
  if (recorded.size !== provenance.installedFiles.length) {
    throw new Error(`Refusing to use incomplete generic anti-slop file metadata at ${provenancePath}.`);
  }

  const actual = walkEntries(destination).filter((path) => path !== ".upstream.json");
  const expected = expectedGenericEntries(recorded.keys());
  const expectedEntries = new Set(expected);
  const unexpected = actual.filter((path) => !expectedEntries.has(path));
  const missing = expected.filter((path) => !actual.includes(path));
  if (unexpected.length || missing.length) {
    const conflicts = [
      ...unexpected.map((path) => join(destination, path)),
      ...missing.map((path) => join(destination, path)),
    ];
    throw new Error(
      `Generic anti-slop installation has an exact file conflict at ${conflicts.join(", ")}; ` +
        "review it before running the installer again.",
    );
  }
  for (const [path, file] of recorded) {
    const actualDigest = sha256(readFileSync(join(destination, path)));
    if (actualDigest !== file.sha256) {
      throw new Error(
        `Managed generic anti-slop file changed locally: ${join(destination, path)}; ` +
          "review it before running the installer again.",
      );
    }
  }

  const expectedCurrent = genericFiles(manifest);
  const current =
    provenance.revision === manifest.revision &&
    JSON.stringify(provenance.files) === JSON.stringify(manifest.files) &&
    JSON.stringify(provenance.installedFiles) === JSON.stringify(expectedCurrent) &&
    JSON.stringify(expected) === JSON.stringify(expectedGenericEntries(expectedCurrent.map((file) => file.path)));
  return { exists: true, current };
}

function expectedGenericEntries(filePaths) {
  const paths = [...filePaths];
  const entries = new Set(paths);
  for (const path of paths) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      entries.add(`${parts.slice(0, index).join("/")}/`);
    }
  }
  return [...entries].sort();
}

function assertGenericAssetsMatch(destination, manifest) {
  const expectedFiles = genericFiles(manifest);
  const expected = expectedGenericEntries(expectedFiles.map((file) => file.path));
  const actual = walkEntries(destination).filter((path) => path !== ".upstream.json");
  const expectedEntries = new Set(expected);
  const unexpected = actual.filter((path) => !expectedEntries.has(path));
  const missing = expected.filter((path) => !actual.includes(path));
  if (unexpected.length || missing.length) {
    const conflicts = [
      ...unexpected.map((path) => join(destination, path)),
      ...missing.map((path) => join(destination, path)),
    ];
    throw new Error(
      `Verified generic anti-slop assets have an exact file conflict at ${conflicts.join(", ")}; ` +
        "review the upstream installer output before recording provenance.",
    );
  }
  for (const file of expectedFiles) {
    const target = join(destination, file.path);
    const actualDigest = sha256(readFileSync(target));
    if (actualDigest !== file.sha256) {
      throw new Error(
        `Verified generic anti-slop file has an unexpected hash at ${target}; ` +
          `expected ${file.sha256}, got ${actualDigest}.`,
      );
    }
  }
}

function inspectTarget(target) {
  const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
  const declared = manifest.packageManager?.split("@")[0];
  const lockMatches = managers.filter((manager) => existsSync(join(target, manager.lockfile)));
  const manager = managers.find((candidate) => candidate.name === declared) ?? lockMatches[0];
  assert.ok(manager, `Could not infer a supported package manager in ${target}`);
  assert.equal(lockMatches.length, 1, `Expected one package-manager lockfile in ${target}`);
  assert.equal(lockMatches[0].name, manager.name, `packageManager and lockfile disagree in ${target}`);
  const status = run("git", ["status", "--short"], target);
  assertCommand(status, `git status --short in ${target}`);
  assert.match(status.stdout, /notes\.md/, `unrelated work disappeared in ${target}`);
  const config = configStyles.find((candidate) => existsSync(join(target, candidate.file)));
  assert.ok(config, `Could not infer an Oxlint configuration in ${target}`);
  return { packageManager: manager.name, configStyle: config.name, config };
}

async function mergeOxlintConfiguration(target, config, mode = "enforcement") {
  const existing = await readConfig(target, config);
  const pluginEntries = [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    { name: "boundary-aware", specifier: "./tools/oxlint/boundary-aware/index.mjs" },
  ];
  const additions = {
    ignorePatterns: installedIgnores,
    jsPlugins: pluginEntries,
    settings: {
      "boundary-contracts": {
        failureNames: ["failure"],
      },
    },
    rules: Object.fromEntries([...genericRules, ...boundaryRules].map((rule) => [rule, "error"])),
  };

  const merge = (base) => ({
    ...base,
    ignorePatterns: unique([...(base.ignorePatterns ?? []), ...additions.ignorePatterns]),
    jsPlugins: uniqueBySpecifier([...(base.jsPlugins ?? []), ...additions.jsPlugins]),
    settings: {
      ...(base.settings ?? {}),
      "boundary-contracts": {
        ...(base.settings?.["boundary-contracts"] ?? {}),
        ...additions.settings["boundary-contracts"],
      },
    },
    rules: { ...(base.rules ?? {}), ...additions.rules },
  });

  const mergeIgnores = (base) => ({
    ...base,
    ignorePatterns: unique([...(base.ignorePatterns ?? []), ...installedIgnores]),
  });

  if (config.kind === "vite-plus") {
    const next = {
      ...existing,
      lint: mode === "brownfield" ? mergeIgnores(existing.lint ?? {}) : merge(existing.lint ?? {}),
      fmt: {
        ...(existing.fmt ?? {}),
        ignorePatterns: unique([...(existing.fmt?.ignorePatterns ?? []), ...installedIgnores]),
      },
    };
    writeModuleConfig(target, config, next);
    if (mode === "brownfield") writeBrownfieldConfig(target, existing.lint ?? {}, merge);
    if (mode === "brownfield") addBrownfieldScript(target);
    return;
  }
  writeConfig(target, config, mode === "brownfield" ? mergeIgnores(existing) : merge(existing));
  if (mode === "brownfield") {
    writeBrownfieldConfig(target, existing, merge);
    addBrownfieldScript(target);
  }
}

function writeBrownfieldConfig(target, base, merge) {
  writeIfChanged(
    join(target, ".oxlint.anti-slop.json"),
    `${JSON.stringify(merge(base), null, 2)}\n`,
  );
}

function addBrownfieldScript(target) {
  const packagePath = join(target, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const scripts = {
    ...(packageJson.scripts ?? {}),
    "anti-slop:check": "oxlint --config .oxlint.anti-slop.json .",
  };
  writeIfChanged(packagePath, `${JSON.stringify({ ...packageJson, scripts }, null, 2)}\n`);
}

async function readConfig(target, config) {
  const path = join(target, config.file);
  const source = readFileSync(path, "utf8");
  if (config.kind === "json") return JSON.parse(source);
  if (config.kind === "jsonc") return JSON.parse(stripJsonComments(source));
  if (config.kind === "typescript" || config.kind === "vite-plus") {
    return Function(`return (${source.replace(/^\s*\/\/.*\n/, "").replace(/^export default\s*/, "").replace(/;\s*$/, "")})`)();
  }
  const module = await import(pathToFileURL(path).href + `?forward=${importNonce++}`);
  return module.default;
}

function writeConfig(target, config, value) {
  if (config.kind === "json") {
    writeIfChanged(join(target, config.file), `${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (config.kind === "jsonc") {
    writeIfChanged(join(target, config.file), `// Existing target comment\n${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  writeModuleConfig(target, config, value);
}

function writeModuleConfig(target, config, value) {
  const exportValue = `// Existing target comment\nexport default ${JSON.stringify(value, null, 2)};\n`;
  writeIfChanged(join(target, config.file), exportValue);
}

function stripJsonComments(source) {
  return source
    .replace(/\/\*[^]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueBySpecifier(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = `${value.name}:${value.specifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runChecks(target, managerName) {
  const manager = managers.find((candidate) => candidate.name === managerName);
  assert.ok(manager);
  const commands = {
    npm: { command: "npm", args: (script) => ["run", "--silent", script] },
    pnpm: { command: "pnpm", args: (script) => ["run", script] },
    bun: { command: "bun", args: (script) => ["run", script] },
    yarn: { command: join(target, ".forward/bin/yarn"), args: (script) => [script] },
  };
  const runner = commands[manager.name];
  return ["lint", "typecheck", "format:check"].map((script) => {
    const result = run(runner.command, runner.args(script), target);
    assertCommand(result, `${manager.name} ${script}`);
    return {
      script,
      command: [runner.command, ...runner.args(script)].join(" "),
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`.trim(),
    };
  });
}

async function assertConfiguration(target, config, mode = "enforcement") {
  const source = readFileSync(join(target, config.file), "utf8");
  const expectedNormalEntries = mode === "brownfield"
    ? installedIgnores
    : [...genericRules, ...boundaryRules, ...installedIgnores];
  for (const needle of expectedNormalEntries) {
    assert.match(source, new RegExp(escapeRegExp(needle)), `${config.file}: ${needle}`);
  }
  if (mode === "brownfield") {
    assert.doesNotMatch(source, /anti-slop\/no-shape-in-symbol-names/);
    assert.doesNotMatch(source, /boundary-aware\/require-declared-boundary/);
    const brownfield = readFileSync(join(target, ".oxlint.anti-slop.json"), "utf8");
    for (const needle of [...genericRules, ...boundaryRules, ...installedIgnores]) {
      assert.match(brownfield, new RegExp(escapeRegExp(needle)), `.oxlint.anti-slop.json: ${needle}`);
    }
  }
  let lintIgnorePatterns = null;
  let formatIgnorePatterns = null;
  if (config.kind === "vite-plus") {
    const parsed = await readConfig(target, config);
    lintIgnorePatterns = parsed.lint.ignorePatterns;
    formatIgnorePatterns = parsed.fmt.ignorePatterns;
    assert.deepEqual(lintIgnorePatterns.slice(-installedIgnores.length), installedIgnores);
    assert.deepEqual(formatIgnorePatterns.slice(-installedIgnores.length), installedIgnores);
  }
  assert.equal(new Set(installedIgnores).size, installedIgnores.length);
  for (const pattern of installedIgnores) {
    if (config.kind === "vite-plus") {
      assert.equal(
        lintIgnorePatterns.filter((entry) => entry === pattern).length,
        1,
        `${config.file}: duplicate lint ignore ${pattern}`,
      );
      assert.equal(
        formatIgnorePatterns.filter((entry) => entry === pattern).length,
        1,
        `${config.file}: duplicate format ignore ${pattern}`,
      );
      continue;
    }
    assert.equal(
      source.indexOf(pattern),
      source.lastIndexOf(pattern),
      `${config.file}: duplicate ${pattern}`,
    );
  }
}

function collectProvenance(target) {
  const upstreamPath = join(target, "tools/oxlint/anti-slop/.upstream.json");
  const pluginPath = join(target, "tools/oxlint/boundary-aware/.boundary-aware.json");
  const runtimePath = join(target, "tools/boundary-contracts/.boundary-aware.json");
  return {
    upstream: JSON.parse(readFileSync(upstreamPath, "utf8")),
    boundaryPlugin: JSON.parse(readFileSync(pluginPath, "utf8")),
    boundaryRuntime: JSON.parse(readFileSync(runtimePath, "utf8")),
  };
}

function makeManagedInstallationsOutdated(target) {
  const upstreamPath = join(target, "tools/oxlint/anti-slop/.upstream.json");
  const upstream = JSON.parse(readFileSync(upstreamPath, "utf8"));
  upstream.revision = "0".repeat(40);
  const oldGenericContent = "// old managed generic plugin\n";
  writeText(join(target, "tools/oxlint/anti-slop/index.ts"), oldGenericContent);
  upstream.installedFiles = upstream.installedFiles.map((file) =>
    file.path === "index.ts"
      ? { ...file, sha256: sha256(Buffer.from(oldGenericContent)) }
      : file,
  );
  writeText(upstreamPath, `${JSON.stringify(upstream, null, 2)}\n`);

  for (const component of [
    ["tools/oxlint/boundary-aware", "index.mjs"],
    ["tools/boundary-contracts", "boundary-contracts.mjs"],
  ]) {
    const componentRoot = join(target, component[0]);
    const provenancePath = join(componentRoot, ".boundary-aware.json");
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
    const oldContent = `// old managed ${component[1]}\n`;
    writeText(join(componentRoot, component[1]), oldContent);
    provenance.version = 0;
    provenance.files = provenance.files.map((file) =>
      file.path === component[1]
        ? { ...file, sha256: sha256(Buffer.from(oldContent)) }
        : file,
    );
    writeText(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  }
}

function assertNoExternalInstall(target, combination) {
  assert.equal(existsSync(join(target, ".agents/external-skills")), false, combination);
  assert.equal(existsSync(join(target, ".agents/skills")), false, combination);
}

async function expectConflict(target, state, pattern, failures) {
  try {
    await invokeCompanionSkill(target, { oxlint: "1.80.0", plugins: "1.80.0" });
    failures.push({ state, target, error: "Expected a conflict but the invocation succeeded." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern, state);
    const artifactPath = join(target, ".forward/failure-artifact.json");
    writeText(
      artifactPath,
      `${JSON.stringify({ state, message, files: snapshot(target) }, null, 2)}\n`,
    );
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    console.log(`Diagnosed expected ${state}: ${artifact.message}`);
  }
}

async function runBrownfieldCriticalPath(root, versions) {
  const toolRoot = join(root, "brownfield-toolchain");
  mkdirSync(toolRoot, { recursive: true });
  const oxlint = join(toolRoot, "node_modules/.bin/oxlint");
  writeJson(join(toolRoot, "package.json"), {
    name: "brownfield-toolchain",
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
        "oxlint@" + versions.oxlint,
        "@oxlint/plugins@" + versions.plugins,
      ],
      repositoryRoot,
    ),
    "install brownfield fixture toolchain",
  );

  const target = join(toolRoot, "brownfield");
  mkdirSync(target, { recursive: true });
  writeJson(join(target, "package.json"), {
    name: "brownfield-critical-path",
    private: true,
    type: "module",
    packageManager: "npm@10.13.1",
    scripts: {
      lint: "node existing/checks.mjs lint",
      typecheck: "node existing/checks.mjs typecheck",
      "format:check": "node existing/checks.mjs format:check",
    },
    devDependencies: {
      "@oxlint/plugins": versions.plugins,
      oxlint: versions.oxlint,
    },
  });
  writeText(
    join(target, "package-lock.json"),
    '{"name":"brownfield-critical-path","lockfileVersion":3}\n',
  );
  writeText(join(target, "AGENTS.md"), "Keep this disposable fixture self-contained.\n");
  writeText(join(target, "notes.md"), "pre-existing unrelated work\n");
  writeJson(join(target, ".oxlintrc.json"), { ignorePatterns: ["existing/**"] });
  writeText(
    join(target, "existing/checks.mjs"),
    [
      'const mode = process.argv[2];',
      'console.log(mode + " passed");',
      "",
    ].join("\n"),
  );
  writeText(
    join(target, "src/brownfield.ts"),
    [
      "export function inspectRaw(input: unknown): boolean {",
      '  return typeof input === "string";',
      "}",
      "const shape = 1;",
      "export { shape };",
      "",
    ].join("\n"),
  );
  assertCommand(run("git", ["init", "--quiet"], target), "git init brownfield fixture");

  const brownfield = await invokeCompanionSkill(target, versions, "brownfield");
  assert.equal(brownfield.mode, "brownfield");
  assert.deepEqual(
    brownfield.checks.map(({ script }) => script),
    ["lint", "typecheck", "format:check"],
  );
  const environment = {
    PATH: join(toolRoot, "node_modules/.bin") + ":" + process.env.PATH,
  };
  const policyRun = run(
    "npm",
    ["run", "--silent", "anti-slop:check"],
    target,
    environment,
  );
  assert.notEqual(policyRun.status, 0, "brownfield check reports active findings");
  assert.match(
    policyRun.stdout + "\n" + policyRun.stderr,
    /require-declared-boundary|no-shape-in-symbol-names/,
  );
  assert.equal(run("npm", ["run", "--silent", "lint"], target, environment).status, 0);
  assert.equal(existsSync(join(target, "reports/anti-slop")), false);
  assert.equal(existsSync(join(target, "tools/oxlint/boundary-aware/assessment.mjs")), false);
  assert.equal(existsSync(join(target, "reports")), false);

  const brownfieldSetupBefore = snapshot(target);
  await invokeCompanionSkill(target, versions, "brownfield");
  assert.deepEqual(
    snapshot(target),
    brownfieldSetupBefore,
    "brownfield setup is idempotent",
  );

  writeText(
    join(target, "src/brownfield.ts"),
    "export const applicationValue = 1;\n",
  );
  assert.equal(
    run("npm", ["run", "--silent", "anti-slop:check"], target, environment).status,
    0,
  );
  const enforcement = await invokeCompanionSkill(target, versions, "enforcement");
  assert.equal(enforcement.mode, "enforcement");
  assertChecks(enforcement, "brownfield critical path enforcement");
  assert.equal(
    run(oxlint, ["--config", ".oxlintrc.json", "."], target, environment).status,
    0,
  );
  const enforcementSetupBefore = snapshot(target);
  await invokeCompanionSkill(target, versions, "enforcement");
  assert.deepEqual(
    snapshot(target),
    enforcementSetupBefore,
    "enforcement setup is idempotent",
  );
  assertNoExternalInstall(target, "brownfield critical path");
  return "brownfield ordinary lint findings, no generated artifacts, enforcement clean";
}
function runSharedFixtureChecks(root, versions) {
  const accepted = run(process.execPath, ["--test", join(skillRoot, "fixtures/accepted.test.mjs")], repositoryRoot);
  assertCommand(accepted, "boundary runtime accepted fixtures");
  const rejected = run(process.execPath, ["--test", join(skillRoot, "fixtures/rejected.test.mjs")], repositoryRoot);
  assertCommand(rejected, "boundary runtime rejected fixtures");
  const installer = run(process.execPath, ["--test", join(scriptDirectory, "install.test.mjs")], repositoryRoot);
  assertCommand(installer, "boundary installer fixtures");
  const oxlintRoot = join(root, "oxlint-tool");
  mkdirSync(oxlintRoot, { recursive: true });
  const oxlintInstall = run(
    "npm",
    [
      "install",
      "--prefix",
      oxlintRoot,
      "--no-save",
      "--package-lock=false",
      `oxlint@${versions.oxlint}`,
      `@oxlint/plugins@${versions.plugins}`,
    ],
    repositoryRoot,
  );
  assertCommand(oxlintInstall, "npm install oxlint for forward fixtures");
  const oxlintBinary = join(oxlintRoot, "node_modules/.bin/oxlint");
  assert.equal(existsSync(oxlintBinary), true, oxlintBinary);
  const sourceOxlint = run(
    process.execPath,
    [
      join(skillRoot, "fixtures/run-oxlint-fixtures.mjs"),
      "--oxlint",
      oxlintBinary,
    ],
    repositoryRoot,
  );
  assertCommand(sourceOxlint, "source boundary-aware Oxlint fixtures");
  return {
    runtime: "accepted/rejected runtime and installer fixtures passed",
    sourceOxlint: "source boundary-aware Oxlint fixtures passed",
    oxlintBinary,
  };
}

function runInstalledOxlintFixtures(target, oxlintBinary) {
  const result = run(
    process.execPath,
    [
      join(skillRoot, "fixtures/run-oxlint-fixtures.mjs"),
      "--oxlint",
      oxlintBinary,
      "--plugin",
      join(target, "tools/oxlint/boundary-aware/index.mjs"),
    ],
    target,
  );
  assertCommand(result, `installed boundary-aware Oxlint fixtures for ${target}`);
  return "installed boundary-aware Oxlint fixtures passed";
}

function readCurrentDependencyVersions() {
  const oxlint = readNpmVersion("oxlint");
  const plugins = readNpmVersion("@oxlint/plugins");
  return { oxlint, plugins };
}

function readNpmVersion(name) {
  const result = run("npm", ["view", name, "version"], repositoryRoot);
  assertCommand(result, `npm view ${name} version`);
  return result.stdout.trim();
}

function snapshot(directory) {
  return walkFiles(directory).map((file) => {
    const stats = lstatSync(join(directory, file));
    return {
      path: file,
      sha256: sha256(readFileSync(join(directory, file))),
      mode: stats.mode,
      mtimeMs: stats.mtimeMs,
    };
  });
}

function statMode(path) {
  return statSync(path).mode & 0o777;
}

function walkFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    const path = join(directory, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walkFiles(path, relativePath);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in disposable target: ${path}`);
    if (entry.isFile()) return [relativePath];
    return [];
  }).sort();
}

function walkEntries(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in generic anti-slop installation: ${absolutePath}`);
    if (entry.isDirectory()) return [`${path}/`, ...walkEntries(absolutePath, path)];
    if (entry.isFile()) return [path];
    return [];
  }).sort();
}

function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeText(path, content);
  return true;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv, CI: "1" },
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

function assertChecks(result, combination) {
  assert.deepEqual(
    result.checks.map((check) => check.script),
    ["lint", "typecheck", "format:check"],
    combination,
  );
  assert.equal(result.provenance.upstream.revision, dependencyManifest.revision, combination);
  assert.equal(result.provenance.upstream.source, dependencyManifest.source, combination);
  assert.equal(result.provenance.upstream.branch, dependencyManifest.branch, combination);
  assert.deepEqual(result.provenance.upstream.files, dependencyManifest.files, combination);
  assert.deepEqual(result.provenance.upstream.installedFiles, genericFiles(dependencyManifest), combination);
  assert.equal(result.provenance.boundaryPlugin.source, "meaningfool/skills/install-boundary-aware-anti-slop", combination);
}
