// ---------- historical & projected return assumptions ----------
import { mean, sd, corr, arithFromGeo } from "./stats.js";

export const LEVELS = { pess: "Pessimistic", cons: "Consensus", opt: "Optimistic" };

let HIST = null; // array of {year, stock, cash, bond, inflation}, nominal %
let CMA = null;  // capital market assumptions (projected forecasts)

// converts raw nominal HIST rows into real (inflation-adjusted) decimal returns
export function init(historicalReturns, marketAssumptions) {
  HIST = historicalReturns.map(({ year, stock, cash, bond, inflation }) => ({
    y: year,
    s: (1 + stock / 100) / (1 + inflation / 100) - 1,
    c: (1 + cash / 100) / (1 + inflation / 100) - 1,
    b: (1 + bond / 100) / (1 + inflation / 100) - 1,
  }));
  CMA = marketAssumptions;
}

export function eqOpts() {
  return {
    eq: document.getElementById("eq").value,
    usW: Math.min(1, Math.max(0, (parseFloat(document.getElementById("usW").value) || 0) / 100)),
    hc: (parseFloat(document.getElementById("hc").value) || 0) / 100,
  };
}

export function globalStocks(usW) {
  return CMA.globalStockForecasts.map(f => {
    if (f.direct != null) return [f.source, f.direct];
    const ex = f.exUs != null ? f.exUs : 0.75 * f.developed + 0.25 * f.emerging;
    return [f.source, usW * f.us + (1 - usW) * ex];
  });
}

export const hcTxt = o => (o.hc * 100).toFixed(2).replace(/\.?0+$/, "");

export function overallMix(tax, cash, ret, tStockPct, rStockPct) {
  const ts = Math.min(1, Math.max(0, tStockPct / 100));
  const rs = Math.min(1, Math.max(0, rStockPct / 100));
  const tot = tax + cash + ret || 1;
  return { s: (tax * ts + ret * rs) / tot, b: (tax * (1 - ts) + ret * (1 - rs)) / tot, c: cash / tot };
}

export function histWindows(mix, opts, L = 50) {
  const out = [], hc = opts && opts.eq === "global" ? opts.hc : 0;
  const D = hc ? HIST.map(x => ({ ...x, s: x.s - hc })) : HIST;
  for (let k = 0; k + L <= D.length; k++) {
    const w = D.slice(k, k + L), S = w.map(x => x.s), B = w.map(x => x.b), C = w.map(x => x.c);
    let g = 1; w.forEach(x => g *= 1 + mix.s * x.s + mix.b * x.b + mix.c * x.c);
    out.push({ from: w[0].y, to: w[L - 1].y, cagr: Math.pow(g, 1 / L) - 1, sm: mean(S), ss: sd(S), bm: mean(B), bs: sd(B), cm: mean(C), cs: sd(C), rho: corr(S, B) });
  }
  return out;
}

export function histPreset(level, mix, opts) {
  opts = opts || eqOpts();
  const W = histWindows(mix, opts), hn = opts.eq === "global" && opts.hc ? `; US stocks less ${hcTxt(opts)}%/yr as a global proxy` : "";
  if (level === "cons") {
    const o = {};
    ["sm", "ss", "bm", "bs", "cm", "cs", "rho"].forEach(k => o[k] = mean(W.map(w => w[k])));
    o.label = `Average of all ${W.length} 50-year windows, ${W[0].from}–${W[W.length - 1].to}${hn}`;
    return o;
  }
  const pick = W.reduce((a, b) => (level === "pess" ? (b.cagr < a.cagr) : (b.cagr > a.cagr)) ? b : a);
  return { ...pick, label: `${pick.from}–${pick.to}: the ${level === "pess" ? "worst" : "best"} 50-year window for your mix (${(pick.cagr * 100).toFixed(1)}%/yr real)${hn}` };
}

export function projPreset(level, opts) {
  opts = opts || eqOpts();
  const stocks = opts.eq === "global" ? globalStocks(opts.usW) : CMA.stockForecasts.map(f => [f.source, f.value]);
  const bonds = CMA.bondForecasts.map(f => [f.source, f.value]);
  const pickFrom = arr => {
    if (level === "cons") return { v: mean(arr.map(a => a[1])), src: "average of " + arr.length };
    const v = level === "pess" ? Math.min(...arr.map(a => a[1])) : Math.max(...arr.map(a => a[1]));
    return { v, src: arr.filter(a => a[1] === v).map(a => a[0]).join(", ") };
  };
  const s = pickFrom(stocks), b = pickFrom(bonds), inf = 1 + CMA.inflation / 100;
  const gs = (1 + s.v / 100) / inf - 1, gb = (1 + b.v / 100) / inf - 1, gc = (1 + CMA.cashMean / 100) / inf - 1;
  return {
    sm: arithFromGeo(gs, CMA.stockVolatility), ss: CMA.stockVolatility,
    bm: arithFromGeo(gb, CMA.bondVolatility), bs: CMA.bondVolatility,
    cm: arithFromGeo(gc, CMA.cashVolatility), cs: CMA.cashVolatility,
    rho: CMA.stockBondCorrelation,
    label: `${opts.eq === "global" ? "Global" : "US large-cap"} stocks ${s.v.toFixed(1)}% nominal (${s.src}), bonds ${b.v.toFixed(1)}% (${b.src}), less ${CMA.inflation}% inflation`,
  };
}

export function presetFor(src, lvl, mix) {
  const o = eqOpts();
  return src === "hist" ? histPreset(lvl, mix, o) : projPreset(lvl, o);
}
