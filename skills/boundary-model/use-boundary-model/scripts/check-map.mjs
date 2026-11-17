#!/usr/bin/env node
// Check a boundary map against boundary-map.schema.json, against its own cross-references, and
// against the rules of the model that a script can test.
// Usage: node check-map.mjs <map.json>
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schema = JSON.parse(readFileSync(new URL("../assets/boundary-map.schema.json", import.meta.url), "utf8"));

// The part of JSON Schema that boundary-map.schema.json uses.
function checkShape(value, rule, path, problems) {
  if (rule.$ref) return checkShape(value, schema.$defs[rule.$ref.split("/").pop()], path, problems);
  if (rule.enum && !rule.enum.includes(value)) {
    problems.push(`${path}: must be one of ${rule.enum.join(", ")}`);
    return;
  }
  if (rule.type === "string") {
    if (typeof value !== "string") problems.push(`${path}: must be a string`);
    else if (value.length < (rule.minLength ?? 0)) problems.push(`${path}: must not be empty`);
  }
  if (rule.type === "array") {
    if (!Array.isArray(value)) problems.push(`${path}: must be an array`);
    else value.forEach((v, i) => checkShape(v, rule.items, `${path}[${i}]`, problems));
  }
  if (rule.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      problems.push(`${path}: must be an object`);
      return;
    }
    for (const key of rule.required ?? [])
      if (!(key in value)) problems.push(`${path}: lacks ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (rule.properties[key]) checkShape(v, rule.properties[key], `${path}.${key}`, problems);
      else problems.push(`${path}: has unknown field ${key}`);
    }
  }
}

function allComponents(component, parent = null) {
  const inside = (component.components ?? []).flatMap((c) => allComponents(c, component));
  return [{ component, parent }, ...inside];
}

function unique(names, what, problems) {
  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) problems.push(`${what} "${name}" appears twice`);
    seen.add(name);
  }
}

// What the schema cannot say: every name refers to something the map defines, and the rules of the
// model hold, such as a provider offering capabilities only on the resources it keeps.
function checkReferences(file, problems) {
  const owners = file.providers.flatMap((p) => allComponents(p));
  const components = new Map(owners.map(({ component }) => [component.name, component]));
  const outside = new Map(file.outsideServices.map((s) => [s.name, s]));
  const resources = new Set(file.resources.map((r) => r.name));
  const interfaces = new Set(file.interfaces.map((i) => i.name));
  const consumers = new Set(file.consumers.map((c) => c.name));
  const label = (b) => `${b.consumer} <-> ${b.provider}`;

  unique(file.resources.map((r) => r.name), "Resource", problems);
  unique(file.interfaces.map((i) => i.name), "Interface", problems);
  unique(
    [...consumers, ...components.keys(), ...outside.keys()],
    "Consumer, provider, component or outside service",
    problems,
  );
  unique(file.boundaries.map(label), "Boundary", problems);

  for (const keeper of [...components.values(), ...outside.values()])
    for (const name of keeper.resources)
      if (!resources.has(name)) problems.push(`${keeper.name} keeps "${name}", which resources does not define`);

  const usedInterfaces = new Set();
  const usedResources = new Set();
  const providerOf = new Map(); // an interface -> the provider it belongs to, and where it was first seen
  for (const b of file.boundaries) {
    if (!consumers.has(b.consumer) && !components.has(b.consumer))
      problems.push(`${label(b)}: the consumer is not a consumer or a component`);
    const provider = components.get(b.provider) ?? outside.get(b.provider);
    if (!provider) problems.push(`${label(b)}: the provider is not defined`);
    for (const name of b.interfaces) {
      usedInterfaces.add(name);
      if (!interfaces.has(name)) problems.push(`${label(b)}: interfaces does not define "${name}"`);
    }
    const capabilities = b.areas.flatMap((a) => a.capabilities);
    for (const c of capabilities) {
      for (const name of c.interfaces ?? [])
        if (!b.interfaces.includes(name)) problems.push(`${label(b)} › ${c.name}: not on interface "${name}"`);
      for (const { resource } of c.acts) {
        usedResources.add(resource);
        if (provider && !provider.resources.includes(resource))
          problems.push(`${label(b)} › ${c.name}: ${b.provider} does not keep "${resource}"`);
      }
    }
    // An interface is a channel of one provider; consumers of that provider may share it.
    for (const name of b.interfaces) {
      const before = providerOf.get(name);
      if (before && before.provider !== b.provider)
        problems.push(`"${name}" is an interface of ${before.provider} on ${before.boundary}, and of ${b.provider} on ${label(b)}`);
      providerOf.set(name, before ?? { provider: b.provider, boundary: label(b) });
    }
    const core = b.areas.filter((a) => a.type === "core");
    if (core.length !== 1) problems.push(`${label(b)}: has ${core.length} core areas, not one`);
    else if (!core[0].capabilities.length) problems.push(`${label(b)}: its core area has no capability`);
    if (!b.evidence.length) problems.push(`${label(b)}: has no evidence`);
    for (const c of capabilities)
      if (!c.acts.length) problems.push(`${label(b)} › ${c.name}: works on no resource`);
  }
  const onBoundary = new Set(file.boundaries.flatMap((b) => [b.consumer, b.provider]));
  for (const name of consumers)
    if (!onBoundary.has(name)) problems.push(`Consumer "${name}" is on no boundary`);
  for (const name of outside.keys())
    if (!onBoundary.has(name)) problems.push(`Outside service "${name}" is on no boundary`);
  for (const name of interfaces)
    if (!usedInterfaces.has(name)) problems.push(`Interface "${name}" is on no boundary`);
  for (const name of resources)
    if (!usedResources.has(name) && !file.resources.find((r) => r.name === name)?.properties?.length)
      problems.push(`Resource "${name}" has no capability and no properties`);

  for (const { place, kind } of file.places) {
    if (kind === "component" && !components.has(place)) problems.push(`Place "${place}" is no component`);
    if (kind === "interface" && !interfaces.has(place)) problems.push(`Place "${place}" is no interface`);
  }

  const areas = new Set(file.boundaries.flatMap((b) => b.areas.map((a) => `${b.consumer} › ${a.name}`)));
  for (const { component } of owners) {
    const shared = component.sharedComponents ?? [];
    for (const { consumer, area } of [...(component.serves ?? []), ...shared.flatMap((s) => s.serves)])
      if (!areas.has(`${consumer} › ${area}`)) problems.push(`${component.name} serves "${consumer} › ${area}", which is no area`);
    for (const { name } of shared)
      if (!components.has(name)) problems.push(`${component.name} shares "${name}", which no provider defines`);
  }
}

// Gives the map, or the problems that keep it from being used.
export function readMap(text) {
  const file = JSON.parse(text);
  const problems = [];
  checkShape(file, schema, "map", problems);
  if (!problems.length) checkReferences(file, problems);
  return problems.length ? { problems } : { problems, map: file };
}

// The same, from a file, with a missing file or broken JSON given as a problem that names it.
export function loadMap(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { problems: [`No map at ${path}`], missing: true };
    throw error;
  }
  try {
    return readMap(text);
  } catch (error) {
    if (error instanceof SyntaxError) return { problems: [`${path} is not valid JSON: ${error.message}`] };
    throw error;
  }
}

const inside = (c) => (c.components ?? []).flatMap((k) => [k, ...inside(k)]);
export const countsOf = (map) =>
  `${map.consumers.length} consumers, ${map.providers.length} providers, ` +
  `${map.providers.flatMap(inside).length} components, ${map.outsideServices.length} outside services, ` +
  `${map.resources.length} resources, ${map.boundaries.length} boundaries`;

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const [mapPath] = process.argv.slice(2);
  if (!mapPath) {
    console.error("Usage: node check-map.mjs <map.json>");
    process.exit(1);
  }
  const { map, problems } = loadMap(mapPath);
  if (problems.length) {
    console.error(`${mapPath} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`${mapPath} passes: ${countsOf(map)}.`);
}
