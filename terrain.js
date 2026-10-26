import * as THREE from "three";

const SIZE = 120;
const SEGMENTS = 220;

// Generador pseudoaleatorio con semilla: el terreno sale igual en cada recarga.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 2021; // año del aterrizaje en el cráter Jezero
let rand = mulberry32(SEED);

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, xf),
    THREE.MathUtils.lerp(c, d, xf),
    zf
  );
}

// Varias capas de ruido: colinas grandes + irregularidades pequeñas.
function fbm(x, z) {
  let total = 0, amp = 1, freq = 0.04, norm = 0;
  for (let i = 0; i < 5; i++) {
    total += valueNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return total / norm - 0.5;
}

const craters = [
  { x: 14, z: -10, r: 6, depth: 1.6 },
  { x: -18, z: 8, r: 4, depth: 1.0 },
  { x: 6, z: 20, r: 3, depth: 0.7 },
  { x: -10, z: -22, r: 8, depth: 2.0 },
  { x: 26, z: 14, r: 2.5, depth: 0.5 },
];

function craterOffset(x, z) {
  let h = 0;
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= c.depth * (1 - d * d);
    // Borde levantado alrededor del cráter.
    h += c.depth * 0.45 * Math.exp(-((d - 1) ** 2) / 0.06);
  }
  return h;
}

export function heightAt(x, z) {
  // Zona central más plana para que el rover arranque estable.
  const dist = Math.hypot(x, z);
  const flatten = THREE.MathUtils.smoothstep(dist, 2, 12);
  const hills = fbm(x, z) * 5 * (0.25 + 0.75 * flatten);
  return hills + craterOffset(x, z);
}

function buildGround() {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x7a3418);
  const light = new THREE.Color(0xc87445);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);

    // Zonas altas más claras (polvo), zonas bajas más oscuras.
    const t = THREE.MathUtils.clamp(0.5 + y * 0.18 + (hash(x * 3, z * 3) - 0.5) * 0.25, 0, 1);
    tmp.copy(dark).lerp(light, t);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  );
  mesh.receiveShadow = true;
  return mesh;
}

function makeRockGeometry() {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  // Las caras no comparten vértices: hay que deformar igual cada punto repetido o la roca se agrieta.
  const scaleFor = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!scaleFor.has(key)) scaleFor.set(key, 0.75 + rand() * 0.5);
    const s = scaleFor.get(key);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.7, pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return geo;
}

// El rover pasa por encima de piedras chicas; solo las grandes lo bloquean.
const OBSTACLE_SIZE = 0.4;

// Tipos de roca del cráter Jezero; no se sabe cuál es hasta tomar la muestra.
const ROCK_TYPES = [
  { label: "Basalto", fact: "Roca volcánica: Marte tuvo volcanes activos.", weight: 35 },
  { label: "Arenisca", fact: "Arena compactada por agua o viento hace millones de años.", weight: 25 },
  { label: "Arcilla", fact: "Solo se forma con agua: rastro del antiguo lago Jezero.", weight: 20 },
  { label: "Carbonato", fact: "Puede conservar señales de vida microbiana antigua.", weight: 20 },
];

function pickRockType() {
  let r = rand() * 100;
  for (const t of ROCK_TYPES) {
    if ((r -= t.weight) < 0) return t;
  }
  return ROCK_TYPES[0];
}

function randomSpot(minDist = 3.5) {
  let x, z;
  do {
    x = (rand() - 0.5) * SIZE * 0.9;
    z = (rand() - 0.5) * SIZE * 0.9;
  } while (Math.hypot(x, z) < minDist); // dejamos libre el punto de partida
  return { x, z };
}

function addRock(group, samples, obstacles, shape, material, x, z, size) {
  const rock = new THREE.Mesh(shape, material);
  rock.scale.setScalar(size);
  rock.position.set(x, heightAt(x, z) + size * 0.2, z);
  rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);
  if (size > OBSTACLE_SIZE) obstacles.push({ x, z, r: size * 1.1 });
  const type = pickRockType();
  samples.push({
    kind: "rock",
    object: rock,
    x,
    z,
    top: rock.position.y + size * 0.7,
    size,
    label: type.label,
    fact: type.fact,
    sampled: false,
  });
}

function buildRocks(samples, obstacles, count = 160) {
  const group = new THREE.Group();
  const shapes = Array.from({ length: 6 }, makeRockGeometry);
  const material = new THREE.MeshStandardMaterial({ color: 0x5e3322, roughness: 0.95, flatShading: true });

  // Una roca de práctica justo delante del punto de partida, para la demo.
  addRock(group, samples, obstacles, shapes[0], material, 2.6, 5.2, 0.3);

  for (let i = 0; i < count; i++) {
    const { x, z } = randomSpot();
    // Muchas piedras chicas, pocas grandes.
    const size = 0.08 + Math.pow(rand(), 3) * 0.9;
    addRock(group, samples, obstacles, shapes[i % shapes.length], material, x, z, size);
  }
  return group;
}

function buildMeteorites(samples, count = 6) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x6b6460, roughness: 0.3, metalness: 0.85, flatShading: true });
  // El primero queda cerca del inicio para que se pueda encontrar rápido.
  const spots = [{ x: -3.5, z: 6 }, ...Array.from({ length: count - 1 }, () => randomSpot(8))];

  for (const { x, z } of spots) {
    const size = 0.15 + rand() * 0.12;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), material);
    m.position.set(x, heightAt(x, z) + size * 0.5, z);
    m.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
    m.castShadow = true;
    group.add(m);
    samples.push({
      kind: "object",
      object: m,
      x,
      z,
      top: m.position.y + size,
      size,
      label: "Meteorito de hierro",
      fact: "Cayó del espacio: Perseverance ya encontró uno de verdad.",
      sampled: false,
    });
  }
  return group;
}

function buildDebris(samples, count = 3) {
  const group = new THREE.Group();
  const panel = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.6, side: THREE.DoubleSide });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xc8501e, roughness: 0.9, side: THREE.DoubleSide });

  for (let i = 0; i < count; i++) {
    const { x, z } = randomSpot(10);
    const piece = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.35), panel);
    a.rotation.set(0.3, 0, 0.2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.3), i % 2 ? fabric : panel);
    b.position.set(0.25, 0.08, 0.15);
    b.rotation.set(-0.5, 0.6, 0.4);
    piece.add(a, b);
    piece.traverse((o) => o.isMesh && (o.castShadow = true));
    piece.position.set(x, heightAt(x, z) + 0.06, z);
    piece.rotation.y = rand() * Math.PI * 2;
    group.add(piece);
    samples.push({
      kind: "object",
      object: piece,
      x,
      z,
      top: piece.position.y + 0.15,
      size: 0.35,
      label: "Restos de la nave de aterrizaje",
      fact: "Piezas del escudo trasero y el paracaídas del aterrizaje de 2021.",
      sampled: false,
    });
  }
  return group;
}

export function createTerrain() {
  rand = mulberry32(SEED);
  const group = new THREE.Group();
  const obstacles = [];
  const samples = [];
  group.add(buildGround());
  group.add(buildRocks(samples, obstacles));
  group.add(buildMeteorites(samples));
  group.add(buildDebris(samples));
  return { group, obstacles, samples };
}
