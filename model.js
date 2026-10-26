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

function nearest(centers, z) {
  let best = 0;
  for (let k = 1; k < centers.length; k++) {
    if (Math.abs(z - centers[k]) < Math.abs(z - centers[best])) best = k;
  }
  return best;
}
