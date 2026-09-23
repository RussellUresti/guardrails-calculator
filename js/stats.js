// ---------- statistics helpers ----------
export const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

export const sd = a => {
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1));
};

export const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return n / Math.sqrt(da * db);
};

// lognormal params (mu, sigma) that produce the given arithmetic mean/sd
export function lnP(m, s) {
  const v = Math.log(1 + (s * s) / ((1 + m) * (1 + m)));
  return { mu: Math.log(1 + m) - v / 2, sig: Math.sqrt(v) };
}

export const geoOf = (m, s) => Math.exp(lnP(m, s).mu) - 1;

// solve for the arithmetic mean that produces a target geometric (compound) return
export function arithFromGeo(g, s) {
  let lo = g - 0.01, hi = g + s * s + 0.01;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (geoOf(m, s) < g) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// seeded PRNG (mulberry32)
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
