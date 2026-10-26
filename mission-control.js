import { lightTimeSeconds, solFromDate, dateFromSol } from "./ephemeris.js";

// Mismo patrón que Open MCT (src/api/telemetry/TelemetryAPI.js):
// cada dato declara sus metadatos (nombre, unidad, proveedor) y los proveedores
// dicen qué pueden servir con supportsRequest/request (historial) y supportsSubscribe/subscribe (en vivo).

const WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json";

const TELEMETRY = [
  {
    key: "distance",
    name: "Distancia recorrida",
    unit: "km",
    provider: "nasa-waypoints",
    field: (p) => p.dist_total_m / 1000,
    // Las localizaciones a mitad de manejo traen la distancia en 0 como relleno.
    valid: (p) => p.dist_total_m > 0,
    format: (v) => v.toFixed(2),
    explain: (s) => `Todo lo que Percy ha manejado desde que aterrizó, sumando cada viaje. Ya son ${fmtInt(last(s).value * 1000)} metros.`,
  },
  {
    key: "elevation",
    name: "Altura del terreno",
    unit: "m",
    provider: "nasa-waypoints",
    field: (p) => p.elev_geoid,
    format: (v) => fmtInt(v),
    explain: (s) =>
      `Marte no tiene mar: la altura se mide desde un nivel de referencia. Percy empezó en el fondo del cráter Jezero y ya subió ${fmtInt(last(s).value - s[0].value)} m por su borde.`,
  },
  {
    key: "tilt",
    name: "Inclinación",
    unit: "°",
    provider: "nasa-waypoints",
    field: (p) => p.tilt,
    format: (v) => v.toFixed(1),
    explain: (s) =>
      `Cuánto está ladeado Percy sobre el terreno: 0° es plano. Su máximo en toda la misión fue ${Math.max(...s.map((d) => d.value)).toFixed(1)}°.`,
  },
  {
    key: "lightTime",
    name: "Tiempo de luz Tierra → Marte",
    unit: "min",
    provider: "ephemeris",
    format: (v) => `${Math.floor(v)}:${String(Math.floor((v % 1) * 60)).padStart(2, "0")}`,
    explain: () =>
      "Lo que tarda un mensaje en llegar a Percy a la velocidad de la luz. Por eso no se maneja con joystick: cada orden llega minutos después. Cambia cada segundo porque los planetas se mueven.",
  },
];

const fmtInt = (v) => Math.round(v).toLocaleString("es");
const last = (s) => s[s.length - 1];

// ---------- Proveedores ----------

function nasaWaypointsProvider() {
  let points; // una sola descarga para los tres datos que salen de este archivo
  const load = () =>
    (points ??= fetch(WAYPOINTS_URL).then((r) => {
      if (!r.ok) throw new Error(`NASA respondió ${r.status}`);
      return r.json();
    }).then((json) => json.features.map((f) => f.properties)));

  return {
    label: "NASA · M20_waypoints.json",
    supportsRequest: (meta) => meta.provider === "nasa-waypoints",
    async request(meta) {
      const all = await load();
      return all
        .filter((p) => (meta.valid ? meta.valid(p) : true))
        .map((p) => ({ sol: p.sol, value: meta.field(p) }));
    },
  };
}

function ephemerisProvider() {
  return {
    label: "Cálculo en vivo · órbitas JPL",
    supportsRequest: (meta) => meta.provider === "ephemeris",
    supportsSubscribe: (meta) => meta.provider === "ephemeris",
    async request() {
      const series = [];
      const now = solFromDate(new Date());
      for (let sol = 0; sol <= now; sol += 2) {
        series.push({ sol, value: lightTimeSeconds(dateFromSol(sol)) / 60 });
      }
      return series;
    },
    subscribe(meta, callback) {
      const tick = () => {
        const now = new Date();
        callback({ sol: solFromDate(now), value: lightTimeSeconds(now) / 60 });
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id); // como en Open MCT, subscribe devuelve cómo desuscribirse
    },
  };
}

function createTelemetryAPI() {
  const providers = [];
  return {
    addProvider: (p) => providers.push(p),
    findRequestProvider: (meta) => providers.find((p) => p.supportsRequest?.(meta)),
    findSubscriptionProvider: (meta) => providers.find((p) => p.supportsSubscribe?.(meta)),
  };
}

// ---------- Interfaz ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function drawChart(canvas, series, solMax) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(canvas);
  const line = css.getPropertyValue("--mc-line").trim();
  const fill = css.getPropertyValue("--mc-fill").trim();
  const grid = css.getPropertyValue("--mc-grid").trim();

  const values = series.map((d) => d.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) max = min + 1;
  const pad = 3;
  const x = (sol) => pad + (sol / solMax) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(h * f) + 0.5);
    ctx.lineTo(w, Math.round(h * f) + 0.5);
    ctx.stroke();
  }

  ctx.beginPath();
  series.forEach((d, i) => (i ? ctx.lineTo(x(d.sol), y(d.value)) : ctx.moveTo(x(d.sol), y(d.value))));
  ctx.lineTo(x(last(series).sol), h);
  ctx.lineTo(x(series[0].sol), h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  series.forEach((d, i) => (i ? ctx.lineTo(x(d.sol), y(d.value)) : ctx.moveTo(x(d.sol), y(d.value))));
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const end = last(series);
  ctx.beginPath();
  ctx.arc(x(end.sol), y(end.value), 3, 0, Math.PI * 2);
  ctx.fillStyle = line;
  ctx.fill();

  return { min, max };
}

export function createMissionControl(container) {
  const telemetry = createTelemetryAPI();
  const providers = [nasaWaypointsProvider(), ephemerisProvider()];
  providers.forEach(telemetry.addProvider);

  const panel = el("aside");
  panel.id = "mission-control";
  panel.setAttribute("aria-label", "Control de misión");

  const header = el("header", "mc-header");
  header.append(el("span", "mc-title", "CONTROL DE MISIÓN"), el("span", "mc-live", "EN VIVO"));
  const solLine = el("p", "mc-sol");
  panel.append(header, solLine);

  const solNow = () => solFromDate(new Date());
  const updateSol = () => (solLine.textContent = `Percy · sol ${Math.floor(solNow())} en Marte · T para ocultar`);
  updateSol();
  setInterval(updateSol, 60000);

  const cards = [];
  for (const meta of TELEMETRY) {
    const provider = telemetry.findRequestProvider(meta);
    const card = el("section", "mc-card");
    card.dataset.telemetry = meta.key;
    card.dataset.status = "loading";

    const top = el("div", "mc-top");
    top.append(el("h3", "mc-name", meta.name), el("span", "mc-provider", provider.label));
    const reading = el("p", "mc-reading");
    const value = el("span", "mc-value", "…");
    reading.append(value, el("span", "mc-unit", meta.unit));
    const canvas = el("canvas", "mc-chart");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Gráfica de ${meta.name} durante toda la misión`);
    const axis = el("div", "mc-axis");
    const axisStart = el("span", null, "sol 0");
    const axisEnd = el("span", null, "");
    axis.append(axisStart, axisEnd);
    const explain = el("p", "mc-explain", "Cargando datos…");

    card.append(top, reading, canvas, axis, explain);
    panel.append(card);
    cards.push({ meta, provider, card, value, canvas, axisEnd, explain, series: null });
  }
  container.append(panel);

  const redraw = () => {
    const solMax = Math.ceil(solNow());
    for (const c of cards) {
      if (!c.series) continue;
      const range = drawChart(c.canvas, c.series, solMax);
      if (range) c.axisEnd.textContent = `sol ${solMax} · rango ${c.meta.format(range.min)} a ${c.meta.format(range.max)} ${c.meta.unit}`;
    }
  };

  const setValue = (c, datum) => {
    c.value.textContent = c.meta.format(datum.value);
    c.card.dataset.value = String(datum.value);
  };

  for (const c of cards) {
    c.provider
      .request(c.meta)
      .then((series) => {
        if (!series.length) throw new Error("sin datos");
        c.series = series;
        setValue(c, last(series));
        c.explain.textContent = c.meta.explain(series);
        c.card.dataset.status = "ok";
        if (c.meta.provider === "nasa-waypoints") {
          c.card.querySelector(".mc-provider").append(` · sol ${last(series).sol}`);
        }
        const live = telemetry.findSubscriptionProvider(c.meta);
        if (live) live.subscribe(c.meta, (datum) => setValue(c, datum));
        redraw();
      })
      .catch((err) => {
        c.card.dataset.status = "error";
        c.value.textContent = "—";
        c.explain.textContent = `No se pudo cargar: ${err.message}. Revisa la conexión a internet.`;
        console.warn(`Control de misión: ${c.meta.name} no cargó`, err);
      });
  }

  window.addEventListener("resize", redraw);

  return {
    toggle() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) redraw();
    },
  };
}
