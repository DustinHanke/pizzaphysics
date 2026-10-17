import assert from 'node:assert/strict';
import * as T from 'three';
import { DoughRheology } from '../src/noodles/DoughRheology';
import { advanceResistantGrip } from '../src/noodles/PullDynamics';
import { NoodleWorld } from '../src/noodles/NoodleWorld';

const timeStep = 1 / 120;
const l = new T.Vector3(-2.3, 1.7, 0);
const r = new T.Vector3(2.3, 1.7, 0);
const model = new DoughRheology();
model.update(timeStep, l, r, true);
assert.equal(model.relaxed, 0, 'newly held material cannot already be relaxed');
l.x -= .8;
model.update(timeStep, l, r, true);
assert(model.shockLoad > 0, 'fast pulling should register a transient material shock');
assert(model.motionSpeed > 0);
const initialShock = model.shockLoad;
for (let i = 0; i < 270; i++) model.update(timeStep, l, r, true);
assert(model.relaxed > .85, 'holding still should progressively relax gluten');
assert(model.shockLoad < initialShock * .01, 'the shock should fade even while held');
const rested = model.relaxed;
l.x -= .8;
for (let i = 0; i < 24; i++) model.update(timeStep, l, r, true);
assert(model.relaxed < rested, 'a new pull must rebuild strain');
for (let i = 0; i < 220; i++) model.update(timeStep, l, r, false);
assert(model.relaxed < .05, 'lifting the fingers resets temporary yield assistance');
model.reset();
assert.equal(model.relaxed, 0);
assert.equal(model.shockLoad, 0);

// Given equal starting strain and fingertip positions, rested gluten yields
// farther than freshly stretched gluten. Returning the hand is unaffected.
const mate = new T.Vector3(2, 1.5, 0);
const target = new T.Vector3(-2, 1.5, 0);
const fresh = new T.Vector3(0, 1.5, 0);
const soft = fresh.clone();
for (let i = 0; i < 90; i++) {
  advanceResistantGrip(fresh, target, mate, timeStep, 3.3, true, 72, 0);
  advanceResistantGrip(soft, target, mate, timeStep, 3.3, true, 72, .92);
}
assert(soft.x < fresh.x - .25, 'rested dough must yield faster under the same tension');

// Integrate with a two-finger XPBD pull and verify one long hold has an actual
// benefit. The existing fold, tear, and volume tests continue to run.
const world = new NoodleWorld();
world.setGripHeld('left', true);
world.setGripHeld('right', true);
for (let t = 0; t < 150; t++) {
  const x = 1.48 + .95 * t / 150;
  world.moveHandle('left', new T.Vector3(-x, 1.85, 0));
  world.moveHandle('right', new T.Vector3(x, 1.85, 0));
  world.step(timeStep);
}
const beforeHold = world.totalLength;
for (let t = 0; t < 240; t++) world.step(timeStep);
assert(world.relaxation > .70, 'holding two grips at fixed separation should relax dough');
assert(world.totalLength > beforeHold, 'the patient held pull should continue to yield');
assert(!world.torn, 'gentle patient pulling should not break the dough');
world.setGripHeld('left', false);
world.setGripHeld('right', false);
for (let t = 0; t < 120; t++) world.step(timeStep);
assert(world.relaxation < .12, 'release clears the temporary softness');
console.log('PASS: speed-sensitive shock, dwell-driven relaxation, yielding under hold, release recovery');
