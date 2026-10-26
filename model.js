import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export const MODEL_URL = "public/models/perseverance.glb";
// Piezas del modelo de la NASA que son cámaras (descartamos tapas, cables y soportes).
const CAMERA_NAME = /cam|lens|watson|camera/i;
const NOT_CAMERA = /cover|wiring|calibration|bracket/i;

// yaw: giro extra para que el frente del modelo mire hacia +z, como nuestro rover.
export async function loadPerseverance({ yaw = 0 } = {}) {
  // El modelo de la NASA viene comprimido con Draco; hace falta su decodificador.
  const draco = new DRACOLoader().setDecoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL_URL);
  const model = gltf.scene;

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // El modelo ya viene en metros reales (2.7 m de ancho, 3.1 m de largo): no lo escalamos.
  // Solo lo centramos en x/z y apoyamos las ruedas en y = 0.
  const holder = new THREE.Group();
  holder.add(model);
  model.rotation.y = yaw;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  holder.updateMatrixWorld(true);
  const wheels = splitWheels(model, holder);

  const cameras = {};
  model.traverse((o) => {
    if (o.name && CAMERA_NAME.test(o.name) && !NOT_CAMERA.test(o.name)) cameras[o.name] = o;
  });

  return { root: holder, model, animations: gltf.animations, cameras, size, wheels };
}

// El modelo viene con el mástil plegado (como viajó a Marte). Su animación "CylinderAction"
// lo levanta entre 0 y 5 s y lo mantiene arriba hasta los 10 s: congelamos ese momento.
const MAST_UP_TIME = 7.5;

export function deployMast(model, animations) {
  const clip = animations.find((c) => c.name === "CylinderAction");
  if (!clip) return false;
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  mixer.setTime(MAST_UP_TIME);
  return true;
}

// En el modelo de la NASA las 6 llantas vienen fundidas en 3 mallas (aluminio, goma y cubo).
// Para que cada una gire sobre su eje, repartimos los triángulos según dónde están:
// izquierda/derecha por el signo de x, y adelante/medio/atrás agrupando por z.
// Devuelve 6 grupos en el orden de nuestro rover: [izq-del, izq-medio, izq-tras, der-del, der-medio, der-tras].
function splitWheels(model, holder) {
  let node;
  model.traverse((o) => {
    if (o.name === "Wheels_objs") node = o;
  });
  if (!node) return null;

  const toHolder = holder.matrixWorld.clone().invert();
  const parts = [];
  node.traverse((o) => o.isMesh && parts.push(o));
  // Pasamos cada malla al espacio del rover y sin índices: 3 vértices seguidos = 1 triángulo.
  const geos = parts.map((m) => {
    const g = m.geometry.clone().applyMatrix4(toHolder.clone().multiply(m.matrixWorld));
    return g.index ? g.toNonIndexed() : g;
  });

  const centroid = (pos, t) => ({
    x: (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3,
    z: (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3,
  });

  // k-means en una dimensión para encontrar los 3 ejes (z) de las llantas.
  const zs = [];
  for (const g of geos) {
    const pos = g.attributes.position;
    for (let t = 0; t < pos.count / 3; t++) zs.push(centroid(pos, t).z);
  }
  let min = Infinity, max = -Infinity;
  for (const z of zs) {
    if (z < min) min = z;
    if (z > max) max = z;
  }
  let centers = [max, (min + max) / 2, min];
  for (let iter = 0; iter < 20; iter++) {
    const sum = [0, 0, 0], n = [0, 0, 0];
    for (const z of zs) {
      const k = nearest(centers, z);
      sum[k] += z;
      n[k]++;
    }
    centers = centers.map((c, k) => (n[k] ? sum[k] / n[k] : c));
  }
  centers.sort((a, b) => b - a); // adelante (z mayor) primero

  // buckets[rueda][parte][atributo] = lista de números
  const buckets = Array.from({ length: 6 }, () => geos.map(() => ({})));
  geos.forEach((g, p) => {
    const pos = g.attributes.position;
    const names = Object.keys(g.attributes);
    for (let t = 0; t < pos.count / 3; t++) {
      const c = centroid(pos, t);
      const w = (c.x < 0 ? 0 : 3) + nearest(centers, c.z);
      const bucket = buckets[w][p];
      for (const name of names) {
        const attr = g.attributes[name];
        const out = (bucket[name] ??= []);
        for (let v = t * 3; v < t * 3 + 3; v++) {
          out.push(attr.getX(v));
          if (attr.itemSize > 1) out.push(attr.getY(v));
          if (attr.itemSize > 2) out.push(attr.getZ(v));
          if (attr.itemSize > 3) out.push(attr.getW(v));
        }
      }
    }
  });

  const wheels = buckets.map((wheelParts) => {
    const pieceGeos = [];
    const box = new THREE.Box3();
    wheelParts.forEach((data, p) => {
      if (!data.position) return;
      const g = new THREE.BufferGeometry();
      for (const [name, values] of Object.entries(data)) {
        g.setAttribute(name, new THREE.Float32BufferAttribute(values, geos[p].attributes[name].itemSize));
      }
      g.computeBoundingBox();
      box.union(g.boundingBox);
      pieceGeos.push({ g, material: parts[p].material });
    });

    // El grupo queda en el centro de la llanta: girarlo = girar la llanta sobre su eje.
    const center = box.getCenter(new THREE.Vector3());
    const wheel = new THREE.Group();
    wheel.position.copy(center);
    for (const { g, material } of pieceGeos) {
      g.translate(-center.x, -center.y, -center.z);
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wheel.add(mesh);
    }
    wheel.userData.radius = (box.max.y - box.min.y) / 2;
    holder.add(wheel);
    return wheel;
  });

  node.visible = false; // escondemos las llantas originales fundidas
  for (const g of geos) g.dispose();
  return wheels;
}

// ---------- Suspensión rocker-bogie ----------
// Medidas tomadas del modelo visto de costado (cuadrícula de 10 cm): solo importan y, z,
// porque ambos pivotes giran sobre el eje x (de lado a lado del rover).
const ROCKER_PIVOT = new THREE.Vector3(0, 0.88, 0.4);
const BOGIE_PIVOT = new THREE.Vector3(0, 0.67, -0.35);
const BODY_HALF_WIDTH = 0.7; // más adentro de esto (barra del diferencial, |x| ≤ 0.66) son piezas fijas al cuerpo

// Recta del brazo trasero del rocker (de su pivote al del bogie): lo que queda bastante
// por debajo, entre los dos pivotes, es el brazo del bogie que baja a la llanta del medio.
function rockerArmY(z) {
  const t = (z - BOGIE_PIVOT.z) / (ROCKER_PIVOT.z - BOGIE_PIVOT.z);
  return BOGIE_PIVOT.y + t * (ROCKER_PIVOT.y - BOGIE_PIVOT.y);
}

function suspensionPart(x, y, z) {
  // Lo fijo al cuerpo está cerca del centro Y arriba; más abajo es el interior de las patas.
  if (Math.abs(x) < BODY_HALF_WIDTH && y > 0.7) return "body";
  const side = x < 0 ? "R" : "L"; // +x es el lado izquierdo del rover
  const isBogie = z < BOGIE_PIVOT.z + 0.05 || (z < ROCKER_PIVOT.z - 0.1 && y < rockerArmY(z) - 0.08);
  return side + (isBogie ? "bogie" : "rocker");
}

// Corta la malla de la suspensión en piezas que giran y cuelga las llantas de ellas.
// Devuelve { articulate(offsets) } donde offsets[i] es cuánto debe subir (+) o bajar (−)
// cada llanta, en el orden de wheels.
export function articulateSuspension(model, holder, wheels, { debugColors = false } = {}) {
  let node;
  model.traverse((o) => {
    if (o.name === "suspension") node = o;
  });
  if (!node || !wheels) return null;

  holder.updateMatrixWorld(true);
  const toHolder = holder.matrixWorld.clone().invert();
  const parts = [];
  node.traverse((o) => o.isMesh && parts.push(o));

  const groups = {};
  const makeGroup = (key, pivot, parent) => {
    const g = new THREE.Group();
    g.position.copy(pivot).sub(parent.userData.pivot ?? new THREE.Vector3());
    g.userData.pivot = pivot.clone();
    parent.add(g);
    return (groups[key] = g);
  };
  holder.userData.pivot = new THREE.Vector3();
  const body = (groups.body = holder);
  for (const s of ["L", "R"]) {
    const rocker = makeGroup(s + "rocker", ROCKER_PIVOT, holder);
    makeGroup(s + "bogie", BOGIE_PIVOT, rocker);
  }

  const debug = { body: 0x888888, Lrocker: 0x2266ff, Lbogie: 0xff8800, Rrocker: 0x22aa44, Rbogie: 0xdd2266 };
  for (const mesh of parts) {
    const g = mesh.geometry.clone().applyMatrix4(toHolder.clone().multiply(mesh.matrixWorld));
    const geo = g.index ? g.toNonIndexed() : g;
    const pos = geo.attributes.position;
    const buckets = {};
    for (let t = 0; t < pos.count / 3; t++) {
      const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
      const cy = (pos.getY(t * 3) + pos.getY(t * 3 + 1) + pos.getY(t * 3 + 2)) / 3;
      const cz = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3;
      const key = suspensionPart(cx, cy, cz);
      const b = (buckets[key] ??= {});
      for (const name of Object.keys(geo.attributes)) {
        const attr = geo.attributes[name];
        const out = (b[name] ??= []);
        for (let v = t * 3; v < t * 3 + 3; v++) {
          out.push(attr.getX(v));
          if (attr.itemSize > 1) out.push(attr.getY(v));
          if (attr.itemSize > 2) out.push(attr.getZ(v));
          if (attr.itemSize > 3) out.push(attr.getW(v));
        }
      }
    }
    for (const [key, data] of Object.entries(buckets)) {
      const piece = new THREE.BufferGeometry();
      for (const [name, values] of Object.entries(data)) {
        piece.setAttribute(name, new THREE.Float32BufferAttribute(values, geo.attributes[name].itemSize));
      }
      const pivot = groups[key].userData.pivot;
      piece.translate(-pivot.x, -pivot.y, -pivot.z);
      const material = debugColors ? new THREE.MeshBasicMaterial({ color: debug[key] }) : mesh.material;
      const m = new THREE.Mesh(piece, material);
      m.castShadow = m.receiveShadow = true;
      groups[key].add(m);
    }
    geo.dispose();
  }
  node.visible = false;

  // Llantas: la delantera cuelga del rocker; la del medio y la trasera, del bogie.
  // splitWheels las entrega como [del, medio, tras] de un lado y luego del otro: 0 y 3 son las delanteras.
  wheels.forEach((w, i) => {
    w.userData.rest = w.position.clone(); // posición original en el rover (contactos, huellas)
    w.userData.side = w.position.x < 0 ? "R" : "L";
    w.userData.front = i % 3 === 0;
    const parent = groups[w.userData.side + (w.userData.front ? "rocker" : "bogie")];
    w.position.copy(w.userData.rest).sub(parent.userData.pivot);
    parent.add(w);
  });

  const MAX_ANGLE = 0.35;
  const clamp = (a) => THREE.MathUtils.clamp(a, -MAX_ANGLE, MAX_ANGLE);

  return {
    // Mínimos cuadrados: con el ángulo del rocker (θr) y del bogie (θb) de cada lado,
    // cada llanta sube o baja ≈ −(distancia horizontal al pivote) · ángulo.
    articulate(offsets) {
      for (const s of ["L", "R"]) {
        const idx = wheels.map((_, i) => i).filter((i) => wheels[i].userData.side === s);
        const front = idx.find((i) => wheels[i].userData.front);
        const backs = idx.filter((i) => i !== front);
        const a = wheels[front].userData.rest.z - ROCKER_PIVOT.z;
        const b = BOGIE_PIVOT.z - ROCKER_PIVOT.z;
        // Filas: [coef θr, coef θb] = desplazamiento deseado
        const rows = [[-a, 0, offsets[front]], ...backs.map((i) => [-b, -(wheels[i].userData.rest.z - BOGIE_PIVOT.z), offsets[i]])];
        let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0;
        for (const [p, q, d] of rows) {
          s11 += p * p; s12 += p * q; s22 += q * q; t1 += p * d; t2 += q * d;
        }
        const det = s11 * s22 - s12 * s12 || 1;
        groups[s + "rocker"].rotation.x = clamp((t1 * s22 - t2 * s12) / det);
        groups[s + "bogie"].rotation.x = clamp((s11 * t2 - s12 * t1) / det);
      }
    },
  };
}

function nearest(centers, z) {
  let best = 0;
  for (let k = 1; k < centers.length; k++) {
    if (Math.abs(z - centers[k]) < Math.abs(z - centers[best])) best = k;
  }
  return best;
}
