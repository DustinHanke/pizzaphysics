import * as T from 'three';

/** A strand is a small, fixed-budget XPBD chain. Rest lengths grow under tension
 * (plastic flow), rather than springing back like melted cheese. */
export interface NoodleStrand {
  points: T.Vector3[];
  previous: T.Vector3[];
  rest: Float64Array;
  lambdas: Float64Array;
}

export interface NoodleSettings {
  plasticity: number;
  softness: number;
  gravity: number;
}

const SEGMENTS = 32;
const SOLVER_PASSES = 9;
const INITIAL_LENGTH = 3.65;
const MAX_STRANDS = 8;
const tmp = new T.Vector3();
const delta = new T.Vector3();

export class NoodleWorld {
  readonly fixedDt = 1 / 120;
  accumulator = 0;
  timeMs = 0;
  settings: NoodleSettings = { plasticity: 65, softness: 48, gravity: 65 };
  readonly left = new T.Vector3(-1.48, 2.95, 0);
  readonly right = new T.Vector3(1.48, 2.95, 0);
  readonly leftTarget = this.left.clone();
  readonly rightTarget = this.right.clone();
  strands: NoodleStrand[] = [];
  steps = 0;
  private lastFoldTotalLength = INITIAL_LENGTH;
  private transition: {elapsed: number; duration: number; source: T.Vector3[][]; left: T.Vector3; right: T.Vector3} | null = null;
  get folding() { return this.transition !== null; }
  get foldProgress() { return this.transition ? Math.min(1, this.transition.elapsed / this.transition.duration) : 1; }
  getRenderHandle(side: 'left' | 'right', out: T.Vector3) {
    const handle = this[side];
    if (!this.transition) return out.copy(handle);
    const t = this.foldProgress;
    const ease = t * t * (3 - 2 * t);
    return out.copy(this.transition[side]).lerp(handle, ease);
  }
  getRenderPoint(strand: number, vertex: number, out: T.Vector3) {
    const end = this.strands[strand].points[vertex];
    if (!this.transition) return out.copy(end);
    const t = this.foldProgress;
    const ease = t * t * (3 - 2 * t);
    return out.copy(this.transition.source[strand][vertex]).lerp(end, ease);
  }

  constructor() { this.reset(); }

  private createStrands(count: number, length: number) {
    const a = this.left, b = this.right;
    this.strands = Array.from({ length: count }, (_, strand) => {
      const points: T.Vector3[] = [];
      const previous: T.Vector3[] = [];
      const offset = (strand - (count - 1) / 2) * .075;
      const sag = Math.sqrt(Math.max(.02, length * length - a.distanceToSquared(b))) * .18;
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const point = new T.Vector3().lerpVectors(a, b, t);
        point.y -= sag * Math.sin(Math.PI * t);
        point.z += offset * Math.sin(Math.PI * t);
        points.push(point);
        previous.push(point.clone());
      }
      return {
        points, previous,
        rest: new Float64Array(SEGMENTS).fill(length / SEGMENTS),
        lambdas: new Float64Array(SEGMENTS),
      };
    });
  }

  reset() {
    this.left.set(-1.48, 2.95, 0);
    this.right.set(1.48, 2.95, 0);
    this.leftTarget.copy(this.left);
    this.rightTarget.copy(this.right);
    this.accumulator = 0;
    this.steps = 0;
    this.lastFoldTotalLength = INITIAL_LENGTH;
    this.transition = null;
    this.createStrands(1, INITIAL_LENGTH);
  }

  moveHandle(side: 'left' | 'right', position: T.Vector3) {
    if (this.folding) return;
    const target = side === 'left' ? this.leftTarget : this.rightTarget;
    target.copy(position);
    target.x = T.MathUtils.clamp(target.x, -4.5, 4.5);
    target.y = T.MathUtils.clamp(target.y, .65, 4.9);
    target.z = T.MathUtils.clamp(target.z, -2.8, 2.8);
  }

  get strandCount() { return this.strands.length; }
  get materialLength() {
    const strand = this.strands[0];
    return strand ? strand.rest.reduce((sum, value) => sum + value, 0) : 0;
  }
  get totalLength() { return this.materialLength * this.strandCount; }
  get drawRatio() { return this.totalLength / INITIAL_LENGTH; }
  /** Volume conservation is approximate, using the chain's total rest length. */
  get radius() {
    return .108 * Math.sqrt(INITIAL_LENGTH / Math.max(.01, this.totalLength));
  }
  get diameterMm() { return this.radius / .108 * 9; }
  get tension() {
    const span = this.left.distanceTo(this.right);
    return Math.round(T.MathUtils.clamp((span / Math.max(.01, this.materialLength) - .76) / .27, 0, 1) * 100);
  }

  /** A new fold requires additional extension since the previous fold. */
  get canFold() {
    return this.strandCount < MAX_STRANDS && this.materialLength >= 2.55
      && this.totalLength >= this.lastFoldTotalLength * 1.22;
  }

  /** Folding halves each strand's rest length and doubles their count.
   * This conserves the modeled dough volume before the next pull. */
  fold() {
    if (!this.canFold) return false;
    const before = this.totalLength;
    const source = this.strands.map(strand => strand.points.map(p => p.clone()));
    const oldLeft = this.left.clone();
    const oldRight = this.right.clone();
    const length = this.materialLength * .5;
    const halfSpan = Math.min(1.15, length * .35);
    const center = tmp.copy(this.left).add(this.right).multiplyScalar(.5);
    const y = T.MathUtils.clamp(center.y, 1.7, 3.5);
    this.left.set(-halfSpan, y, 0);
    this.right.set(halfSpan, y, 0);
    this.leftTarget.copy(this.left);
    this.rightTarget.copy(this.right);
    this.createStrands(this.strandCount * 2, length);
    // Each original strand bends back on itself: the two halves travel together
    // into the doubled arrangement rather than teleporting into parallel tubes.
    const halves = this.strands.map((_, strand) => {
      const path = source[Math.floor(strand / 2)];
      return Array.from({ length: SEGMENTS + 1 }, (_, i) => {
        const k = Math.round(i * .5);
        return path[strand % 2 === 0 ? k : SEGMENTS - k].clone();
      });
    });
    this.transition = {elapsed: 0, duration: .82, source: halves, left: oldLeft, right: oldRight};
    this.lastFoldTotalLength = before;
    this.accumulator = 0;
    return true;
  }

  advance(frameSeconds: number) {
    const start = performance.now();
    this.accumulator = Math.min(this.accumulator + Math.max(0, Math.min(frameSeconds, .05)), this.fixedDt * 6);
    let iterations = 0;
    while (this.accumulator >= this.fixedDt && iterations++ < 6) {
      this.step(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }
    this.timeMs = performance.now() - start;
  }

  step(dt: number) {
    if (this.transition) {
      this.transition.elapsed += dt;
      if (this.transition.elapsed >= this.transition.duration) this.transition = null;
    }
    const blend = 1 - Math.exp(-dt * 24);
    this.left.lerp(this.leftTarget, blend);
    this.right.lerp(this.rightTarget, blend);
    const span = this.left.distanceTo(this.right);
    const gravity = 3 + this.settings.gravity * .085;
    const damping = Math.exp(-dt * (2.1 + (100 - this.settings.softness) * .025));
    const compliance = (.0000008 + this.settings.softness * .00000014) / (dt * dt);
    for (const strand of this.strands) {
      const { points, previous, rest, lambdas } = strand;
      // If the user pulls the anchors apart, the dough must yield permanently.
      // Bounding this growth per step prevents a single large drag from exploding.
      const currentLength = rest.reduce((sum, value) => sum + value, 0);
      const desired = span / .975;
      if (desired > currentLength) {
        const growth = 1 + Math.min(.045, (desired / currentLength - 1) * dt * (3 + this.settings.plasticity * .19));
        for (let i = 0; i < SEGMENTS; i++) rest[i] *= growth;
      }
      for (let i = 1; i < SEGMENTS; i++) {
        const p = points[i], old = previous[i];
        delta.copy(p).sub(old).multiplyScalar(damping).clampLength(0, dt * 13);
        old.copy(p);
        p.add(delta);
        p.y -= gravity * dt * dt;
      }
      lambdas.fill(0);
      for (let pass = 0; pass < SOLVER_PASSES; pass++) {
        points[0].copy(this.left);
        points[SEGMENTS].copy(this.right);
        for (let i = 0; i < SEGMENTS; i++) {
          const a = points[i], b = points[i + 1];
          delta.copy(b).sub(a);
          const distance = delta.length();
          if (distance < 1e-8) continue;
          const wa = i === 0 ? 0 : 1;
          const wb = i === SEGMENTS - 1 ? 0 : 1;
          const dl = (-(distance - rest[i]) - compliance * lambdas[i]) / (wa + wb + compliance);
          lambdas[i] += dl;
          delta.multiplyScalar(dl / distance);
          if (wa) a.addScaledVector(delta, -wa);
          if (wb) b.addScaledVector(delta, wb);
        }
        // Mild bend regularization suppresses kinks without making it a rigid rod.
        const smooth = .013 * (1 - this.settings.softness / 140);
        for (let i = 1; i < SEGMENTS; i++) {
          tmp.copy(points[i - 1]).add(points[i + 1]).multiplyScalar(.5);
          points[i].lerp(tmp, smooth);
          if (points[i].y < .43) points[i].y = .43;
        }
      }
      // Slow local creep spreads yield across nearby segments after a fast pull.
      const creep = dt * (.18 + this.settings.plasticity * .021);
      for (let i = 0; i < SEGMENTS; i++) {
        const distance = points[i].distanceTo(points[i + 1]);
        if (distance > rest[i] * 1.035) {
          rest[i] += Math.min(rest[i] * .006, (distance - rest[i]) * creep);
        }
      }
      points[0].copy(this.left);
      points[SEGMENTS].copy(this.right);
      previous[0].copy(points[0]);
      previous[SEGMENTS].copy(points[SEGMENTS]);
    }
    // Soft lane constraints approximate strand-to-strand contact without an
    // expensive all-pairs capsule solver. Adjacent strands separate only if
    // their thickness requires it; nearby ends can remain joined by the pull.
    for (let k = 1; k < this.strands.length; k++) {
      const prev = this.strands[k - 1].points;
      const next = this.strands[k].points;
      const diameter = Math.max(.035, this.radius * 1.75);
      for (let i = 3; i < SEGMENTS - 2; i++) {
        delta.subVectors(next[i], prev[i]);
        const d = delta.length();
        if (d < diameter && d > 1e-7) {
          delta.multiplyScalar((diameter - d) * .18 / d);
          next[i].add(delta);
          prev[i].sub(delta);
        }
      }
    }
    this.steps++;
  }
}
