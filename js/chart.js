// ---------- portfolio projection SVG chart ----------
import { fmtK } from "./format.js";

export function drawChart(p, now, col, q, coh) {
  const Y = p.years, W = 680, H = 260, L = 56, Rm = 12, T = 12, B = 28, p10 = [], p50 = [], p90 = [], t50 = [];
  for (let y = 0; y <= Y; y++) { const a = col(now.tot, y); p10.push(q(a, 0.1)); p50.push(q(a, 0.5)); p90.push(q(a, 0.9)); t50.push(q(col(now.txb, y), 0.5)); }

  // the 90th-percentile tail can run into tens of millions on long/volatile plans, which would otherwise
  // squash the median and taxable lines into the bottom few pixels. Cap the axis to a multiple of the
  // central (median) lines' own peak instead, and let the percentile band run off the top when it's wider than that.
  const trueMax = Math.max(...p90, 1), centerPeak = Math.max(...p50, ...t50, 1);
  const cap = centerPeak * 3;
  const ymax = Math.min(trueMax, cap) * 1.05;
  const clipped = trueMax * 1.05 > ymax;
  const cl = v => Math.min(v, ymax);

  const x = y => L + (y / Y) * (W - L - Rm), yy = v => T + (1 - cl(v) / ymax) * (H - T - B);
  const line = a => a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1)).join(" ");
  const band = line(p90) + " " + p10.map((v, i) => "L" + x(p10.length - 1 - i).toFixed(1) + " " + yy(p10[p10.length - 1 - i]).toFixed(1)).join(" ") + " Z";
  let grid = ""; for (let k = 0; k <= 4; k++) { const v = ymax * k / 4, yv = yy(v); grid += `<line x1="${L}" x2="${W - Rm}" y1="${yv}" y2="${yv}" stroke="var(--line)"/><text x="${L - 6}" y="${yv + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmtK(v)}</text>`; }
  let xt = ""; const stp = Y > 40 ? 10 : 5; for (let y = 0; y <= Y; y += stp) { xt += `<text x="${x(y)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${Math.round(p.age + y)}</text>`; }
  const ax = x(Math.min(Y, Math.max(0, p.access - p.age)));

  const cohLine = (c, color) => !c ? "" : `<path d="${line(Array.from(c.path))}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="1 3" stroke-linecap="round" opacity="0.9"/>`;
  const cohLines = coh ? cohLine(coh.best, "var(--safe)") + cohLine(coh.median, "var(--raise)") + cohLine(coh.worst, "var(--cut)") : "";

  const clipNote = clipped ? `<text x="${W - Rm}" y="${T + 10}" text-anchor="end" font-size="11" fill="var(--muted)">90th pct peaks at ${fmtK(trueMax)} ↑</text>` : "";

  document.getElementById("chart").innerHTML = grid + xt + `<path d="${band}" fill="var(--safe-soft)"/>` +
    `<line x1="${ax}" x2="${ax}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="4 4"/>` +
    cohLines +
    `<path d="${line(t50)}" fill="none" stroke="var(--cut)" stroke-width="2" stroke-dasharray="6 4"/>` +
    `<path d="${line(p50)}" fill="none" stroke="var(--safe)" stroke-width="2.5"/>` +
    clipNote;
}
