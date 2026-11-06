#!/usr/bin/env node
// Save one still image of every screen of a drawn boundary map, level by level, so a review
// can show the map without anyone opening the page. It needs Chrome, Chromium or Edge.
// Usage: node shoot-map.mjs <page.html> <folder>
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [pagePath, folder] = process.argv.slice(2);
if (!pagePath || !folder) {
  console.error("Usage: node shoot-map.mjs <page.html> <folder>");
  process.exit(1);
}

const page = readFileSync(pagePath, "utf8");
const data = page.match(/<script type="application\/json" id="map-data">(.*?)<\/script>/s);
const map = JSON.parse(data[1]);
const nodes = Object.entries(map.nodes);

// Every screen once: each level's overview, then its boundaries in focus.
function screensOf(frames, seen = new Set()) {
  const frame = frames.at(-1) ?? null;
  const here = map.boundaries.filter((b) => (frame ? b.inside === frame : !b.inside));
  const level = `level-${frames.length + 1}${frame ? `-inside-${frame.replaceAll("_", "-")}` : ""}`;
  const route = `#/${frames.join("/")}`;
  const screens = [
    { folder: level, name: "0-overview", hash: route },
    ...here.map((b, i) => ({
      folder: level,
      name: `${i + 1}-${b.id.replaceAll("_", "-")}`,
      hash: `${route}?focus=${b.id}`,
    })),
  ];
  const inner = nodes.filter(([id, n]) => {
    if (!n.hasInside || seen.has(id)) return false;
    return frame ? n.parent === frame : n.kind === "system";
  });
  for (const [id] of inner) {
    seen.add(id);
    screens.push(...screensOf([...frames, id], seen));
  }
  return screens;
}

const browsers = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
];
const browser = browsers.find((b) => b && spawnSync(b, ["--version"]).status === 0);
const screens = screensOf([]);
const url = (hash) => `${pathToFileURL(resolve(pagePath)).href}?still${hash}`;
if (!browser) {
  console.error("No Chrome, Chromium or Edge found. Set CHROME_PATH, or take these yourself:");
  for (const s of screens) console.error(`  ${s.folder}/${s.name}: ${url(s.hash)}`);
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "shoot-map-"));
const headless = (...args) =>
  spawnSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=3000",
      `--user-data-dir=${profile}`,
      ...args,
    ],
    { encoding: "utf8", maxBuffer: 2 ** 26, timeout: 60_000 },
  );

for (const s of screens) {
  mkdirSync(join(folder, s.folder), { recursive: true });
  // The page measures itself on the first pass, so the image fits it on the second.
  const dom = headless("--window-size=1400,900", "--dump-dom", url(s.hash));
  const size = dom.stdout.match(/data-still-size="(\d+)x(\d+)"/);
  if (!size) {
    console.error(`${s.folder}/${s.name}: the page gave no size`);
    process.exit(1);
  }
  const file = join(folder, s.folder, `${s.name}.png`);
  headless(
    `--window-size=${size[1]},${size[2]}`,
    "--force-device-scale-factor=2",
    `--screenshot=${resolve(file)}`,
    url(s.hash),
  );
  console.log(file);
}
rmSync(profile, { recursive: true, force: true });
