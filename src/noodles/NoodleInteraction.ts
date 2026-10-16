import * as T from 'three';
import { NoodleWorld } from './NoodleWorld';

const pos = new T.Vector2();
const point = new T.Vector3();
const offset = new T.Vector3();
const facing = new T.Vector3();
const rightAxis = new T.Vector3();
const upAxis = new T.Vector3();

/** Handles own gestures; doesn't depend on pizza-specific drag or collision bodies. */
export class NoodleInteraction {
  private ray = new T.Raycaster();
  private plane = new T.Plane();
  private activeSide: 'left' | 'right' | null = null;
  private pointer: number | null = null;
  private orbitPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private orbitYaw = .04;
  private orbitPitch = 1.26;
  private distance = 11.4;
  private desiredYaw = this.orbitYaw;
  private desiredPitch = this.orbitPitch;
  private desiredDistance = this.distance;
  private target = new T.Vector3(0, 2.18, 0);
  private dragOffset = new T.Vector3();
  private keyboard = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: T.PerspectiveCamera,
    private world: NoodleWorld,
    private grips: { left: T.Mesh; right: T.Mesh },
    private onPull: () => void
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('lostpointercapture', this.up);
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

  private cast(e: PointerEvent) {
    const bounds = this.canvas.getBoundingClientRect();
    pos.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1);
    this.ray.setFromCamera(pos, this.camera);
  }

  private down = (e: PointerEvent) => {
    if (this.pointer !== null || this.orbitPointer !== null) return;
    this.cast(e);
    const grip = this.ray.intersectObjects([this.grips.left, this.grips.right])[0];
    const orbitGesture = e.button === 1 || e.button === 2 || e.shiftKey || e.altKey;
    if (grip && !orbitGesture && e.button === 0) {
      this.activeSide = grip.object.userData.side as 'left' | 'right';
      this.pointer = e.pointerId;
      this.camera.getWorldDirection(facing);
      const handle = this.world[this.activeSide];
      this.plane.setFromNormalAndCoplanarPoint(facing, handle);
      this.dragOffset.copy(handle).sub(grip.point);
      this.canvas.classList.add('dragging');
      this.onPull();
    } else {
      this.orbitPointer = e.pointerId;
      this.canvas.classList.add('orbiting');
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    e.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(e.pointerId);
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId === this.pointer && this.activeSide) {
      this.cast(e);
      if (this.ray.ray.intersectPlane(this.plane, point)) {
        point.add(this.dragOffset);
        this.world.moveHandle(this.activeSide, point);
      }
    } else if (e.pointerId === this.orbitPointer) {
      this.desiredYaw -= (e.clientX - this.lastX) * .006;
      this.desiredPitch = T.MathUtils.clamp(this.desiredPitch - (e.clientY - this.lastY) * .006, .55, 1.8);
    } else if (this.pointer === null && this.orbitPointer === null) {
      this.cast(e);
      const hit = this.ray.intersectObjects([this.grips.left, this.grips.right]).length > 0;
      this.canvas.classList.toggle('grabbable', hit);
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId === this.pointer) { this.pointer = null; this.activeSide = null; this.canvas.classList.remove('dragging'); }
    if (e.pointerId === this.orbitPointer) { this.orbitPointer = null; this.canvas.classList.remove('orbiting'); }
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  };

  release = () => {
    this.pointer = this.orbitPointer = null;
    this.activeSide = null;
    this.keyboard = false;
    this.canvas.classList.remove('dragging', 'orbiting');
  };

  resetView() {
    this.desiredYaw = .04;
    this.desiredPitch = 1.26;
    this.desiredDistance = 11.4;
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
    this.target.y = T.MathUtils.lerp(this.target.y, T.MathUtils.clamp(follow - .45, 1.6, 2.8), blend * .25);
    const framing = Math.max(0, (span - 5.2) * .48);
    offset.setFromSphericalCoords(this.distance + framing, this.orbitPitch, this.orbitYaw);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    rightAxis.setFromMatrixColumn(this.camera.matrixWorld, 0);
    upAxis.setFromMatrixColumn(this.camera.matrixWorld, 1);
  }
}
