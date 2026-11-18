#!/usr/bin/env node
// Check a boundary map, then write one self-contained HTML page that draws it.
// With --against, it marks what changed since an earlier map, such as the reviewed one.
// Usage: node render-map.mjs <map.json> [<page.html>] [--against <earlier.json>]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(realpathSync(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args.splice(at, 2)[1];
};
const againstPath = option("--against");
const [mapPath, outArg] = args;
if (!mapPath) {
  console.error("Usage: node render-map.mjs <map.json> [<page.html>] [--against <earlier.json>]");
  process.exit(1);
}
const outPath = outArg ?? `${mapPath.replace(/\.json$/, "")}.html`;

// The map's format and its checks belong to the use-boundary-model skill, installed beside this one.
const checker = join(here, "../../use-boundary-model/scripts/check-map.mjs");
let check;
try {
  check = await import(pathToFileURL(checker).href);
} catch {
  console.error(`render-map needs the use-boundary-model skill installed beside this one; no checker at ${checker}`);
  process.exit(1);
}

const { map, problems, missing } = check.loadMap(mapPath);
if (missing) {
  console.error(`No map at ${mapPath}. To make one from a repository, use the extract-boundaries skill.`);
  process.exit(1);
}
// The page gives every box an address made from its name, as slugOf in page.js does; two names
// must not share one.
const addressOf = (s) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
if (map) {
  const inside = (c) => [c, ...(c.components ?? []).flatMap(inside)];
  const names = [...map.consumers, ...map.providers.flatMap(inside), ...map.outsideServices].map((n) => n.name);
  const seen = new Map();
  for (const name of names) {
    const address = addressOf(name);
    if (!address) problems.push(`"${name}" has no letter or digit, so the page cannot give it an address`);
    else if (seen.has(address)) problems.push(`"${seen.get(address)}" and "${name}" get the same address, #${address}: rename one`);
    else seen.set(address, name);
  }
}
if (problems.length) {
  console.error(`${mapPath} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// How many commits the main branch has gained since the map's revision, when the repository the
// script runs in, or the one holding the map, has both.
function behind(revision) {
  for (const dir of [process.cwd(), dirname(resolve(mapPath))]) {
    const git = (...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
    if (git("cat-file", "-e", `${revision}^{commit}`).status !== 0) continue;
    const main = [git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").stdout?.trim(), "main", "master"].find(
      (b) => b && git("rev-parse", "--verify", "--quiet", `${b}^{commit}`).status === 0,
    );
    const count = main ? Number(git("rev-list", "--count", `${revision}..${main}`).stdout) : NaN;
    if (Number.isInteger(count)) return { count, main };
  }
  return null;
}
const revision = map.system.revision;
const lag = behind(revision);
const lagText = !lag ? "" : lag.count ? ` · ${lag.count} commits behind ${lag.main}` : ` · up to date with ${lag.main}`;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const title = escapeHtml(`${map.system.name} boundary map`);
const css = readFileSync(join(here, "page.css"), "utf8");
const js = readFileSync(join(here, "page.js"), "utf8");
const data = JSON.stringify(map).replace(/</g, "\\u003c");
let against = "";
if (againstPath) {
  const earlier = check.loadMap(againstPath);
  if (earlier.problems.length) {
    console.error(`${againstPath} has ${earlier.problems.length} problem(s):\n  ${earlier.problems.join("\n  ")}`);
    process.exit(1);
  }
  const base = JSON.stringify(earlier.map).replace(/</g, "\\u003c");
  against = `<style>\n${readFileSync(join(here, "compare.css"), "utf8")}</style>\n<script type="application/json" id="base-data">${base}</script>\n<script>\n${readFileSync(join(here, "compare.js"), "utf8")}</script>\n`;
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=Public+Sans:wght@400;600&display=swap">
<style>
${css}</style>
</head>
<body>
<header class="top">
<h1>${title}</h1><span class="rev">${escapeHtml(revision.slice(0, 7) + lagText)}</span>
<p>Click anything to light what it connects to. Open, at the foot of a box, goes inside.</p>
</header>
<nav id="nav" aria-label="Where you are"></nav>
<main><div id="scroll"></div><aside id="panel" hidden></aside></main>
<script type="application/json" id="map-data">${data}</script>
<script>
${js}</script>
${against}</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, page);

console.log(`Wrote ${outPath}: ${check.countsOf(map)}.`);
if (lag?.count)
  console.log(`The map describes ${revision.slice(0, 7)}, ${lag.count} commits behind ${lag.main}; update-boundaries brings it up to date.`);
