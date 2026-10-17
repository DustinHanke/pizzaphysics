import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';

const world = new NoodleWorld();
const initial = world.totalLength;
assert.equal(world.strandCount, 1);
assert(Math.abs(world.diameterMm - 27.216) < 1e-8,
  'the displayed starting diameter must match the calibrated surface mesh');

// Check local plastic thinning independently of global volume changes.
// A locally yielded segment should be visibly narrower than its neighbours.
const localWorld = new NoodleWorld();
const initialMidRadius = localWorld.getLocalRadius(0, .5);
assert(Number.isFinite(initialMidRadius) && initialMidRadius > 0);
localWorld.strands[0].rest[16] *= 1.8;
assert(localWorld.getLocalRadius(0, .5) < initialMidRadius * .94,
  'local plastic extension must reduce the affected cross-section');
assert(localWorld.getLocalRadius(0, .25) > localWorld.getLocalRadius(0, .5),
  'the stretched middle must be thinner than neighbouring material');

// Stretch both anchors in a deliberately slow, high-frequency interaction.
for (let i = 0; i < 480; i++) {
  const x = 1.48 + i / 480 * 1.25;
  world.moveHandle('left', new T.Vector3(-x, 2.95, 0));
  world.moveHandle('right', new T.Vector3(x, 2.95, 0));
  world.step(1 / 120);
}
assert(world.totalLength > initial * 1.12, 'dough must yield plastically during the pull');
assert(world.diameterMm < 27.216, 'volume-conserving noodle must become thinner');
for (let i = 0; i <= 32; i++) {
  const r = world.getLocalRadius(0, i / 32);
  assert(Number.isFinite(r) && r > 0 && r < .4, 'local radii must remain bounded when stretched');
}
for (const strand of world.strands) for (const p of strand.points) assert(Number.isFinite(p.lengthSq()));

const volumeProxy = world.totalLength * world.radius ** 2;
const beforeFold = world.totalLength;
assert.equal(world.fold(), true);
assert.equal(world.strandCount, 2);
assert(Math.abs(world.totalLength - beforeFold) < 1e-7, 'fold must preserve overall rest length');
assert(Math.abs(volumeProxy - world.totalLength * world.radius ** 2) < 1e-9, 'fold must preserve radius-weighted volume');
assert.equal(world.fold(), false, 'fold must require another pull');
for (let i = 0; i < 120; i++) world.step(1 / 120);
assert.equal(world.folding, false, 'fold transition must complete deterministically');
assert(world.strands[0].points[16].distanceTo(world.strands[1].points[16]) > .14,
  'doubled strands must visibly separate instead of occupying the same path');
for (const strand of world.strands) for (const p of strand.points)
  assert(Number.isFinite(p.lengthSq()), 'folded particle positions must remain finite');

let count = world.strandCount;
for (let n = 0; n < 3; n++) {
  const start = world.left.x;
  const delta = 1.55;
  for (let i = 0; i < 600; i++) {
    const x = Math.abs(start) + delta * i / 600;
    world.moveHandle('left', new T.Vector3(-x, 3.1, 0));
    world.moveHandle('right', new T.Vector3(x, 3.1, 0));
    world.step(1 / 120);
  }
  assert(world.fold(), 'new strands should fold after pulling longer');
  count *= 2;
  assert.equal(world.strandCount, count);
  assert(world.strands.every(s => s.points.length === 33 && s.rest.length === 32));
  // The doubled noodle loops terminate in separate paired anchors.
  for (let k = 0; k < world.strandCount; k += 2) {
    const a = world.strands[k].points[32];
    const b = world.strands[k + 1].points[32];
    assert(a.distanceTo(b) > .01, 'a folded loop must have a nonzero opening');
  }
}
assert.equal(world.strandCount, 16);
assert.equal(world.fold(), false, 'limit the detailed prototype to sixteen strands');
for (let i = 0; i < 120; i++) world.step(1 / 120);
assert.equal(world.folding, false);
assert.equal(world.batchReady, true, 'a sufficiently even sixteen-strand pull must reach the finish state');
assert(world.uniformity >= 0 && world.uniformity <= 100, 'pull quality must be bounded');
assert(Number.isFinite(world.minDiameterMm) && world.minDiameterMm > 0);
console.log('LAMIAN_16_STRAND_SAMPLE', JSON.stringify({
  diameterMm: Number(world.diameterMm.toFixed(2)),
  minDiameterMm: Number(world.minDiameterMm.toFixed(2)),
  uniformity: world.uniformity,
  completed: world.batchReady,
  totalLengthCm: Number((world.totalLength * 10).toFixed(1)),
}));

world.reset();
const centerZ = world.strands[0].points[16].z;
assert.equal(world.snap(), true, 'snap should apply a swing impulse');
world.step(1 / 120);
assert(Math.abs(world.strands[0].points[16].z - centerZ) > .01,
  'a snap must move the middle of the strand in the transverse direction');
for (let i = 0; i < 360; i++) {
  world.step(1 / 120);
  assert(Number.isFinite(world.strands[0].points[16].lengthSq()));
}
assert(world.contacts >= 0, 'contact counter must remain well-defined');
world.reset();
assert.equal(world.strandCount, 1);
assert(Math.abs(world.totalLength - initial) < 1e-8);
assert(world.uniformity >= 90, 'fresh dough should start uniform');
assert(Number.isFinite(world.minDiameterMm) && world.minDiameterMm > 0);
// Floor constraint must not inject a downward Verlet impulse at rest.
for (let t = 0; t < 140; t++) world.step(1 / 120);
for (const strand of world.strands) for (let i = 1; i < 32; i++) {
  const floor = .32 + world.getLocalRadius(0, i / 32);
  assert(strand.points[i].y >= floor - 1e-6, 'material may not tunnel through the bench');
  if (Math.abs(strand.points[i].y - floor) < 1e-5)
    assert(Math.abs(strand.points[i].y - strand.previous[i].y) < 1e-4,
      'contact should not create artificial normal velocity');
}
const stepsBeforeStall = world.steps;
world.advance(10);
assert(world.steps - stepsBeforeStall <= 6, 'fixed timestep must cap work following a stalled frame');
for (const strand of world.strands) for (const p of strand.points) assert(Number.isFinite(p.lengthSq()));
console.log('PASS: noodle plasticity, folding, thickness, reset, and bounded fixed-step simulation');
