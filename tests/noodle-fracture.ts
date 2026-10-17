import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';
import { createTubeIndices } from '../src/noodles/NoodleRenderer';

const healthy = new NoodleWorld();
assert.equal(healthy.torn, false);
assert.equal(healthy.integrity, 100);
for (let i = 0; i < 480; i++) {
  const x = 1.48 + 1.25 * i / 480;
  healthy.moveHandle('left', new T.Vector3(-x, 2.95, 0));
  healthy.moveHandle('right', new T.Vector3(x, 2.95, 0));
  healthy.step(1 / 120);
}
assert.equal(healthy.torn, false, 'slow hand pulling must not snap fresh dough');
assert(healthy.integrity > 50, 'slow, deliberate pulling must preserve dough strength');

// Repeat abrupt pulls on a fresh rope without manually setting damage.
// This provides a repeatable gameplay threshold diagnostic.
const rough = new NoodleWorld();
for (let cycle = 0; cycle < 6 && !rough.torn; cycle++) {
  const x = cycle % 2 === 0 ? 4.5 : 1.25;
  for (let i = 0; i < 80 && !rough.torn; i++) {
    rough.moveHandle('left', new T.Vector3(-x, 2.95, 0));
    rough.moveHandle('right', new T.Vector3(x, 2.95, 0));
    rough.step(1 / 120);
  }
}
console.log('LAMIAN_FRACTURE_DIAGNOSTIC', JSON.stringify({
  repeatedYankTore: rough.torn,
  integrity: rough.integrity,
  totalLength: Number(rough.totalLength.toFixed(2)),
}));
assert(!rough.torn, 'repeated moderate strokes should not instantly destroy fresh dough');
assert(rough.integrity >= 60, 'moderate pulling must preserve most of the dough strength');

// Seed a localized weakened patch, then yank both hands apart. This tests the
// complete fracture path without depending on many seconds of accumulated
// playing time or input-device-specific movement speed.
const stressed = new NoodleWorld();
const weakSpot = 15;
stressed.strands[0].damage[weakSpot] = .985;
for (let i = 0; i < 100 && !stressed.torn; i++) {
  const x = 4.5;
  stressed.moveHandle('left', new T.Vector3(-x, 2.9, 0));
  stressed.moveHandle('right', new T.Vector3(x, 2.9, 0));
  stressed.step(1 / 120);
}
assert(stressed.torn, 'rapid tension must sever a locally weakened strand');
assert(stressed.tear && stressed.tear.segment >= 4 && stressed.tear.segment < 28);
assert.equal(stressed.integrity, 0);
assert.equal(stressed.fold(), false, 'severed dough may not be folded');
assert.equal(stressed.snap(), false, 'severed dough may not be flicked');
assert.equal(stressed.batchReady, false);
assert(stressed.strands[0].points.every(p => Number.isFinite(p.lengthSq())));
for (let i = 0; i < 200; i++) stressed.step(1 / 120);
assert(stressed.strands[0].points.every(p => Number.isFinite(p.lengthSq())),
  'both broken halves must remain stable and finite while falling');
stressed.reset();
assert.equal(stressed.torn, false, 'fresh start restores dough continuity');
assert.equal(stressed.integrity, 100);

// Dynamic tube topology must remove the broken span and close the cut faces.
// Each body segment has 2 * RADIAL triangles, and each cap RADIAL triangles.
const intact = createTubeIndices(null);
const torn = createTubeIndices(weakSpot);
const joined = createTubeIndices(null, true);
assert.equal(joined.length, intact.length - 16 * 3,
  'the hidden right endcap must disappear under a connected U-bend');
assert.equal(intact.length, (32 * 16 * 2 + 2 * 16) * 3);
assert.equal(torn.length, intact.length, 'one removed wall strip is replaced by two cut caps');
const bridgeLeft = weakSpot * 16;
const bridgeRight = (weakSpot + 1) * 16;
for (let i = 0; i < torn.length; i += 3) {
  const triangle = [torn[i], torn[i + 1], torn[i + 2]];
  assert(!(triangle.some(v => v >= bridgeLeft && v < bridgeLeft + 16)
    && triangle.some(v => v >= bridgeRight && v < bridgeRight + 16)),
    'no triangle may reconnect the physically disconnected halves');
}
console.log('PASS: slow-pull safety, tensile fracture, isolated broken halves, reset and split-mesh indices');
