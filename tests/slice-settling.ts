import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
const material=new T.MeshPhysicalMaterial();
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,material]));
const report=[];
for(const angle of [-1.05,.85]){
 const body=new PizzaSlice(1,materials);body.detached=true;body.group.position.set(4,1.2,0);
 const axis=new T.Vector3(-Math.sin(body.theta),0,Math.cos(body.theta));body.group.quaternion.setFromAxisAngle(axis,angle);
 const world=new PhysicsWorld([body],{update(){},clear(){}} as any);
 for(let i=0;i<1200;i++)world.step(1/120);
 const up=new T.Vector3(0,1,0).applyQuaternion(body.group.quaternion);
 report.push({angle,up:up.y,speed:body.velocity.length(),spin:body.angularVelocity.length(),sleeping:body.sleeping});
 assert(Math.abs(up.y)>.9,'released slice remained standing on its rim');
 assert(body.velocity.length()<.2&&body.angularVelocity.length()<.2,'released slice failed to settle');
 assert(body.cloth.points.every(p=>Number.isFinite(p.lengthSq())&&p.y>-.02),'dough penetrated ground');
}
const body=new PizzaSlice(2,materials);body.detached=true;body.cloth.start();
const mobile=body.cloth.inverseMass.filter(x=>x>0);assert(Math.max(...mobile)>Math.min(...mobile)*2,'center still has uniform particle masses');
assert(body.crustMass>body.centerMass);
const local=body.cloth.rest[body.cloth.index(3,2)],force=new T.Vector3(10,0,0);
for(let i=0;i<80;i++)body.cloth.applyForce(local,force,1/120);
assert(body.cheeseForceBudget<=.160000001,'dense cheese networks multiplied total force');
assert.equal(body.velocity.lengthSq(),0,'cheese directly towed rigid crust');
body.sleeping=true;const before=body.cloth.previous.map(p=>p.clone());body.cloth.applyForce(local,force,1/120);assert(before.every((p,i)=>p.equals(body.cloth.previous[i])),'cheese woke a resting slice');
console.log(JSON.stringify({settling:report,cheeseBudget:body.cheeseForceBudget}));

// A crust grab supports only the rim; the center continues sagging under gravity.
const held=new PizzaSlice(1,materials);held.detached=held.held=true;
const heldWorld=new PhysicsWorld([held],{update(){},clear(){}} as any);
const anchor=held.crustCenter.clone(),target=held.massCenter(new T.Vector3()).add(new T.Vector3(0,1.4,0));
heldWorld.drag={body:held,local:anchor,target};
for(let i=0;i<720;i++)heldWorld.step(1/120);
assert(held.massCenter(new T.Vector3()).distanceTo(target)<.2,'crust grab lost control');
assert(held.cloth.offsets[0].y<-.3,'held center lost its sag');
assert(held.cloth.links.filter(l=>!l.bend).every(l=>held.cloth.points[l.a].distanceTo(held.cloth.points[l.b])<l.length*1.13),'held center stretched like rubber');
console.log('PASS: local crust grab retains control while the lighter center sags.');
