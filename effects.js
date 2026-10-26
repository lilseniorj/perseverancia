import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

// Huellas: muchas copias de un mismo plano en un solo InstancedMesh (una sola llamada de dibujo).
export function createTracks(scene, heightAt, { max = 4000, spacing = 0.15 } = {}) {
  // Cada marca es un poco más larga que la separación, así se tocan y la huella se ve continua.
  const geo = new THREE.PlaneGeometry(0.32, spacing * 1.15);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x5a2410,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    // Empuja la huella hacia la cámara para que no parpadee contra el suelo.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.InstancedMesh(geo, material, max);
  mesh.count = 0;
  mesh.receiveShadow = true;
  // Las huellas se reparten por todo el mapa; el cálculo de visibilidad por defecto las ocultaría.
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  let next = 0; // búfer circular: al llenarse, se pisa la huella más vieja
  const last = [];
  const normal = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  function terrainNormal(x, z) {
    const e = 0.2;
    return normal
      .set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e))
      .normalize();
  }

  function stamp(x, z, heading) {
    pos.set(x, heightAt(x, z) + 0.01, z);
    tilt.setFromUnitVectors(UP, terrainNormal(x, z));
    yaw.setFromAxisAngle(UP, heading);
    matrix.compose(pos, tilt.multiply(yaw), one);
    mesh.setMatrixAt(next, matrix);
    next = (next + 1) % max;
    mesh.count = Math.min(mesh.count + 1, max);
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    // wheelPositions: una posición por lado (rueda trasera izquierda y derecha).
    update(wheelPositions, heading) {
      wheelPositions.forEach((p, i) => {
        if (!last[i]) last[i] = p.clone();
        if (Math.hypot(p.x - last[i].x, p.z - last[i].z) >= spacing) {
          stamp(p.x, p.z, heading);
          last[i].copy(p);
        }
      });
    },
  };
}

function makeDustTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Polvo: una reserva fija de sprites que se reciclan, así nunca creamos objetos nuevos al manejar.
export function createDust(scene, heightAt, color, { max = 150, life = 1.5 } = {}) {
  const texture = makeDustTexture();
  const particles = [];

  for (let i = 0; i < max; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, color, transparent: true, depthWrite: false, opacity: 0 })
    );
    sprite.visible = false;
    scene.add(sprite);
    particles.push({ sprite, velocity: new THREE.Vector3(), age: 0, active: false });
  }

  function emit(x, z, back) {
    const p = particles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.age = 0;
    p.sprite.visible = true;
    // Nace detrás de la rueda, para que no tape la cámara del mástil.
    p.sprite.position.set(x + back.x * 0.3, heightAt(x, z) + 0.1, z + back.z * 0.3);
    p.velocity.set(
      back.x * 0.6 + (Math.random() - 0.5) * 0.5,
      0.4 + Math.random() * 0.5,
      back.z * 0.6 + (Math.random() - 0.5) * 0.5
    );
  }

  return {
    // back: dirección opuesta al movimiento (vector unitario en el plano XZ).
    spawn(wheelPositions, speed, back, dt) {
      const chance = speed * dt * 8; // más rápido = más polvo
      for (const p of wheelPositions) {
        if (Math.random() < chance) emit(p.x, p.z, back);
      }
    },

    update(dt) {
      for (const p of particles) {
        if (!p.active) continue;
        p.age += dt;
        const t = p.age / life;
        if (t >= 1) {
          p.active = false;
          p.sprite.visible = false;
          continue;
        }
        p.velocity.multiplyScalar(1 - 1.5 * dt); // el aire lo frena
        p.velocity.y -= 0.15 * dt;
        p.sprite.position.addScaledVector(p.velocity, dt);
        p.sprite.scale.setScalar(0.3 + t * 1.2);
        // Aparece rápido y se desvanece lento.
        p.sprite.material.opacity = 0.6 * Math.min(1, t * 6) * (1 - t);
      }
    },
  };
}
