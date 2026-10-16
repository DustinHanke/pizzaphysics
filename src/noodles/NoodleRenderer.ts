import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { NoodleWorld } from './NoodleWorld';

const RADIAL = 16;
const SEGMENTS = 32;
const tangent = new T.Vector3();
const normal = new T.Vector3();
const binormal = new T.Vector3();
const oldPoint = new T.Vector3();
const zAxis = new T.Vector3(0, 0, 1);
const xAxis = new T.Vector3(1, 0, 0);
const grain = (x: number) => {
  const n = Math.sin(x * 127.1 + 78.233) * 43758.5453123;
  return n - Math.floor(n);
};
const smoothstep = (a: number, b: number, t: number) => {
  const u = T.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** A deterministic fine-grained procedural dough texture; no network request. */
function createDoughTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    const noise = grain(x * 0.51 + y * 6.17);
    const coarser = grain(Math.floor(x / 13) + Math.floor(y / 13) * 91);
    const shade = Math.round(220 + noise * 22 + coarser * 11);
    image.data[i] = shade;
    image.data[i + 1] = Math.min(255, shade + 2);
    image.data[i + 2] = Math.min(255, shade + 5);
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function createWorkbenchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#837c71';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 12000; i++) {
    const x = grain(i * 5.97) * 512;
    const y = grain(i * 1.79 + 2.9) * 256;
    const s = grain(i * 0.84 + 4.14);
    ctx.fillStyle = s > .5 ? `rgba(237,226,205,${.018 + s * .085})` : `rgba(49,43,38,${.012 + s * .085})`;
    ctx.fillRect(x, y, .35 + s * 2, .35 + s * 2);
  }
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function createFlourTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const haze = ctx.createRadialGradient(256, 160, 22, 256, 160, 220);
  haze.addColorStop(0, 'rgba(243,230,204,.24)');
  haze.addColorStop(.55, 'rgba(236,219,183,.13)');
  haze.addColorStop(1, 'rgba(243,227,199,0)');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 2300; i++) {
    const x = grain(i * 2.843) * 512, y = grain(i * 4.997 + 10) * 320;
    const radial = ((x - 256) / 240) ** 2 + ((y - 160) / 160) ** 2;
    if (radial > 1.25) continue;
    const s = grain(i * 6.341) * 1.7;
    ctx.fillStyle = `rgba(255,240,212,${.11 + grain(i * 3.5) * .26})`;
    ctx.beginPath(); ctx.ellipse(x, y, .25 + s, .2 + s * .65, 0, 0, Math.PI * 2); ctx.fill();
  }
  return new T.CanvasTexture(canvas);
}
function createTubeGeometry() {
  const geometry = new T.BufferGeometry();
  const count = (SEGMENTS + 1) * RADIAL;
  const positions = new Float32Array((count + 2) * 3);
  const normals = new Float32Array(positions.length);
  const colors = new Float32Array(positions.length);
  const uvs = new Float32Array((count + 2) * 2);
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = (i * RADIAL + j) * 2;
    uvs[a] = i / SEGMENTS * 2.6;
    uvs[a + 1] = j / RADIAL;
  }
  for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * RADIAL + j, b = i * RADIAL + (j + 1) % RADIAL;
    indices.push(a, b, a + RADIAL, b, b + RADIAL, a + RADIAL);
  }
  // Dedicated centers seal the otherwise open, sawed-off tube ends.
  for (let j = 0; j < RADIAL; j++) {
    indices.push(count, (j + 1) % RADIAL, j);
    const last = SEGMENTS * RADIAL;
    indices.push(count + 1, last + j, last + (j + 1) % RADIAL);
  }
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('normal', new T.BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('uv', new T.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Sculpted dynamic dough surfaces on a flour-dusted stone bench.
 * Grab proxies are transparent and do not appear as physical handles. */
export class NoodleRenderer {
  private meshes: T.Mesh[] = [];
  private doughTexture = createDoughTexture();
  private dough = new T.MeshPhysicalMaterial({
    color: '#f6d7a3', map: this.doughTexture, roughness: .89, metalness: 0,
    clearcoat: .03, clearcoatRoughness: .8, vertexColors: true,
    side: T.DoubleSide
  });
  readonly grips: { left: T.Mesh; right: T.Mesh };
  private flourTexture = createFlourTexture();
  constructor(private scene: T.Scene) {
    const surface = new T.Mesh(
      new RoundedBoxGeometry(9.4, .27, 5.9, 5, .12),
      new T.MeshStandardMaterial({ map: createWorkbenchTexture(), color: '#a49b8c', roughness: .94 })
    );
    surface.position.set(0, .16, 0);
    surface.receiveShadow = true;
    scene.add(surface);
    const flour = new T.Mesh(new T.PlaneGeometry(8.8, 5.5),
      new T.MeshBasicMaterial({ map: this.flourTexture, transparent: true, opacity: .83, depthWrite: false }));
    flour.rotation.x = -Math.PI / 2;
    flour.position.set(0, .301, 0);
    scene.add(flour);

    // A small piece of extra dough establishes material scale without distracting from the pull.
    const scraps = new T.Mesh(
      new T.SphereGeometry(.36, 20, 14),
      new T.MeshStandardMaterial({ color: '#e9c997', map: this.doughTexture, roughness: .88 })
    );
    scraps.scale.set(2.35, .32, .73);
    scraps.position.set(-3.25, .43, -1.75);
    scraps.rotation.y = -.3;
    scraps.castShadow = true;
    scene.add(scraps);

    const createProxy = (side: 'left' | 'right') => {
      const proxy = new T.Mesh(
        new T.SphereGeometry(.36, 12, 9),
        new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      proxy.userData.side = side;
      scene.add(proxy);
      return proxy;
    };
    this.grips = { left: createProxy('left'), right: createProxy('right') };
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
    world.getRenderHandle('left', oldPoint);
    this.grips.left.position.copy(oldPoint);
    world.getRenderHandle('right', oldPoint);
    this.grips.right.position.copy(oldPoint);
    for (let strandIndex = 0; strandIndex < world.strands.length; strandIndex++) {
      const geometry = this.meshes[strandIndex].geometry;
      const positions = (geometry.getAttribute('position') as T.BufferAttribute).array as Float32Array;
      const normals = (geometry.getAttribute('normal') as T.BufferAttribute).array as Float32Array;
      const colors = (geometry.getAttribute('color') as T.BufferAttribute).array as Float32Array;
      for (let i = 0; i <= SEGMENTS; i++) {
        // Pull tangent from deformed points, so the cross section follows bending.
        world.getRenderPoint(strandIndex, Math.min(SEGMENTS, i + 1), tangent);
        world.getRenderPoint(strandIndex, Math.max(0, i - 1), oldPoint);
        tangent.sub(oldPoint);
        if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
        tangent.normalize();
        normal.crossVectors(tangent, zAxis);
        if (normal.lengthSq() < .03) normal.crossVectors(tangent, xAxis);
        normal.normalize();
        binormal.crossVectors(tangent, normal).normalize();
        const p = world.getRenderPoint(strandIndex, i, oldPoint);
        const t = i / SEGMENTS;
        const distToTip = Math.min(t, 1 - t);
        // Sculpted tip profile: a rounded narrow end, shoulders of thicker dough,
        // then visibly uneven material across the rest of the strand.
        const rolledEnd = .19 + .81 * smoothstep(0, .107, distToTip);
        const shoulder = .42 * Math.exp(-Math.pow((distToTip - .11) / .075, 2));
        const slowWaves = .095 * Math.sin(t * 7.7 + strandIndex * .62)
          + .066 * Math.sin(t * 18.9 + 1.1 + strandIndex * .19)
          + .033 * Math.sin(t * 41.3 + 2.6);
        const radius = world.radius * 1.34 * (1 + shoulder + slowWaves) * rolledEnd;
        const flatten = .86 + .14 * smoothstep(0, .13, distToTip);
        // Approximate the meridian slope for round rather than flat end shading.
        const tipSlope = distToTip < .11 ? .63 * (1 - smoothstep(0, .11, distToTip)) * (t < .5 ? -1 : 1) : 0;
        for (let j = 0; j < RADIAL; j++) {
          const angle = j / RADIAL * Math.PI * 2;
          const c = Math.cos(angle), s = Math.sin(angle);
          const grainValue = grain(i * 13.17 + j * 1.339 + strandIndex * 71.1);
          const longitudinal = Math.sin(t * 32 + strandIndex * 3.1 + Math.sin(angle) * 2);
          const relief = 1 + .036 * longitudinal + .018 * (grainValue - .5)
            + .016 * Math.sin(angle * 4 + t * 73 + strandIndex);
          const r = radius * relief;
          const index = (i * RADIAL + j) * 3;
          const nx = normal.x * c + binormal.x * s * flatten;
          const ny = normal.y * c + binormal.y * s * flatten;
          const nz = normal.z * c + binormal.z * s * flatten;
          positions[index] = p.x + r * nx;
          positions[index + 1] = p.y + r * ny;
          positions[index + 2] = p.z + r * nz;
          const nlen = Math.hypot(nx, ny, nz) || 1;
          normals[index] = nx / nlen + tangent.x * tipSlope;
          normals[index + 1] = ny / nlen + tangent.y * tipSlope;
          normals[index + 2] = nz / nlen + tangent.z * tipSlope;
          // Broad, soft flour bloom and dough creases, not random black speckles.
          const flour = .075 * Math.pow(Math.max(0, Math.sin(t * 24.1 + Math.sin(angle * 2.5) * 1.2)), 7);
          const warmth = .92 + grainValue * .085 + flour - shoulder * .045
            + .022 * Math.sin(angle * 3 + i * .43);
          colors[index] = warmth;
          colors[index + 1] = warmth * .988;
          colors[index + 2] = warmth * .953;
        }
      }
      // Smoothed end caps share the same dough shader and round off each grip.
      for (let end = 0; end < 2; end++) {
        const p = world.getRenderPoint(strandIndex, end ? SEGMENTS : 0, oldPoint);
        const o = ((SEGMENTS + 1) * RADIAL + end) * 3;
        positions[o] = p.x;
        positions[o + 1] = p.y;
        positions[o + 2] = p.z;
        world.getRenderPoint(strandIndex, end ? SEGMENTS : 1, tangent);
        world.getRenderPoint(strandIndex, end ? SEGMENTS - 1 : 0, binormal);
        tangent.sub(binormal).normalize().multiplyScalar(end ? 1 : -1);
        normals[o] = tangent.x;
        normals[o + 1] = tangent.y;
        normals[o + 2] = tangent.z;
        colors[o] = .98;
        colors[o + 1] = .97;
        colors[o + 2] = .95;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }
}
