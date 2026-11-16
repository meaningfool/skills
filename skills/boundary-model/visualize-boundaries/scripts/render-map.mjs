#!/usr/bin/env node
// Check a boundary map, then write one self-contained HTML page that draws it.
// Usage: node render-map.mjs <map.json> [<page.html>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMap } from "./read-map.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [mapPath, outArg] = process.argv.slice(2);
if (!mapPath) {
  console.error("Usage: node render-map.mjs <map.json> [<page.html>]");
  process.exit(1);
}
const outPath = outArg ?? `${mapPath.replace(/\.json$/, "")}.html`;

const { map, problems } = readMap(readFileSync(mapPath, "utf8"));
if (problems.length) {
  console.error(`${mapPath} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const title = escapeHtml(`${map.system.name} boundary map`);
const css = readFileSync(join(here, "page.css"), "utf8");
const js = readFileSync(join(here, "page.js"), "utf8");
const data = JSON.stringify(map).replace(/</g, "\\u003c");

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
<h1>${title}</h1><span class="rev">${escapeHtml(map.system.revision.slice(0, 7))}</span>
<p>Click anything to light what it connects to. Open, at the foot of a box, goes inside.</p>
</header>
<nav id="nav" aria-label="Where you are"></nav>
<main><div id="scroll"></div><aside id="panel" hidden></aside></main>
<script type="application/json" id="map-data">${data}</script>
<script>
${js}</script>
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, page);

const inside = (c) => (c.components ?? []).flatMap((k) => [k, ...inside(k)]);
console.log(
  `Wrote ${outPath}: ${map.consumers.length} consumers, ${map.providers.length} providers, ` +
    `${map.providers.flatMap(inside).length} components, ${map.outsideServices.length} outside services, ` +
    `${map.resources.length} resources, ${map.boundaries.length} boundaries.`,
);
