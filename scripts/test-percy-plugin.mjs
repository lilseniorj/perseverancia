// Prueba de contrato del plugin de Percy con un "openmct" simulado (sin instalar Open MCT).
// Revisa lo que exige API.md de nasa/openmct: tipos, objetos con metadatos (domain/range),
// request → Promise de datos ordenados dentro de los límites, subscribe → función para desuscribirse.
// No reemplaza probarlo dentro de una app real de Open MCT.
import PercyPlugin from "../openmct-percy-plugin.js";

export async function testPercyPlugin({ ok, fail }) {
  const registered = { types: {}, roots: [], objectProviders: {}, telemetryProviders: [] };
  const openmct = {
    types: { addType: (key, def) => (registered.types[key] = def) },
    objects: {
      addRoot: (id) => registered.roots.push(id),
      addProvider: (ns, p) => (registered.objectProviders[ns] = p),
    },
    telemetry: { addProvider: (p) => registered.telemetryProviders.push(p) },
  };
  openmct.install = (plugin) => plugin(openmct); // igual que src/MCT.js:435-436
  openmct.install(PercyPlugin());

  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  check(registered.types["percy.telemetry"], "registra el tipo percy.telemetry");
  check(registered.roots.some((r) => r.namespace === "percy" && r.key === "mission"), "agrega la carpeta raíz percy:mission");

  const objects = registered.objectProviders.percy;
  const root = await objects.get({ namespace: "percy", key: "mission" });
  check(root?.composition?.length === 4, `la carpeta contiene 4 datos (${root?.composition?.map((c) => c.key).join(", ")})`);

  const provider = registered.telemetryProviders[0];
  for (const id of root.composition) {
    const obj = await objects.get(id);
    const values = obj.telemetry?.values ?? [];
    const domain = values.find((v) => v.hints?.domain);
    const range = values.find((v) => v.hints?.range);
    if (!(domain?.key === "utc" && range)) {
      fail(`${obj.name}: metadatos sin domain "utc" o sin range`);
      continue;
    }
    if (!provider.supportsRequest(obj)) {
      fail(`${obj.name}: el proveedor no acepta el objeto`);
      continue;
    }
    // Ventana de los últimos 30 días de la misión, como pediría el time conductor.
    const end = Date.now();
    const start = end - 30 * 86400000;
    const all = await provider.request(obj, {});
    const window = await provider.request(obj, { start, end });
    const sorted = all.every((d, i) => i === 0 || all[i - 1].utc <= d.utc);
    const inBounds = window.every((d) => d.utc >= start && d.utc <= end);
    const numeric = all.every((d) => Number.isFinite(d.utc) && Number.isFinite(d.value));
    if (all.length && sorted && inBounds && numeric) {
      const last = all.at(-1);
      ok(`${obj.name}: ${all.length} datos ordenados, último ${last.value.toFixed(2)} ${range.unit} (${new Date(last.utc).toISOString().slice(0, 10)}); ${window.length} en los últimos 30 días`);
    } else {
      fail(`${obj.name}: request devolvió datos inválidos (ordenados=${sorted}, en límites=${inBounds}, numéricos=${numeric})`);
    }
  }

  const unrelated = { type: "generator", identifier: { namespace: "", key: "x" } };
  check(!provider.supportsRequest(unrelated), "no acepta objetos que no son de Percy");

  const light = await objects.get({ namespace: "percy", key: "lightTime" });
  const distance = await objects.get({ namespace: "percy", key: "distance" });
  check(provider.supportsSubscribe(light) && !provider.supportsSubscribe(distance), "solo el tiempo de luz se suscribe en vivo");
  const received = [];
  const unsubscribe = provider.subscribe(light, (d) => received.push(d));
  await new Promise((r) => setTimeout(r, 1200));
  check(typeof unsubscribe === "function", "subscribe devuelve la función para desuscribirse");
  unsubscribe();
  const count = received.length;
  await new Promise((r) => setTimeout(r, 1200));
  const v = received.at(-1)?.value;
  check(count >= 2 && received.length === count && v > 3 && v < 23, `en vivo: ${count} datos (${v?.toFixed(2)} min) y se detiene al desuscribirse`);
}

// Se puede correr sola: node scripts/test-percy-plugin.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = 0;
  await testPercyPlugin({ ok: (m) => console.log(`  ✓ ${m}`), fail: (m) => (failed++, console.log(`  ✗ ${m}`)) });
  process.exit(failed ? 1 : 0);
}
