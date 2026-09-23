// ---------- historical & projected return assumptions ----------
import { mean, sd, corr, arithFromGeo } from "./stats.js";

export const LEVELS = { pess: "Pessimistic", cons: "Consensus", opt: "Optimistic" };

// window length above which a "worst/best" pick is too thin a sample to trust (still show "typical")
export const TIER1 = { us: 75, global: 20 };

let HIST = null;      // array of {y, s, c, b} real decimal returns, US market, 1928-
let HIST_EXUS = null; // array of {y, s} real decimal returns, developed ex-US market, 1991-
let HIST_BY_YEAR = null;
let CMA = null;       // capital market assumptions (projected forecasts)

// converts raw nominal rows into real (inflation-adjusted) decimal returns
export function init(historicalReturns, marketAssumptions, exusReturns) {
  const inflationByYear = new Map(historicalReturns.map(r => [r.year, r.inflation]));
  HIST = historicalReturns.map(({ year, stock, cash, bond, inflation }) => ({
    y: year,
    s: (1 + stock / 100) / (1 + inflation / 100) - 1,
    c: (1 + cash / 100) / (1 + inflation / 100) - 1,
    b: (1 + bond / 100) / (1 + inflation / 100) - 1,
  }));
  HIST_BY_YEAR = new Map(HIST.map(x => [x.y, x]));
  HIST_EXUS = exusReturns.map(({ year, stock }) => ({
    y: year,
    s: (1 + stock / 100) / (1 + inflationByYear.get(year) / 100) - 1,
  }));
  CMA = marketAssumptions;
}

export function eqOpts() {
  return {
    eq: document.getElementById("eq").value,
    usW: Math.min(1, Math.max(0, (parseFloat(document.getElementById("usW").value) || 0) / 100)),
  };
}

export function globalStocks(usW) {
  return CMA.globalStockForecasts.map(f => {
    if (f.direct != null) return [f.source, f.direct];
    const ex = f.exUs != null ? f.exUs : 0.75 * f.developed + 0.25 * f.emerging;
    return [f.source, usW * f.us + (1 - usW) * ex];
  });
}

export function overallMix(tax, cash, ret, tStockPct, rStockPct) {
  const ts = Math.min(1, Math.max(0, tStockPct / 100));
  const rs = Math.min(1, Math.max(0, rStockPct / 100));
  const tot = tax + cash + ret || 1;
  return { s: (tax * ts + ret * rs) / tot, b: (tax * (1 - ts) + ret * (1 - rs)) / tot, c: cash / tot };
}

// the working return series for a given equity setting: US stocks/bonds/cash as-is, or (for global)
// each year's stock return blended between the real US and real developed-ex-US market at usW, with
// bonds/cash still US-sourced (there's no ex-US bond/cash series). Ex-US real data only covers
// 1991-, so "global" windows/cohorts can never reach further back than that — see TIER1/histSpan.
export function dataset(opts) {
  if (!opts || opts.eq !== "global") return HIST;
  const usW = opts.usW;
  return HIST_EXUS.map(x => {
    const us = HIST_BY_YEAR.get(x.y);
    return { y: x.y, s: usW * us.s + (1 - usW) * x.s, b: us.b, c: us.c };
  });
}

// how many years of data are actually available for the current equity setting
export function histSpan(opts) {
  return (opts && opts.eq === "global" ? HIST_EXUS : HIST).length;
}

// keep window length long enough for a stable read, short enough to leave enough overlapping windows
export const clampWindow = (years, ceiling) => Math.max(10, Math.min(ceiling, Math.round(years)));

export function histWindows(mix, opts, L = 50) {
  const out = [], D = dataset(opts);
  for (let k = 0; k + L <= D.length; k++) {
    const w = D.slice(k, k + L), S = w.map(x => x.s), B = w.map(x => x.b), C = w.map(x => x.c);
    let g = 1; w.forEach(x => g *= 1 + mix.s * x.s + mix.b * x.b + mix.c * x.c);
    out.push({ from: w[0].y, to: w[L - 1].y, cagr: Math.pow(g, 1 / L) - 1, sm: mean(S), ss: sd(S), bm: mean(B), bs: sd(B), cm: mean(C), cs: sd(C), rho: corr(S, B) });
  }
  return out;
}

// raw yearly real return series (as growth factors) for every historical window of exactly `Y` years,
// unclamped: this is a literal replay of the actual chronological sequence, not a summary statistic
export function cohortReturns(opts, Y) {
  const D = dataset(opts), out = [];
  for (let k = 0; k + Y <= D.length; k++) {
    const w = D.slice(k, k + Y), rs = new Float64Array(Y), rb = new Float64Array(Y), rc = new Float64Array(Y);
    w.forEach((x, i) => { rs[i] = 1 + x.s; rb[i] = 1 + x.b; rc[i] = 1 + x.c; });
    out.push({ from: w[0].y, to: w[Y - 1].y, rs, rb, rc });
  }
  return out;
}

export function histPreset(level, mix, opts, years) {
  opts = opts || eqOpts();
  const ceiling = TIER1[opts.eq === "global" ? "global" : "us"];
  const L = clampWindow(years || 50, ceiling);
  const W = histWindows(mix, opts, L);
  const hn = opts.eq === "global" ? `; ${Math.round(opts.usW * 100)}% US / ${Math.round((1 - opts.usW) * 100)}% developed ex-US blend` : "";
  if (level === "cons") {
    const o = {};
    ["sm", "ss", "bm", "bs", "cm", "cs", "rho"].forEach(k => o[k] = mean(W.map(w => w[k])));
    o.label = `Average of all ${W.length} ${L}-year windows, ${W[0].from}–${W[W.length - 1].to}${hn}`;
    return o;
  }
  const pick = W.reduce((a, b) => (level === "pess" ? (b.cagr < a.cagr) : (b.cagr > a.cagr)) ? b : a);
  return { ...pick, label: `${pick.from}–${pick.to}: the ${level === "pess" ? "worst" : "best"} ${L}-year window for your mix (${(pick.cagr * 100).toFixed(1)}%/yr real)${hn}` };
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

export function presetFor(src, lvl, mix, years) {
  const o = eqOpts();
  return src === "hist" ? histPreset(lvl, mix, o, years) : projPreset(lvl, o);
}
