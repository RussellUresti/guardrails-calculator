// ---------- portfolio projection SVG chart ----------
import { fmtK } from "./format.js";

// round up to a "nice" 1/2/5 x 10^n number, for gridline steps
function niceStep(raw) {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw)), base = Math.pow(10, exp), f = raw / base;
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nf * base;
}

// series: [{id, kind:'band'|'line', color, dash, width, data:[...] , p10:[...], p90:[...]}], one entry per legend row
export function drawChart(p, series, hidden) {
  const Y = p.years, W = 680, H = 260, L = 56, Rm = 12, T = 12, B = 28;

  const allVals = series.flatMap(s => s.kind === "band" ? [...s.p10, ...s.p90] : s.data);
  const ymax = Math.max(...allVals, 1);

  // symlog-style scale: pick a base "step" and give $0-to-step one linear unit of space, then each
  // doubling above that (step→2step→4step→...) gets that same one unit — so every gridline gap is
  // visually equal, including the one touching zero.
  const step = niceStep(ymax / 16);
  const units = v => v <= step ? v / step : 1 + Math.log2(v / step);
  const domainMax = units(ymax) || 1;
  const x = y => L + (y / Y) * (W - L - Rm), yy = v => T + (1 - units(v) / domainMax) * (H - T - B);
  const line = a => a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1)).join(" ");

  // gridlines double from that same base step (0, s, 2s, 4s, 8s, ...) instead of splitting the range evenly
  const gridVals = [0];
  for (let v = step; v < ymax * 1.001; v *= 2) gridVals.push(v);
  let grid = ""; gridVals.forEach(v => { const yv = yy(v); grid += `<line x1="${L}" x2="${W - Rm}" y1="${yv}" y2="${yv}" stroke="var(--line)"/><text x="${L - 6}" y="${yv + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmtK(v)}</text>`; });

  let xt = ""; const stp = Y > 40 ? 10 : 5; for (let y = 0; y <= Y; y += stp) { xt += `<text x="${x(y)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${Math.round(p.age + y)}</text>`; }

  // a small marker wherever a line actually hits (and stays at) zero — a spending failure, not just a low point
  const failMarker = (a, color) => {
    for (let i = 1; i < a.length; i++) {
      if (a[i] === 0 && a[i - 1] > 0) return `<circle cx="${x(i)}" cy="${yy(0)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="1"/>`;
    }
    return "";
  };

  let body = "";
  series.forEach(s => {
    if (hidden.has(s.id)) return;
    if (s.kind === "band") {
      const band = line(s.p90) + " " + s.p10.map((v, i) => "L" + x(s.p10.length - 1 - i).toFixed(1) + " " + yy(s.p10[s.p10.length - 1 - i]).toFixed(1)).join(" ") + " Z";
      body += `<path d="${band}" fill="${s.color}" fill-opacity="0.55"/>`;
    } else {
      const dashAttr = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
      body += `<path d="${line(s.data)}" fill="none" stroke="${s.color}" stroke-width="${s.width}"${dashAttr} stroke-linecap="round"/>` + failMarker(s.data, s.color);
    }
  });

  document.getElementById("chart").innerHTML = grid + xt + body;
}
