#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const assessmentConfigFile = ".oxlint.assessment.json";
export const assessmentReportDirectory = "reports/anti-slop";
export const assessmentReportFile = "assessment.json";
export const readableAssessmentReportFile = "assessment.txt";

const policyPrefixes = ["anti-slop/", "boundary-aware/"];
const toolchainScripts = ["lint", "typecheck", "format:check"];

export function normalizeRuleId(code) {
  if (typeof code !== "string" || code.length === 0) return null;
  const match = /^(.*)\(([^()]+)\)$/u.exec(code);
  if (match) return `${match[1]}/${match[2]}`;
  return code;
}

function isAssessmentRule(rule) {
  return policyPrefixes.some((prefix) => rule?.startsWith(prefix));
}

function normalizePath(filename, root) {
  if (typeof filename !== "string" || filename.length === 0) return null;
  const absolute = isAbsolute(filename) ? filename : resolve(root, filename);
  const relativePath = relative(root, absolute).replaceAll("\\", "/");
  return relativePath.length === 0 ? "." : relativePath;
}

function normalizeLocation(diagnostic) {
  const span = diagnostic?.labels?.[0]?.span;
  if (!span || typeof span.line !== "number" || typeof span.column !== "number") {
    return undefined;
  }
  return { line: span.line, column: span.column };
}

function stableDiagnostic(diagnostic, root) {
  const rule = normalizeRuleId(diagnostic?.code ?? diagnostic?.rule_id);
  const result = {
    code: rule,
    severity: typeof diagnostic?.severity === "string" ? diagnostic.severity : "error",
    file: normalizePath(diagnostic?.filename ?? diagnostic?.file, root),
    message: typeof diagnostic?.message === "string" ? diagnostic.message : String(diagnostic?.message ?? ""),
  };
  const location = normalizeLocation(diagnostic);
  if (location) result.location = location;
  return result;
}

function diagnosticSortKey(diagnostic) {
  return [
    diagnostic.file ?? "",
    diagnostic.location?.line ?? 0,
    diagnostic.location?.column ?? 0,
    diagnostic.code ?? "",
    diagnostic.severity ?? "",
    diagnostic.message ?? "",
  ];
}

function compareDiagnostics(left, right) {
  const leftKey = diagnosticSortKey(left);
  const rightKey = diagnosticSortKey(right);
  for (let index = 0; index < leftKey.length; index += 1) {
    const leftValue = leftKey[index];
    const rightValue = rightKey[index];
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort(compareDiagnostics);
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

export function parseOxlintOutput({ stdout = "", stderr = "", root = process.cwd() } = {}) {
  const parsed = parseJsonOutput(stdout.trim());
  if (!parsed) {
    const text = [stdout, stderr]
      .flatMap((value) => value.split(/\r?\n/u))
      .map((value) => value.replace(/\x1b\[[0-9;]*m/gu, "").trim())
      .filter(Boolean)
      .join(" ");
    return {
      findings: [],
      diagnostics: [
        {
          code: "toolchain/oxlint-output",
          severity: "error",
          file: null,
          message: text || "Oxlint did not return JSON output.",
        },
      ],
    };
  }

  const diagnostics = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.diagnostics)
      ? parsed.diagnostics
      : [];
  const normalized = diagnostics.map((diagnostic) => stableDiagnostic(diagnostic, root));
  return {
    findings: sortDiagnostics(normalized.filter((diagnostic) => isAssessmentRule(diagnostic.code))),
    diagnostics: sortDiagnostics(normalized.filter((diagnostic) => !isAssessmentRule(diagnostic.code))),
  };
}

function countsBy(values, key) {
  const counts = new Map();
  for (const value of values) {
    const name = value[key] ?? "unknown";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeToolchainDiagnostic(diagnostic) {
  if (typeof diagnostic === "string") {
    return { code: "toolchain/command", severity: "error", file: null, message: diagnostic };
  }
  return {
    code: normalizeRuleId(diagnostic?.code ?? "toolchain/command"),
    severity: diagnostic?.severity ?? "error",
    file: diagnostic?.file ?? null,
    message: diagnostic?.message ?? "",
  };
}

function normalizeToolchainSnapshot(snapshot) {
  if (!snapshot) return null;
  const commands = Array.isArray(snapshot.commands) ? snapshot.commands : [];
  return {
    phase: snapshot.phase ?? "unknown",
    commands: [...commands]
      .map((command) => ({
        name: command.name,
        state: command.state ?? (command.status === null ? "not-configured" : "ran"),
        status: typeof command.status === "number" ? command.status : null,
        diagnostics: (command.diagnostics ?? []).map(normalizeToolchainDiagnostic).sort(compareDiagnostics),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function toolchainDiagnosticKey(commandName, diagnostic) {
  return JSON.stringify([commandName, diagnostic.code, diagnostic.severity, diagnostic.file, diagnostic.message]);
}

function introducedToolchainDiagnostics(before, after) {
  if (!after) return [];
  const beforeKeys = new Set(
    (before?.commands ?? []).flatMap((command) =>
      command.diagnostics.map((diagnostic) => toolchainDiagnosticKey(command.name, diagnostic)),
    ),
  );
  return (after.commands ?? []).flatMap((command) =>
    command.diagnostics
      .filter((diagnostic) => !beforeKeys.has(toolchainDiagnosticKey(command.name, diagnostic)))
      .map((diagnostic) => ({
        ...diagnostic,
        command: command.name,
        classification: "introduced-by-dependency-or-oxlint-change",
      })),
  ).sort((left, right) =>
    `${left.command}:${left.file ?? ""}:${left.code}:${left.message}`.localeCompare(
      `${right.command}:${right.file ?? ""}:${right.code}:${right.message}`,
    ),
  );
}

export function buildAssessmentReport({
  config = assessmentConfigFile,
  findings = [],
  diagnostics = [],
  toolchainBefore = null,
  toolchainAfter = null,
} = {}) {
  const normalizedFindings = sortDiagnostics(findings.map((finding) => ({
    ...finding,
    code: normalizeRuleId(finding.code ?? finding.rule),
  })));
  const before = normalizeToolchainSnapshot(toolchainBefore);
  const after = normalizeToolchainSnapshot(toolchainAfter);
  return {
    schemaVersion: 1,
    mode: "assessment",
    config,
    findings: {
      total: normalizedFindings.length,
      bySeverity: countsBy(normalizedFindings, "severity"),
      byRule: countsBy(normalizedFindings, "code"),
      byFile: countsBy(normalizedFindings, "file"),
      items: normalizedFindings,
    },
    toolchainDiagnostics: {
      oxlint: sortDiagnostics(diagnostics.map((diagnostic) => normalizeToolchainDiagnostic(diagnostic))),
      before,
      after,
      introduced: introducedToolchainDiagnostics(before, after),
    },
  };
}

export function renderReadableReport(report) {
  const lines = [
    "Anti-slop assessment",
    "",
    `Findings: ${report.findings.total}`,
  ];
  for (const [rule, count] of Object.entries(report.findings.byRule)) {
    lines.push(`- ${rule}: ${count}`);
  }
  lines.push(
    "",
    `Toolchain diagnostics from Oxlint: ${report.toolchainDiagnostics.oxlint.length}`,
    `Toolchain diagnostics introduced by dependency or Oxlint changes: ${report.toolchainDiagnostics.introduced.length}`,
  );
  return `${lines.join("\n")}\n`;
}

function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeFileSync(path, content);
  return true;
}

export function writeAssessmentReports({ root = process.cwd(), report, directory = assessmentReportDirectory } = {}) {
  const reportRoot = resolve(root, directory);
  mkdirSync(reportRoot, { recursive: true });
  const machinePath = join(reportRoot, assessmentReportFile);
  const readablePath = join(reportRoot, readableAssessmentReportFile);
  const machineChanged = writeIfChanged(machinePath, `${JSON.stringify(report, null, 2)}\n`);
  const readableChanged = writeIfChanged(readablePath, renderReadableReport(report));
  return {
    changed: machineChanged || readableChanged,
    machinePath,
    readablePath,
  };
}

function packageManager(root) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const declared = manifest.packageManager?.split("@")[0];
  const lockfiles = [
    ["npm", "package-lock.json"],
    ["pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lock"],
  ];
  const match = lockfiles.find(([name, lockfile]) => name === declared || existsSync(join(root, lockfile)));
  if (!match) throw new Error(`Could not infer a supported package manager in ${root}.`);
  return match[0];
}

function managerCommand(manager, script) {
  if (manager === "npm") return ["npm", ["run", "--silent", script]];
  if (manager === "pnpm") return ["pnpm", ["run", script]];
  if (manager === "yarn") return ["yarn", [script]];
  return ["bun", ["run", script]];
}

export function captureToolchainSnapshot({ root = process.cwd(), phase } = {}) {
  if (phase !== "before" && phase !== "after") {
    throw new Error("Toolchain snapshot phase must be 'before' or 'after'.");
  }
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const manager = packageManager(root);
  const commands = toolchainScripts.map((name) => {
    if (!manifest.scripts?.[name]) {
      return { name, state: "not-configured", status: null, diagnostics: [] };
    }
    const [command, args] = managerCommand(manager, name);
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
    });
    const diagnostics = [result.stdout ?? "", result.stderr ?? ""]
      .flatMap((value) => value.split(/\r?\n/u))
      .map((value) => value.replace(/\x1b\[[0-9;]*m/gu, "").trim())
      .filter(Boolean)
      .map((message) => ({ code: "toolchain/command", severity: "error", file: null, message }))
      .sort(compareDiagnostics);
    return { name, state: "ran", status: result.status ?? 1, diagnostics };
  });
  return { schemaVersion: 1, phase, manager, commands };
}

function readOptionalJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

export function runAssessment({ root = process.cwd(), args = [] } = {}) {
  const config = option(args, "--config", assessmentConfigFile);
  const reportDirectory = option(args, "--report-dir", assessmentReportDirectory);
  const oxlint = process.env.OXLINT_BIN ?? "oxlint";
  const result = spawnSync(oxlint, ["--config", config, "--format", "json", "."], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  const parsed = parseOxlintOutput({ stdout: result.stdout ?? "", stderr: result.stderr ?? "", root });
  const reportRoot = resolve(root, reportDirectory);
  const report = buildAssessmentReport({
    config,
    findings: parsed.findings,
    diagnostics: parsed.diagnostics,
    toolchainBefore: readOptionalJson(join(reportRoot, "toolchain-before.json")),
    toolchainAfter: readOptionalJson(join(reportRoot, "toolchain-after.json")),
  });
  const files = writeAssessmentReports({ root, report, directory: reportDirectory });
  process.stdout.write(renderReadableReport(report));
  return { ...report, ...files, status: result.status ?? 1 };
}

function main(args) {
  const captureIndex = args.indexOf("--capture");
  if (captureIndex !== -1) {
    const phase = args[captureIndex + 1];
    const root = process.cwd();
    const directory = option(args, "--report-dir", assessmentReportDirectory);
    const snapshot = captureToolchainSnapshot({ root, phase });
    const path = join(resolve(root, directory), `toolchain-${phase}.json`);
    mkdirSync(resolve(root, directory), { recursive: true });
    writeIfChanged(path, `${JSON.stringify(snapshot, null, 2)}\n`);
    process.stdout.write(`Captured ${phase} toolchain results.\n`);
    return 0;
  }
  const result = runAssessment({ root: process.cwd(), args });
  return result.status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
