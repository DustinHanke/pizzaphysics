import * as T from 'three';
import type { NoodleWorld } from './NoodleWorld';

const RADIAL = 12;
const STEPS = 10;
const START = new T.Vector3();
const END = new T.Vector3();
const C1 = new T.Vector3();
const C2 = new T.Vector3();
const D1 = new T.Vector3();
const D2 = new T.Vector3();
const TMP1 = new T.Vector3();
const TMP2 = new T.Vector3();
const P = new T.Vector3();
const Q = new T.Vector3();
const tangent = new T.Vector3();
const normal = new T.Vector3();
const binormal = new T.Vector3();
const up = new T.Vector3(0, 0, 1);
const fallback = new T.Vector3(0, 1, 0);

function geometry() {
  const mesh = new T.BufferGeometry();
  const vertices = new Float32Array((STEPS + 1) * RADIAL * 3);
  const normals = new Float32Array(vertices.length);
  const uvs = new Float32Array((STEPS + 1) * RADIAL * 2);
  for (let i = 0; i <= STEPS; i++) for (let j = 0; j < RADIAL; j++) {
    const index = (i * RADIAL + j) * 2;
    uvs[index] = i / STEPS;
    uvs[index + 1] = j / RADIAL;
  }
  const indices: number[] = [];
  for (let i = 0; i < STEPS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * RADIAL + j;
    const b = i * RADIAL + (j + 1) % RADIAL;
    indices.push(a, b, a + RADIAL, b, b + RADIAL, a + RADIAL);
  }
  mesh.setAttribute('position', new T.BufferAttribute(vertices, 3).setUsage(T.DynamicDrawUsage));
  mesh.setAttribute('normal', new T.BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage));
  mesh.setAttribute('uv', new T.BufferAttribute(uvs, 2));
  const color = new Float32Array(vertices.length).fill(.97);
  mesh.setAttribute('color', new T.BufferAttribute(color, 3));
  mesh.setIndex(indices);
  return mesh;
}

/** U-bend at the looped ends of doubled dough strands. The same dynamic
 * dough material is shared with each strand, and buffers are never rebuilt
 * during dragging. This is a visual continuity cue, not volumetric topology. */
export class NoodleLoops {
  private meshes: T.Mesh[] = [];
  constructor(private scene: T.Scene, private material: T.Material) {}

  update(world: NoodleWorld) {
    const count = Math.floor(world.strandCount / 2);
    while (this.meshes.length < count) {
      const mesh = new T.Mesh(geometry(), this.material);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.scene.add(mesh);
    }
    for (let k = 0; k < this.meshes.length; k++) {
      const mesh = this.meshes[k];
      mesh.visible = k < count;
      if (!mesh.visible) continue;
      world.getRenderPoint(k * 2, 32, START);
      world.getRenderPoint(k * 2 + 1, 32, END);
      // Match the directions of both incoming strands. A cubic bend
      // avoids the sharp tube-to-loop junction of the former quadratic arch.
      world.getRenderPoint(k * 2, 31, D1);
      D1.subVectors(START, D1).normalize();
      world.getRenderPoint(k * 2 + 1, 31, D2);
      D2.subVectors(END, D2).normalize();
      const reach = Math.max(.15, START.distanceTo(END) * .55, world.radius * 2.2);
      // Both tangents point out of the strand endpoints into the same fold.
      // Favor the outer (+X) bend on extreme collisions rather than turning inward.
      D1.x = Math.max(.26, D1.x);
      D2.x = Math.max(.26, D2.x);
      D1.normalize(); D2.normalize();
      C1.copy(START).addScaledVector(D1, reach);
      C2.copy(END).addScaledVector(D2, reach);
      const g = mesh.geometry;
      const positions = (g.getAttribute('position') as T.BufferAttribute).array as Float32Array;
      const normals = (g.getAttribute('normal') as T.BufferAttribute).array as Float32Array;
      const endRadius = (world.getLocalRadius(k * 2, 1) + world.getLocalRadius(k * 2 + 1, 1)) * .5;
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS, a = 1 - t;
        P.copy(START).multiplyScalar(a * a * a)
          .addScaledVector(C1, 3 * a * a * t)
          .addScaledVector(C2, 3 * a * t * t)
          .addScaledVector(END, t * t * t);
        tangent.copy(Q.subVectors(C1, START)).multiplyScalar(3 * a * a)
          .addScaledVector(TMP1.subVectors(C2, C1), 6 * a * t)
          .addScaledVector(TMP2.subVectors(END, C2), 3 * t * t);
        if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
        tangent.normalize();
        normal.crossVectors(tangent, up);
        if (normal.lengthSq() < 1e-8) normal.crossVectors(tangent, fallback);
        normal.normalize();
        binormal.crossVectors(tangent, normal).normalize();
        for (let j = 0; j < RADIAL; j++) {
          const angle = (j / RADIAL) * Math.PI * 2;
          const x = Math.cos(angle), y = Math.sin(angle);
          const nx = normal.x * x + binormal.x * y;
          const ny = normal.y * x + binormal.y * y;
          const nz = normal.z * x + binormal.z * y;
          const n = (i * RADIAL + j) * 3;
          const radius = endRadius * (.90 + .33 * Math.sin(Math.PI * t));
          positions[n] = P.x + radius * nx;
          positions[n + 1] = P.y + radius * ny;
          positions[n + 2] = P.z + radius * nz;
          normals[n] = nx;
          normals[n + 1] = ny;
          normals[n + 2] = nz;
        }
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
  }
}
