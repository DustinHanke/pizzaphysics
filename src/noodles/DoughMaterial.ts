import * as T from 'three';

const SIZE = 256;
const fract = (n: number) => n - Math.floor(n);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (v: number) => v * v * (3 - 2 * v);

function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(fract(x)), fy = smooth(fract(y));
  return lerp(
    lerp(hash(ix, iy), hash(ix + 1, iy), fx),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx),
    fy,
  );
}

/** Procedural albedo, normal and roughness maps for moist, lightly floured,
 * uncooked lamian dough. All maps are generated once, fully offline. */
export function createRawDoughMaterial() {
  const albedo = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  for (const c of [albedo, normalCanvas, roughnessCanvas]) c.width = c.height = SIZE;
  const col = albedo.getContext('2d')!;
  const norm = normalCanvas.getContext('2d')!;
  const rough = roughnessCanvas.getContext('2d')!;
  const rgba = col.createImageData(SIZE, SIZE);
  const normals = norm.createImageData(SIZE, SIZE);
  const roughness = rough.createImageData(SIZE, SIZE);
  const relief = new Float32Array(SIZE * SIZE);
  const flour = new Float32Array(SIZE * SIZE);

  // X follows the length of the noodle. Fine directional gluten striations,
  // soft flour deposits and pores read as material rather than digital noise.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const p = y * SIZE + x;
    const broad = noise(x / 45, y / 52);
    const middle = noise(x / 12, y / 19);
    const fine = noise(x / 2.7, y / 4.7);
    const streak = Math.sin(y * .16 + broad * 4.3 + Math.sin(x * .041) * .6) * .5 + .5;
    const cluster = Math.max(0, noise(x / 24 + 21, y / 27 + 53) - .60) * 2.4;
    const powder = Math.min(1, cluster * cluster + (hash(x, y) > .991 ? .42 : 0));
    flour[p] = powder;
    relief[p] = broad * .48 + middle * .26 + fine * .10 + streak * .16 - powder * .045;
    const shade = (broad - .5) * 11 + (middle - .5) * 6 + (fine - .5) * 2;
    const o = p * 4;
    // Very low saturation, slightly translucent-looking raw wheat dough.
    rgba.data[o] = Math.round(T.MathUtils.clamp(236 + shade + powder * 11, 0, 255));
    rgba.data[o + 1] = Math.round(T.MathUtils.clamp(226 + shade + powder * 13, 0, 255));
    rgba.data[o + 2] = Math.round(T.MathUtils.clamp(207 + shade + powder * 15, 0, 255));
    rgba.data[o + 3] = 255;
    const r = 205 + Math.round((middle - .5) * 24 + powder * 47);
    roughness.data[o] = roughness.data[o + 1] = roughness.data[o + 2] = r;
    roughness.data[o + 3] = 255;
  }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const at = (xx: number, yy: number) => relief[((yy + SIZE) % SIZE) * SIZE + (xx + SIZE) % SIZE];
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.3;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 1.3;
    const inv = 1 / Math.hypot(dx, dy, 1);
    const o = (y * SIZE + x) * 4;
    normals.data[o] = (0.5 - dx * inv * .5) * 255;
    normals.data[o + 1] = (0.5 - dy * inv * .5) * 255;
    normals.data[o + 2] = (0.5 + inv * .5) * 255;
    normals.data[o + 3] = 255;
  }
  col.putImageData(rgba, 0, 0);
  norm.putImageData(normals, 0, 0);
  rough.putImageData(roughness, 0, 0);

  function texture(canvas: HTMLCanvasElement, color = false) {
    const map = new T.CanvasTexture(canvas);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 4;
    if (color) map.colorSpace = T.SRGBColorSpace;
    return map;
  }
  return new T.MeshPhysicalMaterial({
    color: '#f6e8d0',
    map: texture(albedo, true),
    normalMap: texture(normalCanvas),
    normalScale: new T.Vector2(.27, .27),
    roughnessMap: texture(roughnessCanvas),
    roughness: .97,
    metalness: 0,
    clearcoat: .035,
    clearcoatRoughness: .88,
    vertexColors: true,
    side: T.DoubleSide,
  });
}
