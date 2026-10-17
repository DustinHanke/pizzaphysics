/** Small viscoelastic state model for hand-pulled dough.
 * A fast stroke creates temporary elastic resistance. A steady hold permits
 * slow plastic creep. The state is time-step independent and never replaces
 * the position-based strand constraints. */
export class DoughRheology {
  private prevL = {x: 0, y: 0, z: 0};
  private prevR = {x: 0, y: 0, z: 0};
  private speed = 0;
  private stillTime = 0;
  private shock = 0;
  // Outward input impulses are distinct from dough catch-up and inward returns.
  // Only these impulses can fatigue and ultimately tear the gluten.
  private outwardShock = 0;
  private initialised = false;

  reset() {
    this.speed = 0; this.stillTime = 0; this.shock = 0;
    this.outwardShock = 0; this.initialised = false;
  }

  update(
    dt: number,
    l: {x: number; y: number; z: number},
    r: {x: number; y: number; z: number},
    holding: boolean,
  ) {
    if (!this.initialised) {
      Object.assign(this.prevL, l);
      Object.assign(this.prevR, r);
      this.initialised = true;
    }
    const previousSpan = Math.hypot(
      this.prevL.x - this.prevR.x, this.prevL.y - this.prevR.y, this.prevL.z - this.prevR.z,
    );
    const currentSpan = Math.hypot(l.x - r.x, l.y - r.y, l.z - r.z);
    const outwardSpeed = holding ? Math.max(0, currentSpan - previousSpan) / Math.max(1e-6, dt) : 0;
    const dl = Math.hypot(l.x - this.prevL.x, l.y - this.prevL.y, l.z - this.prevL.z);
    const dr = Math.hypot(r.x - this.prevR.x, r.y - this.prevR.y, r.z - this.prevR.z);
    Object.assign(this.prevL, l);
    Object.assign(this.prevR, r);
    const rawSpeed = holding ? Math.max(dl, dr) / Math.max(1e-6, dt) : 0;
    const blend = 1 - Math.exp(-dt * 14);
    this.speed += (Math.min(30, rawSpeed) - this.speed) * blend;
    if (holding && this.speed < .38) this.stillTime = Math.min(8, this.stillTime + dt);
    else this.stillTime = Math.max(0, this.stillTime - dt * (holding ? 3.2 : 5));
    this.shock = Math.max(
      this.shock * Math.exp(-dt * 5),
      holding ? Math.min(1, Math.max(0, rawSpeed - 2.8) / 10) : 0,
    );
    // Rapid *outward* finger movement briefly loads the dough. A static
    // outstretched hand, motion of the delayed dough itself, and returning
    // inward are not new sources of fracture damage.
    this.outwardShock = Math.max(
      this.outwardShock * Math.exp(-dt * 8),
      holding ? Math.min(1, Math.max(0, outwardSpeed - 4) / 14) : 0,
    );
  }

  /** 0 immediately after a pull, approaching 1 after a calm hold. */
  get relaxed() { return 1 - Math.exp(-Math.max(0, this.stillTime - .12) * 1.6); }
  get shockLoad() { return this.shock; }
  get outwardShockLoad() { return this.outwardShock; }
  get motionSpeed() { return this.speed; }
}
