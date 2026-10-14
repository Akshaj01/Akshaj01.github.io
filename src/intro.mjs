// The opening animation: the book settles in, the cover opens, one leaf turns onto
// the contents, the rest riffle past while the camera drives into the last page,
// and that page, being the site's own paper, hands over to the site.
import { createBook, DEFS } from "./book/scene.mjs";

const html = document.documentElement;
const root = document.getElementById("intro");
const params = new URLSearchParams(location.search);
const still = matchMedia("(prefers-reduced-motion: reduce)");

// Milliseconds from the first frame.
const TIME = {
  settle: 450,
  open: [450, 1650],
  turn: [1750, 2700],
  riffle: 3050,
  push: [3050, 4950],
  leave: 4880,
};
const RIFFLE = { first: 1, gap: 250, gapDecay: 0.86, dur: 620, durDecay: 0.9, least: 240 };
// With reduced motion asked for, nothing moves: the shut book fades in, rests for this
// long, and dissolves into the site (opacity only, in site.css).
const GENTLE_HOLD = 1900;

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
// A board or leaf lifted slowly, then falling under its own weight: lands still moving.
const fall = (h) => 2 * h * h - h * h * h;

function coverAt(t) {
  const u = span(t, TIME.open);
  if (u <= 0.8) return Math.PI * fall(u / 0.8);
  const s = (u - 0.8) / 0.2;
  return Math.PI - 0.07 * Math.sin(Math.PI * s) * (1 - s);
}

function schedule(count) {
  const plan = [{ at: TIME.turn[0], dur: TIME.turn[1] - TIME.turn[0], curl: 1.05 }];
  let at = TIME.riffle;
  for (let i = RIFFLE.first; i < count - 1; i++) {
    const k = i - RIFFLE.first;
    plan.push({ at, dur: Math.max(RIFFLE.least, RIFFLE.dur * Math.pow(RIFFLE.durDecay, k)), curl: 0.85 });
    at += RIFFLE.gap * Math.pow(RIFFLE.gapDecay, k);
  }
  plan.push({ at: Infinity, dur: 1, curl: 0 }); // the blank last page never turns
  return plan;
}

function stateAt(t, plan) {
  return {
    cover: coverAt(t),
    flips: plan.map(({ at, dur }) => (t <= at ? 0 : t >= at + dur ? 1 : fall((t - at) / dur))),
    curls: plan.map((p) => p.curl),
  };
}

// ---------------------------------------------------------------- camera

const viewOf = (box, fill, aspect) => {
  const w = Math.max((box.x1 - box.x0) / fill, ((box.y1 - box.y0) / fill) * aspect);
  return { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, w };
};
const mixView = (a, b, t) => ({ cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, w: a.w * Math.pow(b.w / a.w, t) });

// The largest view of this aspect, centred on the page, that the page covers completely.
function insidePage(page, aspect) {
  const cx = page.reduce((s, p) => s + p[0], 0) / 4, cy = page.reduce((s, p) => s + p[1], 0) / 4;
  const inside = ([x, y]) =>
    page.every((a, i) => {
      const b = page[(i + 1) % 4];
      return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
    }) ||
    page.every((a, i) => {
      const b = page[(i + 1) % 4];
      return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) <= 0;
    });
  let lo = 0, hi = 4000;
  for (let i = 0; i < 40; i++) {
    const hw = (lo + hi) / 2, hh = hw / aspect;
    const ok = [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => inside([cx + sx * hw, cy + sy * hh]));
    if (ok) lo = hw;
    else hi = hw;
  }
  return { cx, cy, w: lo * 2 };
}

function cameraAt(t, boxes, aspect) {
  // On a tall phone screen the spread is too wide to read whole, so the camera
  // frames the right-hand page and lets the left one run off the edge.
  const tall = aspect < 0.85;
  const closed = viewOf(boxes.closed, tall ? 0.78 : 0.5, aspect);
  const open = tall ? viewOf(boxes.right, 0.96, aspect) : viewOf(boxes.open, 0.84, aspect);
  open.cy -= (open.w / aspect) * 0.05; // leave headroom for a leaf standing upright
  const page = insidePage(boxes.page, aspect);
  const hold = { cx: open.cx + (page.cx - open.cx) * 0.22, cy: open.cy + (page.cy - open.cy) * 0.22, w: open.w * 0.86 };
  if (t < TIME.open[0]) return closed;
  if (t < TIME.open[1]) return mixView(closed, open, ease(span(t, TIME.open)));
  if (t < TIME.push[0]) return mixView(open, hold, ease(span(t, [TIME.open[1], TIME.push[0]])));
  // The drive-in: distance to the page closes at an accelerating rate, so the
  // apparent size grows like a car's coming at the camera and past it.
  const end = page.w * 0.5;
  const zf = hold.w / end;
  const e = Math.pow(span(t, TIME.push), 2.3);
  const z = 1 / (1 - (1 - 1 / zf) * e);
  return { cx: page.cx + (hold.cx - page.cx) / z, cy: page.cy + (hold.cy - page.cy) / z, w: hold.w / z };
}

// ---------------------------------------------------------------- playing it

let playing = false;

function shouldPlay() {
  if (!root) return false;
  if (params.has("intro") || params.has("t")) return true;
  try {
    return sessionStorage.getItem("intro-seen") !== "1";
  } catch {
    return true;
  }
}

async function fontsReady() {
  if (!document.fonts) return;
  const loads = ['500 12px "Outfit"', '400 12px "Source Serif 4"'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 600))]);
}

async function play() {
  if (playing) return;
  playing = true;
  window.scrollTo(0, 0);
  html.classList.remove("intro-done");
  html.classList.add("intro-playing");
  html.classList.remove("intro-pending");
  root.hidden = false;
  root.classList.remove("is-leaving");

  const svg = root.querySelector("svg");
  svg.classList.remove("is-in");
  svg.innerHTML = `<defs>${DEFS}</defs><g class="bk-dyn"></g>`;
  const css = getComputedStyle(root);
  await fontsReady();
  const book = createBook((name) => css.getPropertyValue(name), svg.lastElementChild);
  const plan = schedule(book.leafCount);

  const draw = (t) => {
    const aspect = Math.max(0.3, root.clientWidth / Math.max(1, root.clientHeight));
    const view = cameraAt(t, book.boxes, aspect);
    const h = view.w / aspect;
    svg.setAttribute("viewBox", `${(view.cx - view.w / 2).toFixed(3)} ${(view.cy - h / 2).toFixed(3)} ${view.w.toFixed(3)} ${h.toFixed(3)}`);
    book.update(stateAt(t, plan));
  };

  if (params.has("t")) {
    // A frozen frame for screenshots: ?t=2200
    draw(Number(params.get("t")));
    svg.classList.add("is-in");
    return;
  }

  // Draw the first frame and let the browser paint it (nearly invisible) before the
  // clock starts, so the cost of the first paint can't eat into the animation.
  draw(0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  svg.classList.add("is-in");

  let start = 0, raf = 0, left = false;
  const stats = (window.__introStats = { frames: 0, ms: 0 });
  const stop = () => {
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey);
  };
  const leave = (fast) => {
    if (left) return;
    left = true;
    performance.mark("intro-leave");
    root.classList.toggle("is-fast", Boolean(fast));
    root.classList.add("is-leaving");
    html.classList.remove("intro-playing");
    html.classList.add("intro-done");
    try {
      sessionStorage.setItem("intro-seen", "1");
    } catch {}
    setTimeout(() => {
      stop();
      root.hidden = true;
      playing = false;
    }, fast ? 320 : still.matches ? 720 : 480);
  };
  const onKey = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      leave(true);
    }
  };
  addEventListener("keydown", onKey);
  root.querySelector(".intro-skip").onclick = () => leave(true);

  if (still.matches) {
    performance.mark("intro-first-frame");
    setTimeout(() => leave(false), GENTLE_HOLD);
    return;
  }

  // If this screen keeps missing its frames (a 120 Hz display on a busy machine), drop
  // to drawing every other refresh: an even 60 fps reads smoother than 120 with gaps.
  const pace = { last: 0, gaps: [], late: 0, half: false, skip: false };
  const paced = (now) => {
    if (pace.last) {
      const gap = now - pace.last;
      if (pace.gaps.length < 12) pace.gaps.push(gap);
      else if (!pace.half) {
        const refresh = [...pace.gaps].sort((a, b) => a - b)[6];
        pace.late = gap > refresh * 1.5 ? pace.late + 1 : Math.max(0, pace.late - 0.25);
        if (refresh < 12 && pace.late >= 4) pace.half = true;
      }
    }
    pace.last = now;
    if (!pace.half) return true;
    pace.skip = !pace.skip;
    return !pace.skip;
  };

  const tick = (now) => {
    if (!start) {
      start = now;
      performance.mark("intro-first-frame");
    }
    const t = now - start;
    if (paced(now)) {
      const t0 = performance.now();
      draw(Math.min(t, TIME.push[1]));
      stats.frames++;
      stats.ms += performance.now() - t0;
    }
    stats.half = pace.half;
    if (t >= TIME.leave) leave(false);
    if (t < TIME.push[1] + 400) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

if (shouldPlay()) play();
else {
  html.classList.remove("intro-pending");
  if (root) root.hidden = true;
}

document.querySelector("[data-replay]")?.addEventListener("click", () => play());
