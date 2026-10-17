import * as T from 'three';
import { advanceResistantGrip } from './PullDynamics';

/** A strand is a small, fixed-budget XPBD chain. Rest lengths grow under tension
 * (plastic flow), rather than springing back like melted cheese. */
export interface NoodleStrand {
  points: T.Vector3[];
  previous: T.Vector3[];
  rest: Float64Array;
  lambdas: Float64Array;
  yieldWeights: Float64Array;
  damage: Float32Array;
  brokenAt: number | null;
}

export interface NoodleSettings {
  plasticity: number;
  softness: number;
  gravity: number;
}

const SEGMENTS = 32;
const SOLVER_PASSES = 9;
const INITIAL_LENGTH = 3.65;
// World unit = 10 cm; the sculpted tube's nominal center section is 1.26x.
export const NOODLE_CM_PER_UNIT = 10;
export const NOMINAL_SURFACE_RADIUS = 1.26;
const MAX_STRANDS = 16;
const tmp = new T.Vector3();
const delta = new T.Vector3();
const leftMotion = new T.Vector3(), rightMotion = new T.Vector3();
const collisionVector = new T.Vector3(), contactNormal = new T.Vector3();

export class NoodleWorld {
  readonly fixedDt = 1 / 120;
  accumulator = 0;
  timeMs = 0;
  settings: NoodleSettings = { plasticity: 65, softness: 48, gravity: 65 };
  readonly left = new T.Vector3(-1.48, 1.55, 0);
  readonly right = new T.Vector3(1.48, 1.55, 0);
  readonly leftTarget = this.left.clone();
  readonly rightTarget = this.right.clone();
  private readonly held: Record<'left' | 'right', boolean> = { left: false, right: false };
  private readonly touched: Record<'left' | 'right', boolean> = { left: false, right: false };
  /** Finger displacement while gluten resists: zero once the finger lifts. */
  get resistance() {
    const left = this.held.left ? this.left.distanceTo(this.leftTarget) : 0;
    const right = this.held.right ? this.right.distanceTo(this.rightTarget) : 0;
    return T.MathUtils.clamp(Math.max(left, right) / .95, 0, 1);
  }
  getGripLag(side: 'left' | 'right') {
    return this.held[side] ? this[side].distanceTo(this[`${side}Target`]) : 0;
  }
  getGripHeld(side: 'left' | 'right') { return this.held[side]; }
  setGripHeld(side: 'left' | 'right', held: boolean) {
    if (held && (this.torn || this.folding)) return;
    if (held && !this.held[side]) this[`${side}Target`].copy(this[side]);
    this.held[side] = held;
    if (held) this.touched[side] = true;
  }
  strands: NoodleStrand[] = [];
  steps = 0;
  private lastFoldTotalLength = INITIAL_LENGTH;
  contacts = 0;
  /** Smoothed recent high-speed tension; damage persists after release. */
  private transientLoad = 0;
  /** The first severed segment, or null while the rope remains intact. */
  get tear() {
    for (let k = 0; k < this.strands.length; k++) {
      const brokenAt = this.strands[k].brokenAt;
      if (brokenAt !== null) return { strand: k, segment: brokenAt };
    }
    return null;
  }
  get torn() { return this.tear !== null; }
  get integrity() {
    let peak = 0;
    for (const strand of this.strands) for (const damage of strand.damage) peak = Math.max(peak, damage);
    return this.torn ? 0 : Math.round(100 * (1 - T.MathUtils.clamp(peak, 0, 1)));
  }
  /** Visible feedback matches BOTH immediate pulling load and lasting damage.
   * Neither an idle gesture nor ordinary bending should trigger a warning. */
  get failureRisk() {
    if (this.torn) return 1;
    return T.MathUtils.clamp(Math.max(1 - this.integrity / 100, this.transientLoad * .53), 0, 1);
  }
  /** Smoothed damage at a mesh ring; interpolates across neighboring segments
   * so a thinning neck forms BEFORE failure instead of popping into existence. */
  getLocalDamage(strandIndex: number, t: number) {
    const strand = this.strands[strandIndex];
    if (!strand) return 0;
    const center = T.MathUtils.clamp(t, 0, 1) * SEGMENTS;
    let weighted = 0;
    for (let i = Math.max(0, Math.floor(center) - 2); i <= Math.min(SEGMENTS - 1, Math.ceil(center) + 2); i++) {
      const distance = Math.abs(i + .5 - center);
      const weight = Math.exp(-distance * distance / 2.1);
      weighted = Math.max(weighted, strand.damage[i] * weight);
    }
    return T.MathUtils.clamp(weighted, 0, 1);
  }
  /** Flick the center of the dough; Verlet velocities carry the motion. */
  snap() {
    if (this.folding || this.torn) return false;
    const amplitude = .065 + this.settings.softness * .0004;
    for (const [k, strand] of this.strands.entries()) for (let i = 1; i < SEGMENTS; i++) {
      const envelope = Math.sin(Math.PI * i / SEGMENTS);
      strand.previous[i].z -= amplitude * envelope * (1 + (k % 3) * .07);
      strand.previous[i].y += .027 * envelope;
    }
    return true;
  }
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
    const startingRadius = this.radius;
    this.strands = Array.from({ length: count }, (_, strand) => {
      const points: T.Vector3[] = [];
      const previous: T.Vector3[] = [];
      const offset = (strand - (count - 1) / 2) * .17;
      const sag = Math.sqrt(Math.max(.02, length * length - a.distanceToSquared(b))) * .38;
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const point = new T.Vector3().lerpVectors(a, b, t);
        point.y -= sag * Math.sin(Math.PI * t);
        point.y += offset * Math.sin(Math.PI * t);
        point.z += offset * .26 * Math.sin(Math.PI * t);
        if (count > 1) {
          // Match the paired end anchors on the very first fold frame too.
          const pairIndex = Math.floor(strand / 2) - (Math.ceil(count / 2) - 1) * .5;
          const side = strand % 2 === 0 ? -1 : 1;
          const radius = startingRadius;
          point.z += pairIndex * radius * 2.75
            + side * radius * ((1 - t) * .63 + t * 1.35);
        }
        points.push(point);
        previous.push(point.clone());
      }
      return {
        points, previous,
        rest: new Float64Array(SEGMENTS).fill(length / SEGMENTS),
        lambdas: new Float64Array(SEGMENTS),
        yieldWeights: new Float64Array(SEGMENTS),
        damage: new Float32Array(SEGMENTS),
        brokenAt: null,
      };
    });
  }

  reset() {
    this.left.set(-1.48, 1.55, 0);
    this.right.set(1.48, 1.55, 0);
    this.leftTarget.copy(this.left);
    this.rightTarget.copy(this.right);
    this.accumulator = 0;
    this.steps = 0;
    this.lastFoldTotalLength = INITIAL_LENGTH;
    this.transition = null;
    this.contacts = 0;
    this.transientLoad = 0;
    this.held.left = this.held.right = false;
    this.touched.left = this.touched.right = false;
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
  /** Average single-strand rest length; unlike the earlier implementation,
   * totalLength includes local plastic flow on EVERY strand. */
  get materialLength() { return this.strandCount ? this.totalLength / this.strandCount : 0; }
  get totalLength() {
    let length = 0;
    for (const strand of this.strands) for (let i = 0; i < SEGMENTS; i++) length += strand.rest[i];
    return length;
  }
  get drawRatio() { return this.totalLength / INITIAL_LENGTH; }
  /** Volume conservation is approximate, using the chain's total rest length. */
  get radius() {
    return .108 * Math.sqrt(INITIAL_LENGTH / Math.max(.01, this.totalLength));
  }
  /** Local cross-section responds to both accumulated plastic flow and
   * elastic stretch. The global radius conserves approximate total volume;
   * this correction distributes that volume along unevenly yielded dough. */
  getLocalRadius(strandIndex: number, t: number) {
    const strand = this.strands[strandIndex];
    if (!strand) return this.radius;
    const location = T.MathUtils.clamp(t, 0, 1) * SEGMENTS;
    const i = Math.min(SEGMENTS - 1, Math.floor(location));
    const before = strand.rest[Math.max(0, i - 1)];
    const center = strand.rest[i];
    const after = strand.rest[Math.min(SEGMENTS - 1, i + 1)];
    const localRest = (before + 2 * center + after) * .25;
    // Only the local strand's rest distribution is needed here. Recomputing
    // the entire bundle for every tube ring becomes costly at 16 strands.
    let strandRestTotal = 0;
    for (let j = 0; j < SEGMENTS; j++) strandRestTotal += strand.rest[j];
    const averageRest = strandRestTotal / SEGMENTS;
    const p = strand.points[i], q = strand.points[i + 1];
    const current = p.distanceTo(q);
    // Blend local strain into the profile without amplifying contact jitter.
    const elastic = T.MathUtils.clamp(current / Math.max(1e-6, center), .85, 1.38);
    const relative = T.MathUtils.clamp(averageRest / Math.max(1e-6, localRest), .45, 1.8);
    const neck = 1 - this.getLocalDamage(strandIndex, t) * .55;
    return this.radius * T.MathUtils.clamp(Math.sqrt(relative / Math.sqrt(elastic)), .66, 1.28) * neck;
  }
  /** Calibrated to actual mesh units rather than a nominal unrendered diameter. */
  get diameterMm() { return this.radius * NOMINAL_SURFACE_RADIUS * NOODLE_CM_PER_UNIT * 20; }
  get minDiameterMm() {
    let min = Infinity;
    for (let k = 0; k < this.strandCount; k++) for (let i = 2; i < SEGMENTS - 2; i++)
      min = Math.min(min, this.getLocalRadius(k, i / SEGMENTS));
    return Number.isFinite(min) ? min * NOMINAL_SURFACE_RADIUS * NOODLE_CM_PER_UNIT * 20 : this.diameterMm;
  }
  get uniformity() {
    let min = Infinity, max = 0;
    for (let k = 0; k < this.strandCount; k++) for (let i = 3; i < SEGMENTS - 3; i++) {
      const r = this.getLocalRadius(k, i / SEGMENTS);
      min = Math.min(min, r); max = Math.max(max, r);
    }
    return max > 0 ? Math.round(T.MathUtils.clamp(min / max, 0, 1) * 100) : 100;
  }
  get batchReady() { return !this.folding && !this.torn && this.strandCount >= 16 && this.diameterMm <= 10 && this.uniformity >= 65; }
  get tension() {
    const span = this.left.distanceTo(this.right);
    return Math.round(T.MathUtils.clamp((span / Math.max(.01, this.materialLength) - .76) / .27, 0, 1) * 100);
  }

  /** A new fold requires additional extension since the previous fold. */
  get canFold() {
    return !this.folding && !this.torn && this.strandCount < MAX_STRANDS && this.materialLength >= 2.55
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
    const y = T.MathUtils.clamp(center.y, 1.25, 3.5);
    this.left.set(-halfSpan, y, 0);
    this.right.set(halfSpan, y, 0);
    this.leftTarget.copy(this.left);
    this.rightTarget.copy(this.right);
    this.held.left = this.held.right = false;
    this.touched.left = this.touched.right = false;
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
    leftMotion.copy(this.left);
    rightMotion.copy(this.right);
    if (this.held.left) advanceResistantGrip(this.left, this.leftTarget, this.right, dt, this.materialLength, true);
    else if (!this.touched.left) this.left.lerp(this.leftTarget, blend);
    if (this.held.right) advanceResistantGrip(this.right, this.rightTarget, this.left, dt, this.materialLength, true);
    else if (!this.touched.right) this.right.lerp(this.rightTarget, blend);
    leftMotion.subVectors(this.left, leftMotion).clampLength(0, .09);
    rightMotion.subVectors(this.right, rightMotion).clampLength(0, .09);
    const span = this.left.distanceTo(this.right);
    const gravity = 3 + this.settings.gravity * .085;
    const radiusAtStart = this.radius;
    const violentMotion = T.MathUtils.clamp((leftMotion.length() + rightMotion.length() - .042) / .105, 0, 1);
    // Less damping preserves hand-driven follow-through after a release.
    const damping = Math.exp(-dt * (.62 + (100 - this.settings.softness) * .010));
    this.contacts = 0;
    this.transientLoad *= Math.exp(-dt * 5);
    const compliance = (.0000008 + this.settings.softness * .00000014) / (dt * dt);
    for (let strandIndex = 0; strandIndex < this.strands.length; strandIndex++) {
      const strand = this.strands[strandIndex];
      const { points, previous, rest, lambdas, yieldWeights } = strand;
      // If the user pulls the anchors apart, the dough must yield permanently.
      // Bounding this growth per step prevents a single large drag from exploding.
      const currentLength = rest.reduce((sum, value) => sum + value, 0);
      const desired = span / .975;
      if (desired > currentLength && strand.brokenAt === null) {
        const growth = Math.min(.035, (desired / currentLength - 1) * dt * (2.1 + this.settings.plasticity * .14));
        let totalWeight = 0;
        for (let i = 0; i < SEGMENTS; i++) {
          // Local tension and small deterministic variations make the yield
          // propagate along the dough instead of uniformly scaling a rubber tube.
          const strain = points[i].distanceTo(points[i + 1]) / Math.max(1e-6, rest[i]);
          const materialVariation = .13 * Math.sin(i * 1.73 + strandIndex * 2.11) ** 2;
          const weight = .65 + materialVariation + Math.max(0, Math.min(1.3, strain - .85)) * 1.55;
          yieldWeights[i] = weight;
          totalWeight += weight;
        }
        const mean = totalWeight / SEGMENTS;
        for (let i = 0; i < SEGMENTS; i++)
          rest[i] *= 1 + growth * T.MathUtils.clamp(yieldWeights[i] / mean, .68, 1.48);
      }
      for (let i = 1; i < SEGMENTS; i++) {
        const p = points[i], old = previous[i];
        delta.copy(p).sub(old).multiplyScalar(damping).clampLength(0, dt * 13);
        old.copy(p);
        p.add(delta);
        p.y -= gravity * dt * dt;
        const nearLeft = Math.max(0, 1 - i / 7);
        const nearRight = Math.max(0, 1 - (SEGMENTS - i) / 7);
        old.addScaledVector(leftMotion, -nearLeft * .33);
        old.addScaledVector(rightMotion, -nearRight * .33);
      }
      lambdas.fill(0);
      for (let pass = 0; pass < SOLVER_PASSES; pass++) {
        this.anchorFor(strandIndex, 'left', points[0], radiusAtStart);
        this.anchorFor(strandIndex, 'right', points[SEGMENTS], radiusAtStart);
        for (let i = 0; i < SEGMENTS; i++) {
          if (strand.brokenAt === i) continue;
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
          if (strand.brokenAt === i || strand.brokenAt === i - 1) {
            // Free, torn material ends must not be reconnected by bend smoothing.
          } else points[i].lerp(tmp, smooth);
          if (points[i].y < .32 + this.radius * NOMINAL_SURFACE_RADIUS) {
            points[i].y = .32 + this.radius * NOMINAL_SURFACE_RADIUS;
            // Cancel the normal velocity rather than creating a fake bounce.
            previous[i].y = points[i].y;
            previous[i].x += (points[i].x - previous[i].x) * .14;
            previous[i].z += (points[i].z - previous[i].z) * .14;
          }
        }
      }
      // Slow local creep spreads yield across nearby segments after a fast pull.
      const creep = dt * (.18 + this.settings.plasticity * .021);
      for (let i = 0; i < SEGMENTS; i++) {
        const distance = points[i].distanceTo(points[i + 1]);
        if (strand.brokenAt === i) continue;
        if (distance > rest[i] * 1.035) {
          rest[i] += Math.min(rest[i] * .006, (distance - rest[i]) * creep);
        }
      }
      if (strand.brokenAt === null) {
        // A sudden two-handed yank at high tension degrades the weakest
        // interior section. Slow, controlled pulls continue to flow plastically.
        // Sharp pulls can shock partly yielded dough too: after a first
        // extension, span/rest tension alone otherwise approaches zero and
        // repeated yanks never actually break a noodle.
        const overload = T.MathUtils.clamp((span / Math.max(.01, currentLength) - .77) / .20, 0, 1);
        const danger = violentMotion * overload;
        this.transientLoad = Math.max(this.transientLoad, danger);
        for (let i = 4; i < SEGMENTS - 4; i++) {
          const irregularity = Math.sin(i * 1.37 + strandIndex * 2.1) ** 2;
          const meanRest = currentLength / SEGMENTS;
          const thinSection = T.MathUtils.clamp(rest[i] / Math.max(.001, meanRest) - 1, 0, 1.5);
          const susceptibility = .67 + irregularity * .3 + thinSection * .32;
          strand.damage[i] = Math.max(0, strand.damage[i] - dt * .026)
            + danger * susceptibility * dt * 9.2;
          if (strand.damage[i] >= 1) {
            strand.brokenAt = i;
            // Separate the disconnected endpoints immediately. Each half
            // remains constrained to its own hand and falls freely at the cut.
            delta.subVectors(points[i + 1], points[i]);
            if (delta.lengthSq() < 1e-6) delta.set(1, 0, 0);
            delta.normalize();
            points[i].addScaledVector(delta, -.065);
            points[i + 1].addScaledVector(delta, .065);
            previous[i].copy(points[i]);
            previous[i + 1].copy(points[i + 1]);
            break;
          }
        }
      }
      this.anchorFor(strandIndex, 'left', points[0], radiusAtStart);
      this.anchorFor(strandIndex, 'right', points[SEGMENTS], radiusAtStart);
      previous[0].copy(points[0]);
      previous[SEGMENTS].copy(points[SEGMENTS]);
    }
    this.solveStrandContacts();
    // Contacts can push material back through the bench. Apply a final,
    // velocity-consistent projection after all strand contacts.
    for (let k = 0; k < this.strandCount; k++) for (let i = 1; i < SEGMENTS; i++) {
      const strand = this.strands[k];
      const floor = .32 + this.getLocalRadius(k, i / SEGMENTS) * NOMINAL_SURFACE_RADIUS;
      if (strand.points[i].y < floor) {
        strand.points[i].y = floor;
        strand.previous[i].y = floor;
      }
    }
    this.steps++;
  }

  /** Preserve a visible U-shaped return at each doubled loop: free ends
   * are grouped into pairs, with a wider turning radius at the looped side.
   * This is a paired-grip constraint, not a continuous volumetric FEM model. */
  private anchorFor(index: number, side: 'left' | 'right', out: T.Vector3, radius: number) {
    out.copy(this[side]);
    const count = this.strandCount;
    if (count <= 1) return out;
    const pairs = Math.ceil(count / 2);
    const lane = Math.floor(index / 2) - (pairs - 1) * .5;
    const polarity = index % 2 === 0 ? -1 : 1;
    out.z += lane * radius * 2.75
      + polarity * radius * (side === 'right' ? 1.35 : .63);
    return out;
  }

  /** Bounded particle-level collision approximation. Adjacent particles on
   * the same strand stay connected; nonlocal contacts and folds can slide. */
  private solveStrandContacts() {
    const gap = Math.max(.055, this.radius * 1.95);
    const gapSq = gap * gap;
    const repel = (a: T.Vector3, b: T.Vector3, pa: T.Vector3, pb: T.Vector3, seed: number) => {
      collisionVector.subVectors(b, a);
      const sq = collisionVector.lengthSq();
      if (sq >= gapSq) return;
      let d = Math.sqrt(sq);
      if (d < 1e-7) {
        collisionVector.set(Math.sin(seed * 17) * .4, 1, .23).normalize();
        d = 0;
      } else collisionVector.multiplyScalar(1 / d);
      const m = Math.min(.045, (gap - d) * .42);
      contactNormal.copy(collisionVector).multiplyScalar(m);
      a.addScaledVector(contactNormal, -.5); b.addScaledVector(contactNormal, .5);
      pa.addScaledVector(contactNormal, -.45); pb.addScaledVector(contactNormal, .45);
      this.contacts++;
    };
    for (let k = 0; k < this.strands.length; k++) {
      const a = this.strands[k];
      for (let j = k + 1; j < this.strands.length; j++) {
        const b = this.strands[j];
        for (let i = 2; i < SEGMENTS - 1; i++)
          for (let n = Math.max(2, i - 1); n <= Math.min(SEGMENTS - 2, i + 1); n++)
            repel(a.points[i], b.points[n], a.previous[i], b.previous[n], 1 + k * 23 + j);
      }
      // Ignore neighboring indices: they are intended to touch.
      for (let i = 2; i < SEGMENTS - 5; i++)
        for (let j = i + 5; j < SEGMENTS - 1; j++)
          repel(a.points[i], a.points[j], a.previous[i], a.previous[j], 101 + i + j);
    }
  }

}
