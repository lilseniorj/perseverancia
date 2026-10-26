import * as THREE from "three";

// Brazo robótico real del modelo de la NASA: 5 articulaciones en cadena.
// Sus ejes no los inventamos: se leen de las animaciones que trae el propio modelo.
const JOINTS = [
  { node: "arm003", clip: "arm.003Action" }, // giro del hombro (eje vertical)
  { node: "arm002", clip: "arm.002Action" }, // elevación del hombro
  { node: "arm", clip: "armAction" }, // codo
  { node: "arm004", clip: "arm.004Action" }, // muñeca
];
const DRILL_NODE = "corring_drill";

const REACH_ERROR = 0.05; // m: si la punta queda más lejos, la roca no está al alcance
const TILT_ERROR = 0.15; // m: cuánto puede desviarse la base del taladro de la vertical

function findNode(root, name) {
  let found;
  root.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

// Caja de un objeto (y todas sus mallas) medida en su propio espacio local.
function localBox(obj) {
  const box = new THREE.Box3();
  const toLocal = obj.matrixWorld.clone().invert();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(o.matrixWorld)));
  });
  return box;
}

// Eje de giro de una articulación: la rotación entre el primer cuadro de su animación
// y el cuadro más alejado, expresada en el espacio local del nodo.
function axisFromClip(clip, nodeName) {
  const track = clip?.tracks.find((t) => t.name === `${nodeName}.quaternion`);
  if (!track) return null;
  const v = track.values;
  const q0 = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
  let best = null, bestAngle = 0;
  for (let i = 4; i < v.length; i += 4) {
    const q = new THREE.Quaternion(v[i], v[i + 1], v[i + 2], v[i + 3]);
    const a = q0.angleTo(q);
    if (a > bestAngle) {
      bestAngle = a;
      best = q;
    }
  }
  if (!best) return null;
  const d = q0.clone().invert().multiply(best);
  const s = Math.sqrt(Math.max(1e-9, 1 - d.w * d.w));
  return new THREE.Vector3(d.x / s, d.y / s, d.z / s).normalize();
}

export function createNasaArm(model, animations) {
  const joints = [];
  for (const j of JOINTS) {
    const node = findNode(model, j.node);
    const axis = axisFromClip(animations.find((c) => c.name === j.clip), j.node);
    if (!node || !axis) return null;
    joints.push({ node, axis, rest: node.quaternion.clone() });
  }
  const drill = findNode(model, DRILL_NODE);
  const turret = findNode(model, "turret_obj");
  if (!drill || !turret) return null;
  const drillRest = drill.quaternion.clone();

  // Punta y base del taladro, en el espacio local del taladro: los extremos de su eje más largo.
  // La punta es el extremo más alejado de la torreta.
  model.updateMatrixWorld(true);
  const bb = localBox(drill);
  const size = bb.getSize(new THREE.Vector3());
  const k = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
  const center = bb.getCenter(new THREE.Vector3());
  const endA = center.clone(), endB = center.clone();
  endA[k] = bb.min[k];
  endB[k] = bb.max[k];
  const turretPos = turret.getWorldPosition(new THREE.Vector3());
  const distA = drill.localToWorld(endA.clone()).distanceTo(turretPos);
  const distB = drill.localToWorld(endB.clone()).distanceTo(turretPos);
  const tipLocal = distA > distB ? endA : endB;
  const baseLocal = distA > distB ? endB : endA;
  const drillLength = drill.localToWorld(tipLocal.clone()).distanceTo(drill.localToWorld(baseLocal.clone()));

  const tmpQ = new THREE.Quaternion();
  const tip = new THREE.Vector3(), base = new THREE.Vector3();
  const stowed = [0, 0, 0, 0];

  function apply(angles) {
    joints.forEach((j, i) => j.node.quaternion.copy(j.rest).multiply(tmpQ.setFromAxisAngle(j.axis, angles[i])));
    joints[0].node.updateMatrixWorld(true);
  }

  // Qué tan lejos queda la pose de lo que queremos: punta sobre la roca y taladro vertical.
  function cost(angles, target, baseTarget) {
    apply(angles);
    drill.localToWorld(tip.copy(tipLocal));
    drill.localToWorld(base.copy(baseLocal));
    return tip.distanceToSquared(target) + base.distanceToSquared(baseTarget);
  }

  // Cinemática inversa numérica: descenso de gradiente con paso adaptable, desde varias poses iniciales.
  function solve(targetWorld) {
    const target = targetWorld.clone();
    const baseTarget = target.clone().add(new THREE.Vector3(0, drillLength, 0));
    let best = null, bestCost = Infinity;
    for (const start of [[0, 0, 0, 0], [Math.PI / 2, 0, 0, 0], [-Math.PI / 2, 0, 0, 0]]) {
      const a = start.slice();
      let f = cost(a, target, baseTarget);
      let step = 0.5;
      for (let iter = 0; iter < 160 && step > 1e-4; iter++) {
        const grad = a.map((_, i) => {
          const h = 1e-3;
          a[i] += h;
          const fp = cost(a, target, baseTarget);
          a[i] -= 2 * h;
          const fm = cost(a, target, baseTarget);
          a[i] += h;
          return (fp - fm) / (2 * h);
        });
        const norm = Math.hypot(...grad) || 1;
        const candidate = a.map((x, i) => x - (step * grad[i]) / norm);
        const fc = cost(candidate, target, baseTarget);
        if (fc < f) {
          a.splice(0, 4, ...candidate);
          f = fc;
          step *= 1.3;
        } else {
          step *= 0.5;
        }
      }
      if (f < bestCost) {
        bestCost = f;
        best = a;
      }
    }

    apply(best);
    drill.localToWorld(tip.copy(tipLocal));
    drill.localToWorld(base.copy(baseLocal));
    const reached = tip.distanceTo(target) < REACH_ERROR && base.distanceTo(baseTarget) < TILT_ERROR;
    apply(stowed); // la búsqueda no debe dejar el brazo movido
    return reached ? best : null;
  }

  return {
    stowed,
    solve,
    apply,
    lerp: (a, b, t) => a.map((x, i) => THREE.MathUtils.lerp(x, b[i], t)),
    spinDrill(dt) {
      drill.rotateOnAxis(new THREE.Vector3().subVectors(tipLocal, baseLocal).normalize(), dt * 40);
    },
    resetDrill() {
      drill.quaternion.copy(drillRest);
    },
  };
}
