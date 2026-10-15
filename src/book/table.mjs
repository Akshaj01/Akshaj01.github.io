// The tabletop the book rests on: one continuous slab of pale oak, with no seams and no
// repeating tile, lying in the floor plane (z = 0) of the book's camera.
//
// It is painted once, before the clock starts, into a canvas laid out in the projected
// space the SVG uses. Each frame the camera only moves and scales that canvas with a CSS
// transform, which the GPU does for free, so the wood costs nothing per frame.

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.trim().slice(i, i + 2), 16));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// floor: { o, ex, ey } – the screen position of the world origin and of one world unit
// along x and y. region: { x, y, w, h } in SVG user units. scale: canvas px per user unit.
export function paintTable(canvas, { floor, region, scale, colors }) {
  const W = Math.max(1, Math.ceil(region.w * scale));
  const H = Math.max(1, Math.ceil(region.h * scale));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return false;
  const base = hex(colors.wood), grain = hex(colors.grain), light = hex(colors.light), shade = hex(colors.shade);

  // World floor coordinates → canvas pixels.
  const m = [floor.ex[0] * scale, floor.ex[1] * scale, floor.ey[0] * scale, floor.ey[1] * scale, (floor.o[0] - region.x) * scale, (floor.o[1] - region.y) * scale];
  const det = m[0] * m[3] - m[1] * m[2];
  const toFloor = ([px, py]) => {
    const x = px - m[4], y = py - m[5];
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
  };
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(toFloor);
  const x0 = Math.min(...corners.map((c) => c[0])) - 20, x1 = Math.max(...corners.map((c) => c[0])) + 20;
  const y0 = Math.min(...corners.map((c) => c[1])) - 20, y1 = Math.max(...corners.map((c) => c[1])) + 20;

  g.fillStyle = rgba(base, 1);
  g.fillRect(0, 0, W, H);
  g.setTransform(...m);
  const r = rng(20261014);

  // Grain runs along x. Neighbouring lines wander together, so the wobble comes from one
  // smooth field; a few arched "cathedral" figures bend the lines around a point, as
  // flat-sawn oak does.
  const waves = Array.from({ length: 4 }, (_, i) => ({ a: 2.2 / (i + 1), fx: 0.004 * (i + 1) * (0.7 + r() * 0.6), fy: 0.006 * (0.5 + r()), p: r() * 6.28 }));
  const arches = Array.from({ length: 7 }, () => ({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), w: 60 + r() * 110, h: 18 + r() * 34, a: 5 + r() * 9 }));
  const field = (x, y) => {
    let d = 0;
    for (const w of waves) d += w.a * Math.sin(x * w.fx + y * w.fy + w.p);
    for (const k of arches) {
      const u = (x - k.x) / k.w, v = (y - k.y) / k.h;
      d += k.a * Math.exp(-v * v) / (1 + u * u * u * u);
    }
    return d;
  };

  // Broad colour streaks: lighter and darker runs of the same board, fading at their edges.
  for (let y = y0; y < y1; ) {
    const h = 6 + r() * 30;
    const tone = r() < 0.5 ? light : shade;
    const a = 0.05 + r() * 0.1;
    const band = g.createLinearGradient(0, y, 0, y + h);
    band.addColorStop(0, rgba(tone, 0));
    band.addColorStop(0.5, rgba(tone, a));
    band.addColorStop(1, rgba(tone, 0));
    g.fillStyle = band;
    g.fillRect(x0, y, x1 - x0, h);
    y += h * (0.4 + r() * 0.5);
  }

  // Growth lines: fine and faint, with a darker latewood line every so often.
  const step = 12;
  for (let y = y0, n = 0; y < y1; y += 1 + r() * 1.6, n++) {
    const late = n % (5 + Math.floor(r() * 6)) === 0;
    g.strokeStyle = rgba(grain, late ? 0.16 + r() * 0.12 : 0.05 + r() * 0.08);
    g.lineWidth = late ? 0.45 + r() * 0.35 : 0.18 + r() * 0.2;
    g.beginPath();
    for (let x = x0; x <= x1 + step; x += step) {
      const yy = y + field(x, y);
      if (x === x0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }

  // Pores: short dashes along the grain, the texture you see up close.
  g.lineCap = "round";
  const pores = Math.round(((x1 - x0) * (y1 - y0)) / 45);
  for (let i = 0; i < pores; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    const yy = y + field(x, y);
    g.strokeStyle = rgba(grain, 0.05 + r() * 0.1);
    g.lineWidth = 0.25 + r() * 0.25;
    g.beginPath();
    g.moveTo(x, yy);
    g.lineTo(x + 0.8 + r() * 2.4, yy + field(x + 2, y) - field(x, y));
    g.stroke();
  }

  // Soft light: brighter where the lamp falls on the book, dimming toward the edges.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const cx = W * colors.focus[0], cy = H * colors.focus[1];
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.62);
  glow.addColorStop(0, rgba(light, 0.22));
  glow.addColorStop(0.55, rgba(light, 0));
  glow.addColorStop(1, rgba(shade, 0.28));
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  return true;
}
