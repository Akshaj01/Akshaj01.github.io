// Injected before the page loads by frame-check.mjs: records the gap between every frame
// the browser presents, so dropped frames show up as gaps of two refreshes or more.
window.__gaps = [];
let last = 0;
const loop = (t) => {
  if (last) window.__gaps.push([t, t - last]);
  last = t;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
