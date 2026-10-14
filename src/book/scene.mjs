// The hardbound book, drawn with the Anatomy kit's camera and tones.
//
// Everything that moves lives in one cross-section: the x–z plane through the
// book, extruded along y from head to tail. The front board turns rigidly about
// a hinge line, the spine is a strip of cloth stretched between the two boards,
// and every leaf is a curve (a short root bound into the spine, then the page)
// that curls over as it turns. A turned leaf lands on the left-hand pile; the
// last leaf is blank paper, the colour of the site behind it.
import { iso, depthOf, cameraOf, slabOf, solidSvg } from "./kit/iso-kit.mjs";
import { W, D, T, B, G, WP, Y0, Y1, ZR } from "./dims.mjs";
import { leaves, coverOutside, coverInside } from "./pages.mjs";

export const CAMERA = { origin: [0, 0], scale: 4, azimuth: 112, elevation: 46 };
const P = CAMERA;
const cam = cameraOf(P);
const PI = Math.PI;

// Toward the viewer (the same vector depthOf uses) and the light the kit shades by.
const V = [cam.cosE * cam.cosA, cam.cosE * cam.sinA, cam.sinE];
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
const LIGHT = unit([-cam.sinA * 0.55, cam.cosA * 0.55, 1]);
const FLAT = LIGHT[2];

const r2 = (n) => Math.round(n * 100) / 100;
const S = (x, y, z) => iso([x, y, z], P);
const dOf = (pts, closed = false) => (pts.length ? pts.map((p, i) => `${i ? "L" : "M"}${r2(p[0])} ${r2(p[1])}`).join("") + (closed ? "Z" : "") : "");
const sub = (a, b) => a.map((c, i) => c - b[i]);
const lerp = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);
const dot = (a, b) => a.reduce((s, c, i) => s + c * b[i], 0);
const ccw = ([x, z]) => [-z, x];
const n3 = ([x, z]) => [x, 0, z];
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// One unit of world y, projected: it never turns, so it sets the stroke scale of curling pages.
const KY = Math.hypot(...S(0, 1, 0));

function matrixOf(o3, ea3, ev3) {
  const o = S(...o3), a = S(...ea3), v = S(...ev3);
  const f = (n) => Math.round(n * 10000) / 10000;
  return `matrix(${f(a[0])} ${f(a[1])} ${f(v[0])} ${f(v[1])} ${f(o[0])} ${f(o[1])})`;
}

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(pts), upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ---------------------------------------------------------------- colour

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.trim().slice(i, i + 2), 16));
const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(" ")})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function paletteOf(read) {
  const pick = (name, fallback) => hex(read(name) || fallback);
  return {
    paper: pick("--paper", "#f6f4ef"),
    paperShade: pick("--page-shade", "#d9d4c9"),
    cloth: pick("--cloth", "#cdc6b7"),
    clothShade: pick("--cloth-shade", "#9f9787"),
    ribbon: pick("--accent", "#46648c"),
    ribbonShade: pick("--accent-deep", "#2f4868"),
  };
}

// Lambert against the kit's light, normalised so a face lying flat gets exactly `light`:
// the last page lying open is exactly the site's paper colour.
function toneOf(n, light, dark) {
  const t = clamp((FLAT - dot(n, LIGHT)) / (FLAT + 0.3), 0, 1);
  return rgb(mix(light, dark, t));
}

// ---------------------------------------------------------------- printed faces

function contentSvg(items, map, mat, k) {
  let out = "";
  for (const it of items) {
    if (it.k === "fill") out += `<path class="${it.cls}" d="${dOf(it.pts.map((p) => map(p[0], p[1])), true)}"/>`;
    else if (it.k === "path") out += `<path class="${it.cls}" d="${dOf(it.pts.map((p) => map(p[0], p[1])), it.closed)}"/>`;
    else if (it.k === "rule") {
      const pts = [];
      const steps = Math.max(1, Math.ceil((it.a1 - it.a0) / 10));
      for (let i = 0; i <= steps; i++) pts.push(map(it.a0 + ((it.a1 - it.a0) * i) / steps, it.v));
      out += `<path class="${it.cls}" d="${dOf(pts)}"/>`;
    } else if (it.k === "dots") {
      out += `<g class="${it.cls}">${it.pts
        .map((p) => {
          const [x, y] = map(p[0], p[1]);
          return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(it.r * k)}"/>`;
        })
        .join("")}</g>`;
    } else if (it.k === "text") {
      const ls = it.ls ? ` letter-spacing="${it.ls}"` : "";
      out += `<text class="${it.cls}" transform="${mat(it.a, it.v)}" font-size="${it.s}" text-anchor="${it.anchor}"${ls}>${esc(it.t)}</text>`;
    }
  }
  return out;
}

const localCache = new WeakMap();
function localSvg(items) {
  if (!localCache.has(items)) localCache.set(items, contentSvg(items, (a, v) => [a, v], (a, v) => `translate(${a} ${v})`, 1));
  return localCache.get(items);
}

// ---------------------------------------------------------------- the moving parts

// The front board turns about a line between the spine's two hinges, so it lifts off
// the text block and lands flat on the table to the left, a gutter's width away.
const HINGE = [-G / 2, T / 2];
const rot = ([x, z], a) => {
  const dx = x - HINGE[0], dz = z - HINGE[1];
  return [HINGE[0] + dx * Math.cos(a) - dz * Math.sin(a), HINGE[1] + dx * Math.sin(a) + dz * Math.cos(a)];
};

// The spine: cloth from the back board's edge to the front board's hinge, rounded
// while the book is shut and lying flat under the gutter once it is open.
function spineOf(a) {
  const A = [0, 0];
  const H = rot([0, T], a);
  const chord = sub(H, A);
  const len = Math.hypot(...chord);
  const u = chord.map((c) => c / len);
  const n = ccw(u);
  const h = 6.5 * Math.pow(Math.max(0, 1 - a / PI), 1.2);
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const s = i / 18;
    pts.push([A[0] + chord[0] * s + n[0] * h * Math.sin(PI * s), A[1] + chord[1] * s + n[1] * h * Math.sin(PI * s)]);
  }
  const mid = pts[9];
  return { pts, u, n, h, anchor: [mid[0] - n[0] * 2, mid[1] - n[1] * 2] };
}

// A leaf's cross-section at flip progress p (0 lying on the right, 1 landed on the left).
function leafOf(p, zLeft, curl, anchor) {
  const right = [0, ZR], left = [-G, zLeft];
  const vr = sub(right, anchor), vl = sub(left, anchor);
  const ar = Math.atan2(vr[1], vr[0]), al = Math.atan2(vl[1], vl[0]);
  const ang = ar + (al - ar) * p;
  const len = Math.hypot(...vr) + (Math.hypot(...vl) - Math.hypot(...vr)) * p;
  const start = [anchor[0] + Math.cos(ang) * len, anchor[1] + Math.sin(ang) * len];
  const theta = PI * p;
  const c = Math.min(curl * Math.sin(PI * p), 0.85 * theta);
  const N = 28, ds = WP / N;
  const blade = [start];
  for (let j = 1; j <= N; j++) {
    const phi = theta - c * Math.pow((j - 0.5) / N, 1.6);
    const last = blade[j - 1];
    blade.push([last[0] + Math.cos(phi) * ds, last[1] + Math.sin(phi) * ds]);
  }
  const root = [anchor, lerp(anchor, start, 0.5), start];
  return { root, blade, ds };
}

const zLeftOf = (index) => B + 0.32 * (index + 1);

// ---------------------------------------------------------------- the live drawing
//
// Every part is created once, up front, and each frame only rewrites the attributes
// that changed: a path's shape, a group's transform, whether it shows. Rebuilding the
// markup every frame made the browser re-measure every letter on every page 120 times
// a second, which a 120 Hz screen has no time for.

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}

// Writes an attribute only when its value changes; null removes it.
function set(node, name, value) {
  const key = `__${name}`;
  if (node[key] === value) return;
  node[key] = value;
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
// Hidden parts stay laid out (visibility, not display), so a page's text is measured once
// before the animation starts rather than on the frame it first appears.
const show = (node, on) => set(node, "visibility", on ? null : "hidden");

// A face's printed items as live elements, for a page that is curling.
function mappedContent(items, parent) {
  const g = el("g", { class: "bk-mapped", style: `--k:${r2(KY)}` }, parent);
  const parts = items.map((it) => {
    if (it.k === "text") {
      const node = el("text", { class: it.cls, "font-size": it.s, "text-anchor": it.anchor, ...(it.ls ? { "letter-spacing": it.ls } : {}) }, g);
      node.textContent = it.t;
      return { it, node };
    }
    if (it.k === "dots") {
      const node = el("g", { class: it.cls }, g);
      return { it, node, dots: it.pts.map(() => el("circle", { r: r2(it.r * KY) }, node)) };
    }
    if (it.k === "rule") {
      const steps = Math.max(1, Math.ceil((it.a1 - it.a0) / 10));
      const at = Array.from({ length: steps + 1 }, (_, i) => it.a0 + ((it.a1 - it.a0) * i) / steps);
      return { it, node: el("path", { class: it.cls }, g), at };
    }
    return { it, node: el("path", { class: it.cls }, g) };
  });
  function update(map, mat) {
    for (const part of parts) {
      const { it, node } = part;
      if (it.k === "text") set(node, "transform", mat(it.a, it.v));
      else if (it.k === "dots")
        it.pts.forEach((p, i) => {
          const [x, y] = map(p[0], p[1]);
          set(part.dots[i], "cx", r2(x));
          set(part.dots[i], "cy", r2(y));
        });
      else if (it.k === "rule") set(node, "d", dOf(part.at.map((a) => map(a, it.v))));
      else set(node, "d", dOf(it.pts.map((p) => map(p[0], p[1])), it.k === "fill" || it.closed));
    }
  }
  return { g, update, empty: !items.length };
}

// The soft halo under the book, blurred once into an image lying on the table, so the
// camera can move over it without the browser re-blurring it every frame.
function haloImage(plan, color, sigma, parent) {
  const s = 2, pad = sigma * 3;
  const w = plan.w + pad * 2, h = plan.d + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * s);
  canvas.height = Math.ceil(h * s);
  const g = canvas.getContext("2d");
  const off = canvas.width + 40;
  g.shadowColor = color;
  g.shadowBlur = sigma * 2 * s;
  g.shadowOffsetX = off;
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(pad * s - off, pad * s, plan.w * s, plan.d * s, plan.r * s);
  g.fill();
  const group = el("g", { transform: matrixOf([0, 0, 0], [1, 0, 0], [0, 1, 0]) }, parent);
  el("image", { href: canvas.toDataURL("image/png"), x: plan.x - pad, y: plan.y - pad, width: w, height: h, preserveAspectRatio: "none" }, group);
  return group;
}

export const DEFS = `<pattern id="bk-weave" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><path class="pc-weave" d="M0 1.4L1.4 0M-.35 .35L.35 -.35M1.05 1.75L1.75 1.05"/><path class="pc-weave-x" d="M0 0L1.4 1.4"/></pattern>`;

// Builds the book inside `layer` (an SVG <g>) and returns update(state) for each frame.
export function createBook(read, layer) {
  const C = paletteOf(read);
  const LEAVES = leaves();
  const OUTSIDE = coverOutside();
  const INSIDE = coverInside();

  // ---- halos and the parts that never move: back board, text block, page edges, ribbon
  const haloColor = (read("--anatomy-halo") || "#5e594f").trim();
  const haloStrength = parseFloat(read("--anatomy-halo-opacity")) || 0.22;
  const haloClosed = haloImage({ x: -6, y: 2, w: W + 4, d: D + 6, r: 6 }, haloColor, 4, layer);
  const haloOpen = haloImage({ x: -W - G + 2, y: 2, w: 2 * W + G - 4, d: D + 6, r: 6 }, haloColor, 4, layer);
  const back = solidSvg(slabOf({ x: 0, y: 0, w: W, d: D, r: 0.8 }, 0, B, P, 2, 0.6), { tone: "hi", className: "bk-cloth" });
  const block = solidSvg(slabOf({ x: 0, y: Y0, w: WP, d: Y1 - Y0, r: 0 }, B, ZR - B, P, 1), { tone: "mid", className: "bk-block" });
  let edges = "";
  for (let z = B + 0.75; z < ZR - 0.4; z += 0.75) edges += dOf([S(0, Y1, z), S(WP, Y1, z)]) + dOf([S(0, Y0, z), S(0, Y1, z)]);
  const still = el("g", {}, layer);
  still.innerHTML = `${back}${block}<path class="iso-line" data-tone="faint" d="${edges}"/>${ribbonSvg(C)}`;

  // ---- the spine
  const spine = (() => {
    const g = el("g", { class: "bk-spine" }, layer);
    const cavity = el("path", { class: "bk-cavity" }, g);
    const hollow = el("path", {}, el("clipPath", { id: "bk-hollow" }, g));
    const w = r2(1.9 * KY), bead = r2(0.8 * KY);
    const bandGroup = el("g", { "clip-path": "url(#bk-hollow)" }, g);
    const band = el("path", { class: "bk-headband", style: `stroke-width:${w}` }, bandGroup);
    const beads = el("path", { class: "bk-headband-bead", style: `stroke-width:${w};stroke-dasharray:${bead} ${bead}` }, bandGroup);
    const fill = el("path", { class: "iso-fill" }, g);
    const segs = Array.from({ length: 18 }, () => el("path", { "stroke-width": ".35" }, g));
    const bands = el("path", { class: "iso-line", "data-tone": "lo" }, g);
    const crowns = el("path", { class: "bk-crown" }, g);
    const title = el("text", { class: "pc-display pc-stamp", "font-size": "5.2", "text-anchor": "middle", "dominant-baseline": "central", "letter-spacing": "1.1" }, g);
    title.textContent = "SRIRAMBHATLA";
    const outline = el("path", { class: "iso-line", "data-tone": "hi" }, g);

    function update(sp) {
      const { pts } = sp;
      const open = sp.h > 0.6;
      show(cavity, open);
      show(bandGroup, open);
      if (open) {
        const end = dOf(pts.map(([x, z]) => S(x, D, z)), true);
        set(cavity, "d", end);
        set(hollow, "d", end);
        const line = [];
        for (let i = 2; i <= pts.length - 3; i++) line.push(S(pts[i][0] - sp.n[0] * 1.3, Y1 + 0.6, pts[i][1] - sp.n[1] * 1.3));
        set(band, "d", dOf(line));
        set(beads, "d", dOf(line));
        set(bandGroup, "opacity", r2(clamp(sp.h / 4, 0, 1)));
      }
      const on = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const n = n3(unit(ccw(sub(pts[i + 1], pts[i]))));
        on.push(dot(n, V) > 0.002 ? n : null);
      }
      const runs = [];
      on.forEach((n, i) => {
        if (!n) return;
        const last = runs[runs.length - 1];
        if (last && last[1] === i) last[1] = i + 1;
        else runs.push([i, i + 1]);
      });
      let shape = "", lines = "", tops = "";
      const across = (from, to, y, off = 0) => dOf(pts.slice(from, to + 1).map(([x, z]) => S(x + sp.n[0] * off, y, z + sp.n[1] * off)));
      for (const [from, to] of runs) {
        const head = pts.slice(from, to + 1).map(([x, z]) => S(x, 0, z));
        const tail = pts.slice(from, to + 1).map(([x, z]) => S(x, D, z));
        shape += dOf([...head, ...[...tail].reverse()], true);
        for (const y of [0.18, 0.36, 0.54, 0.72, 0.88].map((f) => f * D)) {
          lines += across(from, to, y - 1.4) + across(from, to, y + 1.4);
          tops += across(from, to, y, 0.45);
        }
        lines += across(from, to, D - 2.6);
      }
      set(fill, "d", shape);
      set(outline, "d", shape);
      set(bands, "d", lines);
      set(crowns, "d", tops);
      segs.forEach((node, i) => {
        const n = on[i];
        if (!n) return set(node, "d", "");
        const [a, b] = [pts[i], pts[i + 1]];
        const color = toneOf(n, C.cloth, C.clothShade);
        set(node, "d", dOf([S(a[0], 0, a[1]), S(b[0], 0, b[1]), S(b[0], D, b[1]), S(a[0], D, a[1])], true));
        set(node, "fill", color);
        set(node, "stroke", color);
      });
      const crownOn = Boolean(on[9]);
      show(title, crownOn);
      if (crownOn) {
        const p = pts[9];
        set(title, "transform", matrixOf([p[0] + sp.n[0] * 0.2, 0.45 * D, p[1] + sp.n[1] * 0.2], [0, 1, 0], [sp.u[0], 0, sp.u[1]]));
      }
    }
    return { g, update };
  })();

  // ---- the front board
  const cover = (() => {
    const g = el("g", { class: "bk-cover" }, layer);
    const fill = el("path", { class: "iso-fill" }, g);
    const faces = [[0, 1, "outer"], [1, 2, "edge"], [2, 3, "inner"], [3, 0, "edge"]].map(([i, j, kind]) => ({ i, j, kind, node: el("path", {}, g) }));
    const outside = el("g", {}, g);
    outside.innerHTML = localSvg(OUTSIDE);
    const inside = el("g", {}, g);
    inside.innerHTML = localSvg(INSIDE);
    const tail = el("path", { fill: toneOf([0, 1, 0], C.cloth, C.clothShade) }, g);
    const creases = el("path", { class: "iso-line", "data-tone": "lo" }, g);
    const outline = el("path", { class: "iso-line", "data-tone": "hi" }, g);

    function update(a) {
      const c = [[0, T], [W, T], [W, T - B], [0, T - B]].map((p) => rot(p, a));
      const all = [];
      for (const [x, z] of c) all.push(S(x, 0, z), S(x, D, z));
      const rim = dOf(hull(all), true);
      set(fill, "d", rim);
      set(outline, "d", rim);
      let lines = "", outerOn = false, innerOn = false;
      for (const face of faces) {
        const dir = sub(c[face.j], c[face.i]);
        const n = n3(unit(ccw(dir)));
        if (dot(n, V) <= 0.002) {
          set(face.node, "d", "");
          continue;
        }
        const quad = [S(c[face.i][0], 0, c[face.i][1]), S(c[face.j][0], 0, c[face.j][1]), S(c[face.j][0], D, c[face.j][1]), S(c[face.i][0], D, c[face.i][1])];
        set(face.node, "d", dOf(quad, true));
        set(face.node, "fill", face.kind === "inner" ? rgb(C.paper) : toneOf(n, C.cloth, C.clothShade));
        lines += dOf([quad[0], quad[1]]) + dOf([quad[3], quad[2]]);
        if (face.kind === "outer") {
          outerOn = true;
          set(outside, "transform", matrixOf([c[0][0], 0, c[0][1]], unit(n3(dir)), [0, 1, 0]));
        }
        if (face.kind === "inner") {
          innerOn = true;
          set(inside, "transform", matrixOf([c[2][0], 0, c[2][1]], unit(n3(dir)), [0, 1, 0]));
        }
      }
      show(outside, outerOn);
      show(inside, innerOn);
      set(tail, "d", dOf(c.map(([x, z]) => S(x, D, z)), true));
      set(creases, "d", lines);
    }
    return { g, update };
  })();

  // ---- the leaves
  const ROOT_SEGS = 2;
  const nodes = LEAVES.map((leaf, index) => {
    const g = el("g", { class: "bk-leaf" }, layer);
    show(g, false);
    const quads = Array.from({ length: 30 }, () => el("path", { "stroke-width": ".3" }, g));
    const flatR = el("g", {}, g);
    flatR.innerHTML = localSvg(leaf.recto);
    const flatV = el("g", {}, g);
    flatV.innerHTML = localSvg(leaf.verso);
    const clips = {};
    for (const side of ["recto", "verso"]) {
      const id = `bk-c${side[0]}${index}`;
      clips[side] = { id, path: el("path", {}, el("clipPath", { id }, g)) };
    }
    const mapped = { recto: mappedContent(leaf.recto, g), verso: mappedContent(leaf.verso, g) };
    const edge = el("path", { class: "iso-line", "data-tone": "mid" }, g);
    const zL = zLeftOf(index);
    // Flat faces sit at fixed places, so their transforms never change.
    set(flatR, "transform", matrixOf([0, 0, ZR], [1, 0, 0], [0, 1, 0]));
    set(flatV, "transform", matrixOf([-G - WP, 0, zL], [1, 0, 0], [0, 1, 0]));

    const quadOf = (a, b, root) => {
      const n = n3(unit(ccw(sub(b, a))));
      const facing = dot(n, V);
      const seen = facing >= 0 ? n : n.map((c) => -c);
      const color = root ? rgb(mix(C.paper, C.paperShade, 0.55 + 0.45 * clamp((FLAT - dot(seen, LIGHT)) / (FLAT + 0.3), 0, 1))) : toneOf(seen, C.paper, C.paperShade);
      const pts = [S(a[0], Y0, a[1]), S(b[0], Y0, b[1]), S(b[0], Y1, b[1]), S(a[0], Y1, a[1])];
      return { pts, color, recto: facing >= 0, root, depth: depthOf([(a[0] + b[0]) / 2, (Y0 + Y1) / 2, (a[1] + b[1]) / 2], P) };
    };
    const paint = (list) =>
      quads.forEach((node, k) => {
        const q = list[k];
        if (!q) return set(node, "d", "");
        set(node, "d", dOf(q.pts, true));
        set(node, "fill", q.color);
        set(node, "stroke", q.color);
      });

    function update(p, curl, anchor) {
      const { root, blade, ds } = leafOf(p, zL, curl, anchor);
      const section = [...root, ...blade.slice(1)];
      if (p === 0 || p === 1) {
        // Lying flat: the root into the gutter, then the whole page as one face.
        paint([quadOf(section[0], section[1], true), quadOf(section[1], section[2], true), quadOf(blade[0], blade[blade.length - 1], false)]);
        show(flatR, p === 0);
        show(flatV, p === 1);
        show(mapped.recto.g, false);
        show(mapped.verso.g, false);
      } else {
        const list = [];
        for (let i = 0; i < section.length - 1; i++) list.push(quadOf(section[i], section[i + 1], i < ROOT_SEGS));
        const blades = list.filter((q) => !q.root);
        paint([...list].sort((a, b) => a.depth - b.depth));
        show(flatR, false);
        show(flatV, false);
        const at = (u) => {
          const f = clamp(u / ds, 0, blade.length - 1.0001);
          const i = Math.floor(f), t = f - i;
          return { pt: lerp(blade[i], blade[i + 1], t), tan: unit(sub(blade[i + 1], blade[i])) };
        };
        for (const side of ["recto", "verso"]) {
          const content = mapped[side];
          const shown = blades.filter((q) => q.recto === (side === "recto"));
          const on = !content.empty && shown.length > 0;
          show(content.g, on);
          if (!on) continue;
          if (shown.length < blades.length) {
            set(clips[side].path, "d", shown.map((q) => dOf(q.pts, true)).join(""));
            set(content.g, "clip-path", `url(#${clips[side].id})`);
          } else set(content.g, "clip-path", null);
          const u = (a) => (side === "recto" ? a : WP - a);
          content.update(
            (a, v) => {
              const { pt } = at(u(a));
              return S(pt[0], v, pt[1]);
            },
            (a, v) => {
              const { pt, tan } = at(u(a));
              const ea = side === "recto" ? [tan[0], 0, tan[1]] : [-tan[0], 0, -tan[1]];
              return matrixOf([pt[0], v, pt[1]], ea, [0, 1, 0]);
            },
          );
        }
      }
      const tip = section[section.length - 1];
      set(edge, "d", dOf(section.map(([x, z]) => S(x, Y0, z))) + dOf(section.map(([x, z]) => S(x, Y1, z))) + dOf([S(tip[0], Y0, tip[1]), S(tip[0], Y1, tip[1])]));
    }
    return { g, update, flat: -1 };
  });

  // ---- painter's order: re-append only when it changes (a leaf lifts or lands)
  const beta = Math.atan2(V[2], V[0]);
  let order = [];
  function update(state) {
    const a = state.cover;
    const sp = spineOf(a);
    const open = clamp(a / PI, 0, 1);
    const smooth = (a0, a1, x) => {
      const u = clamp((x - a0) / (a1 - a0), 0, 1);
      return u * u * (3 - 2 * u);
    };
    set(haloClosed, "opacity", r2(haloStrength * (1 - smooth(0, 0.45, open))));
    set(haloOpen, "opacity", r2(haloStrength * smooth(0.72, 1, open)));
    spine.update(sp);
    cover.update(a);

    const top = state.flips.findIndex((p) => p === 0);
    const landed = [], flying = [];
    state.flips.forEach((p, i) => {
      if (p >= 1) landed.push(i);
      else if (p > 0) flying.push(i);
    });
    flying.sort((x, y) => Math.abs(state.flips[y] * PI - beta) - Math.abs(state.flips[x] * PI - beta));

    // A leaf that is lying still (or hidden under another) keeps its shape until the cover moves.
    nodes.forEach((leaf, i) => {
      const p = state.flips[i];
      const visible = i === top || p > 0;
      show(leaf.g, visible);
      if (!visible) return;
      const flat = p === 0 || p >= 1;
      const key = flat ? `${p >= 1 ? 1 : 0}|${r2(a)}` : null;
      if (flat && leaf.flat === key) return;
      leaf.flat = key;
      leaf.update(p >= 1 ? 1 : p, state.curls[i], sp.anchor);
    });

    const next = [haloClosed, haloOpen, still];
    if (top >= 0) next.push(...(a <= PI / 2 ? [nodes[top].g, spine.g] : [spine.g, nodes[top].g]));
    else next.push(spine.g);
    next.push(cover.g, ...landed.map((i) => nodes[i].g), ...flying.map((i) => nodes[i].g));
    if (next.length !== order.length || next.some((node, k) => node !== order[k])) {
      for (const node of next) layer.append(node);
      order = next;
    }
  }

  // Screen boxes for the camera: the shut book, the open spread, and the blank last page.
  const boxOf = (pts) => {
    const s = pts.map((p) => S(...p));
    const xs = s.map((q) => q[0]), ys = s.map((q) => q[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const cube = (x0, x1, y0, y1, z0, z1) => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z])));
  const boxes = {
    closed: boxOf(cube(-8, W, 0, D + 30, 0, T)),
    open: boxOf(cube(-W - G, W, 0, D + 30, 0, ZR)),
    right: boxOf(cube(-G, W, 0, D + 30, 0, ZR)),
    page: [[0, Y0, ZR], [WP, Y0, ZR], [WP, Y1, ZR], [0, Y1, ZR]].map((p) => S(...p)),
  };

  return { update, boxes, leafCount: LEAVES.length };
}

// The silk ribbon marker: out of the tail between the leaves, over the back board's
// edge and onto the table, ending in a swallowtail. It is the one lit part.
function ribbonSvg(C) {
  const x0 = 41, x1 = 46.5;
  const path = [[Y1 - 0.2, 15.5], [Y1 + 0.9, 14.6], [D + 0.4, 10], [D + 1.0, 6], [D + 1.7, 2.8], [D + 2.8, 0.8], [D + 5, 0.15], [D + 12, 0.1], [D + 24, 0.1]];
  let out = "";
  for (let i = 0; i < path.length - 1; i++) {
    const [ya, za] = path[i], [yb, zb] = path[i + 1];
    const d = unit([0, yb - ya, zb - za]);
    let n = [0, -d[2], d[1]];
    if (dot(n, V) < 0) n = n.map((c) => -c);
    const fillc = toneOf(n, C.ribbon, C.ribbonShade);
    out += `<path d="${dOf([S(x0, ya, za), S(x1, ya, za), S(x1, yb, zb), S(x0, yb, zb)], true)}" fill="${fillc}" stroke="${fillc}" stroke-width=".3"/>`;
  }
  const [ye, ze] = path[path.length - 1];
  const mid = (x0 + x1) / 2;
  const tailPts = [S(x0, ye, ze), S(x1, ye, ze), S(x1, ye + 7, ze), S(mid, ye + 3.6, ze), S(x0, ye + 7, ze)];
  out += `<path d="${dOf(tailPts, true)}" fill="${toneOf([0, 0, 1], C.ribbon, C.ribbonShade)}"/>`;
  const side = (x) => path.map(([y, z]) => S(x, y, z));
  out += `<path class="iso-line" data-tone="lit" d="${dOf([...side(x0), S(x0, ye + 7, ze), S(mid, ye + 3.6, ze), S(x1, ye + 7, ze), ...[...side(x1)].reverse()])}"/>`;
  return `<g class="bk-ribbon">${out}</g>`;
}
