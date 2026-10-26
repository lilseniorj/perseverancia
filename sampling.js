import * as THREE from "three";
import { STOWED_POSE, applyArmPose, lerpPose, armPoseFor } from "./rover.js";

export const MAX_SAMPLES = 43; // tubos que lleva el Perseverance real

const DEPLOY_TIME = 1.4;
const DRILL_TIME = 2.0;
const STOW_TIME = 1.2;

const ease = (t) => t * t * (3 - 2 * t);

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

  const state = { phase: "idle", t: 0, target: null, pose: null, candidate: null, count: 0, time: 0 };
  const tmp = new THREE.Vector3();

  function findCandidate() {
    let best = null;
    rover.group.updateMatrixWorld();
    for (const s of samples) {
      if (s.sampled) continue;
      // Descarte rápido: lo que está a más de 4 m ni lo miramos.
      if (Math.hypot(s.x - rover.group.position.x, s.z - rover.group.position.z) > 4) continue;
      const local = rover.group.worldToLocal(tmp.set(s.x, s.top, s.z));
      const pose = armPoseFor(local);
      if (!pose) continue;
      const dist = local.length();
      if (!best || dist < best.dist) best = { sample: s, pose, dist };
    }
    return best;
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
      const arm = rover.arm;

      if (state.phase === "idle") {
        state.candidate = roverStopped && state.count < MAX_SAMPLES ? findCandidate() : null;
      } else if (state.phase === "deploy") {
        state.t = Math.min(1, state.t + dt / DEPLOY_TIME);
        applyArmPose(arm, lerpPose(STOWED_POSE, state.pose, ease(state.t)));
        if (state.t === 1) Object.assign(state, { phase: "drill", t: 0 });
      } else if (state.phase === "drill") {
        state.t = Math.min(1, state.t + dt / DRILL_TIME);
        arm.drill.rotation.y += dt * 40;
        // Pequeña vibración mientras taladra.
        arm.turret.position.y = Math.sin(state.time * 90) * 0.006;
        if (state.t === 1) {
          arm.turret.position.y = 0;
          finishSample(state.target);
          Object.assign(state, { phase: "stow", t: 0 });
        }
      } else if (state.phase === "stow") {
        state.t = Math.min(1, state.t + dt / STOW_TIME);
        applyArmPose(arm, lerpPose(state.pose, STOWED_POSE, ease(state.t)));
        if (state.t === 1) Object.assign(state, { phase: "idle", t: 0, target: null, candidate: null });
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
