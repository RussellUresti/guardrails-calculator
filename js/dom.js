// ---------- shared DOM helpers ----------
export const $ = id => document.getElementById(id);
export const num = id => parseFloat($(id).value) || 0;
export const clamp01 = v => Math.min(1, Math.max(0, v));
