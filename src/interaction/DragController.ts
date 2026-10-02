import * as T from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import {OrbitCamera} from './OrbitCamera';
import { PizzaSlice } from '../pizza/PizzaSlice';
const hit=new T.Vector3(),normal=new T.Vector3(),screen=new T.Vector2(),local=new T.Vector3();
/** Near-linear close to the grab; increasing resistance limits distant pulls smoothly. */
export function pullEnvelope(distance:number){return 4.6*Math.tanh(distance/4.6);}
export class DragController {
 private lastHover=0;
 ray=new T.Raycaster();plane=new T.Plane();pointerId:number|null=null;hover:PizzaSlice|null=null;start=new T.Vector3();targetBase=new T.Vector3();keyboardBody:PizzaSlice|null=null;pinEnabled=false;gestureHold=false;lastPointer=new T.Vector2();
 constructor(public canvas:HTMLCanvasElement,public camera:T.PerspectiveCamera,public world:PhysicsWorld,public onGrab:()=>void,public orbit:OrbitCamera){
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);canvas.addEventListener('lostpointercapture',this.up);canvas.addEventListener('keydown',this.key);
  canvas.addEventListener('touchstart',e=>{if(this.pointerId!==null||this.orbit.pointers.size)e.preventDefault();},{passive:false});canvas.addEventListener('touchmove',e=>{if(this.pointerId!==null||this.orbit.pointers.size)e.preventDefault();},{passive:false});
  window.addEventListener('blur',this.release);document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release();});
 }
 cast(e:PointerEvent){const r=this.canvas.getBoundingClientRect();screen.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(screen,this.camera);}
 down=(e:PointerEvent)=>{
  if(this.pointerId!==null){
   if(e.pointerType==='touch'&&e.pointerId!==this.pointerId){const first=this.pointerId;this.pointerId=null;this.gestureHold=true;this.canvas.classList.remove('dragging');
    this.orbit.begin({pointerId:first,clientX:this.lastPointer.x,clientY:this.lastPointer.y,button:0,shiftKey:false,preventDefault(){}} as PointerEvent);this.orbit.begin(e);}
   return;
  }
  if(this.orbit.pointers.size||e.button===2||e.button===1||e.altKey||e.shiftKey){this.orbit.begin(e);return;}
  if(e.button!==0)return;this.cast(e);const hits=this.ray.intersectObjects(this.world.slices.map(s=>s.group),true);if(!hits.length){this.orbit.begin(e);return;}
  const body=hits[0].object.userData.slice as PizzaSlice;if(!body)return;
  if(this.world.drag)this.world.drag.body.held=false;this.orbit.follow=true;this.world.cheese.beginPull(body);
  e.preventDefault();this.canvas.focus({preventScroll:true});this.pointerId=e.pointerId;this.lastPointer.set(e.clientX,e.clientY);this.canvas.setPointerCapture(e.pointerId);this.canvas.classList.add('dragging');
  hit.copy(hits[0].point);body.restPoint(hits[0],local);
  this.camera.getWorldDirection(normal);this.plane.setFromNormalAndCoplanarPoint(normal,hit);this.start.copy(hit);this.targetBase.copy(hit);
  body.sleeping=false;body.sleepTime=0;body.detached=body.held=true;this.world.drag={body,local:local.clone(),target:hit.clone()};this.onGrab();
 };
 move=(e:PointerEvent)=>{
  if(this.orbit.pointers.has(e.pointerId)){this.orbit.move(e);return;}
  this.cast(e);if(this.pointerId===e.pointerId)this.lastPointer.set(e.clientX,e.clientY);
  if(this.pointerId===e.pointerId&&this.world.drag){
   e.preventDefault();if(this.ray.ray.intersectPlane(this.plane,hit)){const distance=hit.distanceTo(this.start);this.targetBase.copy(hit);hit.sub(this.start).multiplyScalar(distance>1e-8?pullEnvelope(distance)/distance:1).add(this.start);this.world.drag.target.copy(hit);this.world.drag.target.y+=Math.min(.85,.08+pullEnvelope(distance)*.32);this.world.drag.target.y=T.MathUtils.clamp(this.world.drag.target.y,.20,4.8);}
  }else if(this.pointerId===null){const now=performance.now();if(now-this.lastHover<1000/30)return;this.lastHover=now;this.hover=this.world.collisions.pick(this.ray.ray);this.canvas.classList.toggle('grabbable',!!this.hover);}
 };
 up=(e:PointerEvent)=>{if(this.orbit.pointers.has(e.pointerId)){this.orbit.end(e);if(this.gestureHold&&!this.orbit.pointers.size){this.gestureHold=false;if(!this.pinEnabled)this.release();}return;}if(this.pointerId===e.pointerId){if(this.pinEnabled&&e.type==='pointerup'){const id=this.pointerId;this.pointerId=null;this.canvas.classList.remove('dragging');if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}else this.release();}};
 release=()=>{this.gestureHold=false;this.orbit.cancel();if(this.world.drag)this.world.drag.body.held=false;this.world.drag=null;this.keyboardBody=null;const id=this.pointerId;this.pointerId=null;this.canvas.classList.remove('dragging');if(id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);};
 togglePin=()=>{this.pinEnabled=!this.pinEnabled;document.querySelector('#hold')?.setAttribute('aria-pressed',String(this.pinEnabled));if(!this.pinEnabled&&this.pointerId===null)this.release();};
 key=(e:KeyboardEvent)=>{
  if(e.code==='KeyH'){e.preventDefault();this.togglePin();return;}
  if(e.code==='KeyC'){e.preventDefault();this.orbit.reset();return;}
  if(e.code==='Escape'){this.release();return;}
  if(e.code==='Space'){e.preventDefault();if(this.world.drag){this.release();return;}const body=this.world.slices[1];body.sleeping=false;body.sleepTime=0;body.detached=body.held=true;this.world.cheese.beginPull(body);this.orbit.follow=true;this.keyboardBody=body;const anchor=new T.Vector3(.1,.33,.3);const target=body.worldPoint(anchor,new T.Vector3());target.y+=1;this.world.drag={body,local:anchor,target};this.onGrab();}
  if(this.keyboardBody&&this.world.drag){const t=this.world.drag.target,step=.2;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.code))e.preventDefault();if(e.code==='ArrowLeft')t.x-=step;if(e.code==='ArrowRight')t.x+=step;if(e.code==='ArrowUp')t.z-=step;if(e.code==='ArrowDown')t.z+=step;if(e.code==='PageUp')t.y+=step;if(e.code==='PageDown')t.y-=step;t.clamp(new T.Vector3(-6,.4,-6),new T.Vector3(6,4.8,6));}
 };
}
