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
const title = escapeHtml(`${map.system || "System"} boundary map`);
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
<header class="bar"><span class="map-name">${title}</span>${map.revision ? `<span class="revision">${map.revision}</span>` : ""}</header>
<div class="layout">
<section class="stage"><nav class="heading"></nav><div class="scroll"><div class="canvas"></div></div></section>
<aside class="panel"></aside>
</div>
<script type="application/json" id="map-data">${data}</script>
<script>
${js}</script>
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, page);

const nodes = Object.values(map.nodes);
const count = (kind) => nodes.filter((n) => n.kind === kind).length;
console.log(
  `Wrote ${outPath}: ${count("consumer")} consumers, ${count("system")} providers, ` +
    `${count("component")} components, ${count("outside")} outside services, ` +
    `${Object.keys(map.resources).length} resources, ${map.boundaries.length} boundaries.`,
);
