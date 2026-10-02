import * as T from 'three';
import type {PhysicsWorld} from '../physics/PhysicsWorld';
import {reducedMotion} from '../presets/presets';
const aim=new T.Vector3(),offset=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3();
/** Camera state never writes to the physics world. Input ownership is decided at pointer-down. */
export class OrbitCamera {
 pointers=new Map<number,{x:number,y:number,pan:boolean}>();yaw=Math.atan2(.275,.55);pitch=.62;radius=10.8;
 desiredYaw=this.yaw;desiredPitch=this.pitch;desiredRadius=this.radius;target=new T.Vector3(0,.25,0);pan=new T.Vector3();desiredPan=new T.Vector3();follow=true;homeRadius=10.8;lastAspect=0;frameRadius=0;
 constructor(public canvas:HTMLCanvasElement,public camera:T.PerspectiveCamera,public world:PhysicsWorld){
  this.resize();this.radius=this.desiredRadius;this.update(1);window.addEventListener('resize',this.resize);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.desiredRadius=T.MathUtils.clamp(this.desiredRadius*Math.exp(T.MathUtils.clamp(e.deltaY,-150,150)*.0018),4.8,24);},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
 resize=()=>{this.lastAspect=this.camera.aspect;const next=Math.max(10.8,6.6/(this.camera.aspect*2*Math.tan(35*Math.PI/360)));this.desiredRadius=T.MathUtils.clamp(this.desiredRadius*next/this.homeRadius,4.8,24);this.homeRadius=next;};
 begin(e:PointerEvent){e.preventDefault();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button===1||e.shiftKey});this.canvas.setPointerCapture(e.pointerId);this.canvas.classList.add('orbiting');}
 move(e:PointerEvent){
  const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;e.preventDefault();
  if(this.pointers.size>1){const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)![1],old=Math.hypot(p.x-other.x,p.y-other.y),next=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(next>5&&old>5)this.desiredRadius=T.MathUtils.clamp(this.desiredRadius*old/next,4.8,24);this.panBy(dx*.5,dy*.5);}
  else if(p.pan)this.panBy(dx,dy);else{this.desiredYaw-=dx*.006;this.desiredPitch=T.MathUtils.clamp(this.desiredPitch-dy*.006,.18,2.08);}
  p.x=e.clientX;p.y=e.clientY;
 }
 private panBy(dx:number,dy:number){right.setFromMatrixColumn(this.camera.matrixWorld,0);up.setFromMatrixColumn(this.camera.matrixWorld,1);const scale=this.desiredRadius*.00075;this.desiredPan.addScaledVector(right,-dx*scale).addScaledVector(up,dy*scale).clampLength(0,1.6);}
 end(e:PointerEvent){this.pointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);if(!this.pointers.size)this.canvas.classList.remove('orbiting');}
 cancel(){for(const id of this.pointers.keys())if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.pointers.clear();this.canvas.classList.remove('orbiting');}
 reset(){const home=Math.atan2(.275,.55);this.desiredYaw=this.yaw+Math.atan2(Math.sin(home-this.yaw),Math.cos(home-this.yaw));this.desiredPitch=.62;this.desiredRadius=this.homeRadius;this.desiredPan.set(0,0,0);this.follow=false;}
 update(dt:number){
  if(Math.abs(this.lastAspect-this.camera.aspect)>.001)this.resize();
  const blend=1-Math.exp(-dt*(reducedMotion.matches?28:16));this.yaw=T.MathUtils.lerp(this.yaw,this.desiredYaw,blend);this.pitch=T.MathUtils.lerp(this.pitch,this.desiredPitch,blend);this.radius=T.MathUtils.lerp(this.radius,this.desiredRadius,blend);this.pan.lerp(this.desiredPan,blend);
  aim.set(0,.25,0);if(this.follow&&this.world.drag){offset.copy(this.world.drag.body.group.position).sub(this.world.drag.body.home).multiplyScalar(.085).clampLength(0,.42);aim.add(offset);}aim.add(this.pan);this.target.lerp(aim,1-Math.exp(-dt*5));
  let framing=0;if(this.follow&&this.world.drag){const extent=this.world.drag.body.group.position.distanceTo(this.target)+1.45;
   const viewHalf=Math.min(this.camera.aspect,1)*Math.tan(this.camera.fov*Math.PI/360);framing=Math.max(0,Math.min(1.65,extent/(viewHalf*.88)-this.radius));}
  this.frameRadius=T.MathUtils.lerp(this.frameRadius,framing,1-Math.exp(-dt*2.4));
  offset.setFromSphericalCoords(this.radius+this.frameRadius,this.pitch,this.yaw);this.camera.position.copy(this.target).add(offset);
  // Keep the camera outside nearby slices and cheese while inspecting close-ups.
  for(const slice of this.world.slices){const d=this.camera.position.distanceTo(slice.group.position);if(d<1.35)this.camera.position.addScaledVector(offset,(1.35-d)/this.radius);}
  for(const strand of this.world.cheese.strands)for(const p of strand.points){const d=this.camera.position.distanceTo(p);if(d<.35)this.camera.position.addScaledVector(offset,(.35-d)/this.radius);}
  this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
 }
}
