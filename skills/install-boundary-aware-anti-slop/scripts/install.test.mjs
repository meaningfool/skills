import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installBoundaryAssets } from "./install.mjs";

const root = mkdtempSync(join(tmpdir(), "boundary-aware-installer-test-"));

try {
  assert.throws(
    () =>
      installBoundaryAssets({
        cwd: root,
        runtimeDestination: "tools/oxlint/boundary-aware",
      }),
    /must be different paths/,
  );

  const fresh = installBoundaryAssets({ cwd: root });
  assert.equal(fresh.changed, true);
  assert.deepEqual(
    fresh.components.map(({ component, changed }) => ({ component, changed })),
    [
      { component: "plugin", changed: true },
      { component: "runtime", changed: true },
    ],
  );
  assert.equal(
    existsSync(join(root, "tools/oxlint/boundary-aware/index.mjs")),
    true,
  );
  assert.equal(
    existsSync(join(root, "tools/oxlint/boundary-aware/assessment.mjs")),
    false,
  );
  assert.equal(
    existsSync(join(root, "tools/boundary-contracts/boundary-contracts.mjs")),
    true,
  );
  assert.equal(
    existsSync(join(root, "tools/boundary-contracts/boundary-contracts.d.mts")),
    true,
  );
  assert.equal(
    existsSync(join(root, "tools/boundary-contracts/boundary-contracts.d.ts")),
    false,
  );

  const pluginMtime = statSync(join(root, "tools/oxlint/boundary-aware/index.mjs")).mtimeMs;
  const runtimeMtime = statSync(join(root, "tools/boundary-contracts/boundary-contracts.mjs")).mtimeMs;
  const current = installBoundaryAssets({ cwd: root });
  assert.equal(current.changed, false);
  assert.equal(
    statSync(join(root, "tools/oxlint/boundary-aware/index.mjs")).mtimeMs,
    pluginMtime,
  );
  assert.equal(
    statSync(join(root, "tools/boundary-contracts/boundary-contracts.mjs")).mtimeMs,
    runtimeMtime,
  );

  const pluginRoot = join(root, "tools/oxlint/boundary-aware");
  const provenancePath = join(pluginRoot, ".boundary-aware.json");
  const oldProvenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  const oldContent = "// old managed plugin\n";
  const retiredAssessmentContent = "// retired managed assessment runner\n";
  writeFileSync(join(pluginRoot, "assessment.mjs"), retiredAssessmentContent);
  oldProvenance.files.push({
    path: "assessment.mjs",
    sha256: createHash("sha256").update(retiredAssessmentContent).digest("hex"),
  });
  writeFileSync(join(pluginRoot, "index.mjs"), oldContent);
  writeFileSync(
    provenancePath,
    `${JSON.stringify(
      {
        ...oldProvenance,
        version: 0,
        files: oldProvenance.files.map((file) =>
          file.path === "index.mjs"
            ? {
                ...file,
                sha256: "e".repeat(64),
              }
            : file,
        ),
      },
      null,
      2,
    )}\n`,
  );
  const unrelatedPath = join(pluginRoot, "target-config.json");
  writeFileSync(unrelatedPath, "{\"keep\":true}\n");

  // The installer must reject a false digest rather than silently overwriting.
  assert.throws(
    () => installBoundaryAssets({ cwd: root }),
    /changed locally|incomplete boundary-aware provenance/,
  );

  // A valid old managed install is upgraded and preserves unrelated files.
  const validOldDigest = createHash("sha256").update(oldContent).digest("hex");
  const validOld = JSON.parse(readFileSync(provenancePath, "utf8"));
  validOld.files = validOld.files.map((file) =>
    file.path === "index.mjs" ? { ...file, sha256: validOldDigest } : file,
  );
  writeFileSync(provenancePath, `${JSON.stringify(validOld, null, 2)}\n`);
  const upgraded = installBoundaryAssets({ cwd: root });
  assert.equal(upgraded.changed, true);
  assert.equal(readFileSync(unrelatedPath, "utf8"), "{\"keep\":true}\n");
  assert.equal(existsSync(join(pluginRoot, "assessment.mjs")), false);
  assert.match(readFileSync(join(pluginRoot, "index.mjs"), "utf8"), /boundaryAwarePlugin/);

  const conflictRoot = mkdtempSync(join(tmpdir(), "boundary-aware-conflict-test-"));
  try {
    const conflictPluginRoot = join(conflictRoot, "tools/oxlint/boundary-aware");
    mkdirSync(conflictPluginRoot, { recursive: true });
    writeFileSync(join(conflictPluginRoot, "README.md"), "owned by target\n");
    assert.throws(
      () => installBoundaryAssets({ cwd: conflictRoot }),
      /unmanaged boundary-aware installation/,
    );
    assert.equal(existsSync(join(conflictRoot, "tools/boundary-contracts")), false);
  } finally {
    rmSync(conflictRoot, { recursive: true, force: true });
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Boundary-aware installer tests passed.");
