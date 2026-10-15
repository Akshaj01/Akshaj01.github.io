// The opening animation: the book settles in, the cover opens, one leaf turns onto
// the contents, the rest riffle past while the camera drives into the last page,
// and that page, being the site's own paper, hands over to the site.
// The book's code (about 30 KB) is imported only when the intro actually plays, so a
// returning visitor downloads none of it.

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

// The camera's key framings depend only on the window's shape, so they are worked out
// once per shape rather than every frame.
const framings = new Map();
function framingOf(boxes, aspect) {
  const key = aspect.toFixed(4);
  if (framings.has(key)) return framings.get(key);
  // On a tall phone screen the spread is too wide to read whole, so the camera
  // frames the right-hand page and lets the left one run off the edge.
  const tall = aspect < 0.85;
  // ?fill=0.8 frames the shut book larger, for the share image.
  const closed = viewOf(boxes.closed, Number(params.get("fill")) || (tall ? 0.78 : 0.5), aspect);
  const open = tall ? viewOf(boxes.right, 0.96, aspect) : viewOf(boxes.open, 0.84, aspect);
  open.cy -= (open.w / aspect) * 0.05; // leave headroom for a leaf standing upright
  const page = insidePage(boxes.page, aspect);
  const hold = { cx: open.cx + (page.cx - open.cx) * 0.22, cy: open.cy + (page.cy - open.cy) * 0.22, w: open.w * 0.86 };
  const framing = { closed, open, page, hold };
  framings.set(key, framing);
  return framing;
}

function cameraAt(t, boxes, aspect) {
  const { closed, open, page, hold } = framingOf(boxes, aspect);
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

// ?stats: after the intro, show how smoothly this device played it. The only way to know
// on a real phone; normal visits never run this.
function frameMeter() {
  const gaps = [];
  let last = 0, on = true;
  const loop = (t) => {
    if (last) gaps.push(t - last);
    last = t;
    if (on) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => {
    on = false;
    const sorted = [...gaps].sort((a, b) => a - b);
    const typical = sorted[sorted.length >> 1] || 16.7;
    const slow = gaps.filter((g) => g > typical * 1.5).length;
    const box = document.createElement("p");
    box.className = "intro-stats";
    box.textContent = `Intro on this device: ${Math.round(1000 / typical)} fps · ${gaps.length} frames · ${slow} slow · worst ${Math.round(sorted[sorted.length - 1] || 0)} ms`;
    document.body.append(box);
  };
}

let playing = false;

function shouldPlay() {
  if (!root) return false;
  if (params.has("intro") || params.has("t")) return true;
  // The page was already handed back because the intro took too long to load.
  if (html.hasAttribute("data-intro-late")) return false;
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

// If anything goes wrong (an old browser, a failed download), get out of the way.
function bail(error) {
  console.warn("intro skipped:", error);
  html.classList.remove("intro-pending", "intro-playing");
  html.classList.add("intro-done");
  if (root) root.hidden = true;
  playing = false;
}

async function play() {
  if (playing) return;
  playing = true;
  try {
    await run();
  } catch (error) {
    bail(error);
  }
}

async function run() {
  window.scrollTo(0, 0);
  html.classList.remove("intro-done");
  html.classList.add("intro-playing");
  html.classList.remove("intro-pending");
  root.hidden = false;
  root.classList.remove("is-leaving");

  const svg = root.querySelector("svg");
  svg.classList.remove("is-in");
  const [{ createBook, DEFS, FLOOR }, { paintTable }] = await Promise.all([import("./book/scene.mjs"), import("./book/table.mjs")]);
  svg.innerHTML = `<defs>${DEFS}</defs><g class="bk-dyn"></g>`;
  const css = getComputedStyle(root);
  await fontsReady();
  const book = createBook((name) => css.getPropertyValue(name), svg.lastElementChild);
  const plan = schedule(book.leafCount);

  // The tabletop: painted once over everything the camera sees before it dives into
  // the page, at the sharpest scale it is seen at, then only moved and scaled.
  const table = root.querySelector(".table");
  // The window's size, read once and on resize: reading it inside a frame, after the
  // drawing has changed, would force the browser to lay the page out mid-frame.
  const size = { w: root.clientWidth, h: Math.max(1, root.clientHeight) };
  const onResize = () => {
    size.w = root.clientWidth;
    size.h = Math.max(1, root.clientHeight);
  };
  addEventListener("resize", onResize);
  const aspect0 = Math.max(0.3, size.w / size.h);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const seen = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, sharp: 0 };
  for (let t = 0; t <= TIME.push[0] + 300; t += 40) {
    const v = cameraAt(t, book.boxes, aspect0), h = v.w / aspect0;
    seen.x0 = Math.min(seen.x0, v.cx - v.w / 2);
    seen.x1 = Math.max(seen.x1, v.cx + v.w / 2);
    seen.y0 = Math.min(seen.y0, v.cy - h / 2);
    seen.y1 = Math.max(seen.y1, v.cy + h / 2);
    seen.sharp = Math.max(seen.sharp, (size.w * dpr) / v.w);
  }
  const pad = (seen.x1 - seen.x0) * 0.06;
  const region = { x: seen.x0 - pad, y: seen.y0 - pad, w: seen.x1 - seen.x0 + pad * 2, h: seen.y1 - seen.y0 + pad * 2 };
  // Stay inside what every browser allows for one canvas (about 16.7 million pixels).
  const scale = Math.min(seen.sharp, 4096 / Math.max(region.w, region.h), Math.sqrt(16e6 / (region.w * region.h)));
  const book0 = book.boxes.closed;
  performance.mark("table-start");
  const painted = table && paintTable(table, {
    floor: FLOOR,
    region,
    scale,
    colors: {
      wood: css.getPropertyValue("--wood"),
      grain: css.getPropertyValue("--wood-grain"),
      light: css.getPropertyValue("--wood-light"),
      shade: css.getPropertyValue("--wood-shade"),
      focus: [((book0.x0 + book0.x1) / 2 - region.x) / region.w, ((book0.y0 + book0.y1) / 2 - region.y) / region.h],
    },
  });
  performance.measure("table-paint", "table-start");
  const unit = scale / dpr; // CSS px per user unit, as painted
  if (painted) {
    table.style.width = `${(region.w * unit).toFixed(1)}px`;
    table.style.height = `${(region.h * unit).toFixed(1)}px`;
    table.classList.add("is-ready");
  }

  const draw = (t) => {
    const aspect = Math.max(0.3, size.w / size.h);
    const view = cameraAt(t, book.boxes, aspect);
    const h = view.w / aspect;
    const vx = view.cx - view.w / 2, vy = view.cy - h / 2;
    svg.setAttribute("viewBox", `${vx.toFixed(3)} ${vy.toFixed(3)} ${view.w.toFixed(3)} ${h.toFixed(3)}`);
    if (painted) {
      // Once the camera is inside the last page, no wood is visible: stop compositing it.
      const { page } = framingOf(book.boxes, aspect);
      const covered = t > TIME.push[0] && view.w <= page.w * 0.96 && Math.abs(view.cx - page.cx) < page.w * 0.02 && Math.abs(view.cy - page.cy) < (page.w * 0.02) / aspect;
      table.style.visibility = covered ? "hidden" : "";
      if (!covered) {
        const k = size.w / view.w;
        table.style.transform = `translate(${((region.x - vx) * k).toFixed(2)}px, ${((region.y - vy) * k).toFixed(2)}px) scale(${(k / unit).toFixed(5)})`;
      }
    }
    book.update(stateAt(t, plan));
  };

  if (params.has("t")) {
    // A frozen frame for screenshots (and the share image): ?t=2200
    root.querySelector(".intro-skip").hidden = true;
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
    removeEventListener("resize", onResize);
  };
  const leave = (fast) => {
    if (left) return;
    left = true;
    performance.mark("intro-leave");
    meter?.();
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
      const table = root.querySelector(".table");
      if (table) {
        table.width = table.height = 0; // free the canvas memory
        table.classList.remove("is-ready");
      }
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

  const meter = params.has("stats") ? frameMeter() : null;

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
