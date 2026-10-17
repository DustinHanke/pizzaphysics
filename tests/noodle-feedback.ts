import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';
import { stressBand, StressHaptics } from '../src/noodles/StressFeedback';

const fresh = new NoodleWorld();
assert.equal(fresh.failureRisk, 0);
assert.equal(stressBand(fresh.failureRisk, fresh.torn), 'safe');
assert.equal(stressBand(.269), 'safe');
assert.equal(stressBand(.27), 'caution');
assert.equal(stressBand(.699), 'caution');
assert.equal(stressBand(.70), 'critical');
assert.equal(stressBand(.1, true), 'broken');

// Controlled pulling must avoid misleading yellow or red warnings.
for (let i = 0; i < 480; i++) {
  const x = 1.48 + i / 480 * 1.25;
  fresh.moveHandle('left', new T.Vector3(-x, 2.95, 0));
  fresh.moveHandle('right', new T.Vector3(x, 2.95, 0));
  fresh.step(1 / 120);
}
assert.equal(fresh.torn, false);
assert(fresh.failureRisk < .27,
  'a sustained, controlled pull should not continuously show a warning');

// Weak spots produce a smooth pre-fracture neck, rather than a sudden pop
// when the final XPBD segment breaks.
const damaged = new NoodleWorld();
const original = damaged.getLocalRadius(0, 15.5 / 32);
damaged.strands[0].damage[15] = .8;
const near = damaged.getLocalRadius(0, 15.5 / 32);
const far = damaged.getLocalRadius(0, 5 / 32);
assert(near < original * .65, 'damaged dough must visibly narrow before tearing');
assert(far > near * 1.3, 'damage must stay spatially local');
assert(damaged.failureRisk >= .7, 'severe physical weakening should trigger a red vignette');
damaged.strands[0].brokenAt = 15;
assert.equal(stressBand(damaged.failureRisk, damaged.torn), 'broken');
damaged.reset();
assert.equal(damaged.failureRisk, 0, 'reset must fully clear warning risk');

// Explicitly injected vibration function allows deterministic testing without
// pretending that iOS Safari implements navigator.vibrate.
const emitted: Array<number | number[]> = [];
const haptics = new StressHaptics((pattern) => { emitted.push(pattern); return true; });
assert(haptics.supported);
assert(!haptics.pulse(.1, false, 0));
assert(haptics.pulse(.3, false, 10), 'first yellow warning pulses once');
assert(!haptics.pulse(.3, false, 200), 'yellow haptics have a cooldown');
assert(haptics.pulse(.75, false, 250), 'transition into red danger pulses immediately');
assert(!haptics.pulse(.75, false, 350));
assert(haptics.pulse(.9, true, 400), 'tear triggers a distinct one-time vibration');
assert(!haptics.pulse(.9, true, 3000), 'the broken state must never buzz repeatedly');
assert.deepEqual(emitted, [20, [32, 55, 32], [45, 70, 95]]);
haptics.reset();
haptics.enabled = false;
assert(!haptics.pulse(.9, true, 4000), 'user opt-out must stop all vibration');
const unsupported = new StressHaptics(null);
assert(!unsupported.supported);
assert.equal(unsupported.pulse(.9, true, 0), false);
console.log('PASS: stress warning thresholds, recoverable physical necking, haptics rate limits and unsupported devices');
