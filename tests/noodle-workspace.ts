import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';

const dt = 1 / 120;
const world = new NoodleWorld();
world.moveHandle('left', new T.Vector3(-6.3, 3.1, -3.5));
world.moveHandle('right', new T.Vector3(6.3, 3.1, 3.5));
assert(world.leftTarget.x < -6 && world.rightTarget.x > 6,
  'the pull workspace must extend well beyond the old ±4.5 world unit cap');
assert(world.leftTarget.z < -3 && world.rightTarget.z > 3,
  'the countertop must offer meaningful front-to-back travel');

// True two-finger interaction: targets jump, actual gluten handles still
// resist and catch up slowly. A deliberate yank must be able to snap it.
world.reset();
world.setGripHeld('left', true);
world.setGripHeld('right', true);
const xs: number[] = [];
for (let cycle = 0; cycle < 5 && !world.torn; cycle++) {
  // Start near the rope, then yank both fingertips outward in one gesture.
  const inward = 1.5;
  world.moveHandle('left', new T.Vector3(-inward, 2.8, 0));
  world.moveHandle('right', new T.Vector3(inward, 2.8, 0));
  for (let i = 0; i < 36 && !world.torn; i++) world.step(dt);
  const outward = 6.5;
  world.moveHandle('left', new T.Vector3(-outward, 2.8, 0));
  world.moveHandle('right', new T.Vector3(outward, 2.8, 0));
  for (let i = 0; i < 55 && !world.torn; i++) {
    world.step(dt);
    if (i === 2) xs.push(world.failureRisk);
  }
  if (cycle === 0) assert(!world.torn,
    'a single extreme yank should warn and weaken, not immediately destroy the dough');
}
console.log('WIDE_TWO_HAND_TEAR', JSON.stringify({
  torn: world.torn, risks: xs.map(x => +x.toFixed(3)),
  diameter: +world.diameterMm.toFixed(2), strength: world.integrity,
}));
assert(world.torn, 'strong two-hand yanks at the extended workbench must visibly tear dough');
assert(world.failureRisk === 1, 'the red warning must accompany a completed break');
assert(world.strands[0].brokenAt !== null, 'physics geometry must be severed');

// Returning hands and resetting must restore the original geometry and bounds.
world.setGripHeld('left', false);
world.setGripHeld('right', false);
world.reset();
assert(!world.torn && world.strandCount === 1);
assert(world.strands[0].points.every(p => Number.isFinite(p.x + p.y + p.z)));
console.log('PASS: larger countertop targets and accessible physical two-finger tearing');
