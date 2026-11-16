#!/usr/bin/env node
// List what changed in a repository since a boundary map's revision, as Markdown on stdout:
// the commits, the boundaries each changed file can touch, and what the map no longer covers.
// Run it from the repository root. The target defaults to the head of the main branch.
// Usage: node find-delta.mjs <map.json> [<target-revision>]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [mapPath, targetArg] = process.argv.slice(2);
if (!mapPath) {
  console.error("Usage: node find-delta.mjs <map.json> [<target-revision>]");
  process.exit(1);
}
const stop = (message) => {
  console.error(message);
  process.exit(1);
};
let map;
try {
  map = JSON.parse(readFileSync(mapPath, "utf8"));
} catch (error) {
  stop(error.code === "ENOENT" ? `No map at ${mapPath}` : `${mapPath} cannot be read: ${error.message}`);
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 2 ** 28 }).trim();
const isCommit = (rev) => spawnSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).status === 0;
const lines = (text) => (text ? text.split("\n") : []);

const base = map.system.revision;
if (!isCommit(base))
  stop(
    `The map's revision, "${base}", is not a commit of this repository, so there is nothing to compare it with. ` +
      "Run this from the repository the map describes, or extract the map again.",
  );
const originHead = spawnSync("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { encoding: "utf8" }).stdout?.trim();
const target = targetArg ?? [originHead, "main", "master", "HEAD"].find((b) => b && isCommit(b));
if (!isCommit(target)) stop(`"${target}" is not a commit of this repository`);

function matcher(glob) {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${source}$`);
}
// A pattern across folders, such as tests, comes first. Otherwise the longer a path's fixed
// start, the more specific it is, and a file pattern outranks a folder.
const weightOf = (glob) =>
  glob.slice(0, -3).includes("**") ? Infinity : glob.split("*")[0].length + (glob.endsWith("/**") ? 0 : 0.5);
const paths = map.places.flatMap((place) =>
  place.paths.map((glob) => ({ place, test: matcher(glob), weight: weightOf(glob) })),
);
const placeOf = (file) =>
  paths.filter((p) => p.test.test(file)).sort((a, b) => b.weight - a.weight)[0]?.place;

// A component's change touches its own boundaries directly. It can also show further out: on
// the boundaries of the components that contain it, and on the areas they serve.
const containers = new Map();
const served = new Map();
const walk = (component, chain) => {
  containers.set(component.name, chain);
  served.set(component.name, [...(served.get(component.name) ?? []), ...(component.serves ?? [])]);
  for (const shared of component.sharedComponents ?? [])
    served.set(shared.name, [...(served.get(shared.name) ?? []), ...shared.serves]);
  for (const inner of component.components ?? []) walk(inner, [...chain, component.name]);
};
for (const provider of map.providers) walk(provider, []);
const label = (b) => `${b.consumer} <-> ${b.provider}`;
const hasArea = (b, { consumer, area }) => b.consumer === consumer && b.areas.some((a) => a.name === area);
const onBoundary = (b, name) => b.consumer === name || b.provider === name;
function boundariesOf({ place, kind }) {
  if (kind === "interface")
    return { direct: map.boundaries.filter((b) => b.interfaces.includes(place)), further: [] };
  if (kind !== "component") return { direct: [], further: [] };
  const direct = map.boundaries.filter((b) => onBoundary(b, place));
  const outer = [place, ...(containers.get(place) ?? []).slice(1)];
  const further = map.boundaries.filter(
    (b) =>
      !direct.includes(b) &&
      outer.some((name) => onBoundary(b, name) || (served.get(name) ?? []).some((s) => hasArea(b, s))),
  );
  return { direct, further };
}

// With -z, git gives paths as they are, accents included: a status, then one path, or two for a
// rename or a copy.
const fields = git("diff", "--name-status", "-z", "--find-renames", base, target).split("\0").filter(Boolean);
const changes = [];
while (fields.length) {
  const status = fields.shift();
  const from = fields.shift();
  const file = /^[RC]/.test(status) ? fields.shift() : from;
  changes.push({ status: status[0], file, from });
}
// A moved file counts in the place it left and in the place it went to.
const groups = new Map();
for (const change of changes) {
  const places = [placeOf(change.file), ...(change.from === change.file ? [] : [placeOf(change.from)])];
  for (const place of [...new Set(places)]) {
    const key = place?.place ?? "";
    if (!groups.has(key)) groups.set(key, { place, changes: [] });
    groups.get(key).changes.push(change);
  }
}
const shown = (c) => (c.from === c.file ? `${c.status} \`${c.file}\`` : `${c.status} \`${c.from}\` → \`${c.file}\``);

const removed = new Set(changes.filter((c) => c.status === "D" || c.status === "R").map((c) => c.from));
const staleEvidence = map.boundaries.flatMap((b) =>
  b.evidence.filter((e) => removed.has(e.path)).map((e) => `${label(b)}: \`${e.path}\``),
);
const touched = [...groups.values()].filter((g) => g.place && ["component", "interface"].includes(g.place.kind));
const direct = new Map();
const further = new Map();
const note = (found, b, why) => {
  if (!found.has(label(b))) found.set(label(b), new Set());
  found.get(label(b)).add(why);
};
for (const { place, changes: files } of touched) {
  const found = boundariesOf(place);
  const why = `${place.place} (${files.length})`;
  for (const b of found.direct) note(direct, b, why);
  for (const b of found.further) note(further, b, why);
}
for (const name of direct.keys()) further.delete(name);
const other = (kinds) => [...groups.values()].filter((g) => g.place && kinds.includes(g.place.kind));

const out = [];
const section = (title, items) => out.push(`## ${title}`, "", ...(items.length ? items : ["None."]), "");
out.push(`# Changes since the boundary map`, "", `- From: ${base.slice(0, 7)}`, `- To: ${git("rev-parse", "--short", target)}`, "");
section("Commits", lines(git("log", "--no-merges", "--format=- %h %s", `${base}..${target}`)));
const listed = (found) => [...found].map(([name, why]) => `- ${name}: ${[...why].join(", ")}`);
section("Boundaries touched directly", listed(direct));
section("Boundaries that a change inside could reach", listed(further));
section("Boundaries with nothing changed", map.boundaries.filter((b) => !direct.has(label(b)) && !further.has(label(b))).map((b) => `- ${label(b)}`));
section("Changed files by element", touched.flatMap(({ place, changes: files }) => [
  `- ${place.place} (${place.kind}):`,
  ...files.map((c) => `  - ${shown(c)}`),
]));
section("Files with no place", (groups.get("")?.changes ?? []).map((c) => `- ${shown(c)}`));
section("Evidence that moved or went away", staleEvidence.map((e) => `- ${e}`));
section("Cleanup candidates and exclusions touched", other(["cleanup", "excluded"]).flatMap(({ place, changes: files }) =>
  files.map((c) => `- ${place.place}: ${shown(c)}`),
));
section("Libraries touched", other(["library"]).map(({ place, changes: files }) => `- ${place.place}: ${files.map((c) => `\`${c.file}\``).join(", ")}`));
section("Left out as tooling", other(["tooling"]).map(({ place, changes: files }) => `- ${place.place}: ${files.length} files`));
console.log(out.join("\n"));
