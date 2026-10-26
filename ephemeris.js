// Posiciones aproximadas de la Tierra y Marte con los elementos orbitales de JPL
// ("Keplerian Elements for Approximate Positions of the Major Planets", tabla 1, válida 1800–2050).
// Cada elemento: [valor en J2000, cambio por siglo]. Ángulos en grados, a en UA.
const ORBITS = {
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    node: [0, 0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    node: [49.55953891, -0.29257343],
  },
};

const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;
const DEG = Math.PI / 180;

// Perseverance aterrizó el 18-feb-2021 20:55 UTC, a las 15:53 hora local de Marte del sol 0.
const LANDING_MS = Date.UTC(2021, 1, 18, 20, 55);
const SOL_MS = 88775244; // un día marciano: 24 h 39 min 35 s
const LANDING_SOL_FRACTION = 15.88 / 24;

function heliocentric(orbit, centuries) {
  const el = (k) => orbit[k][0] + orbit[k][1] * centuries;
  const a = el("a"), e = el("e"), I = el("I") * DEG, L = el("L"), peri = el("peri"), node = el("node");
  const w = (peri - node) * DEG;
  const O = node * DEG;
  let M = (((L - peri) % 360) + 540) % 360 - 180;
  M *= DEG;

  // Ecuación de Kepler: M = E - e·sin(E), resuelta con Newton.
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export function earthMarsKm(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const p = heliocentric(ORBITS.earth, T);
  const q = heliocentric(ORBITS.mars, T);
  return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * AU_KM;
}

// Segundos que tarda la luz (y la radio) en ir de la Tierra a Marte.
export function lightTimeSeconds(date) {
  return earthMarsKm(date) / LIGHT_KM_S;
}

export function solFromDate(date) {
  return (date.getTime() - LANDING_MS) / SOL_MS + LANDING_SOL_FRACTION;
}

export function dateFromSol(sol) {
  return new Date(LANDING_MS + (sol - LANDING_SOL_FRACTION) * SOL_MS);
}
