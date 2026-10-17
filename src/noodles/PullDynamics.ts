import * as T from 'three';

/** A viscous hand-to-dough coupling. Input stays at the fingertip, while the
 * material grip moves only as quickly as the gluten can yield. Unlike simply
 * multiplying the pointer coordinates, the movement is time-step independent. */
export function advanceResistantGrip(
  current: T.Vector3, target: T.Vector3, partner: T.Vector3,
  dt: number, restLength: number, held: boolean,
) {
  const start = current.clone();
  if (!held) {
    current.lerp(target, 1 - Math.exp(-dt * 24));
    return current.distanceTo(start);
  }

  const distance = current.distanceTo(target);
  if (distance < 1e-8) return 0;
  const outward = target.distanceTo(partner) > current.distanceTo(partner) + .005;
  const extension = T.MathUtils.clamp(
    (current.distanceTo(partner) / Math.max(.05, restLength) - .70) / .38, 0, 1,
  );
  // Opening the dough feels progressively heavier. Returning the hands
  // inward is intentionally faster, so folding remains pleasant on phones.
  const speed = outward ? T.MathUtils.lerp(1.95, .70, extension) : 3.3;
  const easing = 1 - Math.exp(-dt * (outward ? 5.4 : 12));
  const step = Math.min(distance * easing, speed * dt);
  current.addScaledVector(target.clone().sub(current), step / distance);
  return current.distanceTo(start);
}
