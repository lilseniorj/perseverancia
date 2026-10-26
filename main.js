import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTerrain, heightAt } from "./terrain.js";
import { createRover, placeOnTerrain, WHEEL_RADIUS, DEFAULT_CONTACTS } from "./rover.js";
import { createSampler, MAX_SAMPLES } from "./sampling.js";
import { loadPerseverance, deployMast } from "./model.js";
import { createTracks, createDust } from "./effects.js";
import { createMissionControl } from "./mission-control.js";
import { createPhotoViewer, createCameraHotspots } from "./camera-photos.js";

const MARS_SKY = 0xd9a07a;

const scene = new THREE.Scene();
scene.background = new THREE.Color(MARS_SKY);
// Polvo en suspensión: la atmósfera de Marte difumina el horizonte.
scene.fog = new THREE.Fog(MARS_SKY, 15, 70);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 3, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05; // que la cámara no se meta bajo el suelo

// El sol se ve más pequeño y la luz es más cálida/débil que en la Tierra.
const sun = new THREE.DirectionalLight(0xffe2c4, 2.2);
sun.position.set(10, 15, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);
scene.add(sun.target);
const SUN_OFFSET = sun.position.clone();

// Luz de rebote: cielo anaranjado arriba, suelo rojizo abajo.
scene.add(new THREE.HemisphereLight(0xf0b890, 0x5a2a14, 0.8));

const terrain = createTerrain();
scene.add(terrain.group);

const rover = createRover();
scene.add(rover.group);
rover.mastCam.aspect = camera.aspect;
rover.mastCam.updateProjectionMatrix();

// Mientras carga (o si falla la descarga) se ve nuestro rover de geometrías simples.
// Cuando llega el modelo oficial de la NASA, lo ponemos en su lugar dentro del mismo grupo,
// así la conducción, la inclinación y la cámara siguen funcionando igual.
let cameraHotspots = null; // se crean cuando llega el modelo con sus cámaras
loadPerseverance()
  .then(({ root, model, animations, cameras, wheels }) => {
    for (const child of rover.group.children) {
      if (child !== rover.mastCam) child.visible = false;
    }
    rover.group.add(root);
    rover.cameraParts = cameras;
    deployMast(model, animations);
    if (cameras.Mastcam_Z_cams) placeMastCam(cameras.Mastcam_Z_cams);
    cameraHotspots = createCameraHotspots({ rover, cameraParts: cameras, onPick: (key) => photoViewer.open(key) });
    if (wheels) {
      // Desde ahora giran y se apoyan las llantas reales del modelo.
      rover.wheels = wheels;
      rover.contacts = wheels.map((w) => [w.position.x, w.position.z]);
      REAR_WHEELS[0].set(wheels[2].position.x, 0, wheels[2].position.z);
      REAR_WHEELS[1].set(wheels[5].position.x, 0, wheels[5].position.z);
    }
    console.log("Cámaras del Perseverance (modelo NASA):");
    console.table(Object.keys(cameras).map((name) => ({ pieza: name })));
  })
  .catch((err) => console.error("No se pudo cargar el modelo de la NASA, se usa el rover simple.", err));

// La vista de la tecla C sale de la Mastcam-Z real, un poco por delante para no ver la propia cabeza.
function placeMastCam(mastcamPart) {
  rover.group.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(mastcamPart).getCenter(new THREE.Vector3());
  rover.mastCam.position.copy(rover.group.worldToLocal(center)).add(new THREE.Vector3(0, 0, 0.18));
}

// Puntos donde las ruedas traseras tocan el suelo (coordenadas del rover; +z es adelante).
// Se actualizan con las posiciones reales cuando carga el modelo.
const REAR_WHEELS = [new THREE.Vector3(-1.0, 0, -0.75), new THREE.Vector3(1.0, 0, -0.75)];
rover.contacts = DEFAULT_CONTACTS;
const tracks = createTracks(scene, heightAt);
const dust = createDust(scene, heightAt, 0xd2a27c);

// El Perseverance real va a ~4 cm/s; aquí lo aceleramos para que sea divertido.
const MAX_SPEED = 3; // m/s
const TURN_SPEED = 1.0; // rad/s
const ACCEL = 4;
const LIMIT = 55; // borde del terreno
const ROVER_RADIUS = 1.5; // el modelo real es un poco más grande que el simple

const state = {
  x: 0,
  z: 0,
  heading: Math.PI * 0.15,
  speed: 0,
  distance: 0,
  blockedTimer: 0,
  mastView: false,
};
placeOnTerrain(rover.group, heightAt, state.x, state.z, state.heading, rover.contacts);

const sampler = createSampler({
  scene,
  rover,
  samples: terrain.samples,
  heightAt,
  onSample: (s, n) => {
    showToast(`Muestra #${n}: ${s.label}`, s.fact);
    addToLog(n, s.label);
  },
});

const START_MESSAGES = {
  none: ["Nada al alcance del brazo", "Detén el rover frente a una roca u objeto."],
  full: ["Tubos llenos", `Ya usaste los ${MAX_SAMPLES} tubos de muestras.`],
};

const missionControl = createMissionControl(document.body);

const keys = new Set();
// Con una foto abierta, las teclas son del visor (flechas, Esc), no del rover.
const photoViewer = createPhotoViewer({ onOpen: () => keys.clear() });

window.addEventListener("keydown", (e) => {
  if (photoViewer.isOpen) return;
  keys.add(e.code);
  if (e.code === "KeyC" && !e.repeat) toggleView();
  if (e.code === "KeyT" && !e.repeat) missionControl.toggle();
  if (e.code === "KeyE" && !e.repeat) {
    const result = sampler.tryStart();
    if (START_MESSAGES[result]) showToast(...START_MESSAGES[result]);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

const pressed = (...codes) => codes.some((c) => keys.has(c));

function toggleView() {
  state.mastView = !state.mastView;
  controls.enabled = !state.mastView;
}

function hitsRock(x, z) {
  return terrain.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + ROVER_RADIUS);
}

function drive(dt) {
  // Con el brazo desplegado el rover no se mueve, igual que el real.
  const canDrive = !sampler.busy;
  const throttle = canDrive ? (pressed("KeyW", "ArrowUp") ? 1 : 0) - (pressed("KeyS", "ArrowDown") ? 1 : 0) : 0;
  const steer = canDrive ? (pressed("KeyA", "ArrowLeft") ? 1 : 0) - (pressed("KeyD", "ArrowRight") ? 1 : 0) : 0;

  const target = throttle * MAX_SPEED;
  const step = ACCEL * dt;
  state.speed += THREE.MathUtils.clamp(target - state.speed, -step, step);

  const omega = steer * TURN_SPEED;
  state.heading += omega * dt;

  const nextX = THREE.MathUtils.clamp(state.x + Math.sin(state.heading) * state.speed * dt, -LIMIT, LIMIT);
  const nextZ = THREE.MathUtils.clamp(state.z + Math.cos(state.heading) * state.speed * dt, -LIMIT, LIMIT);

  let moved = 0;
  if (hitsRock(nextX, nextZ)) {
    // Como las Hazcams reales: detecta el obstáculo y frena.
    state.speed = 0;
    state.blockedTimer = 1.5;
  } else {
    moved = Math.hypot(nextX - state.x, nextZ - state.z) * Math.sign(state.speed);
    state.x = nextX;
    state.z = nextZ;
    state.distance += Math.abs(moved);
  }
  state.blockedTimer = Math.max(0, state.blockedTimer - dt);

  const prevPos = rover.group.position.clone();
  placeOnTerrain(rover.group, heightAt, state.x, state.z, state.heading, rover.contacts);

  if (moved !== 0 || omega !== 0) {
    rover.group.updateMatrixWorld();
    const rearWheels = REAR_WHEELS.map((p) => rover.group.localToWorld(p.clone()));
    tracks.update(rearWheels, state.heading);
    if (moved !== 0) {
      // El polvo sale hacia atrás respecto de hacia dónde avanza (también al retroceder).
      const s = Math.sign(moved);
      const back = new THREE.Vector3(-Math.sin(state.heading) * s, 0, -Math.cos(state.heading) * s);
      dust.spawn(rearWheels, Math.abs(state.speed), back, dt);
    }
  }

  // Cada lado gira a distinta velocidad al doblar; así el rover puede girar en su lugar.
  for (const wheel of rover.wheels) {
    const sideDistance = moved - omega * wheel.position.x * dt;
    wheel.rotation.x += sideDistance / (wheel.userData.radius ?? WHEEL_RADIUS);
  }

  // La cámara y el sol acompañan al rover sin perder el ángulo que eligió el usuario.
  const delta = rover.group.position.clone().sub(prevPos);
  camera.position.add(delta);
  controls.target.add(delta);
  sun.position.copy(rover.group.position).add(SUN_OFFSET);
  sun.target.position.copy(rover.group.position);
}

const hud = {
  speed: document.getElementById("hud-speed"),
  distance: document.getElementById("hud-distance"),
  heading: document.getElementById("hud-heading"),
  camera: document.getElementById("hud-camera"),
  samples: document.getElementById("hud-samples"),
  alert: document.getElementById("hud-alert"),
  hint: document.getElementById("hud-hint"),
  toast: document.getElementById("toast"),
  log: document.getElementById("sample-log"),
};

let toastTimer;
function showToast(title, detail) {
  hud.toast.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("span");
  p.textContent = detail;
  hud.toast.append(strong, p);
  hud.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (hud.toast.hidden = true), 4500);
}

function addToLog(n, label) {
  const li = document.createElement("li");
  li.textContent = `#${n} ${label}`;
  hud.log.prepend(li);
  hud.log.hidden = false;
  while (hud.log.children.length > 6) hud.log.lastChild.remove();
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function updateHud() {
  // Tomamos -z como Norte.
  const deg = ((180 - THREE.MathUtils.radToDeg(state.heading)) % 360 + 360) % 360;
  hud.speed.textContent = `${Math.abs(state.speed).toFixed(1)} m/s`;
  hud.distance.textContent = `${state.distance.toFixed(1)} m`;
  hud.heading.textContent = `${deg.toFixed(0)}° ${COMPASS[Math.round(deg / 45) % 8]}`;
  hud.camera.textContent = state.mastView ? "Mastcam-Z" : "Órbita";
  hud.samples.textContent = `${sampler.count} / ${MAX_SAMPLES}`;
  hud.alert.hidden = state.blockedTimer === 0;

  const c = sampler.candidate;
  if (sampler.busy) {
    hud.hint.textContent = "Brazo trabajando…";
  } else if (c) {
    hud.hint.textContent = `${c.kind === "rock" ? "Roca" : "Objeto"} al alcance — presiona E para tomar muestra`;
  }
  hud.hint.hidden = !(sampler.busy || c);
}

window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  for (const cam of [camera, rover.mastCam]) {
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  drive(dt);
  dust.update(dt); // cada cuadro, para que el polvo termine de asentarse aunque el rover pare
  sampler.update(dt, Math.abs(state.speed) < 0.05);
  controls.update();
  cameraHotspots?.update(camera, !state.mastView && !photoViewer.isOpen);
  updateHud();
  renderer.render(scene, state.mastView ? rover.mastCam : camera);
}
animate();
