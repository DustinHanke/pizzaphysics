import * as T from 'three';
import type { NoodleWorld } from './NoodleWorld';

const RADIAL = 9;
const SEGMENTS = 32;
const tangent = new T.Vector3();
const normal = new T.Vector3();
const binormal = new T.Vector3();
const zAxis = new T.Vector3(0, 0, 1);
const xAxis = new T.Vector3(1, 0, 0);

function createTubeGeometry() {
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array((SEGMENTS + 1) * RADIAL * 3);
  const normals = new Float32Array(positions.length);
  const indices: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * RADIAL + j, b = i * RADIAL + (j + 1) % RADIAL;
    indices.push(a, b, a + RADIAL, b, b + RADIAL, a + RADIAL);
  }
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('normal', new T.BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage));
  geometry.setIndex(indices);
  return geometry;
}

/** A fixed-topology tube: only vertex positions and normals change each frame. */
export class NoodleRenderer {
  private meshes: T.Mesh[] = [];
  private dough = new T.MeshStandardMaterial({ color: '#ecd09d', roughness: .92, metalness: 0, side: T.DoubleSide });
  readonly grips: { left: T.Mesh; right: T.Mesh };
  constructor(private scene: T.Scene) {
    const board = new T.Mesh(
      new T.CylinderGeometry(3.25, 3.35, .17, 64),
      new T.MeshStandardMaterial({ color: '#77553b', roughness: .9 })
    );
    board.position.y = .13;
    board.receiveShadow = true;
    scene.add(board);
    // The small dough knobs are both visual pinch points and raycast targets.
    const makeGrip = (side: 'left' | 'right') => {
      const grip = new T.Mesh(
        new T.SphereGeometry(.18, 18, 12),
        new T.MeshStandardMaterial({ color: '#e5b879', roughness: .88 })
      );
      grip.userData.side = side;
      grip.castShadow = true;
      grip.scale.set(1, .86, 1);
      scene.add(grip);
      return grip;
    };
    this.grips = { left: makeGrip('left'), right: makeGrip('right') };
  }

  private resizeStrands(count: number) {
    while (this.meshes.length > count) {
      const removed = this.meshes.pop()!;
      this.scene.remove(removed);
      removed.geometry.dispose();
    }
    while (this.meshes.length < count) {
      const mesh = new T.Mesh(createTubeGeometry(), this.dough);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  update(world: NoodleWorld) {
    this.resizeStrands(world.strandCount);
    this.grips.left.position.copy(world.left);
    this.grips.right.position.copy(world.right);
    for (let strandIndex = 0; strandIndex < world.strands.length; strandIndex++) {
      const points = world.strands[strandIndex].points;
      const geometry = this.meshes[strandIndex].geometry;
      const positions = (geometry.getAttribute('position') as T.BufferAttribute).array as Float32Array;
      const normals = (geometry.getAttribute('normal') as T.BufferAttribute).array as Float32Array;
      for (let i = 0; i <= SEGMENTS; i++) {
        tangent.subVectors(points[Math.min(SEGMENTS, i + 1)], points[Math.max(0, i - 1)]);
        if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
        tangent.normalize();
        normal.crossVectors(tangent, zAxis);
        if (normal.lengthSq() < .03) normal.crossVectors(tangent, xAxis);
        normal.normalize();
        binormal.crossVectors(tangent, normal).normalize();
        for (let j = 0; j < RADIAL; j++) {
          const angle = j / RADIAL * Math.PI * 2;
          const c = Math.cos(angle), s = Math.sin(angle);
          const relief = 1 + .025 * Math.sin(i * 1.9 + j * 2.1 + strandIndex * 3.7);
          const radius = world.radius * relief;
          const index = (i * RADIAL + j) * 3;
          const nx = normal.x * c + binormal.x * s;
          const ny = normal.y * c + binormal.y * s;
          const nz = normal.z * c + binormal.z * s;
          positions[index] = points[i].x + radius * nx;
          positions[index + 1] = points[i].y + radius * ny;
          positions[index + 2] = points[i].z + radius * nz;
          normals[index] = nx;
          normals[index + 1] = ny;
          normals[index + 2] = nz;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    }
  }
}
