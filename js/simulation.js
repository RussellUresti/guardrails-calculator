// ---------- Monte Carlo simulation engine ----------
import { lnP, mulberry32 } from "./stats.js";

export function buildReturns(p) {
  const N = p.sims, Y = p.years, rnd = mulberry32(p.seed || 1);
  const g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const mk = q => ({ S: lnP(q.sm, q.ss), B: lnP(q.bm, q.bs), C: lnP(q.cm, q.cs), rho: q.rho, k: Math.sqrt(Math.max(0, 1 - q.rho * q.rho)) });
  const A = mk(p), Z = p.after ? mk(p.after) : A;
  const rs = new Float64Array(N * Y), rb = new Float64Array(N * Y), rc = new Float64Array(N * Y);
  for (let n = 0; n < N; n++) for (let y = 0; y < Y; y++) {
    const i = n * Y + y, P = (p.after && y >= p.afterYears) ? Z : A, z1 = g(), z2 = g(), z3 = g(), zb = P.rho * z1 + P.k * z2;
    rs[i] = Math.exp(P.S.mu + P.S.sig * z1); rb[i] = Math.exp(P.B.mu + P.B.sig * zb); rc[i] = Math.exp(P.C.mu + P.C.sig * z3);
  }
  return { rs, rb, rc };
}

export function simulate(p, R, spend, f, record) {
  const N = p.sims, Y = p.years, T0 = (p.tax + p.cash) * f, Ret0 = p.ret * f;
  const wc = (p.tax + p.cash) > 0 ? p.cash / (p.tax + p.cash) : 0;
  let ok = 0, bridgeFail = 0, lateFail = 0;
  const tot = record ? new Float64Array(N * (Y + 1)) : null, txb = record ? new Float64Array(N * (Y + 1)) : null;
  const penRate = 1 - p.tr - 0.10;
  for (let n = 0; n < N; n++) {
    let T = T0, Rt = Ret0, failed = false;
    if (record) { tot[n * (Y + 1)] = T + Rt; txb[n * (Y + 1)] = T; }
    for (let y = 0; y < Y; y++) {
      const age = p.age + y;
      let need = spend - (age >= p.incAge ? p.inc : 0); if (need < 0) need = 0;
      const pre = Math.min(1, Math.max(0, p.access - age)), needPre = need * pre, needPost = need - needPre;
      let gross = needPre / (1 - p.tt);
      if (gross <= T) { T -= gross; }
      else {
        const rem = (gross - T) * (1 - p.tt); T = 0;
        if (p.short === "penalty" && penRate > 0) { const g2 = rem / penRate; if (g2 <= Rt) Rt -= g2; else { failed = true; bridgeFail++; } }
        else { failed = true; bridgeFail++; }
      }
      if (!failed) {
        gross = needPost / (1 - p.tt);
        if (gross <= T) { T -= gross; }
        else { const rem = (gross - T) * (1 - p.tt); T = 0; const g2 = rem / (1 - p.tr); if (g2 <= Rt) Rt -= g2; else { failed = true; lateFail++; } }
      }
      if (failed) { if (record) { for (let z = y + 1; z <= Y; z++) { tot[n * (Y + 1) + z] = 0; txb[n * (Y + 1) + z] = 0; } } break; }
      const i = n * Y + y;
      T *= wc * R.rc[i] + (1 - wc) * (p.ts * R.rs[i] + (1 - p.ts) * R.rb[i]);
      Rt *= p.rs * R.rs[i] + (1 - p.rs) * R.rb[i];
      if (record) { tot[n * (Y + 1) + y + 1] = T + Rt; txb[n * (Y + 1) + y + 1] = T; }
    }
    if (!failed) ok++;
  }
  return { rate: ok / N, bridge: bridgeFail / N, late: lateFail / N, tot, txb };
}

export const succ = (p, R, s, f) => simulate(p, R, s, f, false).rate;

export function spendFor(p, R, target, f, it = 26) {
  let lo = 0, hi = (p.tax + p.cash + p.ret) * f * 0.15 + p.inc + 1000;
  for (let k = 0; k < 12 && succ(p, R, hi, f) >= target; k++) hi *= 2;
  if (succ(p, R, 0, f) < target) return 0;
  for (let k = 0; k < it; k++) { const m = (lo + hi) / 2; if (succ(p, R, m, f) >= target) lo = m; else hi = m; }
  return lo;
}

export function scaleFor(p, R, target, s, lo, hi, it = 26) {
  if (succ(p, R, s, hi) < target) return null;
  if (succ(p, R, s, lo) >= target) return lo;
  for (let k = 0; k < it; k++) { const m = (lo + hi) / 2; if (succ(p, R, s, m) >= target) hi = m; else lo = m; }
  return hi;
}

export function solve(p, R, it) {
  const now = succ(p, R, p.spend, 1), rec = spendFor(p, R, p.gT, 1, it);
  let fL = null, fU = null, sL = null, sU = null, belowL = now < p.gL, aboveU = now >= p.gU;
  if (!belowL) { fL = scaleFor(p, R, p.gL, p.spend, 0.02, 1, it); if (fL != null && fL <= 0.02) fL = null; }
  if (!aboveU) fU = scaleFor(p, R, p.gU, p.spend, 1, 25, it);
  if (fL != null) sL = spendFor(p, R, p.gT, fL, it);
  if (fU != null) sU = spendFor(p, R, p.gT, fU, it);
  return { now, rec, fL, fU, sL, sU, belowL, aboveU };
}
