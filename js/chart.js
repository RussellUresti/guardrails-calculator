// ---------- portfolio projection SVG chart ----------
import { fmtK } from "./format.js";

// round up to a "nice" 1/2/5 x 10^n number, for gridline steps
function niceStep(raw) {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw)), base = Math.pow(10, exp), f = raw / base;
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nf * base;
}

export function drawChart(p, now, col, q, coh) {
  const Y = p.years, W = 680, H = 260, L = 56, Rm = 12, T = 12, B = 28, p10 = [], p50 = [], p90 = [], t50 = [];
  for (let y = 0; y <= Y; y++) { const a = col(now.tot, y); p10.push(q(a, 0.1)); p50.push(q(a, 0.5)); p90.push(q(a, 0.9)); t50.push(q(col(now.txb, y), 0.5)); }

  const cohortMax = coh ? Math.max(...coh.best.path, ...coh.median.path, ...coh.worst.path) : 0;
  const ymax = Math.max(...p90, ...p50, ...t50, cohortMax, 1);

  // the 90th-percentile tail can run into tens of millions while the median/taxable lines stay small.
  // a log1p scale (log(v+1)) gives equal visual space to each doubling of value, same as a log scale,
  // but — unlike a plain log — it still has a finite, well-defined position for $0, which matters here
  // since failed simulations and failed cohorts genuinely hit zero.
  const toY = v => Math.log(v + 1), domainMax = toY(ymax) || 1;
  const x = y => L + (y / Y) * (W - L - Rm), yy = v => T + (1 - toY(v) / domainMax) * (H - T - B);
  const line = a => a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1)).join(" ");
  const band = line(p90) + " " + p10.map((v, i) => "L" + x(p10.length - 1 - i).toFixed(1) + " " + yy(p10[p10.length - 1 - i]).toFixed(1)).join(" ") + " Z";

  // gridlines double from a nice base step (0, s, 2s, 4s, 8s, ...) instead of splitting the range evenly,
  // since evenly-split gridlines would bunch up uselessly at the top of a log-scaled axis
  const step = niceStep(ymax / 16), gridVals = [0];
  for (let v = step; v < ymax * 1.001; v *= 2) gridVals.push(v);
  let grid = ""; gridVals.forEach(v => { const yv = yy(v); grid += `<line x1="${L}" x2="${W - Rm}" y1="${yv}" y2="${yv}" stroke="var(--line)"/><text x="${L - 6}" y="${yv + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmtK(v)}</text>`; });

  let xt = ""; const stp = Y > 40 ? 10 : 5; for (let y = 0; y <= Y; y += stp) { xt += `<text x="${x(y)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${Math.round(p.age + y)}</text>`; }
  const ax = x(Math.min(Y, Math.max(0, p.access - p.age)));

  const cohLine = (c, color) => !c ? "" : `<path d="${line(Array.from(c.path))}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="1 3" stroke-linecap="round" opacity="0.9"/>`;
  const cohLines = coh ? cohLine(coh.best, "var(--safe)") + cohLine(coh.median, "var(--raise)") + cohLine(coh.worst, "var(--cut)") : "";

  document.getElementById("chart").innerHTML = grid + xt + `<path d="${band}" fill="var(--safe-soft)"/>` +
    `<line x1="${ax}" x2="${ax}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="4 4"/>` +
    cohLines +
    `<path d="${line(t50)}" fill="none" stroke="var(--cut)" stroke-width="2" stroke-dasharray="6 4"/>` +
    `<path d="${line(p50)}" fill="none" stroke="var(--safe)" stroke-width="2.5"/>`;
}
