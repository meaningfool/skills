// Draws a boundary map in two kinds of screen at every level: all the boundaries, and one
// boundary in focus. Selecting an element shows its details in the side panel, and the panel
// offers the way deeper: Focus from an interface, Go inside from a provider that has an inside.
const map = JSON.parse(document.getElementById("map-data").textContent);
const N = map.nodes;
const R = map.resources;
const boundaryById = new Map(map.boundaries.map((b) => [b.id, b]));
const MODE_WORD = { produces: "creates", mutates: "changes", observes: "reads", reacts: "reacts to" };
const WRITES = new Set(["produces", "mutates"]);
const KIND_WORD = {
  consumer: "Consumer",
  system: "Provider",
  component: "Component",
  outside: "Outside service",
};

const MARGIN = 32;
const BOX_W = 190;
const LABEL_W = 170;
const GAP_W = LABEL_W + 110;
const TAG_W = 150;
const AREA_W = 300;
const RES_W = 180;

let route = null;
let screen = null; // { lit(selection) -> Set of keys or null, panel(selection) -> nodes }
let selected = null;

// ---------- small helpers ----------

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

function svg(tag, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  return e;
}

const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Inline Markdown as the map writes it: `code`, **bold** and _italic_.
const inline = (s) =>
  escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");

const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const unique = (xs) => [...new Set(xs)];

// A horizontal S-curve between two points.
const curve = ([x1, y1], [x2, y2]) => {
  const dx = Math.max(24, (x2 - x1) / 2);
  return `C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};

function wire(layer, d, key, { arrow = false, reads = false } = {}) {
  layer.append(
    svg("path", {
      d,
      class: reads ? "wire reads" : "wire",
      "data-key": key,
      "data-arrow": arrow ? "1" : null,
      "marker-end": arrow ? "url(#arrow)" : null,
    }),
  );
}

function hit(layer, d, onclick) {
  layer.append(svg("path", { d, class: "hit", onclick }));
}

function newLayer(canvas) {
  const layer = svg("svg");
  const defs = svg("defs");
  for (const [id, color] of [
    ["arrow", "#c9c9c9"],
    ["arrow-lit", "#d8401f"],
  ]) {
    const marker = svg("marker", {
      id,
      viewBox: "0 0 8 8",
      refX: 7,
      refY: 4,
      markerWidth: 8,
      markerHeight: 8,
      orient: "auto",
    });
    marker.append(svg("path", { d: "M0,0 L8,4 L0,8 z", fill: color }));
    defs.append(marker);
  }
  layer.append(defs);
  canvas.append(layer);
  return layer;
}

function sizeCanvas(canvas, layer, width, height) {
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  layer.setAttribute("width", width);
  layer.setAttribute("height", height);
}

function place(e, x, y, h) {
  e.style.left = `${x}px`;
  e.style.top = `${y}px`;
  if (h !== undefined) e.style.height = `${h}px`;
}

// ---------- routes ----------

// "#/eventpulse/interview_runtime?focus=<boundary>": the providers gone inside, then the focus.
function readRoute() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const frames = path.split("/").filter((id) => N[id]?.hasInside);
  const focus = new URLSearchParams(query).get("focus");
  return { frames, focus: boundaryById.has(focus) ? focus : null };
}

const href = (r) => `#/${r.frames.join("/")}${r.focus ? `?focus=${r.focus}` : ""}`;
const go = (r) => {
  location.hash = href(r);
};
const frameOf = (r) => r.frames.at(-1) ?? null;
const boundaryName = (b) => `${N[b.consumer].name} ↔ ${N[b.provider].name}`;

function above(r) {
  if (r.focus) return { frames: r.frames, focus: null };
  if (r.frames.length) return { frames: r.frames.slice(0, -1), focus: null };
  return null;
}

function titleOf(r) {
  if (r.focus) return boundaryName(boundaryById.get(r.focus));
  const frame = frameOf(r);
  return frame ? `Inside ${N[frame].name}` : "All boundaries";
}

// ---------- map queries ----------

const boundariesAt = (frame) =>
  map.boundaries.filter((b) =>
    frame ? b.inside === frame || b.alsoInside?.includes(frame) : !b.inside,
  );
const isPartOf = (id, frame) => N[id].parent === frame || Boolean(N[id].alsoIn?.includes(frame));
const componentsOf = (frame) => Object.keys(N).filter((id) => isPartOf(id, frame));
const capabilitiesOf = (b) =>
  b.areas.flatMap((a) =>
    a.capabilities.map((c, i) => ({ ...c, area: a, key: `cap:${a.id}:${i}`, i })),
  );
const reaches = (b, iid, area) => area.capabilities.some((c) => c.via.includes(iid));
const resourceName = (rid) => R[rid]?.name ?? rid;

// ---------- panels ----------

const head = (kind, title) => [el("span", { class: "kind" }, kind), el("h2", {}, title)];
const paragraph = (text) =>
  el("p", { html: inline(text.replace(/^[a-z]/, (c) => c.toUpperCase())) });
const description = (text) =>
  text ? paragraph(text) : el("p", { class: "missing" }, "The map gives no description.");

function field(title, values, className) {
  if (!values.length) return [];
  return [
    el("h3", {}, title),
    el("ul", { class: className }, values.map((v) => el("li", { html: inline(v) }))),
  ];
}

const action = (text, onclick) => el("button", { class: "action", type: "button", onclick }, text);

function nodePanel(id, { here = false } = {}) {
  const n = N[id];
  return [
    ...head(KIND_WORD[n.kind], n.name),
    description(n.description),
    ...field("Resources", (n.resources ?? []).map(resourceName)),
    ...field(
      "Components",
      componentsOf(id).map((c) => N[c].name),
    ),
    ...field(n.opened ? "Other parts" : "Parts", n.parts ?? []),
    n.hasInside && !here
      ? action(`Go inside ${n.name}`, () => go({ frames: [...route.frames, id], focus: null }))
      : null,
  ];
}

function interfacePanel(b, iid, { offerFocus }) {
  const caps = capabilitiesOf(b).filter((c) => c.via.includes(iid));
  return [
    ...head("Interface", b.interfaces[iid]),
    description(b.interfaceDetails?.[iid]),
    ...field("Boundary", [boundaryName(b)]),
    ...field(
      "Capabilities",
      caps.map((c) => c.name),
    ),
    offerFocus
      ? action("Focus on this boundary", () => go({ frames: route.frames, focus: b.id }))
      : null,
  ];
}

function mapPanel() {
  return [
    ...head("Boundary map", map.system),
    description(map.systemDescription),
    ...field("Revision", map.revision ? [`\`${map.revision}\``] : []),
  ];
}

// ---------- screen: all the boundaries at one level ----------

function drawLevel(canvas, frame) {
  const bs = boundariesAt(frame);
  const ids = unique([
    ...bs.flatMap((b) => [b.consumer, b.provider]),
    ...(frame ? componentsOf(frame) : []),
  ]);
  const inside = (id) => !frame || isPartOf(id, frame);
  const layer = newLayer(canvas);

  // Columns: each consumer sits left of the providers it uses. What is outside the frame sits
  // left of it when it only uses, right of it otherwise.
  const preds = new Map(ids.map((id) => [id, []]));
  for (const b of bs) preds.get(b.provider).push(b.consumer);
  const col = new Map();
  const visiting = new Set();
  const depthOf = (id) => {
    if (col.has(id)) return col.get(id);
    visiting.add(id);
    let c = 0;
    for (const p of preds.get(id))
      if (inside(p) && !visiting.has(p)) c = Math.max(c, depthOf(p) + 1);
    visiting.delete(id);
    col.set(id, c);
    return c;
  };
  for (const id of ids) if (inside(id)) depthOf(id);
  const lastInside = Math.max(0, ...col.values());
  for (const id of ids)
    if (!inside(id)) col.set(id, preds.get(id).length ? lastInside + 1 : -1);
  const shift = [...col.values()].some((c) => c < 0) ? 1 : 0;
  for (const [id, c] of col) col.set(id, c + shift);

  const columns = Array.from({ length: Math.max(...col.values()) + 1 }, () => []);
  const items = new Map();
  for (const id of ids) {
    const it = { key: `node:${id}`, id, col: col.get(id), prev: [], next: [] };
    items.set(it.key, it);
    columns[it.col].push(it);
  }
  // A boundary that skips columns passes through one waypoint in each column it crosses.
  const chains = new Map();
  for (const b of bs) {
    const from = items.get(`node:${b.consumer}`);
    const to = items.get(`node:${b.provider}`);
    const chain = [from];
    for (let c = from.col + 1; c < to.col; c++) {
      const w = { key: `via:${b.id}:${c}`, col: c, waypoint: true, b, from: chain.at(-1), prev: [], next: [] };
      items.set(w.key, w);
      columns[c].push(w);
      chain.push(w);
    }
    chain.push(to);
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].col !== chain[i - 1].col + 1) continue;
      chain[i - 1].next.push(chain[i]);
      chain[i].prev.push(chain[i - 1]);
    }
    chains.set(b.id, chain);
  }

  // Order each column by the mean position of its neighbours, sweeping both ways.
  const indexIn = (it) => columns[it.col].indexOf(it);
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    for (const column of down ? columns.slice(1) : columns.slice(0, -1).reverse()) {
      const pos = new Map(
        column.map((it, i) => {
          const near = down ? it.prev : it.next;
          return [it, near.length ? avg(near.map(indexIn)) : i];
        }),
      );
      column.sort((a, b) => pos.get(a) - pos.get(b));
    }
  }

  // Boxes and interface labels, measured once they are on the page.
  const providers = new Set(bs.map((b) => b.provider));
  for (const it of items.values()) {
    if (it.waypoint) {
      it.h = 14;
      continue;
    }
    const n = N[it.id];
    const classes = ["box", n.kind === "outside" && "outside", providers.has(it.id) && "provider"];
    it.el = el(
      "div",
      {
        class: classes.filter(Boolean).join(" "),
        "data-key": it.key,
        style: `width:${BOX_W}px`,
        onclick: (e) => select({ kind: "node", id: it.id, key: it.key }, e),
      },
      el("span", { class: "kind" }, KIND_WORD[n.kind]),
      el("span", { class: "name" }, n.name),
    );
    canvas.append(it.el);
    it.h = it.el.offsetHeight;
  }
  const labels = new Map();
  for (const b of bs) {
    labels.set(
      b.id,
      Object.entries(b.interfaces).map(([iid, name]) => {
        const key = `iface:${b.id}:${iid}`;
        const onclick = (e) => select({ kind: "interface", b, iid, key }, e);
        const e = el("div", { class: "label", "data-key": key, style: `width:${LABEL_W}px`, onclick }, name);
        canvas.append(e);
        return { iid, key, el: e, h: e.offsetHeight, onclick };
      }),
    );
  }
  // Vertical positions, column by column. Each boundary's interface slots sit level with the
  // stem that brings it, and each provider grows to hold its slots.
  const SLOT_GAP = 12;
  const top = frame ? MARGIN + 44 : MARGIN;
  const x = (c) => MARGIN + 24 + c * (BOX_W + GAP_W);
  const mid = (it) => it.y + it.h / 2;
  const incoming = (id) => bs.filter((b) => b.provider === id);
  const outgoing = (id) =>
    bs
      .filter((b) => b.consumer === id)
      .sort((a, b) => indexIn(chains.get(a.id)[1]) - indexIn(chains.get(b.id)[1]));
  const startY = (b) => {
    const out = outgoing(b.consumer);
    return mid(items.get(`node:${b.consumer}`)) + (out.indexOf(b) - (out.length - 1) / 2) * 10;
  };
  const arrivesAt = (b) => {
    const prev = chains.get(b.id).at(-2);
    return prev.waypoint ? mid(prev) : startY(b);
  };
  const slots = new Map(); // label key -> y of its line
  const slotMid = new Map(); // boundary id -> mean y of its slots
  for (const column of columns) {
    let bottom = top;
    for (const it of column) {
      if (it.waypoint) {
        const want = it.from.waypoint ? mid(it.from) : startY(it.b);
        it.y = Math.max(want - it.h / 2, bottom);
        bottom = it.y + it.h + 8;
        continue;
      }
      const groups = incoming(it.id)
        .map((b) => ({ b, ls: labels.get(b.id), want: arrivesAt(b) }))
        .sort((a, b) => a.want - b.want);
      // Each label sits above its line; a group's lines are centred on where its stem arrives.
      for (const g of groups) {
        let y = 0;
        g.lines = g.ls.map((l) => {
          const line = y + l.h + 3;
          y += l.h + SLOT_GAP;
          return line;
        });
        g.h = y;
        g.offset = avg(g.lines);
      }
      it.y = groups.length ? Math.max(bottom, groups[0].want - groups[0].offset - 8) : bottom;
      let y = it.y + 8;
      for (const g of groups) {
        y = Math.max(y, g.want - g.offset);
        g.ls.forEach((l, i) => slots.set(l.key, y + g.lines[i]));
        slotMid.set(g.b.id, y + g.offset);
        y += g.h;
      }
      it.h = Math.max(it.h, y - it.y + 8);
      bottom = it.y + it.h + 26;
    }
  }
  // Then each consumer on the far left is centred on what it leads to, as far as room allows.
  let bottom = top;
  for (const it of columns[0]) {
    const out = outgoing(it.id);
    const leads = out.map((b) => {
      const chain = chains.get(b.id);
      return chain.length > 2 ? mid(chain[1]) : slotMid.get(b.id);
    });
    it.y = Math.max(out.length ? avg(leads) - it.h / 2 : it.y, bottom);
    bottom = it.y + it.h + 26;
  }

  // The frame: the provider gone inside, around its components.
  let height = 0;
  for (const it of items.values()) height = Math.max(height, it.y + it.h);
  if (frame) {
    const cols = [...items.values()].filter((it) => !it.waypoint && inside(it.id)).map((it) => it.col);
    const left = x(Math.min(...cols)) - 24;
    const right = x(Math.max(...cols)) + BOX_W + 24;
    const box = el("div", { class: "frame" });
    place(box, left, MARGIN, height + 24 - MARGIN);
    box.style.width = `${right - left}px`;
    const title = el("div", { class: "frame-title" }, N[frame].name);
    place(title, left + 10, MARGIN + 8);
    canvas.prepend(box);
    canvas.append(title);
    height += 24;
  }

  for (const it of items.values()) if (it.el) place(it.el, x(it.col), it.y, it.h);

  // Wires: one stem per boundary from its consumer, branching into one arrow per interface.
  for (const it of items.values()) {
    if (it.waypoint) continue;
    for (const b of outgoing(it.id)) {
      const chain = chains.get(b.id);
      const to = chain.at(-1);
      let at = [x(it.col) + BOX_W, startY(b)];
      let d = `M${at[0]},${at[1]}`;
      for (const w of chain.slice(1, -1)) {
        const enter = [x(w.col), mid(w)];
        d += ` ${curve(at, enter)} L${x(w.col) + BOX_W},${mid(w)}`;
        at = [x(w.col) + BOX_W, mid(w)];
      }
      const end = x(to.col);
      const bx = to.col > it.col ? end - LABEL_W - 40 : end - 40;
      const branch = [bx, slotMid.get(b.id)];
      d += ` ${curve(at, branch)}`;
      wire(layer, d, `stem:${b.id}`);
      for (const l of labels.get(b.id)) {
        const ly = slots.get(l.key);
        const bd = `M${branch[0]},${branch[1]} ${curve(branch, [bx + 24, ly])} L${end - 2},${ly}`;
        wire(layer, bd, l.key, { arrow: true });
        hit(layer, bd, l.onclick);
        place(l.el, bx + 28, ly - l.h - 3);
      }
    }
  }

  const width = x(columns.length - 1) + BOX_W + MARGIN;
  sizeCanvas(canvas, layer, width, height + MARGIN);

  return {
    lit(sel) {
      const keys = new Set([sel.key]);
      const touch = (b) => {
        keys.add(`stem:${b.id}`);
        keys.add(`node:${b.consumer}`);
        keys.add(`node:${b.provider}`);
      };
      if (sel.kind === "interface") touch(sel.b);
      if (sel.kind === "node")
        for (const b of bs) {
          if (b.consumer !== sel.id && b.provider !== sel.id) continue;
          touch(b);
          for (const iid of Object.keys(b.interfaces)) keys.add(`iface:${b.id}:${iid}`);
        }
      return keys;
    },
    panel(sel) {
      if (!sel) return frame ? nodePanel(frame, { here: true }) : mapPanel();
      if (sel.kind === "interface") return interfacePanel(sel.b, sel.iid, { offerFocus: true });
      return nodePanel(sel.id);
    },
  };
}

// ---------- screen: one boundary in focus ----------

function drawFocus(canvas, b) {
  const layer = newLayer(canvas);
  const caps = capabilitiesOf(b);
  const iids = Object.keys(b.interfaces);

  const consumer = el(
    "div",
    {
      class: `box${N[b.consumer].kind === "outside" ? " outside" : ""}`,
      "data-key": "consumer",
      style: `width:${BOX_W}px`,
      onclick: (e) => select({ kind: "node", id: b.consumer, key: "consumer" }, e),
    },
    el("span", { class: "kind" }, KIND_WORD[N[b.consumer].kind]),
    el("span", { class: "name" }, N[b.consumer].name),
  );
  canvas.append(consumer);

  const tags = iids.map((iid) => {
    const key = `iface:${iid}`;
    const e = el(
      "div",
      {
        class: "tag",
        "data-key": key,
        style: `width:${TAG_W}px`,
        onclick: (ev) => select({ kind: "interface", iid, key }, ev),
      },
      b.interfaces[iid],
    );
    canvas.append(e);
    return { iid, key, el: e, h: e.offsetHeight };
  });

  const areas = b.areas.map((a) => {
    const rows = caps
      .filter((c) => c.area === a)
      .map((c) => ({
        c,
        el: el(
          "div",
          {
            class: "capability",
            "data-key": c.key,
            onclick: (ev) => select({ kind: "capability", c, key: c.key }, ev),
          },
          c.name,
        ),
      }));
    const title = el("div", { class: "area-title", "data-key": `area:${a.id}` }, el("b", {}, a.name), ` · ${a.type}`);
    const e = el("div", { class: "area", style: `width:${AREA_W}px` }, title, ...rows.map((r) => r.el));
    canvas.append(e);
    return { a, el: e, title, rows, h: e.offsetHeight };
  });

  const rids = unique(caps.flatMap((c) => c.on.map(([rid]) => rid)));
  const resources = rids.map((rid) => {
    const key = `res:${rid}`;
    const e = el(
      "div",
      {
        class: "box",
        "data-key": key,
        style: `width:${RES_W}px`,
        onclick: (ev) => select({ kind: "resource", rid, key }, ev),
      },
      el("span", { class: "kind" }, "Resource"),
      el("span", { class: "name" }, resourceName(rid)),
    );
    canvas.append(e);
    return { rid, key, el: e, h: e.offsetHeight };
  });

  // Columns: the consumer, the interfaces on the provider's outline, the areas, the resources.
  const periX = MARGIN + BOX_W + 100;
  const tagX = periX - TAG_W / 2;
  const areaX = periX + TAG_W / 2 + 64;
  const resX = areaX + AREA_W + 110;
  const periRight = resX + RES_W + 36;
  const contentTop = MARGIN + 52;

  let bottom = contentTop;
  for (const ar of areas) {
    ar.y = bottom;
    bottom += ar.h + 24;
    for (const r of ar.rows) r.mid = ar.y + r.el.offsetTop + r.el.offsetHeight / 2;
    ar.titleMid = ar.y + ar.title.offsetHeight / 2;
  }
  const rows = areas.flatMap((ar) => ar.rows);

  const stack = (list, want, gap) => {
    let y = contentTop;
    for (const it of list) {
      it.y = Math.max(want(it) - it.h / 2, y);
      y = it.y + it.h + gap;
    }
  };
  stack(resources, (r) => avg(rows.filter((row) => row.c.on.some(([rid]) => rid === r.rid)).map((row) => row.mid)), 16);
  stack(tags, (t) => {
    const reached = areas.filter((ar) => reaches(b, t.iid, ar.a));
    return reached.length ? avg(reached.map((ar) => ar.titleMid)) : contentTop;
  }, 16);
  const consumerH = consumer.offsetHeight;
  const consumerY = Math.max(contentTop, avg(tags.map((t) => t.y + t.h / 2)) - consumerH / 2);

  let periBottom = 0;
  for (const it of [...areas, ...resources, ...tags]) periBottom = Math.max(periBottom, it.y + it.h);
  periBottom += 28;

  const perimeter = el("div", { class: "frame" });
  place(perimeter, periX, MARGIN, periBottom - MARGIN);
  perimeter.style.width = `${periRight - periX}px`;
  canvas.prepend(perimeter);
  const providerTitle = el(
    "div",
    {
      class: "frame-title",
      "data-key": "provider",
      onclick: (e) => select({ kind: "node", id: b.provider, key: "provider" }, e),
    },
    N[b.provider].name,
  );
  place(providerTitle, periX + TAG_W / 2 + 10, MARGIN + 8);
  canvas.append(providerTitle);

  place(consumer, MARGIN, consumerY);
  for (const t of tags) place(t.el, tagX, t.y);
  for (const ar of areas) place(ar.el, areaX, ar.y);
  for (const r of resources) place(r.el, resX, r.y);

  // Wires: consumer to each interface, each interface to the areas it reaches, each capability
  // to the resources it acts on.
  const start = [MARGIN + BOX_W, consumerY + consumerH / 2];
  const branch = [tagX - 40, start[1]];
  wire(layer, `M${start[0]},${start[1]} L${branch[0]},${branch[1]}`, "stem");
  for (const t of tags) {
    const ty = t.y + t.h / 2;
    const d = `M${branch[0]},${branch[1]} ${curve(branch, [tagX - 2, ty])}`;
    wire(layer, d, t.key, { arrow: true });
    for (const ar of areas) {
      if (!reaches(b, t.iid, ar.a)) continue;
      const from = [tagX + TAG_W, ty];
      wire(layer, `M${from[0]},${from[1]} ${curve(from, [areaX - 2, ar.titleMid])}`, `link:${t.iid}:${ar.a.id}`, { arrow: true });
    }
  }
  for (const row of rows)
    for (const [rid, mode] of row.c.on) {
      const res = resources.find((r) => r.rid === rid);
      const from = [areaX + AREA_W, row.mid];
      const d = `M${from[0]},${from[1]} ${curve(from, [resX, res.y + res.h / 2])}`;
      wire(layer, d, `use:${row.c.key}:${rid}`, { reads: !WRITES.has(mode) });
    }

  sizeCanvas(canvas, layer, periRight + MARGIN, periBottom + MARGIN);

  const toArea = (keys, a, iidsIn) => {
    keys.add(`area:${a.id}`);
    for (const iid of iidsIn) {
      keys.add(`iface:${iid}`);
      keys.add(`link:${iid}:${a.id}`);
    }
    if (iidsIn.length) {
      keys.add("stem");
      keys.add("consumer");
    }
  };
  const toResources = (keys, c, only) => {
    for (const [rid] of c.on) {
      if (only && rid !== only) continue;
      keys.add(`use:${c.key}:${rid}`);
      keys.add(`res:${rid}`);
    }
  };

  return {
    lit(sel) {
      const keys = new Set([sel.key]);
      if (sel.kind === "interface") {
        for (const c of caps) {
          if (!c.via.includes(sel.iid)) continue;
          keys.add(c.key);
          toArea(keys, c.area, [sel.iid]);
          toResources(keys, c);
        }
        keys.add("stem");
        keys.add("consumer");
      }
      if (sel.kind === "capability") {
        toArea(keys, sel.c.area, sel.c.via);
        toResources(keys, sel.c);
      }
      // Interfaces link to areas, so a resource lights every interface that reaches an area
      // acting on it.
      if (sel.kind === "resource")
        for (const c of caps) {
          if (!c.on.some(([rid]) => rid === sel.rid)) continue;
          keys.add(c.key);
          toArea(keys, c.area, iids.filter((iid) => reaches(b, iid, c.area)));
          toResources(keys, c, sel.rid);
        }
      if (sel.kind === "node" && sel.id === b.consumer) {
        keys.add("stem");
        for (const iid of iids) keys.add(`iface:${iid}`);
      }
      if (sel.kind === "node" && sel.id === b.provider) return null;
      return keys;
    },
    panel(sel) {
      if (!sel) return boundaryPanel(b);
      if (sel.kind === "interface") return interfacePanel(b, sel.iid, { offerFocus: false });
      if (sel.kind === "capability") return capabilityPanel(b, sel.c);
      if (sel.kind === "resource") return resourcePanel(b, sel.rid);
      return nodePanel(sel.id);
    },
  };
}

function boundaryPanel(b) {
  return [
    ...head("Boundary", boundaryName(b)),
    ...field(
      "Interfaces",
      Object.entries(b.interfaces).map(([iid, name]) =>
        b.interfaceDetails?.[iid] ? `${name}: ${b.interfaceDetails[iid]}` : name,
      ),
    ),
    ...field(
      "Areas",
      b.areas.map((a) => `${a.name} (${a.type}): ${a.description}`),
    ),
    ...field(
      "Evidence",
      b.evidence.map(([path, why]) => `\`${path}\`: ${why}`),
      "evidence",
    ),
  ];
}

function capabilityPanel(b, c) {
  return [
    ...head("Capability", c.name),
    ...field("Takes", [c.takes]),
    ...field("Gives", [c.gives]),
    ...field("Area", [`${c.area.name} (${c.area.type}): ${c.area.description}`]),
    ...field(
      "Interfaces",
      c.via.map((iid) => b.interfaces[iid]),
    ),
    ...field(
      "Resources",
      c.on.map(([rid, mode]) => `${MODE_WORD[mode] ?? mode} **${resourceName(rid)}**`),
    ),
  ];
}

function resourcePanel(b, rid) {
  const r = R[rid];
  const keptBy = Object.keys(N).filter((id) => N[id].resources?.includes(rid));
  return [
    ...head("Resource", resourceName(rid)),
    description(r?.definition),
    ...field("Properties", r?.properties ?? []),
    ...field(
      "Kept by",
      keptBy.map((id) => N[id].name),
    ),
    ...field(
      "Capabilities",
      capabilitiesOf(b).flatMap((c) =>
        c.on.filter(([id]) => id === rid).map(([, mode]) => `${c.name}: ${MODE_WORD[mode] ?? mode}`),
      ),
    ),
  ];
}

// ---------- still image ----------

// A still image cannot be clicked, so it carries under the drawing what the panels would say.
const STILL = new URLSearchParams(location.search).has("still");
if (STILL) document.documentElement.classList.add("still");

function legendGroups(r) {
  const nodeEntry = (id) => [N[id].name, N[id].description];
  if (r.focus) {
    const b = boundaryById.get(r.focus);
    const rids = [...new Set(capabilitiesOf(b).flatMap((c) => c.on.map(([rid]) => rid)))];
    return [
      ["Boundary", [b.consumer, b.provider].map(nodeEntry)],
      ["Interfaces", Object.entries(b.interfaces).map(([iid, name]) => [name, b.interfaceDetails[iid]])],
      ...b.areas.map((a) => [
        `${a.name} (${a.type}): ${a.description}`,
        a.capabilities.map((c) => [c.name, `takes ${c.takes}; gives ${c.gives}`]),
      ]),
      ["Resources", rids.map((rid) => [R[rid].name, R[rid].definition])],
    ];
  }
  const frame = frameOf(r);
  const shown = boundariesAt(frame);
  const ids = [
    ...(frame ? componentsOf(frame) : []),
    ...shown.flatMap((b) => [b.consumer, b.provider]),
  ];
  const interfaces = new Map(
    shown.flatMap((b) =>
      Object.entries(b.interfaces).map(([iid, name]) => [name, b.interfaceDetails[iid]]),
    ),
  );
  return [
    ["Elements", [...new Set(ids)].map(nodeEntry)],
    ["Interfaces", [...interfaces]],
  ];
}

function drawLegend(r) {
  const groups = legendGroups(r).map(([title, entries]) =>
    el("section", {}, [
      el("h3", {}, title),
      el(
        "ul",
        {},
        entries.map(([name, text]) => el("li", { html: inline(`**${name}**: ${text}`) })),
      ),
    ]),
  );
  const legend = el("div", { class: "legend" }, groups);
  const canvas = document.querySelector(".canvas");
  legend.style.width = `${Math.max(canvas.offsetWidth, 1200)}px`;
  document.querySelector(".legend")?.remove();
  document.querySelector(".stage").append(legend);
  const { bottom } = legend.getBoundingClientRect();
  const width = Math.max(canvas.offsetWidth, legend.offsetWidth);
  document.documentElement.dataset.stillSize = `${Math.ceil(width)}x${Math.ceil(bottom)}`;
}

// ---------- selection and drawing ----------

function select(sel, event) {
  event.stopPropagation();
  selected = sel;
  refresh();
}

function refresh() {
  const keys = selected ? screen.lit(selected) : null;
  for (const e of document.querySelectorAll(".canvas [data-key]")) {
    const on = Boolean(keys?.has(e.dataset.key));
    e.classList.toggle("lit", on);
    e.classList.toggle("dim", Boolean(keys) && !on);
    e.classList.toggle("chosen", e.dataset.key === selected?.key && e.tagName !== "path");
    if (e.dataset.arrow) e.setAttribute("marker-end", `url(#arrow${on ? "-lit" : ""})`);
  }
  document.querySelector(".panel").replaceChildren(...screen.panel(selected).filter(Boolean));
}

function render() {
  route = readRoute();
  selected = null;
  const up = above(route);
  document
    .querySelector(".heading")
    .replaceChildren(
      up ? el("a", { class: "back", href: href(up) }, `← ${titleOf(up)}`) : "",
      el("h1", {}, titleOf(route)),
    );
  const canvas = document.querySelector(".canvas");
  canvas.replaceChildren();
  screen = route.focus
    ? drawFocus(canvas, boundaryById.get(route.focus))
    : drawLevel(canvas, frameOf(route));
  document.querySelector(".scroll").scrollTo(0, 0);
  refresh();
  if (STILL) drawLegend(route);
}

document.querySelector(".canvas").addEventListener("click", () => {
  selected = null;
  refresh();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !selected) return;
  selected = null;
  refresh();
});
window.addEventListener("hashchange", render);
document.fonts.ready.then(render);
