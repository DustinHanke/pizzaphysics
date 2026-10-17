import assert from 'node:assert/strict';
import * as T from 'three';
import { NoodleWorld } from '../src/noodles/NoodleWorld';
import { NoodleInteraction } from '../src/noodles/NoodleInteraction';

// Simulate real independent PointerEvent IDs without requiring a graphics backend.
// Raycasting uses the actual Three.js camera and spherical grab targets.
const listeners = new Map<string, (e: PointerEvent) => void>();
const captures = new Set<number>();
const classes = new Set<string>();
const canvas = {
  addEventListener: (name: string, handler: (e: PointerEvent) => void) => listeners.set(name, handler),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  setPointerCapture: (id: number) => captures.add(id),
  releasePointerCapture: (id: number) => captures.delete(id),
  hasPointerCapture: (id: number) => captures.has(id),
  focus: () => undefined,
  classList: {
    add: (s: string) => classes.add(s),
    remove: (...s: string[]) => s.forEach(x => classes.delete(x)),
    toggle: (s: string, force: boolean) => force ? classes.add(s) : classes.delete(s),
  },
} as unknown as HTMLCanvasElement;
Object.assign(globalThis, {
  window: { addEventListener: () => undefined },
  document: { addEventListener: () => undefined, hidden: false },
});
function send(name: string, id: number, x: number, y: number, type = 'touch') {
  const listener = listeners.get(name);
  assert(listener, 'missing event listener ' + name);
  listener!({
    pointerId: id, pointerType: type, clientX: x, clientY: y,
    button: 0, shiftKey: false, altKey: false,
    preventDefault: () => undefined,
  } as unknown as PointerEvent);
}
function screen(camera: T.Camera, p: T.Vector3) {
  const ndc = p.clone().project(camera);
  return { x: (ndc.x + 1) * 500, y: (1 - ndc.y) * 300 };
}
const world = new NoodleWorld();
const camera = new T.PerspectiveCamera(35, 1000 / 600, .1, 70);
camera.updateProjectionMatrix();
const grips = {
  left: new T.Mesh(new T.SphereGeometry(.36, 12, 9), new T.MeshBasicMaterial()),
  right: new T.Mesh(new T.SphereGeometry(.36, 12, 9), new T.MeshBasicMaterial()),
};
grips.left.userData.side = 'left';
grips.right.userData.side = 'right';
grips.left.position.copy(world.left);
grips.right.position.copy(world.right);
let foldEvents = 0;
let pulls = 0;
let latest = { left: false, right: false, hovered: null as string | null };
const controller = new NoodleInteraction(
  canvas, camera, world, grips, () => pulls++, () => foldEvents++,
  (left, right, hovered) => { latest = { left, right, hovered }; },
);
const l = screen(camera, grips.left.position);
const r = screen(camera, grips.right.position);
assert(l.x < r.x, 'the two grab points should project to separate touch targets');

// Press each grip with a different finger, in either order.
send('pointerdown', 11, l.x, l.y);
send('pointerdown', 12, r.x, r.y);
assert(captures.has(11) && captures.has(12), 'both fingers must be pointer-captured');
assert(latest.left && latest.right, 'both grips must report active simultaneously');
assert.equal(pulls, 2, 'each finger must start an independent dough pull');
assert(classes.has('dragging') && !classes.has('orbiting'));

// Stretch both ends in opposite directions without camera orbiting.
send('pointermove', 11, l.x - 65, l.y);
send('pointermove', 12, r.x + 65, r.y);
assert(world.leftTarget.x < world.left.x - .1, 'first finger must move the left endpoint');
assert(world.rightTarget.x > world.right.x + .1, 'second finger must move the right endpoint');
const rightTargetBefore = world.rightTarget.x;
send('pointerdown', 13, r.x + 65, r.y);
assert(!captures.has(13), 'a third finger cannot steal an owned grip');
send('pointerdown', 14, 5, 5);
assert(!classes.has('orbiting'), 'extra touch must not orbit during a two-hand pull');

// Releasing one finger retains control with the other.
send('pointerup', 11, l.x - 65, l.y);
assert(!latest.left && latest.right && classes.has('dragging'));
send('pointermove', 12, r.x + 100, r.y);
assert(world.rightTarget.x > rightTargetBefore, 'remaining finger must keep dragging');
assert.equal(foldEvents, 0, 'partial release must never fold');

// Final canceled pointer must not fold, even when conditions would permit it.
Object.defineProperty(world, 'canFold', { configurable: true, get: () => true });
world.leftTarget.set(-.3, 1.55, 0);
world.rightTarget.set(.3, 1.55, 0);
send('pointercancel', 12, r.x + 100, r.y);
assert.equal(foldEvents, 0);
assert(!latest.left && !latest.right && !classes.has('dragging'));
assert(!captures.has(11) && !captures.has(12));

// A completed two-finger gesture folds exactly once on the LAST release.
grips.left.position.copy(world.left);
grips.right.position.copy(world.right);
send('pointerdown', 20, l.x, l.y);
send('pointerdown', 21, r.x, r.y);
assert(latest.left && latest.right);
world.leftTarget.set(-.3, 1.55, 0);
world.rightTarget.set(.3, 1.55, 0);
send('pointerup', 20, l.x, l.y);
assert.equal(foldEvents, 0, 'fold only after both fingers release');
send('pointerup', 21, r.x, r.y);
assert.equal(foldEvents, 1, 'valid finished two-hand fold triggers once');
controller.release();
console.log('PASS: two-handed grips, independent pointer capture, third-touch suppression, cancellation and final-release folding');
