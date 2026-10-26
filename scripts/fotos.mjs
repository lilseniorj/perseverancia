// Renovar las fotos de las cámaras, con una persona mirando antes de elegir (sin dependencias).
//
//   npm run fotos              → baja las candidatas recientes y arma fotos-candidatas.html
//   (mira la hoja, y escribe tus elegidas en fotos-elegidas.json — ver el ejemplo que se genera)
//   npm run fotos -- escribir  → genera photos.js con las elegidas
//
// Filtros automáticos (los mismos que se usaron a mano el 24-oct-2026): solo cuadros completos,
// Mastcam-Z solo con filtro RGB (fuera banda angosta y ND del sol), WATSON solo SIF (a color),
// y como mucho 3 fotos por secuencia. El resto (cielo vacío, sol, calibración) lo decide quien mira.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API = "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=100&order=sol+desc";
const CANDIDATES_JSON = join(ROOT, "fotos-candidatas.json");
const CANDIDATES_HTML = join(ROOT, "fotos-candidatas.html");
const PICKS_JSON = join(ROOT, "fotos-elegidas.json");

const CAMERAS = {
  mastcam: { part: "Mastcam_Z_cams", name: "Mastcam-Z", role: "Los ojos de Percy, con zoom, en lo alto del mástil", instruments: ["MCZ_LEFT", "MCZ_RIGHT"] },
  navcam: { part: "NavCams", name: "NavCam", role: "Cámaras para planear por dónde manejar", instruments: ["NAVCAM_LEFT", "NAVCAM_RIGHT"] },
  hazcam: { part: "hazcams_front", name: "Hazcam delantera", role: "Vigilan obstáculos frente a las ruedas", instruments: ["FRONT_HAZCAM_LEFT_A", "FRONT_HAZCAM_RIGHT_A", "FRONT_HAZCAM_LEFT_B", "FRONT_HAZCAM_RIGHT_B"] },
  watson: { part: "WATSON", name: "WATSON", role: "Lupa en la punta del brazo robótico", instruments: ["SHERLOC_WATSON"] },
};

const height = (dim) => Number(String(dim).match(/,(\d+)\)/)?.[1] ?? 0);
const RULES = {
  mastcam: (i) => /_RGB$/.test(i.camera.filter_name) && height(i.extended?.dimension) >= 1000,
  navcam: (i) => /^N[LR]F/.test(i.imageid) && height(i.extended?.dimension) >= 900,
  hazcam: (i) => height(i.extended?.dimension) >= 900,
  watson: (i) => /^SIF/.test(i.imageid) && height(i.extended?.dimension) >= 1100,
};
const sequence = (id) => id.match(/(ZCAM|NCAM|FHAZ|SRLC)\d+/)?.[0] ?? id;

async function download() {
  const out = {};
  for (const [key, cam] of Object.entries(CAMERAS)) {
    const search = encodeURIComponent(`|${cam.instruments.join("|")}|`);
    const images = [];
    for (let page = 0; page < 3; page++) {
      const res = await fetch(`${API}&page=${page}&search=${search}`);
      if (!res.ok) throw new Error(`La API de la NASA respondió ${res.status}`);
      const { images: batch } = await res.json();
      images.push(...batch);
      if (batch.length < 100) break;
    }
    const perSequence = {};
    out[key] = images
      .filter((i) => i.sample_type === "Full" && RULES[key](i))
      .filter((i) => (perSequence[sequence(i.imageid)] = (perSequence[sequence(i.imageid)] ?? 0) + 1) <= 3)
      .map((i, n) => ({
        n,
        id: i.imageid,
        instrument: i.camera.instrument,
        sol: i.sol,
        utc: i.date_taken_utc.endsWith("Z") ? i.date_taken_utc : i.date_taken_utc + "Z",
        url: i.image_files.large,
        thumb: i.image_files.medium,
      }));
    console.log(`  ${cam.name}: ${out[key].length} candidatas (sols ${out[key].at(-1)?.sol}–${out[key][0]?.sol})`);
  }
  return out;
}

function contactSheet(candidates) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sections = Object.entries(candidates).map(([key, list]) => `
    <h2>${esc(CAMERAS[key].name)} <small>(${key})</small></h2>
    <div class="grid">${list.map((c) => `
      <figure><img loading="lazy" src="${esc(c.thumb)}" alt=""><figcaption><b>${key} ${c.n}</b> · sol ${c.sol} · ${esc(c.instrument)}</figcaption></figure>`).join("")}
    </div>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Fotos candidatas</title>
<style>body{margin:16px;background:#111;color:#eee;font:13px system-ui}h2{margin:28px 0 8px}small{opacity:.6}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}figure{margin:0}img{width:100%;display:block}b{color:#ffd54f}</style>
<p>Mira cada foto y descarta cielo vacío, sol, calibración, fotos oscuras o que solo muestran piezas del rover.
Escribe las elegidas en <code>fotos-elegidas.json</code> y corre <code>npm run fotos -- escribir</code>.</p>${sections}`;
}

async function writePhotosJs() {
  if (!existsSync(CANDIDATES_JSON) || !existsSync(PICKS_JSON)) {
    throw new Error("Primero corre `npm run fotos` y escribe tus elegidas en fotos-elegidas.json");
  }
  const candidates = JSON.parse(await readFile(CANDIDATES_JSON, "utf8"));
  const picks = JSON.parse(await readFile(PICKS_JSON, "utf8"));
  const body = Object.entries(CAMERAS).map(([key, cam]) => {
    const chosen = (picks[key] ?? []).map(({ n, caption }) => {
      const c = candidates[key]?.find((x) => x.n === n);
      if (!c) throw new Error(`${key} ${n} no existe en fotos-candidatas.json`);
      if (!caption) throw new Error(`${key} ${n}: falta la frase "caption" que describe la foto`);
      return { id: c.id, instrument: c.instrument, sol: c.sol, utc: c.utc, url: c.url, caption };
    });
    if (!chosen.length) throw new Error(`${cam.name}: elige al menos una foto`);
    return `  ${key}: {\n    part: ${JSON.stringify(cam.part)},\n    name: ${JSON.stringify(cam.name)},\n    role: ${JSON.stringify(cam.role)},\n    photos: [\n${chosen.map((p) => "      " + JSON.stringify(p)).join(",\n")},\n    ],\n  },`;
  });
  const total = Object.values(picks).flat().length;
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    join(ROOT, "photos.js"),
    `// Fotos reales de Perseverance (API raw_images de la NASA), elegidas a mano después de verlas:
// a color, con horizonte, el brazo sobre el suelo o rocas de cerca. Sin cielo vacío, sol, calibración
// ni miniaturas. Generado con \`npm run fotos -- escribir\` el ${today}.
// Fuente: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2
export const CAMERAS = {
${body.join("\n")}
};
`
  );
  console.log(`photos.js actualizado con ${total} fotos.`);
}

if (process.argv[2] === "escribir") {
  await writePhotosJs();
} else {
  console.log("Bajando candidatas recientes de la NASA…");
  const candidates = await download();
  await writeFile(CANDIDATES_JSON, JSON.stringify(candidates, null, 1));
  await writeFile(CANDIDATES_HTML, contactSheet(candidates));
  if (!existsSync(PICKS_JSON)) {
    await writeFile(PICKS_JSON, JSON.stringify({ mastcam: [{ n: 0, caption: "Describe qué se ve" }], navcam: [], hazcam: [], watson: [] }, null, 2) + "\n");
  }
  console.log(`\nAbre fotos-candidatas.html (con el servidor: http://localhost:8080/fotos-candidatas.html),\nelige y escribe tus elegidas en fotos-elegidas.json, luego: npm run fotos -- escribir`);
}
