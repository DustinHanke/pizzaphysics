import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
import {OrbitCamera} from '../src/interaction/OrbitCamera';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene();slices.forEach(s=>scene.add(s.group));const cheese=new CheeseSystem(slices,scene,materials.strand),world=new PhysicsWorld(slices,cheese);
const report:any={};const body=slices[1];body.detached=true;body.hasCheese=true;body.group.position.set(.3,1.6,.1);
let contacts=0;const start=performance.now();for(let i=0;i<600;i++){world.step(1/120);contacts+=world.collisions.contacts;}
report.drop={height:body.group.position.y,penetration:world.collisions.maxPenetration(),contacts,stepMs:(performance.now()-start)/600};
assert(contacts>0);assert(world.collisions.maxPenetration()<.04);assert(body.cloth.points[0].y>.125,'flexible tip fell through the remaining pizza');
const other=slices[3];other.detached=true;other.hasCheese=true;other.group.position.set(.4,2,.1);for(let i=0;i<600;i++)world.step(1/120);report.stack={height:other.group.position.y,penetration:world.collisions.maxPenetration()};assert(report.stack.penetration<.045);
// Pushing into the pizza remains constrained even against the drag spring.
const local=new T.Vector3(.2,.18,.1),target=new T.Vector3(.3,.1,.1);body.held=true;world.drag={body,local,target};for(let i=0;i<480;i++)world.step(1/120);report.push={penetration:world.collisions.maxPenetration()};assert(report.push.penetration<.045);
world.reset();const proxy=world.collisions.proxies[0],particle=proxy.center.clone(),previous=particle.clone();for(let i=0;i<4;i++)world.collisions.resolveParticle(particle,previous,.015);assert(particle.distanceTo(proxy.center)>.025);assert(particle.y>=.04);report.particleContact=particle.toArray();
const swept=proxy.center.clone(),old=swept.clone();old.y=.6;swept.y=-.2;world.collisions.resolveParticle(swept,old,.012);assert(swept.y>.117,'fast cheese particle crossed the thin dough');report.sweptContact=swept.y;
// New pull shapes are generated once, not changed per frame or replayed on reset.
const signatures=new Set<string>(),counts:number[]=[];for(let i=0;i<12;i++){world.reset();cheese.spawn(body);const fingerprint=()=>JSON.stringify(cheese.strands.map(s=>[s.side,s.r,s.radius,s.primary]));const before=fingerprint();counts.push(cheese.initial);signatures.add(before);for(let n=0;n<10;n++)cheese.update(1/120);assert.equal(before,fingerprint());}assert(signatures.size===12);assert(new Set(counts).size>2);report.topologies={unique:signatures.size,counts};world.reset();
body.detached=body.held=true;body.hasCheese=true;const anchor=new T.Vector3(.1,.18,.1),held=body.worldPoint(anchor,new T.Vector3()).add(new T.Vector3(0,1.4,0));world.drag={body,local:anchor,target:held};for(let i=0;i<200;i++)world.step(1/120);let low=10,high=-10;held.x+=.8;held.y+=.6;for(let i=0;i<150;i++){world.step(1/120);low=Math.min(low,body.bend);high=Math.max(high,body.bend);}for(let i=0;i<600;i++)world.step(1/120);report.flex={variation:high-low,settledVelocity:body.bendVelocity,twistVelocity:body.twistVelocity};assert(high-low>.02);assert(Math.abs(body.bendVelocity)<.01);assert(Math.abs(body.twistVelocity)<.01);
// Orbit camera modifies only view state, and returns to a stable home view.
(globalThis as any).window={addEventListener(){}};const capture=new Set<number>();const canvas:any={addEventListener(){},classList:{add(){},remove(){}},setPointerCapture(id:number){capture.add(id);},releasePointerCapture(id:number){capture.delete(id);},hasPointerCapture(id:number){return capture.has(id);}};
const camera=new T.PerspectiveCamera(35,4/3,.1,70),orbit=new OrbitCamera(canvas,camera,world),snapshot=JSON.stringify(slices.map(s=>[s.group.position.toArray(),s.group.quaternion.toArray(),s.velocity.toArray()]));const event=(x:number,y:number)=>({pointerId:1,clientX:x,clientY:y,button:0,shiftKey:false,preventDefault(){}} as PointerEvent);
orbit.begin(event(0,0));orbit.move(event(1400,-1400));orbit.end(event(1400,-1400));for(let i=0;i<120;i++)orbit.update(1/60);assert(camera.position.y<0,'underside view unavailable');assert(orbit.pitch<=2.08);assert(orbit.radius>=4.8);assert.equal(snapshot,JSON.stringify(slices.map(s=>[s.group.position.toArray(),s.group.quaternion.toArray(),s.velocity.toArray()])));
orbit.reset();for(let i=0;i<180;i++)orbit.update(1/60);assert(camera.position.y>4);assert(orbit.target.distanceTo(new T.Vector3(0,.25,0))<.001);report.orbit={limits:true,underside:true,physicsUnaffected:true,reset:true};console.log(JSON.stringify({passed:true,report},null,2));
