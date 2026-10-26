import * as THREE from "three";
import { CAMERAS } from "./photos.js";

const MIN_DOT_GAP = 26; // px: Mastcam-Z y NavCam están a 8 cm, en pantalla se encimarían

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function daysAgo(utc) {
  const days = Math.floor((Date.now() - new Date(utc).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

// ---------- Visor de fotos ----------

export function createPhotoViewer({ onOpen, onClose }) {
  const root = el("div");
  root.id = "photo-viewer";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Foto de Percy");

  const shutterTop = el("div", "pv-shutter pv-shutter-top");
  const shutterBottom = el("div", "pv-shutter pv-shutter-bottom");
  const flash = el("div", "pv-flash");

  const frame = el("figure", "pv-frame");
  const imgWrap = el("div", "pv-img-wrap");
  const img = el("img", "pv-img");
  img.alt = "";
  const status = el("p", "pv-status", "");
  imgWrap.append(img, status);

  const caption = el("figcaption", "pv-caption");
  const camLine = el("p", "pv-cam");
  const camName = el("strong");
  const meta = el("span", "pv-meta");
  camLine.append(camName, meta);
  const text = el("p", "pv-text");
  const help = el("p", "pv-help", "Clic en la foto para ampliar · ← → más fotos de esta cámara · Esc para volver al juego");
  caption.append(camLine, text, help);
  frame.append(imgWrap, caption);
  root.append(frame, shutterTop, shutterBottom, flash);
  document.body.append(root);

  const state = { camera: null, index: 0, token: 0 };

  function show(index, { withShutter }) {
    const cam = CAMERAS[state.camera];
    state.index = (index + cam.photos.length) % cam.photos.length;
    const photo = cam.photos[state.index];
    const token = ++state.token;

    root.dataset.state = "shooting";
    root.dataset.camera = state.camera;
    root.classList.remove("pv-zoomed", "pv-revealed", "pv-shoot");
    img.style.transformOrigin = "";
    void root.offsetWidth; // reinicia las animaciones CSS
    if (withShutter) root.classList.add("pv-shoot");

    camName.textContent = cam.name;
    meta.textContent = ` · sol ${photo.sol} · ${daysAgo(photo.utc)} · foto ${state.index + 1} de ${cam.photos.length}`;
    text.textContent = photo.caption;
    status.textContent = "Recibiendo imagen desde Marte…";
    status.hidden = false;
    img.alt = `${cam.name}, sol ${photo.sol}: ${photo.caption}`;

    // La foto se revela poco a poco cuando termina de llegar (y después del flash).
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = photo.url;
    const minDelay = new Promise((r) => setTimeout(r, withShutter ? 450 : 120));
    Promise.all([loaded, minDelay])
      .then(() => {
        if (token !== state.token) return;
        status.hidden = true;
        root.classList.add("pv-revealed");
        root.dataset.state = "developing";
        setTimeout(() => token === state.token && (root.dataset.state = "revealed"), 2600);
      })
      .catch(() => {
        if (token !== state.token) return;
        status.textContent = "No llegó la imagen. Revisa la conexión a internet.";
        root.dataset.state = "error";
        console.warn("Foto de Marte no cargó:", photo.url);
      });
  }

  function open(cameraKey) {
    state.camera = cameraKey;
    root.hidden = false;
    onOpen?.();
    show(0, { withShutter: true });
  }

  function close() {
    if (root.hidden) return;
    state.token++;
    root.hidden = true;
    root.dataset.state = "closed";
    root.classList.remove("pv-zoomed", "pv-revealed", "pv-shoot");
    onClose?.();
  }

  imgWrap.addEventListener("click", (e) => {
    if (root.dataset.state !== "revealed" && root.dataset.state !== "developing") return;
    const rect = img.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
    root.classList.toggle("pv-zoomed");
  });

  window.addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(state.index + 1, { withShutter: true });
    else if (e.key === "ArrowLeft") show(state.index - 1, { withShutter: true });
    else return;
    e.preventDefault();
  });

  return {
    open,
    close,
    get isOpen() {
      return !root.hidden;
    },
  };
}

// ---------- Puntos sobre las cámaras del modelo ----------

export function createCameraHotspots({ rover, cameraParts, onPick }) {
  const layer = el("div");
  layer.id = "camera-dots";
  document.body.append(layer);

  const dots = [];
  for (const [key, cam] of Object.entries(CAMERAS)) {
    const part = cameraParts[cam.part];
    if (!part) continue;

    const button = el("button", "cam-dot");
    button.type = "button";
    button.hidden = true; // hasta el primer cuadro no tiene posición: aparecería en la esquina
    button.dataset.camera = key;
    button.setAttribute("aria-label", `${cam.name}: tomar una foto`);
    const tip = el("span", "cam-tip");
    tip.append(el("strong", null, cam.name), el("span", null, cam.role));
    button.append(tip);
    button.addEventListener("click", () => onPick(key));
    layer.append(button);
    dots.push({ key, part, button, screen: { x: 0, y: 0 } });
  }

  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  return {
    update(activeCamera, visible) {
      layer.hidden = !visible;
      if (!visible) return;
      const w = window.innerWidth, h = window.innerHeight;
      rover.group.updateMatrixWorld(true);
      for (const d of dots) {
        // Se recalcula en cada cuadro: el punto sigue a su pieza aunque el brazo o el mástil se muevan.
        box.setFromObject(d.part).getCenter(v);
        v.project(activeCamera);
        d.behind = v.z > 1;
        d.screen.x = (v.x * 0.5 + 0.5) * w;
        d.screen.y = (-v.y * 0.5 + 0.5) * h;
      }
      // Separa los puntos que caen casi en el mismo lugar de la pantalla.
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i].screen, b = dots[j].screen;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MIN_DOT_GAP) {
            const push = (MIN_DOT_GAP - dist) / 2;
            const nx = dist ? dx / dist : 0, ny = dist ? dy / dist : 1;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
      for (const d of dots) {
        d.button.hidden = d.behind;
        // "translate" (no "transform"): así el agrandado al pasar el mouse no mueve el punto.
        d.button.style.translate = `${d.screen.x}px ${d.screen.y}px`;
      }
    },
  };
}
