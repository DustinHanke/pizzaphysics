import * as T from 'three';

/** A viscous hand-to-dough coupling. Input stays at the fingertip, while the
 * material grip moves only as quickly as the gluten can yield. Unlike simply
 * multiplying the pointer coordinates, the movement is time-step independent. */
export function advanceResistantGrip(
  current: T.Vector3, target: T.Vector3, partner: T.Vector3,
  dt: number, restLength: number, held: boolean, resistance = 72,
) {
  const startX = current.x, startY = current.y, startZ = current.z;
  if (!held) {
    current.lerp(target, 1 - Math.exp(-dt * 24));
    return Math.hypot(current.x - startX, current.y - startY, current.z - startZ);
  }

  const distance = current.distanceTo(target);
  if (distance < 1e-8) return 0;
  const outward = target.distanceTo(partner) > current.distanceTo(partner) + .005;
  const extension = T.MathUtils.clamp(
    (current.distanceTo(partner) / Math.max(.05, restLength) - .70) / .38, 0, 1,
  );
  // Opening the dough feels progressively heavier. Returning the hands
  // inward is intentionally faster, so folding remains pleasant on phones.
  const viscosity = 1.9 - T.MathUtils.clamp(resistance, 0, 100) * .012;
  const speed = outward ? T.MathUtils.lerp(1.95, .70, extension) * viscosity : 3.3;
  const easing = 1 - Math.exp(-dt * (outward ? 5.4 * viscosity : 12));
  const step = Math.min(distance * easing, speed * dt);
  const factor = step / distance;
  current.x += (target.x - current.x) * factor;
  current.y += (target.y - current.y) * factor;
  current.z += (target.z - current.z) * factor;
  return Math.hypot(current.x - startX, current.y - startY, current.z - startZ);
}
