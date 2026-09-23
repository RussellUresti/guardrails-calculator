// ---------- formatting helpers ----------
export const fmt = v => v == null ? "–" : "$" + Math.round(v).toLocaleString("en-US");
export const fmtK = v => { if (v == null) return "–"; const a = Math.abs(v); return a >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1e3) + "k"; };
export const pct = v => (v * 100).toFixed(0) + "%";
export const round100 = v => Math.round(v / 100) * 100;
export const round1k = v => Math.round(v / 1000) * 1000;
