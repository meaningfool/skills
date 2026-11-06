// Check a boundary map against boundary-map.schema.json and against its own cross-references,
// then turn it into the data the page draws.
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../boundary-map.schema.json", import.meta.url), "utf8"));

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

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

// What the schema cannot say: every name refers to something the map defines.
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
  const offered = new Map();
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
    for (const name of b.interfaces) {
      const names = capabilities.filter((c) => !c.interfaces || c.interfaces.includes(name)).map((c) => c.name).sort();
      const before = offered.get(name);
      if (before && before.names.join() !== names.join())
        problems.push(`"${name}" offers different capabilities on ${before.boundary} and ${label(b)}`);
      offered.set(name, before ?? { names, boundary: label(b) });
    }
  }
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

// The data page.js draws, keyed by ids made from the names.
function toPage(file) {
  const nodes = {};
  const add = (name, fields) => (nodes[slug(name)] = { name, ...fields });
  for (const b of file.boundaries)
    if (file.consumers.some((c) => c.name === b.consumer))
      add(b.consumer, { kind: "consumer", description: file.consumers.find((c) => c.name === b.consumer).description });
  const addComponent = (c, parent) => {
    const opened = Boolean(c.components?.length);
    add(c.name, {
      kind: parent ? "component" : "system",
      description: c.description,
      ...(parent && { parent: slug(parent) }),
      opened,
      hasInside: opened,
      parts: c.parts.map((p) => `${p.name}: ${p.why}`),
      resources: c.resources.map(slug),
    });
    for (const inner of c.components ?? []) addComponent(inner, c.name);
  };
  for (const p of file.providers) addComponent(p, null);
  for (const s of file.outsideServices)
    add(s.name, { kind: "outside", description: s.description, resources: s.resources.map(slug) });
  for (const { component } of file.providers.flatMap((p) => allComponents(p)))
    for (const shared of component.sharedComponents ?? [])
      (nodes[slug(shared.name)].alsoIn ||= []).push(slug(component.name));

  const depth = (id) => (nodes[id]?.parent ? depth(nodes[id].parent) + 1 : 1);
  const resources = {};
  for (const r of file.resources) {
    const id = slug(r.name);
    const keepers = Object.keys(nodes).filter((n) => nodes[n].resources?.includes(id));
    const owner = keepers.reduce((a, b) => (depth(b) > depth(a) ? b : a), keepers[0]);
    resources[id] = { owner, name: r.name, definition: r.description, properties: r.properties ?? [] };
  }

  const interfaceText = new Map(file.interfaces.map((i) => [i.name, i.description]));
  const boundaries = file.boundaries.map((b) => {
    const consumer = slug(b.consumer);
    const parent = nodes[consumer].parent;
    return {
      id: `${consumer}-${slug(b.provider)}`,
      consumer,
      provider: slug(b.provider),
      ...(parent && { inside: parent }),
      interfaces: Object.fromEntries(b.interfaces.map((n) => [slug(n), n])),
      interfaceDetails: Object.fromEntries(b.interfaces.map((n) => [slug(n), interfaceText.get(n)])),
      areas: b.areas.map((a) => ({
        id: slug(a.name),
        name: a.name,
        type: a.type,
        description: a.description,
        capabilities: a.capabilities.map((c) => ({
          name: c.name,
          takes: c.takes,
          gives: c.gives,
          via: (c.interfaces ?? b.interfaces).map(slug),
          on: c.acts.map(({ mode, resource }) => [slug(resource), mode]),
        })),
      })),
      evidence: b.evidence.map((e) => [e.path, e.shows]),
    };
  });

  return {
    system: file.system.name,
    systemDescription: file.system.description,
    revision: file.system.revision.slice(0, 7),
    nodes,
    resources,
    boundaries,
  };
}

// Gives the page's data, or the problems that keep the map from being drawn.
export function readMap(text) {
  const file = JSON.parse(text);
  const problems = [];
  checkShape(file, schema, "map", problems);
  if (!problems.length) checkReferences(file, problems);
  return problems.length ? { problems } : { problems, map: toPage(file) };
}
