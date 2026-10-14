// Plays the intro in a real, visible Chrome window (GPU, real refresh rate) with a
// throwaway profile, and reports every frame that arrived late.
//
//   npm run serve                      (in another terminal)
//   node --experimental-websocket scripts/frame-check.mjs [url] [width] [height]
//
// Headless Chrome can't do this: its frame clock is simulated, so every frame looks on
// time however long it took to draw. Set CHROME_PATH if Chrome isn't in /Applications.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url = "http://localhost:4173/?intro", width = "1200", height = "800"] = process.argv.slice(2);
const binary = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = mkdtempSync(join(tmpdir(), "frame-check-"));
const chrome = spawn(binary, [
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check",
  // Keep drawing at full rate even if the window opens behind others.
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
  `--window-size=${width},${height}`, "--window-position=40,40", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    const file = join(profile, "DevToolsActivePort");
    if (existsSync(file)) port = readFileSync(file, "utf8").split("\n")[0];
  }
  if (!port) throw new Error("Chrome did not start");
  const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    waiting.get(m.id)?.(m);
    waiting.delete(m.id);
  });
  const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

  await send("Page.enable");
  await send("Page.bringToFront");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: readFileSync(new URL("./frame-probe.js", import.meta.url), "utf8") });
  await send("Page.navigate", { url });
  for (let i = 0; i < 150 && !(await evaluate("performance.getEntriesByName('intro-leave').length")); i++) await sleep(100);

  const r = await evaluate(`(() => {
    const start = performance.getEntriesByName("intro-first-frame")[0].startTime;
    const end = performance.getEntriesByName("intro-leave")[0].startTime;
    const gaps = __gaps.filter(([t]) => t > start && t <= end);
    const sorted = gaps.map(([, g]) => g).sort((a, b) => a - b);
    const refresh = sorted[Math.floor(sorted.length / 2)];
    const late = gaps.filter(([, g]) => g > refresh * 1.5).map(([t, g]) => Math.round(t - start) + "ms (" + g.toFixed(1) + ")");
    return { viewport: innerWidth + "×" + innerHeight + " @" + devicePixelRatio + "x", refreshMs: +refresh.toFixed(1), frames: gaps.length, late,
      scriptMsPerFrame: +(__introStats.ms / __introStats.frames).toFixed(2), halfRate: Boolean(__introStats.half) };
  })()`);
  console.log(`${r.viewport} · refresh ${r.refreshMs} ms · ${r.frames} frames · ${r.late.length} late · script ${r.scriptMsPerFrame} ms/frame${r.halfRate ? " · fell back to half rate" : ""}`);
  if (r.late.length) console.log(`late frames (time into intro, frame length): ${r.late.join(", ")}`);
  ws.close();
} finally {
  chrome.kill();
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}
