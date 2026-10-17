import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';
import { castsNoodleShadow, noodleRadialSegments } from '../src/noodles/NoodleRenderer';

// Non-gating CPU benchmark. Real-world FPS also depends on GPU, screen
// resolution, browser backend and shadow rendering.
function measure(strandCount: number) {
  const world = new NoodleWorld();
  if (strandCount > 1) {
    const origin = world.strands[0];
    world.strands = Array.from({ length: strandCount }, (_, k) => {
      const offset = new T.Vector3(0, .04 * (k % 2), (k - strandCount / 2) * .24);
      return {
        points: origin.points.map(p => p.clone().add(offset)),
        previous: origin.previous.map(p => p.clone().add(offset)),
        rest: origin.rest.slice(), lambdas: origin.lambdas.slice(),
        yieldWeights: origin.yieldWeights.slice(), damage: origin.damage.slice(),
        brokenAt: null,
      };
    });
  }
  for (let i = 0; i < 15; i++) world.step(1 / 120);
  const start = performance.now();
  const frames = 80;
  for (let i = 0; i < frames; i++) world.step(1 / 120);
  const msPerStep = (performance.now() - start) / frames;
  assert(msPerStep >= 0 && Number.isFinite(msPerStep));
  assert(world.strands.every(s => s.points.every(p => Number.isFinite(p.lengthSq()))));
  return { msPerStep: Number(msPerStep.toFixed(3)), contacts: world.contacts };
}
assert.equal(noodleRadialSegments(true), 12, 'touch devices use lower vertex detail');
assert.equal(noodleRadialSegments(false), 16, 'desktop keeps full radial resolution');
// At sixteen strands, keep all geometry visible but submit only four
// tube shadows plus no loop shadows on a touch-focused mobile GPU.
assert.equal(Array.from({length:16}, (_,i)=>castsNoodleShadow(i,16,true))
  .filter(Boolean).length,4);
assert(Array.from({length:16}, (_,i)=>castsNoodleShadow(i,16,false))
  .every(Boolean), 'desktop retains full shadows');
assert(Array.from({length:4}, (_,i)=>castsNoodleShadow(i,4,true))
  .every(Boolean), 'early mobile pulling keeps the original shadows');
console.log('NOODLE_PHYSICS_CPU_MS', JSON.stringify({
  single: measure(1),
  eight: measure(8),
  sixteen: measure(16),
}));
