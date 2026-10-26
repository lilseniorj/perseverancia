// npm start — servidor local sin caché (sin dependencias).
// python3 -m http.server deja que el navegador reutilice módulos viejos de su caché:
// tras actualizar el código, main.js nuevo importaba funciones de archivos viejos y la escena quedaba en negro.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT ?? 8080);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = resolve(ROOT, "." + (path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("No encontrado");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`El puerto ${PORT} ya está en uso. Cierra el otro servidor o usa otro puerto: PORT=8090 npm start`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => console.log(`Perseverance 3D en http://localhost:${PORT}  (Ctrl+C para detener)`));
