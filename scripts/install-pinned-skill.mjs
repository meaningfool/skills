#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(repositoryRoot, "dependencies/anti-slop.json");
const ownedSkillRoot = join(repositoryRoot, "skills");
const provenanceFile = ".upstream.json";

function fail(message) {
  throw new Error(message);
}

function assertSafeRelativePath(path, label) {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    fail(`${label} must be a safe relative POSIX path: ${path}`);
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") fail("Dependency manifest must be an object.");
  for (const field of ["name", "source", "branch", "revision", "path"]) {
    if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
      fail(`Dependency manifest field '${field}' must be a non-empty string.`);
    }
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.revision)) {
    fail("Dependency manifest revision must be a 40-character lowercase commit SHA.");
  }
  assertSafeRelativePath(manifest.path, "Dependency manifest path");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail("Dependency manifest files must be a non-empty array.");
  }

  const paths = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      fail("Every dependency manifest file needs a path and a SHA-256 digest.");
    }
    assertSafeRelativePath(file.path, "Dependency manifest file path");
    if (paths.has(file.path)) fail(`Duplicate dependency manifest file: ${file.path}`);
    paths.add(file.path);
  }
  return manifest;
}

export function readManifest(path = manifestPath) {
  return validateManifest(JSON.parse(readFileSync(path, "utf8")));
}

function githubRepository(source) {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    fail(`Dependency source must be an HTTPS GitHub repository URL: ${source}`);
  }
  const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length !== 2) fail(`Dependency source must identify one GitHub repository: ${source}`);
  return { owner: parts[0], repository: parts[1] };
}

function rawUrl(manifest, revision, path) {
  const { owner, repository } = githubRepository(manifest.source);
  const encodedPath = [owner, repository, revision, manifest.path, path]
    .flatMap((part) => part.split("/"))
    .map(encodeURIComponent)
    .join("/");
  return `https://raw.githubusercontent.com/${encodedPath}`;
}

async function request(url) {
  if (typeof fetch !== "function") fail("Node.js 18 or newer is required for pinned skill installation.");
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "meaningfool-skills-pinned-dependency",
    },
  });
  const body = await response.arrayBuffer();
  if (!response.ok) {
    const message = Buffer.from(body).toString("utf8").slice(0, 240).replace(/\s+/g, " ");
    fail(`Upstream request failed (${response.status}) for ${url}: ${message}`);
  }
  return Buffer.from(body);
}

async function requestJson(url) {
  const body = await request(url);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    fail(`Upstream response was not valid JSON: ${url}`);
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function downloadFiles(manifest, revision, files, verify = true) {
  const expected = new Map(files.map((file) => [file.path, file.sha256]));
  const downloaded = await Promise.all(
    files.map(async (file) => {
      const content = await request(rawUrl(manifest, revision, file.path));
      const digest = sha256(content);
      if (verify && digest !== expected.get(file.path)) {
        fail(`Hash mismatch for ${file.path} at ${revision}: expected ${expected.get(file.path)}, got ${digest}.`);
      }
      return { path: file.path, sha256: digest, content };
    }),
  );
  return downloaded.sort((left, right) => left.path.localeCompare(right.path));
}

async function upstreamFiles(manifest, revision) {
  const { owner, repository } = githubRepository(manifest.source);
  const tree = await requestJson(
    `https://api.github.com/repos/${owner}/${repository}/git/trees/${revision}?recursive=1`,
  );
  if (tree.truncated) fail(`The upstream tree is truncated; refusing to update ${manifest.name}.`);
  const prefix = `${manifest.path}/`;
  const files = tree.tree
    ?.filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .map((entry) => {
      const path = entry.path.slice(prefix.length);
      assertSafeRelativePath(path, "Upstream file path");
      return { path };
    })
    .filter((entry) => entry.path.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (!files?.length) fail(`No files found at upstream path ${manifest.path} for ${revision}.`);
  const downloaded = await downloadFiles(manifest, revision, files, false);
  return downloaded.map(({ path, sha256: digest }) => ({ path, sha256: digest }));
}

async function latestRevision(manifest) {
  const { owner, repository } = githubRepository(manifest.source);
  const commit = await requestJson(
    `https://api.github.com/repos/${owner}/${repository}/commits/${encodeURIComponent(manifest.branch)}`,
  );
  if (!/^[0-9a-f]{40}$/.test(commit.sha ?? "")) fail("GitHub returned an invalid upstream commit SHA.");
  return commit.sha;
}

function provenance(manifest) {
  return JSON.stringify(
    {
      name: manifest.name,
      source: manifest.source,
      branch: manifest.branch,
      revision: manifest.revision,
      path: manifest.path,
      files: manifest.files,
    },
    null,
    2,
  ) + "\n";
}

function walkFiles(directory, prefix = "") {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`Refusing to inspect a symlink in ${directory}: ${path}`);
    if (entry.isDirectory()) return walkFiles(absolutePath, path);
    if (entry.isFile()) return [path];
    fail(`Refusing to inspect unsupported filesystem entry: ${absolutePath}`);
  });
}

function assertInstallLocation(destination) {
  const resolved = resolve(destination);
  const owned = `${resolve(ownedSkillRoot)}${sep}`;
  if (resolved === resolve(ownedSkillRoot) || resolved.startsWith(owned)) {
    fail(`Refusing to install an external skill inside the owned skill source tree: ${resolved}`);
  }
  return resolved;
}

function desiredFiles(manifest, downloaded) {
  const files = new Map(downloaded.map((file) => [file.path, file.content]));
  files.set(provenanceFile, Buffer.from(provenance(manifest)));
  return files;
}

function sameFiles(destination, desired) {
  if (!existsSync(destination) || !lstatSync(destination).isDirectory()) return false;
  const actual = walkFiles(destination).sort();
  const expected = [...desired.keys()].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return false;
  return expected.every((path) => readFileSync(join(destination, path)).equals(desired.get(path)));
}

function assertExistingInstallIsOwned(destination, manifest, desired) {
  if (!existsSync(destination)) return;
  if (!lstatSync(destination).isDirectory()) fail(`Install destination is not a directory: ${destination}`);
  const path = join(destination, provenanceFile);
  if (!existsSync(path)) {
    fail(`Refusing to overwrite an untracked install at ${destination}; remove it or choose another destination.`);
  }
  const current = JSON.parse(readFileSync(path, "utf8"));
  if (current.name !== manifest.name || current.source !== manifest.source || current.path !== manifest.path) {
    fail(`Refusing to overwrite a different upstream skill at ${destination}.`);
  }
  const unexpected = walkFiles(destination).filter((file) => !desired.has(file));
  if (unexpected.length > 0) {
    fail(`Refusing to remove unexpected files from ${destination}: ${unexpected.join(", ")}`);
  }
}

function replaceDirectory(destination, desired) {
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".pinned-skill-"));
  let moved = false;
  try {
    for (const [path, content] of desired) {
      assertSafeRelativePath(path, "Installed file path");
      const target = join(staging, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, { mode: 0o644 });
    }
    if (existsSync(destination)) {
      const backup = `${destination}.previous-${process.pid}-${Date.now()}`;
      renameSync(destination, backup);
      try {
        renameSync(staging, destination);
        moved = true;
        rmSync(backup, { recursive: true, force: true });
      } catch (error) {
        renameSync(backup, destination);
        throw error;
      }
    } else {
      renameSync(staging, destination);
      moved = true;
    }
  } finally {
    if (!moved) rmSync(staging, { recursive: true, force: true });
  }
}

export async function installPinnedSkill(manifest, destination) {
  validateManifest(manifest);
  const resolvedDestination = assertInstallLocation(destination);
  const downloaded = await downloadFiles(manifest, manifest.revision, manifest.files);
  const desired = desiredFiles(manifest, downloaded);
  assertExistingInstallIsOwned(resolvedDestination, manifest, desired);
  if (sameFiles(resolvedDestination, desired)) {
    return { changed: false, destination: resolvedDestination, revision: manifest.revision };
  }
  replaceDirectory(resolvedDestination, desired);
  return { changed: true, destination: resolvedDestination, revision: manifest.revision };
}

export async function updateManifest(manifest, path = manifestPath) {
  validateManifest(manifest);
  const revision = await latestRevision(manifest);
  if (revision === manifest.revision) return { changed: false, manifest };
  const files = await upstreamFiles(manifest, revision);
  const updated = { ...manifest, revision, files };
  writeFileSync(path, `${JSON.stringify(updated, null, 2)}\n`);
  return { changed: true, manifest: updated };
}

export async function checkForUpdate(manifest) {
  validateManifest(manifest);
  const revision = await latestRevision(manifest);
  return { available: revision !== manifest.revision, current: manifest.revision, latest: revision };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/install-pinned-skill.mjs check-update",
    "  node scripts/install-pinned-skill.mjs update",
    "  node scripts/install-pinned-skill.mjs install --destination <path>",
  ].join("\n");
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export async function main(args = process.argv.slice(2)) {
  const [command] = args;
  const manifest = readManifest();
  if (command === "check-update") {
    const result = await checkForUpdate(manifest);
    if (result.available) {
      console.log(`Update available for ${manifest.name}: ${result.current} -> ${result.latest}`);
      console.log("Run the explicit `update` command to write a reviewable manifest change.");
    } else {
      console.log(`${manifest.name} is pinned to the latest ${manifest.branch} revision (${manifest.revision}).`);
    }
    return;
  }
  if (command === "update") {
    const result = await updateManifest(manifest);
    console.log(
      result.changed
        ? `Updated ${manifest.name} to ${result.manifest.revision}; review the manifest diff before installing.`
        : `${manifest.name} is already current at ${manifest.revision}.`,
    );
    return;
  }
  if (command === "install") {
    const destination = option(args, "--destination");
    if (!destination) fail("install requires --destination <path>.\n\n" + usage());
    const result = await installPinnedSkill(manifest, destination);
    console.log(
      result.changed
        ? `Installed ${manifest.name} ${result.revision} at ${result.destination}.`
        : `Install already matches ${manifest.name} ${result.revision} at ${result.destination}.`,
    );
    return;
  }
  fail(usage());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
