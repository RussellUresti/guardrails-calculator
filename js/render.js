// ---------- rendering: results panel, road diagram, stats, chart ----------
import { $, num, clamp01 } from "./dom.js";
import { overallMix } from "./assumptions.js";
import { fmt, fmtK, pct, round100, round1k } from "./format.js";
import { drawChart } from "./chart.js";

export function render(p, now, total, r) {
  const { rec, fL, fU, sL, sU, belowL, aboveU } = r;
  $("results").hidden = false;
  const lowV = fL != null ? fL * total : null, upV = fU != null ? fU * total : null;
  $("nowSucc").textContent = pct(now.rate) + " success";
  $("nowText").textContent = p.mode === "odds"
    ? `Spending for ${pct(p.gT)} target: ${fmt(p.spend)}/yr on ${fmt(total)}.`
    : `At ${fmt(p.spend)}/yr on ${fmt(total)}. Spending for ${pct(p.gT)} success: ${fmt(round100(rec))}.`;
  if (belowL) { $("cTrig").textContent = "Already below"; $("cText").textContent = `You're under the ${pct(p.gL)} guardrail now. Spending for ${pct(p.gT)}: ${fmt(round100(rec))}.`; }
  else if (fL == null) { $("cTrig").textContent = "None"; $("cText").textContent = "Success stays above the lower guardrail even after a 98% drop."; }
  else { $("cTrig").textContent = fmt(round1k(lowV)); $("cText").textContent = `A ${pct(1 - fL)} drop. Cut spending to ${fmt(round100(sL))} (${((sL / p.spend - 1) * 100).toFixed(1)}%).`; }
  if (aboveU) { $("uTrig").textContent = "Already above"; $("uText").textContent = `You're over the ${pct(p.gU)} guardrail now. Spending for ${pct(p.gT)}: ${fmt(round100(rec))}.`; }
  else if (fU == null) { $("uTrig").textContent = "Out of range"; $("uText").textContent = `Even 25× your portfolio doesn't reach ${pct(p.gU)}; check the bridge-failure rate below.`; }
  else { $("uTrig").textContent = fmt(round1k(upV)); $("uText").textContent = `A ${pct(fU - 1)} gain. Raise spending to ${fmt(round100(sU))} (+${((sU / p.spend - 1) * 100).toFixed(1)}%).`; }
  let rule = "";
  if (belowL || aboveU) { rule = `Your current spending sits outside the guardrails. Spending for ${pct(p.gT)} success is ${fmt(round100(rec))} — update the field above, or switch to "I know my target odds" mode.`; }
  else {
    rule = "Check your total portfolio (taxable, cash and retirement accounts) each quarter. ";
    if (lowV != null) rule += `If it falls below ${fmt(round1k(lowV))}, cut spending to ${fmt(round100(sL))}. `;
    if (upV != null) rule += `If it rises above ${fmt(round1k(upV))}, raise spending to ${fmt(round100(sU))}. `;
    rule += "After any change, and at least yearly, re-run this with new balances and age.";
  }
  $("rule").textContent = rule;
  const Y = p.years, N = p.sims, accessIdx = Math.min(Y, Math.max(0, Math.ceil(p.access - p.age)));
  const col = (arr, y) => { const a = new Float64Array(N); for (let n = 0; n < N; n++) a[n] = arr[n * (Y + 1) + y]; a.sort(); return a; };
  const q = (a, x) => a[Math.min(N - 1, Math.floor(x * (N - 1)))];
  const atAccess = col(now.tot, accessIdx), atEnd = col(now.tot, Y), taxAtAccess = col(now.txb, accessIdx);
  const wr = total > 0 ? p.spend / total : 0, taxWr = (p.tax + p.cash) > 0 ? p.spend / (1 - p.tt) / (p.tax + p.cash) : 0;
  const mixS = (p.tax * p.ts + p.ret * p.rs) / total;
  $("stats").innerHTML =
    `<div>Overall allocation<b>${pct(mixS)} stocks</b>${pct((p.tax * (1 - p.ts) + p.ret * (1 - p.rs)) / total)} bonds, ${pct(p.cash / total)} cash</div>` +
    `<div>Bridge failures<b>${pct(now.bridge)}</b>taxable ran out before ${p.access}</div>` +
    `<div>Later failures<b>${pct(now.late)}</b>ran out after access</div>` +
    `<div>Withdrawal rate<b>${(wr * 100).toFixed(2)}%</b>of total; ${(taxWr * 100).toFixed(1)}% of taxable, gross</div>` +
    `<div>Median taxable at ${p.access}<b>${fmtK(q(taxAtAccess, 0.5))}</b></div>` +
    `<div>Median total at ${p.access}<b>${fmtK(q(atAccess, 0.5))}</b>10th pct ${fmtK(q(atAccess, 0.1))}</div>` +
    `<div>Median total at ${p.endAge}<b>${fmtK(q(atEnd, 0.5))}</b>10th pct ${fmtK(q(atEnd, 0.1))}</div>`;
  const track = $("track"), labels = $("roadLabels");
  const pts = [total]; if (lowV != null) pts.push(lowV); if (upV != null) pts.push(upV);
  const mn = Math.min(...pts) * 0.8, mx = Math.max(...pts) * 1.12, pos = v => ((v - mn) / (mx - mn)) * 100;
  const lp = lowV != null ? pos(lowV) : (belowL ? pos(total) + 8 : 0), up = upV != null ? pos(upV) : (aboveU ? pos(total) - 8 : 100);
  track.innerHTML = `<div class="zone cut" style="width:${Math.max(0, lp)}%"></div><div class="zone safe" style="width:${Math.max(0, up - lp)}%"></div><div class="zone raise" style="flex:1"></div>` +
    (lowV != null ? `<div class="rail cut" style="left:${lp}%"></div>` : "") + (upV != null ? `<div class="rail raise" style="left:${up}%"></div>` : "") +
    `<div class="you" style="left:${pos(total)}%"></div>`;
  let lab = `<span style="left:${pos(total)}%"><b>${fmtK(total)}</b>today</span>`;
  if (lowV != null) lab += `<span style="left:${Math.max(8, lp)}%"><b>${fmtK(lowV)}</b>cut</span>`;
  if (upV != null) lab += `<span style="left:${Math.min(92, up)}%"><b>${fmtK(upV)}</b>raise</span>`;
  labels.innerHTML = lab;
  drawChart(p, now, col, q);
}

export function updateMix() {
  const tax = num("tax"), cash = num("cash"), ret = num("ret"), ts = clamp01(num("tStock") / 100), rs = clamp01(num("rStock") / 100), tot = tax + cash + ret, el = $("mix");
  if (tot <= 0) { el.textContent = ""; return; }
  const m = overallMix(tax, cash, ret, num("tStock"), num("rStock")), tt = tax + cash, P = v => Math.round(v * 100) + "%";
  const tS = tt > 0 ? tax * ts / tt : 0, tB = tt > 0 ? tax * (1 - ts) / tt : 0, tC = tt > 0 ? cash / tt : 0;
  el.innerHTML = `<div class="mixbar"><span style="width:${m.s * 100}%;background:var(--safe)"></span><span style="width:${m.b * 100}%;background:var(--raise)"></span><span style="width:${m.c * 100}%;background:var(--cut)"></span></div>` +
    `<p><span class="k" style="background:var(--safe)"></span>Stocks ${P(m.s)} &nbsp; <span class="k" style="background:var(--raise)"></span>Bonds ${P(m.b)} &nbsp; <span class="k" style="background:var(--cut)"></span>Cash ${P(m.c)} of total</p>` +
    `<p>Taxable side: ${P(tS)} stocks, ${P(tB)} bonds, ${P(tC)} cash. Retirement: ${P(rs)} / ${P(1 - rs)}.</p>`;
}
