// Plugin de Open MCT con la telemetría real de Percy.
// Uso dentro de una app de Open MCT:  openmct.install(PercyPlugin());
// Sigue el contrato de API.md de nasa/openmct: tipos, objetos con metadatos y un proveedor
// con supportsRequest/request (historial) y supportsSubscribe/subscribe (en vivo).
import { dateFromSol, solFromDate, lightTimeSeconds } from "./ephemeris.js";

const NAMESPACE = "percy";
const TYPE = "percy.telemetry";
const WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json";

const MEASUREMENTS = {
  distance: { name: "Distancia recorrida", unit: "km", field: (p) => p.dist_total_m / 1000, valid: (p) => p.dist_total_m > 0 },
  elevation: { name: "Altura del terreno", unit: "m", field: (p) => p.elev_geoid },
  tilt: { name: "Inclinación", unit: "°", field: (p) => p.tilt },
  lightTime: { name: "Tiempo de luz Tierra → Marte", unit: "min", live: true },
};

// Ficha (metadatos) de cada dato: "utc" debe llamarse igual que el sistema de tiempo activo.
function telemetryValues(m) {
  return [
    { key: "utc", source: "utc", name: "Tiempo", format: "utc", hints: { domain: 1 } },
    { key: "value", name: m.name, unit: m.unit, format: "float", hints: { range: 1 } },
  ];
}

function domainObject(key) {
  if (key === "mission") {
    return {
      identifier: { namespace: NAMESPACE, key },
      name: "Percy (Perseverance)",
      type: "folder",
      location: "ROOT",
      composition: Object.keys(MEASUREMENTS).map((k) => ({ namespace: NAMESPACE, key: k })),
    };
  }
  const m = MEASUREMENTS[key];
  if (!m) return undefined;
  return {
    identifier: { namespace: NAMESPACE, key },
    name: m.name,
    type: TYPE,
    location: `${NAMESPACE}:mission`,
    telemetry: { values: telemetryValues(m) },
  };
}

export default function PercyPlugin({ fetchImpl = (...args) => fetch(...args) } = {}) {
  let waypoints; // una sola descarga para los tres datos que salen del mismo archivo
  const loadWaypoints = () =>
    (waypoints ??= fetchImpl(WAYPOINTS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`NASA respondió ${r.status}`);
        return r.json();
      })
      .then((json) => json.features.map((f) => f.properties)));

  return function install(openmct) {
    openmct.types.addType(TYPE, {
      name: "Dato de Percy",
      description: "Telemetría real del rover Perseverance",
      cssClass: "icon-telemetry",
    });

    openmct.objects.addRoot({ namespace: NAMESPACE, key: "mission" });
    openmct.objects.addProvider(NAMESPACE, {
      get: (identifier) => Promise.resolve(domainObject(identifier.key)),
    });

    const isPercy = (obj) => obj?.type === TYPE;

    openmct.telemetry.addProvider({
      supportsRequest: isPercy,
      supportsSubscribe: (obj) => isPercy(obj) && MEASUREMENTS[obj.identifier.key]?.live === true,

      // Historial ordenado de menor a mayor tiempo, recortado a los límites que pide Open MCT.
      async request(obj, options = {}) {
        const key = obj.identifier.key;
        const m = MEASUREMENTS[key];
        let data;
        if (m.live) {
          const nowSol = solFromDate(new Date());
          data = [];
          for (let sol = 0; sol <= nowSol; sol += 2) {
            const date = dateFromSol(sol);
            data.push({ utc: date.getTime(), value: lightTimeSeconds(date) / 60 });
          }
        } else {
          const points = await loadWaypoints();
          data = points
            .filter((p) => (m.valid ? m.valid(p) : true))
            .map((p) => ({ utc: dateFromSol(p.sol).getTime(), value: m.field(p) }));
        }
        data.sort((a, b) => a.utc - b.utc);
        const { start, end } = options;
        return data.filter((d) => (start === undefined || d.utc >= start) && (end === undefined || d.utc <= end));
      },

      // En vivo: un dato por segundo. Devuelve la función para dejar de escuchar.
      subscribe(obj, callback) {
        const tick = () => {
          const now = new Date();
          callback({ utc: now.getTime(), value: lightTimeSeconds(now) / 60 });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
      },
    });
  };
}

