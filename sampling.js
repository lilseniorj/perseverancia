import * as THREE from "three";

export const MAX_SAMPLES = 43; // tubos que lleva el Perseverance real

const DEPLOY_TIME = 1.8;
const DRILL_TIME = 2.0;
const STOW_TIME = 1.5;
const SEARCH_RADIUS = 4; // m: lo que está más lejos ni se intenta alcanzar

const ease = (t) => t * t * (3 - 2 * t);

// El brazo se maneja a través de rover.armDriver (brazo simple o brazo real de la NASA):
// stowed, solve(puntoMundo) → pose | null, apply(pose), lerp(a, b, t), spinDrill(dt), resetDrill().
export function createSampler({ scene, rover, samples, heightAt, onSample }) {
  const sampledRockMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6a4e, roughness: 0.9, flatShading: true });

  // Anillo en el suelo que marca qué va a tomar el brazo.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const state = { phase: "idle", t: 0, target: null, pose: null, candidate: null, count: 0, time: 0, searchedAt: null };
  const tmp = new THREE.Vector3();

  function findCandidate() {
    const arm = rover.armDriver;
    let best = null;
    rover.group.updateMatrixWorld(true);
    for (const s of samples) {
      if (s.sampled) continue;
      if (Math.hypot(s.x - rover.group.position.x, s.z - rover.group.position.z) > SEARCH_RADIUS) continue;
      const local = rover.group.worldToLocal(tmp.set(s.x, s.top, s.z));
      if (local.z < 0.3) continue; // el brazo trabaja hacia adelante
      const pose = arm.solve(new THREE.Vector3(s.x, s.top, s.z));
      if (!pose) continue;
      const dist = local.length();
      if (!best || dist < best.dist) best = { sample: s, pose, dist };
    }
    return best;
  }

  // Resolver el brazo cuesta: solo se busca de nuevo si el rover se movió o cambió de brazo.
  function searchKey() {
    const p = rover.group.position;
    return `${p.x.toFixed(3)},${p.z.toFixed(3)},${rover.group.rotation.y.toFixed(3)},${rover.armDriver === state.lastDriver}`;
  }

  function finishSample(s) {
    s.sampled = true;
    state.count++;
    if (s.kind === "rock") {
      s.object.material = sampledRockMaterial; // queda la marca del taladro
    } else {
      s.object.visible = false; // los objetos se recogen
    }
    onSample(s, state.count);
  }

  return {
    get busy() {
      return state.phase !== "idle";
    },
    get count() {
      return state.count;
    },
    get candidate() {
      return state.phase === "idle" ? state.candidate?.sample ?? null : null;
    },

    // Devuelve "ok" o el motivo por el que no se pudo empezar.
    tryStart() {
      if (state.phase !== "idle") return "busy";
      if (state.count >= MAX_SAMPLES) return "full";
      if (!state.candidate) return "none";
      state.target = state.candidate.sample;
      state.pose = state.candidate.pose;
      state.phase = "deploy";
      state.t = 0;
      return "ok";
    },

    update(dt, roverStopped) {
      state.time += dt;
      const arm = rover.armDriver;

      if (state.phase === "idle") {
        if (!roverStopped || state.count >= MAX_SAMPLES) {
          state.candidate = null;
          state.searchedAt = null;
        } else {
          const key = searchKey();
          if (key !== state.searchedAt) {
            state.candidate = findCandidate();
            state.lastDriver = arm;
            state.searchedAt = searchKey();
          }
        }
      } else if (state.phase === "deploy") {
        state.t = Math.min(1, state.t + dt / DEPLOY_TIME);
        arm.apply(arm.lerp(arm.stowed, state.pose, ease(state.t)));
        if (state.t === 1) Object.assign(state, { phase: "drill", t: 0 });
      } else if (state.phase === "drill") {
        state.t = Math.min(1, state.t + dt / DRILL_TIME);
        arm.spinDrill(dt);
        if (state.t === 1) {
          arm.resetDrill();
          finishSample(state.target);
          Object.assign(state, { phase: "stow", t: 0 });
        }
      } else if (state.phase === "stow") {
        state.t = Math.min(1, state.t + dt / STOW_TIME);
        arm.apply(arm.lerp(state.pose, arm.stowed, ease(state.t)));
        if (state.t === 1) Object.assign(state, { phase: "idle", t: 0, target: null, candidate: null, searchedAt: null });
      }

      const marked = state.phase === "idle" ? state.candidate?.sample : state.phase !== "stow" ? state.target : null;
      ring.visible = !!marked;
      if (marked) {
        ring.position.set(marked.x, heightAt(marked.x, marked.z) + 0.03, marked.z);
        ring.scale.setScalar(Math.max(0.6, marked.size * 1.8));
        ring.material.opacity = 0.5 + 0.35 * Math.sin(state.time * 5);
        ring.material.color.set(state.phase === "idle" ? 0xffffff : 0x7fd4ff);
      }
    },
  };
}
