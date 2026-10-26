// npm run check — sin dependencias: usa Node (http, WebSocket) y el Chrome ya instalado.
// 1) revisa la sintaxis de los módulos  2) abre el juego en Chrome sin ventana
// 3) confirma que los 4 datos del control de misión cargaron con números reales
// 4) prueba que la tecla T oculta y muestra el panel
// 5) hace clic en cada cámara, espera la foto real y guarda la captura en check-output/
// 6) falla si la consola tiene errores
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { readFile, readdir, mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "check-output"); // capturas con la foto abierta
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TIMEOUT_MS = 45000;

// Rangos creíbles: si un número cae fuera, no es un dato real de Percy.
const EXPECTED = {
  distance: { name: "Distancia recorrida", min: 1, max: 200, unit: "km" },
  elevation: { name: "Altura del terreno", min: -5000, max: 0, unit: "m" },
  tilt: { name: "Inclinación", min: 0, max: 45, unit: "°" },
  lightTime: { name: "Tiempo de luz", min: 3, max: 23, unit: "min" },
};

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. Sintaxis ----------
console.log("\n1. Sintaxis de los módulos");
const jsFiles = (await readdir(ROOT)).filter((f) => f.endsWith(".js"));
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ["--input-type=module", "--check"], { input: await readFile(join(ROOT, f)), stdio: ["pipe", "ignore", "pipe"] });
    ok(f);
  } catch (e) {
    fail(`${f}: ${e.stderr?.toString().trim()}`);
  }
}

// ---------- 2. Servidor + Chrome ----------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = resolve(ROOT, "." + (path === "/" ? "/index.html" : path));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const appUrl = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(join(tmpdir(), "percy-check-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--enable-unsafe-swiftshader", // WebGL por software para Three.js
  "--window-size=1280,800",
  "about:blank",
]);

async function cleanup() {
  chrome.kill();
  server.close();
  await sleep(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

let cdp;
try {
  const wsBrowser = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Chrome no arrancó (¿está instalado? usa CHROME_PATH)")), 15000);
    chrome.on("error", rej);
    chrome.stderr.on("data", (d) => {
      const m = d.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        res(m[1]);
      }
    });
  });
  const port = new URL(wsBrowser).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");

  // Mini cliente del protocolo de DevTools.
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  cdp = (method, params = {}) =>
    new Promise((r) => {
      const id = nextId++;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

  const consoleErrors = [];
  listeners.push(({ method, params }) => {
    if (method === "Runtime.exceptionThrown") {
      const d = params.exceptionDetails;
      consoleErrors.push(d.exception?.description ?? d.text);
    } else if (method === "Runtime.consoleAPICalled" && (params.type === "error" || params.type === "assert")) {
      consoleErrors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    } else if (method === "Log.entryAdded" && params.entry.level === "error") {
      consoleErrors.push(`${params.entry.text}${params.entry.url ? ` (${params.entry.url})` : ""}`);
    }
  });
  await cdp("Runtime.enable");
  await cdp("Log.enable");
  await cdp("Page.enable");
  await cdp("Page.navigate", { url: appUrl });

  // ---------- 3. Los 4 datos ----------
  console.log("\n2. Control de misión: los 4 datos de Percy");
  const readCards = () =>
    evaluate(`[...document.querySelectorAll('[data-telemetry]')].map(c => ({
      key: c.dataset.telemetry, status: c.dataset.status, value: Number(c.dataset.value),
      shown: c.querySelector('.mc-value')?.textContent, provider: c.querySelector('.mc-provider')?.textContent }))`);
  let cards = [];
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    cards = (await readCards()) ?? [];
    if (cards.length === 4 && cards.every((c) => c.status !== "loading")) break;
    await sleep(500);
  }
  for (const [key, exp] of Object.entries(EXPECTED)) {
    const c = cards.find((x) => x.key === key);
    if (!c) fail(`${exp.name}: no aparece en el panel`);
    else if (c.status !== "ok") fail(`${exp.name}: estado "${c.status}" (no cargó)`);
    else if (!Number.isFinite(c.value) || c.value < exp.min || c.value > exp.max)
      fail(`${exp.name}: valor ${c.value} fuera del rango real [${exp.min}, ${exp.max}] ${exp.unit}`);
    else ok(`${exp.name}: ${c.shown} ${exp.unit}  ← ${c.provider}`);
  }

  // ---------- 4. Tecla T ----------
  console.log("\n3. La tecla T oculta y muestra el panel");
  const pressT = async () => {
    for (const type of ["keyDown", "keyUp"]) {
      await cdp("Input.dispatchKeyEvent", { type, code: "KeyT", key: "t", windowsVirtualKeyCode: 84 });
    }
    await sleep(200);
  };
  const isHidden = () => evaluate(`document.getElementById('mission-control')?.hidden`);
  const before = await isHidden();
  await pressT();
  const afterFirst = await isHidden();
  await pressT();
  const afterSecond = await isHidden();
  if (before === false && afterFirst === true && afterSecond === false) ok("visible → T → oculto → T → visible");
  else fail(`la tecla T no alterna el panel (antes=${before}, 1ª=${afterFirst}, 2ª=${afterSecond})`);

  // ---------- 5. Cámaras: clic → foto real ----------
  console.log("\n4. Cámaras de Percy: clic en cada punto abre una foto real");
  await mkdir(OUT_DIR, { recursive: true });
  const viewerState = () =>
    evaluate(`(() => { const v = document.getElementById('photo-viewer'); const img = v?.querySelector('img');
      return v && { open: !v.hidden, state: v.dataset.state, src: img.src, natural: img.naturalWidth,
        meta: v.querySelector('.pv-meta').textContent.trim(), name: v.querySelector('.pv-cam strong').textContent }; })()`);
  const waitRevealed = async () => {
    const t0 = Date.now();
    let s;
    while (Date.now() - t0 < 20000) {
      s = await viewerState();
      if (s?.state === "revealed" || s?.state === "error") return s;
      await sleep(200);
    }
    return s;
  };
  const pressKey = async (key, code, keyCode) => {
    for (const type of ["keyDown", "keyUp"]) await cdp("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode });
    await sleep(200);
  };

  // Los puntos aparecen cuando termina de cargar el modelo de la NASA.
  let dots = [];
  for (let t0 = Date.now(); Date.now() - t0 < 20000; await sleep(300)) {
    dots = (await evaluate(`[...document.querySelectorAll('.cam-dot')].filter(d => !d.hidden).map(d => {
      const r = d.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { key: d.dataset.camera, x, y, onTop: document.elementFromPoint(x, y)?.closest('.cam-dot') === d }; })`)) ?? [];
    if (dots.length === 4) break;
  }
  if (dots.length !== 4) fail(`se esperaban 4 puntos de cámara visibles y hay ${dots.length}`);

  for (const dot of dots) {
    if (!dot.onTop) {
      fail(`${dot.key}: el punto está tapado por otro elemento`);
      continue;
    }
    // Clic real con el mouse (no un .click() de JavaScript).
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: dot.x, y: dot.y });
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: dot.x, y: dot.y, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: dot.x, y: dot.y, button: "left", clickCount: 1 });
    const s = await waitRevealed();
    if (!s?.open) fail(`${dot.key}: el clic no abrió el visor`);
    else if (s.state !== "revealed" || !s.natural || !/^https:\/\/mars\.nasa\.gov\/mars2020-raw-images\//.test(s.src))
      fail(`${dot.key}: la foto no cargó (estado ${s.state}, ${s.src})`);
    else {
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      const file = join(OUT_DIR, `foto-${dot.key}.png`);
      await writeFile(file, Buffer.from(shot.result.data, "base64"));
      ok(`${s.name} ${s.meta}  → ${relative(ROOT, file)}`);
    }

    if (dot.key === dots[0].key) {
      const before = (await viewerState()).src;
      await pressKey("ArrowRight", "ArrowRight", 39);
      const after = await waitRevealed();
      if (after.src !== before && after.state === "revealed") ok(`→ muestra otra foto de la misma cámara (${after.meta})`);
      else fail("la flecha → no cambió de foto");
    }

    await pressKey("Escape", "Escape", 27);
    if ((await viewerState()).open) fail(`${dot.key}: Esc no cerró el visor`);
  }

  // ---------- 6. Consola ----------
  console.log("\n5. Consola del navegador");
  await sleep(2000); // margen para errores tardíos (modelo 3D, timers)
  if (consoleErrors.length === 0) ok("sin errores");
  else consoleErrors.forEach((e) => fail(`error en consola: ${e}`));
} catch (err) {
  fail(`no se pudo ejecutar el chequeo en Chrome: ${err.message}`);
} finally {
  await cleanup();
}

console.log(failures.length ? `\n✗ check falló (${failures.length})\n` : "\n✓ check OK\n");
process.exit(failures.length ? 1 : 0);
