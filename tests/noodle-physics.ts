import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';

const world = new NoodleWorld();
const initial = world.totalLength;
assert.equal(world.strandCount, 1);
assert(Math.abs(world.diameterMm - 9) < 1e-8);

// Stretch both anchors in a deliberately slow, high-frequency interaction.
for (let i = 0; i < 480; i++) {
  const x = 1.48 + i / 480 * 1.25;
  world.moveHandle('left', new T.Vector3(-x, 2.95, 0));
  world.moveHandle('right', new T.Vector3(x, 2.95, 0));
  world.step(1 / 120);
}
assert(world.totalLength > initial * 1.12, 'dough must yield plastically during the pull');
assert(world.diameterMm < 9, 'volume-conserving noodle must become thinner');
for (const strand of world.strands) for (const p of strand.points) assert(Number.isFinite(p.lengthSq()));

const volumeProxy = world.totalLength * world.radius ** 2;
const beforeFold = world.totalLength;
assert.equal(world.fold(), true);
assert.equal(world.strandCount, 2);
assert(Math.abs(world.totalLength - beforeFold) < 1e-7, 'fold must preserve overall rest length');
assert(Math.abs(volumeProxy - world.totalLength * world.radius ** 2) < 1e-9, 'fold must preserve radius-weighted volume');
assert.equal(world.fold(), false, 'fold must require another pull');

let count = world.strandCount;
for (let n = 0; n < 2; n++) {
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
}
assert.equal(world.strandCount, 8);
assert.equal(world.fold(), false, 'limit the prototype to eight strands');

world.reset();
assert.equal(world.strandCount, 1);
assert(Math.abs(world.totalLength - initial) < 1e-8);
world.advance(10);
assert(world.steps <= 6, 'fixed timestep must cap work following a stalled frame');
for (const strand of world.strands) for (const p of strand.points) assert(Number.isFinite(p.lengthSq()));
console.log('PASS: noodle plasticity, folding, thickness, reset, and bounded fixed-step simulation');
