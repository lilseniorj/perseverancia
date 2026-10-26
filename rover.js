import * as THREE from "three";

// 1 unidad = 1 metro. El rover mira hacia +z.
export const WHEEL_RADIUS = 0.26;
const WHEEL_X = 1.0;
const WHEEL_Z = [0.8, 0.02, -0.75]; // delanteras, centrales, traseras
const BODY_Y = 0.9;

const mat = {
  white: new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.55, metalness: 0.1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa9abae, roughness: 0.4, metalness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc89b45, roughness: 0.35, metalness: 0.6 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x0b1a2a, roughness: 0.1, metalness: 0.8 }),
};

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

// Barra entre dos puntos: sirve para la suspensión y el brazo.
function bar(a, b, thickness, material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, len), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  return m;
}

function createWheel() {
  const wheel = new THREE.Group();
  const width = 0.26;

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, width, 28), mat.metal);
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, width + 0.02, 12), mat.dark);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);

  // Grousers: las "garras" que dan tracción sobre la arena.
  const grousers = 24;
  for (let i = 0; i < grousers; i++) {
    const a = (i / grousers) * Math.PI * 2;
    const g = box(width, 0.025, 0.03, mat.dark, 0, Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS);
    g.rotation.x = a;
    wheel.add(g);
  }
  return wheel;
}

function createSuspension(side) {
  const group = new THREE.Group();
  const x = side * 0.82;
  const legTop = (z) => new THREE.Vector3(x, 0.55, z);
  const hub = (z) => new THREE.Vector3(x, WHEEL_RADIUS, z);

  const rockerPivot = new THREE.Vector3(side * 0.72, BODY_Y - 0.1, 0.2);
  const bogiePivot = new THREE.Vector3(x, 0.62, -0.35);

  // Rocker: del cuerpo a la rueda delantera y al bogie.
  group.add(bar(rockerPivot, legTop(WHEEL_Z[0]), 0.07, mat.metal));
  group.add(bar(rockerPivot, bogiePivot, 0.07, mat.metal));
  // Bogie: une rueda central y trasera.
  group.add(bar(bogiePivot, legTop(WHEEL_Z[1]), 0.06, mat.metal));
  group.add(bar(bogiePivot, legTop(WHEEL_Z[2]), 0.06, mat.metal));

  for (const z of WHEEL_Z) {
    group.add(bar(legTop(z), hub(z), 0.06, mat.metal));
    group.add(bar(hub(z), new THREE.Vector3(side * (WHEEL_X - 0.12), WHEEL_RADIUS, z), 0.05, mat.dark));
  }
  return group;
}

function createMast() {
  const mast = new THREE.Group();
  const deckTop = BODY_Y + 0.25;

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.15, 12), mat.white);
  pole.position.y = deckTop + 0.575;
  mast.add(pole);

  const headY = deckTop + 1.2;
  mast.add(box(0.42, 0.2, 0.24, mat.white, 0, headY, 0.02));

  // Mastcam-Z: las dos cámaras "ojos" del rover.
  for (const sx of [-0.12, 0.12]) {
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16), mat.dark);
    cam.rotation.x = Math.PI / 2;
    cam.position.set(sx, headY - 0.02, 0.17);
    mast.add(cam);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), mat.lens);
    lens.position.set(sx, headY - 0.02, 0.221);
    mast.add(lens);
  }

  // SuperCam: el láser que analiza rocas a distancia.
  const superCam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 20), mat.white);
  superCam.rotation.x = Math.PI / 2;
  superCam.position.set(0, headY + 0.08, 0.12);
  mast.add(superCam);
  const superLens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), mat.lens);
  superLens.position.set(0, headY + 0.08, 0.191);
  mast.add(superLens);

  mast.position.set(0.45, 0, 0.7);
  return mast;
}

// Brazo robótico: hombro -> brazo -> codo -> antebrazo -> torreta con taladro.
// Cada articulación es un Group; girar uno mueve todo lo que cuelga de él.
const UPPER_ARM = 1.0;
const FOREARM = 0.8;
const DRILL_REACH = 0.47; // de la muñeca a la punta del taladro
const SHOULDER = new THREE.Vector3(0.5, BODY_Y, 1.08);

export const STOWED_POSE = { sy: -Math.PI / 2, sp: 0, ey: Math.PI * 0.85, ep: 0 };

function createArm() {
  const shoulder = new THREE.Group();
  shoulder.rotation.order = "YXZ";
  shoulder.position.copy(SHOULDER);
  shoulder.add(box(0.14, 0.14, 0.14, mat.dark, 0, 0, 0));
  shoulder.add(box(0.08, 0.08, UPPER_ARM, mat.white, 0, 0, UPPER_ARM / 2));

  const elbow = new THREE.Group();
  elbow.rotation.order = "YXZ";
  elbow.position.z = UPPER_ARM;
  elbow.add(box(0.11, 0.11, 0.11, mat.dark, 0, 0, 0));
  elbow.add(box(0.07, 0.07, FOREARM, mat.white, 0, 0, FOREARM / 2));
  shoulder.add(elbow);

  const turret = new THREE.Group();
  turret.position.z = FOREARM;
  turret.add(box(0.3, 0.22, 0.22, mat.metal, 0, -0.11, 0));
  const drill = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.25, 10), mat.dark);
  drill.position.y = -0.22 - 0.125;
  turret.add(drill);
  elbow.add(turret);

  const arm = { group: shoulder, shoulder, elbow, turret, drill };
  applyArmPose(arm, STOWED_POSE);
  return arm;
}

export function applyArmPose(arm, pose) {
  arm.shoulder.rotation.set(pose.sp, pose.sy, 0);
  arm.elbow.rotation.set(pose.ep, pose.ey, 0);
  // La torreta compensa la inclinación para que el taladro apunte siempre hacia abajo.
  arm.turret.rotation.x = -(pose.sp + pose.ep);
}

export function lerpPose(a, b, t) {
  const l = THREE.MathUtils.lerp;
  return { sy: l(a.sy, b.sy, t), sp: l(a.sp, b.sp, t), ey: l(a.ey, b.ey, t), ep: l(a.ep, b.ep, t) };
}

// Cinemática inversa de 2 segmentos: dado un punto (en coordenadas del rover),
// calcula los ángulos de hombro y codo para que la punta del taladro lo toque.
// Devuelve null si el punto está fuera del alcance del brazo.
export function armPoseFor(localTarget) {
  const v = localTarget.clone().sub(SHOULDER);
  v.y += DRILL_REACH;
  const yaw = Math.atan2(v.x, v.z);
  if (Math.abs(yaw) > 1.2) return null; // el brazo no alcanza hacia los costados ni atrás

  const r = v.length();
  if (r > UPPER_ARM + FOREARM - 0.02 || r < 0.5) return null;

  const clampCos = (c) => THREE.MathUtils.clamp(c, -1, 1);
  const below = Math.atan2(-v.y, Math.hypot(v.x, v.z)); // ángulo del objetivo bajo la horizontal
  const alpha = Math.acos(clampCos((UPPER_ARM ** 2 + r * r - FOREARM ** 2) / (2 * UPPER_ARM * r)));
  const gamma = Math.acos(clampCos((UPPER_ARM ** 2 + FOREARM ** 2 - r * r) / (2 * UPPER_ARM * FOREARM)));

  // Ley de cosenos: el codo queda arriba y el antebrazo baja hacia la roca.
  return { sy: yaw, sp: below - alpha, ey: 0, ep: Math.PI - gamma };
}

function createRTG() {
  // Generador nuclear (RTG): da energía sin depender del sol.
  const rtg = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), mat.dark);
  rtg.add(core);
  const fins = 8;
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2;
    const fin = box(0.02, 0.65, 0.16, mat.dark, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
    fin.rotation.y = -a;
    rtg.add(fin);
  }
  rtg.position.set(0, BODY_Y + 0.25, -1.15);
  rtg.rotation.x = -0.7;
  return rtg;
}

function createAntennas() {
  const group = new THREE.Group();
  // Antena de alta ganancia: el disco hexagonal para hablar con la Tierra.
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mat.metal);
  post.position.set(-0.4, BODY_Y + 0.4, -0.35);
  group.add(post);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 6), mat.metal);
  dish.position.set(-0.4, BODY_Y + 0.6, -0.35);
  dish.rotation.set(0.5, 0, -0.3);
  group.add(dish);

  const lowGain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 10), mat.white);
  lowGain.position.set(-0.1, BODY_Y + 0.42, -0.65);
  group.add(lowGain);
  return group;
}

function createBody() {
  const body = new THREE.Group();
  body.add(box(1.3, 0.5, 2.0, mat.white, 0, BODY_Y, 0));

  // Equipos sobre la cubierta.
  body.add(box(0.5, 0.12, 0.6, mat.gold, -0.3, BODY_Y + 0.31, 0.25));
  body.add(box(0.35, 0.15, 0.35, mat.dark, 0.3, BODY_Y + 0.32, -0.35));
  body.add(box(0.9, 0.04, 0.5, mat.metal, 0, BODY_Y + 0.27, -0.75));

  // Hazcams: cámaras para esquivar obstáculos, al frente y atrás.
  for (const sx of [-0.35, -0.2, 0.2, 0.35]) {
    body.add(box(0.08, 0.06, 0.04, mat.dark, sx, BODY_Y - 0.12, 1.02));
    body.add(box(0.08, 0.06, 0.04, mat.dark, sx, BODY_Y - 0.12, -1.02));
  }
  return body;
}

export function createRover() {
  const group = new THREE.Group();
  group.rotation.order = "YXZ";

  group.add(createBody());
  group.add(createMast());
  const arm = createArm();
  group.add(arm.group);
  group.add(createRTG());
  group.add(createAntennas());

  const wheels = [];
  for (const side of [-1, 1]) {
    group.add(createSuspension(side));
    for (const z of WHEEL_Z) {
      const wheel = createWheel();
      wheel.position.set(side * WHEEL_X, WHEEL_RADIUS, z);
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Cámara en la cabeza del mástil, justo delante de la Mastcam-Z, mirando hacia adelante y un poco abajo.
  const mastCam = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
  mastCam.rotation.order = "YXZ";
  mastCam.rotation.set(-0.15, Math.PI, 0);
  mastCam.position.set(0.45, BODY_Y + 1.43, 0.97);
  group.add(mastCam);

  return { group, wheels, mastCam, arm };
}

// Puntos donde cada llanta toca el suelo, en coordenadas del rover: [x, z].
export const DEFAULT_CONTACTS = [-1, 1].flatMap((side) => WHEEL_Z.map((z) => [side * WHEEL_X, z]));

// Apoya el rover sobre sus llantas: mide la altura del terreno bajo cada una y busca
// el plano que mejor pasa por esos puntos (mínimos cuadrados). Ese plano da la altura
// del rover, cuánto se inclina hacia adelante (pitch) y hacia el costado (roll).
export function placeOnTerrain(rover, heightAt, x, z, heading, contacts = DEFAULT_CONTACTS) {
  const sin = Math.sin(heading), cos = Math.cos(heading);

  // Plano h = a + b·lx + c·lz  →  sistema normal 3×3
  let n = 0, sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0, sh = 0, sxh = 0, szh = 0;
  for (const [lx, lz] of contacts) {
    const h = heightAt(x + lx * cos + lz * sin, z - lx * sin + lz * cos);
    n++;
    sx += lx; sz += lz;
    sxx += lx * lx; szz += lz * lz; sxz += lx * lz;
    sh += h; sxh += lx * h; szh += lz * h;
  }
  const [a, b, c] = solve3(
    [[n, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]],
    [sh, sxh, szh]
  );

  rover.position.set(x, a, z);
  rover.rotation.y = heading;
  rover.rotation.x = -Math.atan(c); // pendiente hacia adelante
  rover.rotation.z = Math.atan(b); // pendiente hacia el costado (+x)
}

// Regla de Cramer para un sistema 3×3.
function solve3(m, v) {
  const det = (q) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  return [0, 1, 2].map((col) => det(m.map((row, r) => row.map((val, k) => (k === col ? v[r] : val)))) / d);
}
