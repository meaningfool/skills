// ---------- what changed since an earlier map ----------
// With an earlier map in the page (render-map.mjs --against), each screen marks what is new or
// changed since it, and the text under a still image starts with what changed on that screen. A box
// or capability group is new, or changed when anything about it, or on the screens inside it,
// changed; what did not change fades. A box, capability group or capability that one name replaced
// in the same place, with something in common, was renamed; a capability found in another group of
// the same boundary moved. Both count as changed rather than as one thing gone and one new.

(() => {
  const baseData = document.getElementById("base-data");
  if (!baseData) return;
  document.documentElement.classList.add("diff");
  const BASE = JSON.parse(baseData.textContent);

  const sorted = (xs) => [...(xs ?? [])].sort();
  const overlaps = (a, b) => a.some((x) => b.includes(x));
  const boxesOf = (m) => {
    const out = new Map();
    const ends = (name) =>
      m.boundaries.flatMap((b) => (b.consumer === name ? [b.provider] : b.provider === name ? [b.consumer] : []));
    const add = (c, kind, parent) =>
      out.set(c.name, {
        kind,
        parent,
        formerly: c.formerly,
        description: c.description,
        resources: sorted(c.resources),
        parts: (c.parts ?? []).map((p) => p.name),
        partsWhy: sorted((c.parts ?? []).map((p) => `${p.name}: ${p.why}`)),
        serves: sorted((c.serves ?? []).map((s) => `${s.consumer} › ${s.area}`)),
        ends: ends(c.name),
      });
    const visit = (c, parent) => {
      add(c, parent ? "component" : "provider", parent);
      for (const k of c.components ?? []) visit(k, c.name);
    };
    m.providers.forEach((p) => visit(p, null));
    m.consumers.forEach((c) => add(c, "consumer", null));
    m.outsideServices.forEach((s) => add(s, "outside", null));
    return out;
  };

  // A box renamed: the only box gone and the only box new among those of its kind and parent, with
  // a resource, a part, an area it handles or a box it meets in common.
  const now = boxesOf(RAW);
  const before = boxesOf(BASE);
  const placeOf = (e) => `${e.kind}|${e.parent}`;
  const renamedTo = new Map();
  for (const key of new Set([...before.values()].map(placeOf))) {
    const gone = [...before].filter(([n, e]) => placeOf(e) === key && !now.has(n));
    const added = [...now].filter(([n, e]) => placeOf(e) === key && !before.has(n));
    if (gone.length !== 1 || added.length !== 1) continue;
    const [[oldName, o], [newName, n]] = [gone[0], added[0]];
    const tokens = (e) => [...e.resources, ...e.parts, ...e.serves, ...e.ends];
    if (overlaps(tokens(o), tokens(n))) renamedTo.set(oldName, newName);
  }
  // The earlier map with those boxes under their new names, so the rest compares by name.
  const tr = (name) => renamedTo.get(name) ?? name;
  const T = JSON.parse(JSON.stringify(BASE));
  const rename = (c) => {
    if (renamedTo.has(c.name)) c.formerly = c.name;
    c.name = tr(c.name);
    for (const s of c.serves ?? []) s.consumer = tr(s.consumer);
    for (const s of c.sharedComponents ?? []) {
      s.name = tr(s.name);
      for (const v of s.serves ?? []) v.consumer = tr(v.consumer);
    }
    (c.components ?? []).forEach(rename);
  };
  T.providers.forEach(rename);
  T.consumers.forEach(rename);
  T.outsideServices.forEach(rename);
  for (const b of T.boundaries) {
    b.consumer = tr(b.consumer);
    b.provider = tr(b.provider);
  }
  const was = boxesOf(T);

  const capSig = (c) => JSON.stringify([c.takes, c.gives, sorted(c.acts.map((x) => `${x.mode} ${x.resource}`)), sorted(c.interfaces)]);
  const areaSig = (a) => JSON.stringify([a.description, a.type, a.capabilities.map((c) => `${c.name}=${capSig(c)}`).sort()]);
  const boundarySig = (b) => JSON.stringify([sorted(b.interfaces), b.areas.map((a) => `${a.name}=${areaSig(a)}`).sort()]);
  const byId = (m) => new Map(m.boundaries.map((b) => [`${b.consumer} → ${b.provider}`, b]));
  const wasB = byId(T);
  const nowB = byId(RAW);
  const wasI = new Map(BASE.interfaces.map((i) => [i.name, i.description]));
  const resSig = (r) => JSON.stringify([r.description, r.properties]);
  const wasR = new Map(BASE.resources.map((r) => [r.name, resSig(r)]));

  // A capability group renamed: the only group gone and the only group new on a boundary, with a
  // capability in common.
  const areaWas = new Map(); // `${boundary id} › ${new name}` -> old name
  for (const [id, b] of nowB) {
    const o = wasB.get(id);
    if (!o) continue;
    const gone = o.areas.filter((a) => !b.areas.some((x) => x.name === a.name));
    const added = b.areas.filter((a) => !o.areas.some((x) => x.name === a.name));
    const names = (a) => a.capabilities.map((c) => c.name);
    if (gone.length === 1 && added.length === 1 && overlaps(names(gone[0]), names(added[0])))
      areaWas.set(`${id} › ${added[0].name}`, gone[0].name);
  }
  const oldAreaName = (id, name) => areaWas.get(`${id} › ${name}`) ?? name;
  const newAreaName = (id, name) =>
    [...areaWas].find(([k, v]) => v === name && k.startsWith(`${id} › `))?.[0].slice(id.length + 3) ?? name;
  const oldArea = (a) => wasB.get(a.boundary.id)?.areas.find((x) => x.name === oldAreaName(a.boundary.id, a.name));

  // What happened to each capability of a boundary, with the group it now sits in, or sat in.
  function capRecords(id) {
    const o = wasB.get(id);
    const n = nowB.get(id);
    if (!o || !n) return [];
    const caps = (b, toNew) =>
      new Map(b.areas.flatMap((a) => a.capabilities.map((c) => [c.name, { c, area: toNew ? newAreaName(id, a.name) : a.name }])));
    const oc = caps(o, true);
    const nc = caps(n, false);
    const gone = [...oc.keys()].filter((k) => !nc.has(k));
    const added = [...nc.keys()].filter((k) => !oc.has(k));
    const resources = (c) => c.acts.map((x) => x.resource);
    const renamed =
      gone.length === 1 && added.length === 1 && overlaps(resources(oc.get(gone[0]).c), resources(nc.get(added[0]).c))
        ? { from: gone[0], to: added[0] }
        : null;
    const out = [];
    for (const k of added) {
      const { c, area } = nc.get(k);
      if (renamed?.to === k)
        out.push({ area, text: `${k}, was ${renamed.from}${capSig(c) !== capSig(oc.get(renamed.from).c) ? ", changed" : ""}` });
      else out.push({ area, text: `${k} is new` });
    }
    for (const k of [...nc.keys()].filter((k) => oc.has(k))) {
      const a = oc.get(k);
      const b = nc.get(k);
      if (a.area !== b.area) out.push({ area: b.area, text: `${k} moved from ${oldAreaName(id, a.area)}` });
      else if (capSig(a.c) !== capSig(b.c)) out.push({ area: b.area, text: `${k} changed` });
    }
    for (const k of gone) if (renamed?.from !== k) out.push({ area: oc.get(k).area, text: `${k} is gone` });
    return out;
  }

  const fields = (name) => {
    const a = was.get(name);
    const b = now.get(name);
    const out = [];
    if (a.formerly) out.push(`its name, was ${a.formerly}`);
    if (a.description !== b.description) out.push("its description");
    const say = (xs, word) => xs.length && (xs.length > 3 ? `${xs.length} ${word}` : `${xs.join(", ")} ${word}`);
    const listed = (label, x, y) => {
      const added = y.filter((v) => !x.includes(v));
      const gone = x.filter((v) => !y.includes(v));
      if (added.length || gone.length) out.push(`${label}: ${[say(added, "added"), say(gone, "removed")].filter(Boolean).join(", ")}`);
    };
    listed("parts", a.parts, b.parts);
    if (!out.some((f) => f.startsWith("parts")) && JSON.stringify(a.partsWhy) !== JSON.stringify(b.partsWhy)) out.push("what its parts do");
    listed("keeps", a.resources, b.resources);
    listed("handles", a.serves, b.serves);
    return out;
  };
  const under = (tree, name) =>
    [...tree.keys()].filter((k) => {
      for (let p = tree.get(k).parent; p; p = tree.get(p)?.parent) if (p === name) return true;
      return false;
    });
  const boundaryState = (id) => (!wasB.has(id) ? "new" : boundarySig(wasB.get(id)) !== boundarySig(nowB.get(id)) ? "changed" : null);
  const ownState = (name) => (!was.has(name) ? "new" : fields(name).length ? "changed" : null);
  // What opening the box shows: the boundaries into it, on its own screen, and everything inside it.
  const insideCount = (name) => {
    const n = now.get(name);
    if (!n || n.kind === "consumer" || n.kind === "outside" || !was.has(name)) return 0;
    const nowIn = new Set(under(now, name));
    const wasIn = new Set(under(was, name));
    const consumerOf = (id) => id.split(" → ")[0];
    const providerOf = (id) => id.split(" → ")[1];
    const reached = (id, inside) => inside.has(consumerOf(id)) || providerOf(id) === name;
    let count = 0;
    for (const k of nowIn) if (ownState(k)) count++;
    for (const k of wasIn) if (!now.has(k)) count++;
    for (const id of nowB.keys()) if (reached(id, nowIn) && boundaryState(id)) count++;
    for (const id of wasB.keys()) if (reached(id, wasIn) && !nowB.has(id)) count++;
    return count;
  };
  const boxState = (name) => ownState(name) ?? (insideCount(name) ? "changed" : null);
  const ifaceState = (n) => (!wasI.has(n) ? "new" : wasI.get(n) !== interfaceText.get(n) ? "changed" : null);
  const resState = (n) => (!wasR.has(n) ? "new" : wasR.get(n) !== resSig(resourceByName.get(n)) ? "changed" : null);
  const areaState = (g) => {
    const states = g.members.map((a) => {
      const o = oldArea(a);
      return !o ? "new" : o.name !== a.name || areaSig(o) !== areaSig(a) ? "changed" : null;
    });
    if (states.every((s) => s === "new")) return "new";
    const moved = g.members.some((a) => capRecords(a.boundary.id).some((r) => r.area === a.name));
    return states.some(Boolean) || moved ? "changed" : null;
  };

  // What changed on the screen of the open box, in words.
  function changesHere(s) {
    const lines = [];
    const add = (state, html) => lines.push({ state, html });
    if (!s.top && ownState(openBox) === "changed") add("changed", `**${openBox}** changed: ${fields(openBox).join("; ")}.`);
    for (const n of [...s.consumers, ...s.boxes, ...s.uses]) {
      const st = ownState(n);
      if (st === "new") add("new", `**${n}** is new.`);
      else if (st === "changed") add("changed", `**${n}** changed: ${fields(n).join("; ")}.`);
      const inside = opens(n) ? insideCount(n) : 0;
      if (inside) add("inside", `**${n}** has ${inside} change${inside > 1 ? "s" : ""} inside: open it to see ${inside > 1 ? "them" : "it"}.`);
    }
    const wasInner = s.top ? T.providers.map((p) => p.name) : [...was.keys()].filter((k) => was.get(k).parent === openBox);
    for (const k of wasInner) if (!now.has(k)) add("gone", `**${k}** is gone.`);
    for (const g of s.areas) {
      const st = areaState(g);
      const records = g.members.flatMap((a) => capRecords(a.boundary.id).filter((r) => r.area === a.name)).map((r) => r.text);
      const formerly = g.members.map(oldArea).find((o) => o && o.name !== g.name)?.name;
      if (st === "new") add("new", `**${g.name}** is new: ${g.capabilities.map((c) => c.name).join(", ")}.`);
      else if (st === "changed")
        add("changed", `**${g.name}**${formerly ? `, was ${formerly},` : ""} changed${records.length ? `: ${records.join("; ")}` : ""}.`);
    }
    if (!s.top) {
      const kept = s.areas.flatMap((g) => g.members.map((a) => oldAreaName(a.boundary.id, a.name)));
      for (const b of [...wasB.values()].filter((b) => b.provider === openBox))
        for (const a of b.areas) if (!kept.includes(a.name)) add("gone", `**${a.name}** is gone.`);
    }
    for (const p of s.ports) {
      const st = ifaceState(p);
      if (st) add(st, `Interface **${p}** ${st === "new" ? "is new" : "changed its description"}.`);
    }
    for (const b of s.links) {
      const st = boundaryState(b.id);
      if (st === "new") add("new", `**${b.consumer} → ${b.provider}** is new: ${b.areas.flatMap((a) => a.capabilities.map((c) => c.name)).join(", ")}.`);
      else if (st === "changed")
        add("changed", `**${b.consumer} → ${b.provider}** changed: ${capRecords(b.id).map((r) => r.text).join("; ") || "its interfaces or groups"}.`);
    }
    for (const r of unique([...s.kept.values()].flat())) {
      const st = resState(r);
      if (st) add(st, `Resource **${r}** ${st === "new" ? "is new" : "changed"}.`);
    }
    return lines;
  }

  const PILL = { new: "New", changed: "Changed" };
  function mark() {
    const s = screen;
    for (const [key, e] of drawn) {
      const cut = key.indexOf(":");
      const kind = key.slice(0, cut);
      const id = key.slice(cut + 1);
      const st =
        kind === "b"
          ? boxState(id)
          : kind === "a"
            ? areaState(s.areas.find((g) => g.name === id))
            : kind === "p"
              ? ifaceState(id)
              : kind === "r"
                ? resState(id)
                : null;
      if (!st) continue;
      e.dataset.diff = st;
      if (kind === "b" || kind === "a") e.dataset.pill = PILL[st];
    }
    for (const e of document.querySelectorAll(".b-box:not([data-diff])")) if (e.querySelector(".b-chip[data-diff]")) e.dataset.diffIn = "";
    for (const p of document.querySelectorAll(".b-wires path")) {
      // Only a line between two boxes is a boundary; the others join a box to an interface or a group.
      if (!p.dataset.from?.startsWith("b:") || !p.dataset.to?.startsWith("b:")) continue;
      const st = boundaryState(`${p.dataset.from.slice(2)} → ${p.dataset.to.slice(2)}`);
      if (st) p.dataset.diff = st;
    }
    const head = document.querySelector(".b-frame-head h2");
    if (head && ownState(openBox)) head.dataset.diff = ownState(openBox);
  }

  const baseLegendOf = legendOf;
  legendOf = (s) => {
    const legend = baseLegendOf(s);
    const lines = changesHere(s);
    const states = new Map();
    for (const n of [...s.consumers, ...s.boxes, ...s.uses]) if (boxState(n)) states.set(n, boxState(n));
    for (const p of s.ports) if (ifaceState(p)) states.set(p, ifaceState(p));
    for (const li of legend.querySelectorAll("li")) {
      const name = li.querySelector("strong")?.textContent;
      if (states.has(name)) li.dataset.diff = states.get(name);
    }
    legend.prepend(
      el(
        "section",
        { class: "b-changes" },
        el("h3", {}, lines.length ? "What changed here" : "Nothing changed on this screen"),
        lines.length > 0 && el("ul", {}, lines.map((l) => el("li", { "data-diff": l.state, html: inline(l.html) }))),
      ),
    );
    return legend;
  };

  const baseRender = render;
  render = () => {
    baseRender();
    mark();
    // Still images: All providers, then only the screens of boxes that are new or changed.
    if (STILL)
      document.documentElement.dataset.screens = screens()
        .filter((trail) => !trail.length || boxState(trail.at(-1)))
        .map(addressOf)
        .join(" ");
  };
  render();
  document.fonts?.ready.then(() => render());
})();
