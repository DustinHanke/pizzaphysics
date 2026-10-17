import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';
import { advanceResistantGrip } from '../src/noodles/PullDynamics';

const world = new NoodleWorld();
const initialLeft = world.left.clone(), initialRight = world.right.clone();
world.setGripHeld('left', true);
world.setGripHeld('right', true);
const leftFinger = new T.Vector3(-3.7, 2.6, 0);
const rightFinger = new T.Vector3(3.7, 2.6, 0);
world.moveHandle('left', leftFinger);
world.moveHandle('right', rightFinger);
assert(world.resistance > .2, 'fingers must initially lead the resting dough');
world.step(1 / 120);
assert(world.left.x < initialLeft.x && world.right.x > initialRight.x,
  'the dough responds to simultaneous pulls');
assert(world.left.distanceTo(initialLeft) < .08 && world.right.distanceTo(initialRight) < .08,
  'the grips cannot jump to the finger in a single simulation step');
assert(world.left.distanceTo(leftFinger) > .5 && world.right.distanceTo(rightFinger) > .5,
  'the material remains behind a fast moving fingertip');
const startLag = world.resistance;
for (let i = 0; i < 240; i++) world.step(1 / 120);
assert(world.left.x < -2 && world.right.x > 2, 'held tension must gradually extend the dough');
assert(world.resistance < startLag, 'the lag must reduce as dough yields under a steady hold');
assert(!world.torn, 'a patient hold must not tear the dough');

world.setGripHeld('left', false);
world.setGripHeld('right', false);
assert.equal(world.resistance, 0, 'release must clear ghost-finger resistance');
const releasedLeft = world.left.clone(), releasedRight = world.right.clone();
for (let i = 0; i < 100; i++) world.step(1 / 120);
assert(world.left.distanceTo(releasedLeft) < 1e-8, 'released left dough must not chase an abandoned finger');
assert(world.right.distanceTo(releasedRight) < 1e-8, 'released right dough must not chase an abandoned finger');

// Going inward must be quicker than extending against the gluten at the same
// distance, preserving quick folds even with deliberately heavy outward pulls.
const partner = new T.Vector3(3, 1.5, 0);
const outward = new T.Vector3(0, 1.5, 0);
const inward = outward.clone();
advanceResistantGrip(outward, new T.Vector3(-2, 1.5, 0), partner, 1 / 60, 3.3, true);
advanceResistantGrip(inward, new T.Vector3(2, 1.5, 0), partner, 1 / 60, 3.3, true);
assert(inward.x > -outward.x * 1.2, 'inward motion should be more responsive than pulling outward');

// The exposed slider must have a measurable, deterministic effect.
const lowResistance = new T.Vector3(0, 1.5, 0);
const highResistance = lowResistance.clone();
const sliderTarget = new T.Vector3(-2, 1.5, 0);
for (let i = 0; i < 60; i++) {
  advanceResistantGrip(lowResistance, sliderTarget, partner, 1 / 60, 3.3, true, 0);
  advanceResistantGrip(highResistance, sliderTarget, partner, 1 / 60, 3.3, true, 100);
}
assert(lowResistance.x < highResistance.x - .35,
  'a low resistance setting must visibly yield faster than a high setting');

// Input should remain stable across a 60Hz and 120Hz update cadence.
const a = new T.Vector3(0, 1.5, 0), b = a.clone(), finger = new T.Vector3(-1.4, 1.5, 0);
for (let i = 0; i < 60; i++) advanceResistantGrip(a, finger, partner, 1 / 60, 3.3, true);
for (let i = 0; i < 120; i++) advanceResistantGrip(b, finger, partner, 1 / 120, 3.3, true);
assert(a.distanceTo(b) < .06, 'material drag should be reasonably timestep independent');
world.reset();
assert.equal(world.resistance, 0);
assert.equal(world.getGripHeld('left'), false);
console.log('PASS: two-handed viscous resistance, lag-to-yield, clean release, return strokes and timestep invariance');
