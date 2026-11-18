#!/usr/bin/env node
// Save one still image of every screen of a drawn boundary map, All providers first, then each box
// that opens, so a review can show the map without anyone opening the page. Each image is named by
// how deep its screen is and the path to it, such as 2-shop--payments.png. It needs Chrome,
// Chromium or Edge.
// Usage: node shoot-map.mjs <page.html> <folder>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [pagePath, folder] = process.argv.slice(2);
if (!pagePath || !folder) {
  console.error("Usage: node shoot-map.mjs <page.html> <folder>");
  process.exit(1);
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
// With ?still the page draws one screen without motion or panel, and writes under the drawing
// what the panel would say.
const url = (address) => `${pathToFileURL(resolve(pagePath)).href}?still${address}`;
if (!browser) {
  console.error("No Chrome, Chromium or Edge found. Set CHROME_PATH, or take the images yourself:");
  console.error(`  open ${url("#all")}, then each box's Open`);
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
const fail = (message) => {
  rmSync(profile, { recursive: true, force: true });
  console.error(message);
  process.exit(1);
};
const failure = (run) => (run.error?.message ?? run.stderr?.trim().split("\n").at(-1)) || `exit status ${run.status}`;
// The page measures itself on a first pass and writes the size its image needs.
const measure = (address) => {
  const run = headless("--window-size=1400,900", "--dump-dom", url(address));
  if (run.status !== 0) fail(`${browser} could not open ${url(address)}: ${failure(run)}`);
  const dom = run.stdout ?? "";
  return { dom, size: dom.match(/data-still-size="(\d+)x(\d+)"/) };
};

const first = measure("#all");
const screens = first.dom.match(/data-screens="([^"]*)"/)?.[1].split(" ");
if (!screens) fail("The page gave no list of screens. Was it drawn by render-map.mjs?");

mkdirSync(folder, { recursive: true });
for (const address of screens) {
  const path = address.slice(1);
  const name = `${path === "all" ? 0 : path.split("/").length}-${path.replaceAll("/", "--")}`;
  const { size } = address === "#all" ? first : measure(address);
  if (!size) fail(`${name}: the page gave no size`);
  const file = join(folder, `${name}.png`);
  rmSync(file, { force: true });
  const run = headless(`--window-size=${size[1]},${size[2]}`, "--force-device-scale-factor=2", `--screenshot=${resolve(file)}`, url(address));
  if (run.status !== 0 || !existsSync(file)) fail(`${name}: ${browser} wrote no image: ${failure(run)}`);
  console.log(file);
}
rmSync(profile, { recursive: true, force: true });
