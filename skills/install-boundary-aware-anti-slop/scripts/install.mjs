#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  cpSync,
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provenanceFile = ".boundary-aware.json";
const sourceName = "meaningfool/skills/install-boundary-aware-anti-slop";
const installerVersion = 2;

const components = {
  plugin: {
    defaultDestination: "tools/oxlint/boundary-aware",
    files: [
      ["index.mjs", "references/oxlint/index.mjs"],
      ["shared.mjs", "references/oxlint/shared.mjs"],
      [
        "rules/no-raw-boundary-data-escape.mjs",
        "references/oxlint/rules/no-raw-boundary-data-escape.mjs",
      ],
      [
        "rules/require-declared-boundary.mjs",
        "references/oxlint/rules/require-declared-boundary.mjs",
      ],
      [
        "rules/require-constraining-schema.mjs",
        "references/oxlint/rules/require-constraining-schema.mjs",
      ],
      [
        "rules/require-bounded-tolerant-boundary.mjs",
        "references/oxlint/rules/require-bounded-tolerant-boundary.mjs",
      ],
    ],
  },
  runtime: {
    defaultDestination: "tools/boundary-contracts",
    files: [
      ["boundary-contracts.mjs", "references/boundary-contracts.mjs"],
      ["boundary-contracts.d.mts", "references/boundary-contracts.d.mts"],
    ],
  },
};

function fail(message) {
  throw new Error(message);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assertSafeRelativePath(path, label) {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..") ||
    path === "." ||
    path.endsWith("/")
  ) {
    fail(`${label} must be a safe relative path: ${path}`);
  }
}

function readComponentFiles(component) {
  return component.files.map(([path, source]) => {
    const content = readFileSync(join(skillRoot, source));
    return { path, sha256: sha256(content), content };
  });
}

function metadataFor(componentName, files) {
  return {
    source: sourceName,
    version: installerVersion,
    component: componentName,
    files: files.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
  };
}

function readMetadata(destination, componentName) {
  const path = join(destination, provenanceFile);

  if (!existsSync(path)) {
    fail(
      `Refusing to overwrite an unmanaged boundary-aware installation at ${destination}; ` +
        `remove it or choose another destination.`,
    );
  }

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`Refusing to use invalid boundary-aware provenance at ${path}.`);
  }

  if (
    metadata?.source !== sourceName ||
    metadata?.component !== componentName ||
    !Array.isArray(metadata.files) ||
    metadata.files.length === 0
  ) {
    fail(`Refusing to overwrite a different managed installation at ${destination}.`);
  }

  return metadata;
}

function assertNoSymlinks(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`Refusing to inspect a symlink in the managed installation: ${path}`);
    }
    if (entry.isDirectory()) {
      assertNoSymlinks(path);
    }
  }
}

function assertLocalEditsAreReviewed(destination, metadata) {
  const recorded = new Map(
    metadata.files
      .map((file) => {
        if (typeof file?.path !== "string") {
          fail(`Refusing to use invalid boundary-aware file metadata at ${destination}.`);
        }
        assertSafeRelativePath(file.path, "Boundary-aware provenance file path");
        if (!/^[0-9a-f]{64}$/.test(file.sha256)) {
          fail(`Refusing to use invalid boundary-aware file digest at ${destination}.`);
        }
        return [file.path, file.sha256];
      }),
  );

  if (recorded.size !== metadata.files.length) {
    fail(`Refusing to use incomplete boundary-aware provenance at ${join(destination, provenanceFile)}.`);
  }

  for (const [path, digest] of recorded) {
    const target = join(destination, path);
    if (!existsSync(target)) {
      fail(`Managed boundary-aware file is missing: ${target}.`);
    }
    if (!lstatSync(target).isFile() || sha256(readFileSync(target)) !== digest) {
      fail(
        `Managed boundary-aware file changed locally: ${target}; ` +
          "review it before running the installer again.",
      );
    }
  }
}

function prepareComponent(componentName, destination) {
  const component = components[componentName];
  if (!component) fail(`Unknown boundary-aware component: ${componentName}`);

  const resolvedDestination = resolve(destination);
  const files = readComponentFiles(component);
  const metadata = metadataFor(componentName, files);

  let previousMetadata = null;
  if (existsSync(resolvedDestination)) {
    if (!lstatSync(resolvedDestination).isDirectory()) {
      fail(`Boundary-aware destination is not a directory: ${resolvedDestination}`);
    }
    assertNoSymlinks(resolvedDestination);
    previousMetadata = readMetadata(resolvedDestination, componentName);
    assertLocalEditsAreReviewed(resolvedDestination, previousMetadata);
  }

  return {
    componentName,
    destination: resolvedDestination,
    files,
    metadata,
    previousMetadata,
  };
}

function filesMatch(component) {
  if (!existsSync(component.destination)) return false;

  const metadataPath = join(component.destination, provenanceFile);
  if (!existsSync(metadataPath)) return false;
  if (JSON.stringify(JSON.parse(readFileSync(metadataPath, "utf8"))) !== JSON.stringify(component.metadata)) {
    return false;
  }

  return component.files.every(({ path, content }) => {
    const target = join(component.destination, path);
    return existsSync(target) && lstatSync(target).isFile() && readFileSync(target).equals(content);
  });
}

function replaceManagedDirectory(component) {
  const parent = dirname(component.destination);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".boundary-aware-install-"));
  let moved = false;

  try {
    if (existsSync(component.destination)) {
      cpSync(component.destination, staging, { recursive: true, force: true });
    }

    const installedPaths = new Set(component.files.map(({ path }) => path));
    for (const previous of component.previousMetadata?.files ?? []) {
      if (!installedPaths.has(previous.path)) {
        rmSync(join(staging, previous.path), { force: true });
      }
    }

    for (const { path, content } of component.files) {
      const target = join(staging, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, { mode: 0o644 });
    }

    writeFileSync(
      join(staging, provenanceFile),
      `${JSON.stringify(component.metadata, null, 2)}\n`,
      { mode: 0o644 },
    );

    if (existsSync(component.destination)) {
      const backup = `${component.destination}.previous-${process.pid}-${Date.now()}`;
      renameSync(component.destination, backup);
      try {
        renameSync(staging, component.destination);
        moved = true;
        rmSync(backup, { recursive: true, force: true });
      } catch (error) {
        renameSync(backup, component.destination);
        throw error;
      }
    } else {
      renameSync(staging, component.destination);
      moved = true;
    }
  } finally {
    if (!moved) rmSync(staging, { recursive: true, force: true });
  }
}

export function installBoundaryAssets({
  cwd = process.cwd(),
  pluginDestination = components.plugin.defaultDestination,
  runtimeDestination = components.runtime.defaultDestination,
} = {}) {
  const root = resolve(cwd);
  const resolvedPluginDestination = resolve(root, pluginDestination);
  const resolvedRuntimeDestination =
    runtimeDestination === null ? null : resolve(root, runtimeDestination);
  if (resolvedRuntimeDestination === resolvedPluginDestination) {
    fail("Boundary-aware plugin and runtime destinations must be different paths.");
  }

  const prepared = [prepareComponent("plugin", resolvedPluginDestination)];
  if (runtimeDestination !== null) {
    prepared.push(prepareComponent("runtime", resolvedRuntimeDestination));
  }
  const results = prepared.map((component) => ({
    component: component.componentName,
    destination: component.destination,
    changed: !filesMatch(component),
  }));

  for (const [index, component] of prepared.entries()) {
    if (results[index].changed) replaceManagedDirectory(component);
  }

  return { changed: results.some((result) => result.changed), components: results };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/install.mjs [--destination <plugin-path>] [--runtime-destination <runtime-path>] [--skip-runtime]",
    "",
    "Paths are resolved relative to the target repository's current directory.",
  ].join("\n");
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

export function parseArguments(args) {
  if (args.includes("--help")) return { help: true };
  const destination = option(args, "--destination", components.plugin.defaultDestination);
  const runtimeDestination = option(
    args,
    "--runtime-destination",
    components.runtime.defaultDestination,
  );
  if (!destination || (!runtimeDestination && !args.includes("--skip-runtime"))) {
    fail("Installation destinations must be non-empty paths.");
  }
  return {
    destination,
    runtimeDestination: args.includes("--skip-runtime") ? null : runtimeDestination,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      const result = installBoundaryAssets({
        pluginDestination: options.destination,
        runtimeDestination: options.runtimeDestination,
      });
      for (const component of result.components) {
        console.log(
          `${component.changed ? "Installed/updated" : "Already current"} ${component.component} at ${component.destination}`,
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
