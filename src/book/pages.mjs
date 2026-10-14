// What is printed, stamped and pencilled on every face of the book.
// Each face is a list of items in its own flat coordinates: `a` runs across the
// page in reading direction, `v` runs from head to tail (the world y axis).
// scene.mjs draws a list either through one affine matrix (a flat face) or
// point by point through a curling page.
import { PERSON, SECTIONS } from "../content.mjs";
import { W, D, WP, Y0, Y1 } from "./dims.mjs";

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rect = (a0, v0, a1, v1) => [[a0, v0], [a1, v0], [a1, v1], [a0, v1]];
const text = (a, v, t, s, cls, anchor = "middle", ls = 0) => ({ k: "text", a, v, t, s, cls, anchor, ls });
const rule = (a0, a1, v, cls = "pc-rule") => ({ k: "rule", a0, a1, v, cls });
const path = (pts, cls, closed = false) => ({ k: "path", pts, cls, closed });
const fill = (pts, cls) => ({ k: "fill", pts, cls });

// Combed marbling: wavy bands in three tints with a hairline on every boundary.
function marble(a0, a1, v0, v1, seed) {
  const r = rng(seed);
  const items = [];
  const lines = [];
  for (let v = v0 + 6; v < v1 - 3; v += 7.5) {
    const p1 = r() * 6.28, p2 = r() * 6.28, amp = 1.6 + r() * 1.6;
    const pts = [];
    for (let a = a0; a <= a1 + 0.01; a += 3) {
      const wave = amp * Math.sin(a / 8.5 + p1) + 0.9 * Math.sin(a / 2.9 + p2) + 0.5 * Math.sin(a / 1.3 + p1 * 2);
      pts.push([a, Math.max(v0, Math.min(v1, v + wave))]);
    }
    lines.push(pts);
  }
  const edges = [rect(a0, v0, a1, v0).slice(0, 2), ...lines, [[a0, v1], [a1, v1]]];
  const tints = ["pc-marble-a", "pc-marble-b", "pc-marble-c", "pc-marble-b"];
  for (let i = 0; i < edges.length - 1; i++) items.push(fill([...edges[i], ...[...edges[i + 1]].reverse()], tints[i % tints.length]));
  for (const pts of lines) items.push(path(pts, "pc-marble-line"));
  // Feathering: short comb strokes dragged through every third band.
  for (let i = 1; i < lines.length - 1; i += 3) {
    for (let j = 2; j < lines[i].length - 2; j += 4) {
      const [a, v] = lines[i][j];
      const below = lines[i + 1][j][1];
      items.push(path([[a, v], [a + 1.4, (v + below) / 2], [a, below]], "pc-marble-line"));
    }
  }
  return items;
}

function bookplate(cx, top) {
  const w = 52, h = 66, a0 = cx - w / 2, a1 = cx + w / 2, v1 = top + h;
  return [
    fill(rect(a0, top, a1, v1), "pc-plate"),
    path(rect(a0, top, a1, v1), "pc-plate-edge", true),
    path(rect(a0 + 2.6, top + 2.6, a1 - 2.6, v1 - 2.6), "pc-plate-rule", true),
    path(rect(a0 + 3.6, top + 3.6, a1 - 3.6, v1 - 3.6), "pc-plate-rule", true),
    text(cx, top + 14, "EX LIBRIS", 3.2, "pc-mono pc-ink", "middle", 0.9),
    path([[cx - 3, top + 20], [cx, top + 18], [cx + 3, top + 20], [cx, top + 22]], "pc-plate-rule", true),
    text(cx, top + 34, PERSON.first, 8, "pc-display pc-ink"),
    text(cx, top + 42, PERSON.last, 4.6, "pc-display pc-ink", "middle", 0.4),
    rule(cx - 9, cx + 9, top + 48, "pc-plate-rule"),
    text(cx, top + 56, PERSON.githubLabel, 2.6, "pc-mono pc-muted", "middle", 0.2),
  ];
}

// Body text stands in as ruled lines: paragraphs with an indent and a short last line.
function body(items, r, from, to, a0, a1, startAt = 0) {
  let v = from;
  let indent = true;
  let left = 3 + Math.floor(r() * 5);
  let n = 0;
  while (v <= to) {
    const last = left === 1;
    const start = a0 + (n < startAt ? 15 : 0) + (indent && n >= startAt ? 6 : 0);
    const end = last ? start + (a1 - start) * (0.25 + r() * 0.55) : a1 - r() * 2.5;
    items.push(rule(start, end, v));
    indent = last;
    left = last ? 3 + Math.floor(r() * 5) : left - 1;
    v += 6.2;
    n++;
  }
  return v;
}

function textPage({ folio, side, head, opener, pencil, dogEar, seed }) {
  const r = rng(seed);
  const items = [];
  const recto = side === "recto";
  const a0 = 18, a1 = WP - 18;
  items.push(text(WP / 2, Y0 + 13, head.toUpperCase(), 3, "pc-mono pc-muted", "middle", 0.9));
  items.push(text(recto ? a1 : a0, Y1 - 11, String(folio), 3.6, "pc-serif pc-muted", recto ? "end" : "start"));
  let top = Y0 + 26;
  if (opener) {
    items.push(text(a0, Y0 + 44, opener.num, 4, "pc-mono pc-muted", "start", 0.6));
    items.push(text(a0, Y0 + 60, opener.title, 12, "pc-display pc-ink", "start"));
    items.push(rule(a0, a0 + 22, Y0 + 67, "pc-ink-rule"));
    top = Y0 + 82;
    // Drop cap three lines deep, then the first three lines run beside it.
    items.push(text(a0 - 0.6, top + 12.4, opener.cap, 19.5, "pc-display pc-ink", "start"));
  }
  const end = body(items, r, top, Y1 - 26, a0, a1, opener ? 3 : 0);
  if (pencil) {
    const v = top + 6.2 * (opener ? 5 : 7) + 1.4;
    for (let i = 0; i < 2; i++) {
      const pts = [];
      for (let a = a0 + 2; a <= a1 - 6 - i * 30; a += 4) pts.push([a, v + i * 6.2 + Math.sin(a * 0.9 + i) * 0.25]);
      items.push(path(pts, "pc-pencil"));
    }
    const m = recto ? a1 + 7 : a0 - 7;
    items.push(path([[m, v - 5.6], [m + 0.3, v + 3], [m, v + 6.4]], "pc-pencil"));
  }
  if (dogEar) {
    // The top outer corner folded over: the flap shows the back of the leaf.
    const c = recto ? WP : 0, s = 15, dir = recto ? -1 : 1;
    items.push(fill([[c + dir * s, Y0], [c, Y0], [c, Y0 + s]], "pc-under"));
    items.push(path([[c + dir * s, Y0], [c, Y0], [c, Y0 + s]], "pc-under-edge"));
    items.push(fill([[c + dir * s, Y0], [c + dir * s, Y0 + s], [c, Y0 + s]], "pc-flap"));
    items.push(path([[c + dir * s, Y0], [c + dir * s, Y0 + s], [c, Y0 + s], [c + dir * s, Y0]], "pc-flap-edge", true));
  }
  return { items, end };
}

function contentsPage() {
  const items = [];
  items.push(text(WP / 2, Y0 + 40, "Contents", 9, "pc-display pc-ink"));
  items.push(rule(WP / 2 - 10, WP / 2 + 10, Y0 + 47, "pc-ink-rule"));
  SECTIONS.forEach((section, index) => {
    const v = Y0 + 70 + index * 15;
    items.push(text(20, v, section.num, 3.6, "pc-mono pc-muted", "start", 0.4));
    items.push(text(31, v, section.title, 5.6, "pc-display pc-ink", "start"));
    const from = 31 + section.title.length * 5.6 * 0.52 + 3;
    const to = WP - 28;
    const dots = [];
    for (let a = from; a <= to; a += 2.4) dots.push([a, v - 0.4]);
    items.push({ k: "dots", pts: dots, r: 0.36, cls: "pc-leader" });
    items.push(text(WP - 20, v, String(section.page), 5, "pc-serif pc-ink", "end"));
    if (section.id === "projects") items.push(path([[10.5, v - 3], [12.4, v - 0.2], [16.6, v - 6.6]], "pc-pencil"));
  });
  items.push(text(WP / 2, Y1 - 11, "vii", 3.6, "pc-serif pc-muted"));
  return items;
}

function titlePage() {
  const cx = WP / 2;
  return [
    text(cx, Y0 + 80, PERSON.first.toUpperCase(), 10, "pc-display pc-ink", "middle", 1.6),
    text(cx, Y0 + 94, PERSON.last.toUpperCase(), 10, "pc-display pc-ink", "middle", 1.6),
    rule(cx - 12, cx + 12, Y0 + 104, "pc-ink-rule"),
    text(cx, Y0 + 116, PERSON.role, 5.4, "pc-serif pc-ink"),
    text(cx, Y0 + 124, PERSON.focus, 3.8, "pc-serif pc-muted"),
    text(cx, Y1 - 34, PERSON.region.toUpperCase(), 2.8, "pc-mono pc-muted", "middle", 0.8),
    text(cx, Y1 - 26, "MMXXVI", 3, "pc-serif pc-muted", "middle", 0.6),
  ];
}

// The outside of the front board: cloth, hinge groove, bevel, a stamped frame and title.
export function coverOutside() {
  const items = [fill(rect(0, 0, W, D), "pc-cloth")];
  items.push(path([[7, 0], [7, D]], "pc-groove"), path([[8.3, 0], [8.3, D]], "pc-groove-hi"));
  items.push(path([[W - 1.4, 0], [W - 1.4, D - 1.4], [0, D - 1.4]], "pc-bevel"));
  const f = { a0: 18, a1: W - 9, v0: 10, v1: D - 10 };
  items.push(path(rect(f.a0, f.v0, f.a1, f.v1), "pc-stamp-line", true));
  items.push(path(rect(f.a0 + 2.4, f.v0 + 2.4, f.a1 - 2.4, f.v1 - 2.4), "pc-stamp-line", true));
  for (const [a, v, da, dv] of [[f.a0, f.v0, 1, 1], [f.a1, f.v0, -1, 1], [f.a1, f.v1, -1, -1], [f.a0, f.v1, 1, -1]]) {
    const ca = a + da * 7, cv = v + dv * 7;
    items.push(fill([[ca, cv - 2.6], [ca + 2.6, cv], [ca, cv + 2.6], [ca - 2.6, cv]], "pc-stamp"));
    items.push(path([[a + da * 2.4, cv], [ca - da * 2.6, cv]], "pc-stamp-line"), path([[ca, v + dv * 2.4], [ca, cv - dv * 2.6]], "pc-stamp-line"));
  }
  const cx = (f.a0 + f.a1) / 2;
  for (const [t, v, s, ls] of [[PERSON.first, 86, 17, 0.2], [PERSON.last, 103, 12.5, 0.3]]) {
    items.push(text(cx + 0.25, v + 0.35, t, s, "pc-display pc-stamp-hi", "middle", ls));
    items.push(text(cx, v, t, s, "pc-display pc-stamp", "middle", ls));
  }
  items.push(path([[cx - 13, 113], [cx + 13, 113]], "pc-stamp-line"));
  items.push(text(cx + 0.2, 123.3, PERSON.role.toUpperCase(), 3.8, "pc-display pc-stamp-hi", "middle", 1.2));
  items.push(text(cx, 123, PERSON.role.toUpperCase(), 3.8, "pc-display pc-stamp", "middle", 1.2));
  items.push(text(cx, D - 26, "MMXXVI", 3.4, "pc-display pc-stamp", "middle", 0.8));
  return items;
}

// The inside of the front board: cloth turn-ins round a marbled pastedown with a bookplate.
export function coverInside() {
  return [fill(rect(0, 0, W, D), "pc-cloth"), ...marble(4, W - 4, 4, D - 4, 7), path(rect(4, 4, W - 4, D - 4), "pc-marble-edge", true), ...bookplate(W / 2 + 6, 46)];
}

// Every leaf of the book, front (recto, seen on the right) and back (verso, seen on the left).
// Leaf 0 is the free endpaper, leaf 1 carries the contents, the last leaf is the blank
// page the camera flies into.
export function leaves() {
  const list = [];
  list.push({ recto: marble(0, WP, Y0, Y1, 3), verso: titlePage() });
  list.push({ recto: contentsPage(), verso: textPage({ folio: "viii", side: "verso", head: PERSON.name, seed: 11 }).items });
  const openers = new Map(SECTIONS.map((s) => [s.page, s]));
  const chapterAt = (page) => [...SECTIONS].reverse().find((s) => s.page <= page) ?? SECTIONS[0];
  const caps = { experience: "W", projects: "S", skills: "P", education: "C", contact: "A" };
  for (let page = 1; page <= 24; page += 2) {
    const leaf = {};
    for (const [side, folio] of [["recto", page], ["verso", page + 1]]) {
      const opening = openers.get(folio);
      const chapter = chapterAt(folio);
      leaf[side] = textPage({
        folio,
        side,
        head: side === "recto" ? chapter.title : PERSON.name,
        opener: opening ? { num: opening.num, title: opening.title, cap: caps[opening.id] } : null,
        pencil: folio === 9,
        dogEar: folio === 13,
        seed: 100 + folio,
      }).items;
    }
    list.push(leaf);
  }
  list.push({ recto: [], verso: [] });
  return list;
}
