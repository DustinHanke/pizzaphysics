import * as T from 'three';
import { NoodleWorld } from './NoodleWorld';

type Side = 'left' | 'right';
interface Drag {
  side: Side;
  plane: T.Plane;
  offset: T.Vector3;
}

/** Independent Pointer Events for both dough ends. Capturing each pointer ID
 * allows two fingers to pull simultaneously without camera orbit interference. */
export class NoodleInteraction {
  private ray = new T.Raycaster();
  private ndc = new T.Vector2();
  private hit = new T.Vector3();
  private view = new T.Vector3();
  private cameraOffset = new T.Vector3();
  private desiredCameraPosition = new T.Vector3();
  private readonly drags = new Map<number, Drag>();
  private readonly owners = new Map<Side, number>();
  private orbit: { id: number; x: number; y: number } | null = null;
  private hover: Side | null = null;

  private orbitYaw = .04;
  private orbitPitch = 1.13;
  private distance = 7.4;
  private desiredYaw = this.orbitYaw;
  private desiredPitch = this.orbitPitch;
  private desiredDistance = this.distance;
  private target = new T.Vector3(0, 1.28, 0);
  private keyboard = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: T.PerspectiveCamera,
    private world: NoodleWorld,
    private grips: { left: T.Mesh; right: T.Mesh },
    private onPull: () => void,
    private onFoldGesture: () => void,
    private onGripState: (leftActive: boolean, rightActive: boolean, hovered: Side | null) => void,
    private onDoughGesture?: () => void,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel);
    canvas.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'touch' && this.drags.size === 0) {
        this.hover = null;
        this.emitGripState();
      }
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.desiredDistance = T.MathUtils.clamp(this.desiredDistance * Math.exp(e.deltaY * .0015), 6, 19);
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('keydown', this.key);
    window.addEventListener('blur', this.release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release(); });
    this.update(1);
  }

  private emitGripState() {
    this.onGripState(this.owners.has('left'), this.owners.has('right'), this.hover);
  }

  private cast(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(
      (e.clientX - rect.left) / rect.width * 2 - 1,
      -(e.clientY - rect.top) / rect.height * 2 + 1,
    );
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private locateSide(e: PointerEvent): Side | null {
    // Ray intersection is precise for mouse/pen; the proximity fallback
    // provides generous, accessible touch targets on smaller screens.
    const intersection = this.ray.intersectObjects([this.grips.left, this.grips.right])[0];
    const dl = this.ray.ray.distanceToPoint(this.grips.left.position);
    const dr = this.ray.ray.distanceToPoint(this.grips.right.position);
    const margin = e.pointerType === 'touch' ? .83 : .56;
    if (intersection) return intersection.object.userData.side as Side;
    return Math.min(dl, dr) < margin ? (dl <= dr ? 'left' : 'right') : null;
  }

  private capture(id: number) {
    this.canvas.setPointerCapture(id);
    this.canvas.focus({ preventScroll: true });
  }

  private down = (e: PointerEvent) => {
    if (this.world.folding || this.drags.has(e.pointerId) || this.orbit?.id === e.pointerId) return;
    // Never assign the same grip to both fingers, and never steal one already
    // held by another pointer. Additional touches are safely ignored.
    this.cast(e);
    const side = this.locateSide(e);
    const orbitGesture = e.button === 1 || e.button === 2 || e.shiftKey || e.altKey;
    if (side && !orbitGesture && e.button === 0 && !this.owners.has(side)) {
      this.camera.getWorldDirection(this.view);
      const anchor = this.grips[side].position;
      const plane = new T.Plane().setFromNormalAndCoplanarPoint(this.view, anchor);
      this.ray.ray.closestPointToPoint(anchor, this.hit);
      this.drags.set(e.pointerId, { side, plane, offset: anchor.clone().sub(this.hit) });
      this.owners.set(side, e.pointerId);
      this.hover = null;
      this.canvas.classList.add('dragging');
      this.canvas.classList.remove('grabbable');
      this.emitGripState();
      this.onPull();
      e.preventDefault();
      this.capture(e.pointerId);
      return;
    }
    // On touch screens an unclaimed second finger must NOT start orbiting
    // while dough is being stretched with the first finger.
    if (e.pointerType === 'touch' && (this.drags.size > 0 || this.orbit !== null)) return;
    if (this.orbit || this.drags.size > 0) return;
    this.orbit = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.canvas.classList.add('orbiting');
    this.hover = null;
    this.emitGripState();
    e.preventDefault();
    this.capture(e.pointerId);
  };

  private move = (e: PointerEvent) => {
    const drag = this.drags.get(e.pointerId);
    if (drag) {
      this.cast(e);
      if (this.ray.ray.intersectPlane(drag.plane, this.hit)) {
        this.world.moveHandle(drag.side, this.hit.add(drag.offset));
        // A real pointer gesture offers the best chance of permission to
        // trigger navigator.vibrate on platforms that support it.
        this.onDoughGesture?.();
      }
      e.preventDefault();
      return;
    }
    if (this.orbit?.id === e.pointerId) {
      // An orbit gesture that started before a grab must not rotate the camera
      // while either hand is stretching dough.
      if (this.drags.size === 0) {
        this.desiredYaw -= (e.clientX - this.orbit.x) * .006;
        this.desiredPitch = T.MathUtils.clamp(this.desiredPitch - (e.clientY - this.orbit.y) * .006, .55, 1.8);
      }
      this.orbit.x = e.clientX;
      this.orbit.y = e.clientY;
      e.preventDefault();
      return;
    }
    if (e.pointerType !== 'touch' && this.drags.size === 0 && !this.orbit) {
      this.cast(e);
      this.hover = this.locateSide(e);
      this.canvas.classList.toggle('grabbable', this.hover !== null);
      this.emitGripState();
    }
  };

  private finish(e: PointerEvent, allowFold: boolean) {
    const drag = this.drags.get(e.pointerId);
    if (drag) {
      this.drags.delete(e.pointerId);
      this.owners.delete(drag.side);
      if (this.drags.size === 0) this.canvas.classList.remove('dragging');
      this.emitGripState();
      // Trigger only when the FINAL finger releases, never when one hand
      // lets go mid-pull, nor when the browser cancels an interrupted touch.
      if (allowFold && this.drags.size === 0 && this.world.canFold
        && this.world.leftTarget.distanceTo(this.world.rightTarget) < 1.35) {
        this.onFoldGesture();
      }
    }
    if (this.orbit?.id === e.pointerId) {
      this.orbit = null;
      this.canvas.classList.remove('orbiting');
    }
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  }

  private up = (e: PointerEvent) => this.finish(e, true);
  private cancel = (e: PointerEvent) => this.finish(e, false);

  release = () => {
    const ids = [...this.drags.keys()];
    if (this.orbit) ids.push(this.orbit.id);
    this.drags.clear();
    this.owners.clear();
    this.orbit = null;
    this.keyboard = false;
    this.hover = null;
    this.emitGripState();
    this.canvas.classList.remove('dragging', 'orbiting', 'grabbable');
    for (const id of ids) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  };

  resetView() {
    this.desiredYaw = .04;
    this.desiredPitch = 1.13;
    this.desiredDistance = 7.4;
  }

  private key = (e: KeyboardEvent) => {
    if (e.code === 'Escape') { this.release(); return; }
    if (e.code === 'KeyC') { this.resetView(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      this.keyboard = !this.keyboard;
      if (this.keyboard) this.onPull();
    }
    if (!this.keyboard) return;
    const target = this.world.rightTarget.clone();
    const step = .18;
    if (e.code === 'ArrowLeft') target.x -= step;
    else if (e.code === 'ArrowRight') target.x += step;
    else if (e.code === 'ArrowUp') target.z -= step;
    else if (e.code === 'ArrowDown') target.z += step;
    else if (e.code === 'PageUp') target.y += step;
    else if (e.code === 'PageDown') target.y -= step;
    else return;
    e.preventDefault();
    this.world.moveHandle('right', target);
  };

  update(dt: number) {
    const blend = 1 - Math.exp(-Math.max(0, Math.min(dt, .25)) * 12);
    this.orbitYaw = T.MathUtils.lerp(this.orbitYaw, this.desiredYaw, blend);
    this.orbitPitch = T.MathUtils.lerp(this.orbitPitch, this.desiredPitch, blend);
    this.distance = T.MathUtils.lerp(this.distance, this.desiredDistance, blend);
    const span = this.world.left.distanceTo(this.world.right);
    const follow = .5 * (this.world.left.y + this.world.right.y);
    this.target.y = T.MathUtils.lerp(this.target.y, T.MathUtils.clamp(follow - .34, 1.13, 2.4), blend * (this.drags.size ? .10 : .25));
    const fitDistance = span * 1.20 / (2 * Math.tan(35 * Math.PI / 360) * Math.max(.56, this.camera.aspect));
    const framing = Math.max(0, (span - 5.2) * .48);
    this.cameraOffset.setFromSphericalCoords(Math.max(this.distance + framing, fitDistance), this.orbitPitch, this.orbitYaw);
    this.desiredCameraPosition.copy(this.target).add(this.cameraOffset);
    // Avoid chasing a moving fingertip by dramatically changing screen-space
    // projection while it is holding a dough grip.
    this.camera.position.lerp(this.desiredCameraPosition, this.drags.size > 0 ? .075 : 1);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
