// ---------- app wiring: form state, persistence, controls, orchestration ----------
import { $, num, clamp01 } from "./dom.js";
import { init as initAssumptions, LEVELS, presetFor, histPreset, overallMix, cohortReturns, eqOpts } from "./assumptions.js";
import { buildReturns, simulate, solve, spendFor } from "./simulation.js";
import { render, updateMix } from "./render.js";
import { round100, fmtK } from "./format.js";
import { geoOf } from "./stats.js";

const FIELDS = ["age", "access", "endAge", "tax", "cash", "ret", "tStock", "rStock", "mode", "spend", "tt", "tr", "inc", "incAge", "gT", "gL", "gU", "short", "eq", "usW", "hc", "src", "lvl", "hz", "sm", "ss", "bm", "bs", "cm", "cs", "rho", "sims", "seed"];
const DEFAULTS = {};
FIELDS.forEach(id => DEFAULTS[id] = $(id).value);
const KEY = "rbg-bridge-inputs-v2";

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("rbg-bridge-inputs-v1") || "null");
    if (s) {
      FIELDS.forEach(id => { if (s[id] !== undefined) $(id).value = s[id]; });
      if (s.src === undefined) $("src").value = "custom";
    }
  } catch (e) {}
}
function save() {
  try { const o = {}; FIELDS.forEach(id => o[id] = $(id).value); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
}

// ---------- source controls ----------
function setInputsFrom(pr) {
  const r2 = v => Math.round(v * 100) / 100;
  $("sm").value = r2(pr.sm * 100); $("ss").value = r2(pr.ss * 100); $("bm").value = r2(pr.bm * 100); $("bs").value = r2(pr.bs * 100);
  $("cm").value = r2(pr.cm * 100); $("cs").value = r2(pr.cs * 100); $("rho").value = r2(pr.rho);
}
let lastSrc = null;
function syncControls() {
  const mode = $("mode").value;
  document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === mode));
  $("spend").disabled = mode === "odds";
  $("spendLabel").textContent = mode === "odds" ? "Annual spending, after tax (calculated)" : "Annual spending, after tax";
  $("modeNote").textContent = mode === "odds"
    ? "We'll calculate the spending that hits your target % below (Guardrails)."
    : "Enter your spending; we'll calculate your odds of success.";
  $("gTHint").textContent = mode === "odds" ? "what you're solving for" : "used for recommended spending and triggers";
  const src = $("src").value, lvl = $("lvl").value;
  if (src === "custom" && lastSrc !== "custom") $("advDetails").open = true;
  lastSrc = src;
  document.querySelectorAll("#srcSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === src));
  document.querySelectorAll("#lvlSeg button").forEach(b => { b.setAttribute("aria-pressed", src !== "custom" && b.dataset.v === lvl); b.disabled = false; });
  $("hzRow").style.display = src === "proj" ? "" : "none";
  const eq = $("eq").value;
  document.querySelectorAll("#eqSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === eq));
  $("usWRow").style.display = eq === "global" ? "" : "none"; $("hcRow").style.display = eq === "global" ? "" : "none";
  if (src !== "custom") {
    const mix = overallMix(num("tax"), num("cash"), num("ret"), num("tStock"), num("rStock"));
    const pr = presetFor(src, lvl, mix, Math.ceil(num("endAge") - num("age")));
    setInputsFrom(pr);
    let note = pr.label; if (src === "proj" && $("hz").value === "10") note += ". After year 10, switches to historical consensus.";
    $("srcNote").textContent = note;
  } else $("srcNote").textContent = "Your own inputs. Pick Historical or Projected to load a scenario; the stock-market toggle only affects those.";
  $("smG").textContent = `≈ ${(geoOf(num("sm") / 100, num("ss") / 100) * 100).toFixed(2)}% compound`;
  $("bmG").textContent = `≈ ${(geoOf(num("bm") / 100, num("bs") / 100) * 100).toFixed(2)}% compound`;
  $("timelineSummary").textContent = `Age ${num("age")} · plan through ${num("endAge")} · accounts open at ${num("access")}`;
  $("accountsSummary").textContent = `Taxable ${fmtK(num("tax"))} · cash ${fmtK(num("cash"))} · retirement ${fmtK(num("ret"))}`;
}

const IO_SECTIONS = ["secTimeline", "secAccounts", "secAlloc", "secSpend", "secGuardrails", "secMarket"];
const collapseAllSections = () => IO_SECTIONS.forEach(id => { $(id).open = false; });
const expandAllSections = () => IO_SECTIONS.forEach(id => { $(id).open = true; });
document.querySelectorAll("#modeSeg button").forEach(b => b.addEventListener("click", () => { $("mode").value = b.dataset.v; syncControls(); save(); calculate(); }));
document.querySelectorAll("#srcSeg button").forEach(b => b.addEventListener("click", () => { $("src").value = b.dataset.v; syncControls(); save(); calculate(); }));
document.querySelectorAll("#eqSeg button").forEach(b => b.addEventListener("click", () => { $("eq").value = b.dataset.v; syncControls(); save(); calculate(); }));
document.querySelectorAll("#lvlSeg button").forEach(b => b.addEventListener("click", () => { if ($("src").value === "custom") $("src").value = "hist"; $("lvl").value = b.dataset.v; syncControls(); save(); calculate(); }));

// ---------- inputs ----------
function readInputs() {
  const p = {
    age: num("age"), access: num("access"), endAge: num("endAge"), tax: num("tax"), cash: num("cash"), ret: num("ret"),
    ts: clamp01(num("tStock") / 100), rs: clamp01(num("rStock") / 100), spend: num("spend"), tt: num("tt") / 100, tr: num("tr") / 100, inc: num("inc"), incAge: num("incAge"),
    gT: num("gT") / 100, gL: num("gL") / 100, gU: num("gU") / 100, short: $("short").value,
    sm: num("sm") / 100, ss: num("ss") / 100, bm: num("bm") / 100, bs: num("bs") / 100, cm: num("cm") / 100, cs: num("cs") / 100, rho: Math.max(-0.99, Math.min(0.99, num("rho"))),
    sims: Math.max(500, Math.min(10000, Math.round(num("sims")))), seed: Math.round(num("seed")), after: null, afterYears: 0,
    src: $("src").value, lvl: $("lvl").value, hz: $("hz").value, mode: $("mode").value,
  };
  p.years = Math.max(1, Math.ceil(p.endAge - p.age));
  if (p.src === "proj" && p.hz === "10") {
    const mix = overallMix(p.tax, p.cash, p.ret, num("tStock"), num("rStock"));
    p.after = histPreset("cons", mix, null, p.years - 10);
    p.afterYears = 10;
  }
  return p;
}
function validate(p) {
  if (p.endAge <= p.age) return "Plan-through age must be after your current age.";
  if (p.endAge - p.age > 75) return "Plan length can't exceed 75 years — that's the limit of the historical cohort data (e.g. age 25 to 100).";
  if (!(p.gL < p.gT && p.gT < p.gU)) return "Guardrails must satisfy lower < target < upper.";
  if (p.gU >= 1) return "Upper guardrail must be below 100%.";
  if (p.tt >= 0.9 || p.tr >= 0.8) return "Tax rates look too high to model.";
  if (p.tax + p.cash + p.ret <= 0) return "Enter at least one account balance.";
  return null;
}

// ---------- historical cohort replay (literal chronological sequences, for sequence-of-returns context) ----------
function buildCohorts(p) {
  const Y = p.years, cohorts = cohortReturns(eqOpts(), Y), K = cohorts.length;
  if (!K) return null;
  const Rc = { rs: new Float64Array(K * Y), rb: new Float64Array(K * Y), rc: new Float64Array(K * Y) };
  cohorts.forEach((c, k) => {
    for (let y = 0; y < Y; y++) { const i = k * Y + y; Rc.rs[i] = c.rs[y]; Rc.rb[i] = c.rb[y]; Rc.rc[i] = c.rc[y]; }
  });
  const cs = simulate({ ...p, sims: K }, Rc, p.spend, 1, true);
  // rank worst→best: a failure always ranks below a survivor, and an earlier failure is worse than a later one
  const ranked = cohorts.map((c, k) => {
    const end = cs.tot[k * (Y + 1) + Y], failYear = cs.failYear[k];
    return { ...c, k, end, failYear, rank: failYear >= 0 ? failYear : Y + 1 + end / 1e12 };
  }).sort((a, b) => a.rank - b.rank);
  const withPath = c => {
    const path = new Float64Array(Y + 1);
    for (let y = 0; y <= Y; y++) path[y] = cs.tot[c.k * (Y + 1) + y];
    return { ...c, path };
  };
  const failCount = ranked.filter(c => c.failYear >= 0).length;
  return { worst: withPath(ranked[0]), median: withPath(ranked[Math.floor((K - 1) / 2)]), best: withPath(ranked[K - 1]), K, failCount };
}

// ---------- main calc ----------
let runId = 0;
function calculate() {
  syncControls();
  const p = readInputs(), err = validate(p), st = $("status");
  if (err) { st.textContent = err; st.className = "status warn"; return; }
  st.className = "status"; st.textContent = "Calculating…";
  $("run").disabled = true;
  const my = ++runId;
  setTimeout(() => {
    if (my !== runId) return;
    const R = buildReturns(p), total = p.tax + p.cash + p.ret;
    if (p.mode === "odds") {
      p.spend = round100(spendFor(p, R, p.gT, 1, 26));
      $("spend").value = p.spend; save();
    }
    const now = simulate(p, R, p.spend, 1, true), r = solve(p, R, 26), coh = buildCohorts(p);
    render(p, now, total, r, coh);
    const lbl = p.src === "custom" ? "Custom assumptions" : `${p.src === "hist" ? "Historical" : "Projected"}, ${LEVELS[p.lvl].toLowerCase()}`;
    st.textContent = `${lbl} · ${p.sims.toLocaleString()} simulations, ${p.years} years`;
    $("run").disabled = false;
  }, 20);
}

let timer = null;
$("f").addEventListener("input", e => {
  if (e.target.classList && e.target.classList.contains("ret")) $("src").value = "custom";
  save(); updateMix(); clearTimeout(timer); timer = setTimeout(calculate, 500);
});
$("run").addEventListener("click", () => { calculate(); collapseAllSections(); });
$("reset").addEventListener("click", () => { FIELDS.forEach(id => $(id).value = DEFAULTS[id]); save(); updateMix(); expandAllSections(); calculate(); });

// ---------- bootstrap ----------
async function bootstrap() {
  const [historicalReturns, marketAssumptions] = await Promise.all([
    fetch("data/historical-returns.json").then(r => r.json()),
    fetch("data/market-assumptions.json").then(r => r.json()),
  ]);
  initAssumptions(historicalReturns, marketAssumptions);
  loadSaved();
  updateMix();
  calculate();
}
bootstrap();
