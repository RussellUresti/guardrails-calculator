// ---------- app wiring: form state, persistence, controls, orchestration ----------
import { $, num, clamp01 } from "./dom.js";
import { init as initAssumptions, LEVELS, presetFor, histPreset, overallMix } from "./assumptions.js";
import { buildReturns, simulate, solve, spendFor } from "./simulation.js";
import { render, updateMix } from "./render.js";
import { round100 } from "./format.js";
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
}
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
  if (!(p.gL < p.gT && p.gT < p.gU)) return "Guardrails must satisfy lower < target < upper.";
  if (p.gU >= 1) return "Upper guardrail must be below 100%.";
  if (p.tt >= 0.9 || p.tr >= 0.8) return "Tax rates look too high to model.";
  if (p.tax + p.cash + p.ret <= 0) return "Enter at least one account balance.";
  return null;
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
    const t0 = performance.now(), R = buildReturns(p), total = p.tax + p.cash + p.ret;
    if (p.mode === "odds") {
      p.spend = round100(spendFor(p, R, p.gT, 1, 26));
      $("spend").value = p.spend; save();
    }
    const now = simulate(p, R, p.spend, 1, true), r = solve(p, R, 26);
    render(p, now, total, r);
    const lbl = p.src === "custom" ? "Custom assumptions" : `${p.src === "hist" ? "Historical" : "Projected"}, ${LEVELS[p.lvl].toLowerCase()}`;
    st.textContent = `${lbl} · ${p.sims.toLocaleString()} simulations, ${p.years} years, ${Math.round(performance.now() - t0)} ms`;
    $("run").disabled = false;
  }, 20);
}

let timer = null;
$("f").addEventListener("input", e => {
  if (e.target.classList && e.target.classList.contains("ret")) $("src").value = "custom";
  save(); updateMix(); clearTimeout(timer); timer = setTimeout(calculate, 500);
});
$("run").addEventListener("click", calculate);
$("reset").addEventListener("click", () => { FIELDS.forEach(id => $(id).value = DEFAULTS[id]); save(); updateMix(); calculate(); });

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
