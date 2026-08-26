import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildAssessmentReport,
  normalizeRuleId,
  parseOxlintOutput,
  renderReadableReport,
  writeAssessmentReports,
} from "./assessment.mjs";

const root = mkdtempSync(join(tmpdir(), "boundary-aware-assessment-test-"));

test.after(() => rmSync(root, { recursive: true, force: true }));

test("normalizes Oxlint plugin rule codes without changing severities", () => {
  assert.equal(normalizeRuleId("anti-slop(no-shape-in-symbol-names)"), "anti-slop/no-shape-in-symbol-names");
  assert.equal(normalizeRuleId("boundary-aware(require-declared-boundary)"), "boundary-aware/require-declared-boundary");

  const parsed = parseOxlintOutput({
    root,
    stdout: JSON.stringify({
      diagnostics: [
        {
          code: "eslint(no-unused-vars)",
          severity: "warning",
          filename: "src/toolchain.ts",
          message: "toolchain diagnostic",
        },
        {
          code: "anti-slop(no-shape-in-symbol-names)",
          severity: "error",
          filename: "src/bad.ts",
          message: "rename the symbol",
          labels: [{ span: { line: 2, column: 7 } }],
        },
      ],
    }),
  });
  assert.deepEqual(parsed.findings, [
    {
      code: "anti-slop/no-shape-in-symbol-names",
      severity: "error",
      file: "src/bad.ts",
      message: "rename the symbol",
      location: { line: 2, column: 7 },
    },
  ]);
  assert.deepEqual(parsed.diagnostics, [
    {
      code: "eslint/no-unused-vars",
      severity: "warning",
      file: "src/toolchain.ts",
      message: "toolchain diagnostic",
    },
  ]);
});

test("produces stable totals and separately classifies introduced toolchain diagnostics", () => {
  const report = buildAssessmentReport({
    config: ".oxlint.assessment.json",
    findings: [
      { code: "boundary-aware/no-raw-boundary-data-escape", severity: "error", file: "src/b.ts", message: "boundary" },
      { code: "anti-slop/no-shape-in-symbol-names", severity: "error", file: "src/a.ts", message: "generic" },
    ],
    diagnostics: [
      { code: "eslint(no-unused-vars)", severity: "warning", file: "src/a.ts", message: "react diagnostic" },
    ],
    toolchainBefore: {
      phase: "before",
      commands: [{ name: "lint", status: 0, diagnostics: [] }],
    },
    toolchainAfter: {
      phase: "after",
      commands: [{
        name: "lint",
        status: 1,
        diagnostics: [{ code: "react/no-direct-mutation-state", severity: "error", file: "src/a.ts", message: "diagnostic" }],
      }],
    },
  });

  assert.deepEqual(report.findings.byRule, {
    "anti-slop/no-shape-in-symbol-names": 1,
    "boundary-aware/no-raw-boundary-data-escape": 1,
  });
  assert.equal(report.findings.total, 2);
  assert.equal(report.toolchainDiagnostics.oxlint[0].code, "eslint/no-unused-vars");
  assert.deepEqual(report.toolchainDiagnostics.introduced, [
    {
      code: "react/no-direct-mutation-state",
      severity: "error",
      file: "src/a.ts",
      message: "diagnostic",
      command: "lint",
      classification: "introduced-by-dependency-or-oxlint-change",
    },
  ]);

  const first = writeAssessmentReports({ root, report });
  const machineBefore = readFileSync(first.machinePath, "utf8");
  const readableBefore = readFileSync(first.readablePath, "utf8");
  const second = writeAssessmentReports({ root, report });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(readFileSync(first.machinePath, "utf8"), machineBefore);
  assert.equal(readFileSync(first.readablePath, "utf8"), readableBefore);
  assert.match(renderReadableReport(report), /Findings: 2/);
  assert.equal(existsSync(join(root, "reports/anti-slop/assessment.json")), true);
});
