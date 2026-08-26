import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkForUpdate, installPinnedSkill, updateManifest } from "./install-pinned-skill.mjs";

const revision = "0123456789abcdef0123456789abcdef01234567";
const nextRevision = "fedcba9876543210fedcba9876543210fedcba98";
const files = [
  ["SKILL.md", "---\nname: install-anti-slop\n---\n"],
  ["scripts/install.mjs", "console.log('verified');\n"],
];
const nextFiles = [
  ["SKILL.md", "---\nname: install-anti-slop\n---\nupdated\n"],
  ["scripts/install.mjs", "console.log('verified update');\n"],
];
const manifest = {
  name: "install-anti-slop",
  source: "https://github.com/example/anti-slop.git",
  branch: "main",
  revision,
  path: "skills/install-anti-slop",
  files: files.map(([path, content]) => ({
    path,
    sha256: createHash("sha256").update(content).digest("hex"),
  })),
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value.includes("api.github.com/repos/example/anti-slop/commits/main")) {
    const content = Buffer.from(JSON.stringify({ sha: nextRevision }));
    return { ok: true, status: 200, arrayBuffer: async () => content };
  }
  if (value.includes(`api.github.com/repos/example/anti-slop/git/trees/${nextRevision}`)) {
    const content = Buffer.from(
      JSON.stringify({
        tree: nextFiles.map(([path]) => ({ path: `skills/install-anti-slop/${path}`, type: "blob" })),
      }),
    );
    return { ok: true, status: 200, arrayBuffer: async () => content };
  }
  const sourceFiles = value.includes(`/${nextRevision}/`) ? nextFiles : files;
  const file = sourceFiles.find(([path]) => value.endsWith(`/${path}`));
  if (!file) throw new Error(`Unexpected test request: ${value}`);
  const content = Buffer.from(file[1]);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => content,
  };
};

const root = mkdtempSync(join(tmpdir(), "pinned-skill-test-"));
const destination = join(root, "external", "install-anti-slop");
try {
  const first = await installPinnedSkill(manifest, destination);
  assert.equal(first.changed, true);
  assert.equal(readFileSync(join(destination, "SKILL.md"), "utf8"), files[0][1]);
  const provenance = JSON.parse(readFileSync(join(destination, ".upstream.json"), "utf8"));
  assert.equal(provenance.source, manifest.source);
  assert.equal(provenance.revision, manifest.revision);

  const update = await checkForUpdate(manifest);
  assert.deepEqual(update, { available: true, current: revision, latest: nextRevision });
  const updatedManifestPath = join(root, "updated-manifest.json");
  const updated = await updateManifest(manifest, updatedManifestPath);
  assert.equal(updated.changed, true);
  assert.equal(updated.manifest.revision, nextRevision);
  assert.deepEqual(JSON.parse(readFileSync(updatedManifestPath, "utf8")).files, updated.manifest.files);

  const before = statSync(join(destination, "SKILL.md")).mtimeMs;
  const second = await installPinnedSkill(manifest, destination);
  assert.equal(second.changed, false);
  assert.equal(statSync(join(destination, "SKILL.md")).mtimeMs, before);

  writeFileSync(join(destination, "unrelated.txt"), "keep me\n");
  await assert.rejects(() => installPinnedSkill(manifest, destination), /unexpected files/);

  const tamperedManifest = {
    ...manifest,
    files: manifest.files.map((file) => ({ ...file, sha256: "0".repeat(64) })),
  };
  await assert.rejects(() => installPinnedSkill(tamperedManifest, join(root, "tampered")), /Hash mismatch/);
} finally {
  globalThis.fetch = originalFetch;
  rmSync(root, { recursive: true, force: true });
}

console.log("Pinned dependency install tests passed.");
