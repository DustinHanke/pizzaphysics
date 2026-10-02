import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CollisionWorld} from '../src/physics/CollisionWorld';
import {params,presets} from '../src/presets/presets';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const body=new PizzaSlice(1,materials),collisions=new CollisionWorld([body]);body.detached=true;body.group.position.y=1.25;
const report:any={};
for(let i=0;i<720;i++)body.cloth.step(1/120,collisions,null);
report.hanging={offset:body.cloth.offsets[0].toArray(),tip:body.cloth.points[0].toArray(),maxStrain:Math.max(...body.cloth.links.filter(l=>!l.bend).map(l=>body.cloth.points[l.a].distanceTo(body.cloth.points[l.b])/l.length))};
assert(-body.cloth.offsets[0].y>.35,'unsupported dough should hang below its crust');
assert(report.hanging.maxStrain<1.12,'dough stretched like rubber');
// A local contact under one shoulder must lift that patch while adjacent dough hangs.
const center=body.cloth.points[body.cloth.index(4,0)].clone();center.y-=.2;const sphereRadius=.42;
const contactWorld={resolveParticle(p:T.Vector3,previous:T.Vector3|undefined,r:number){collisions.resolveParticle(p,previous,r,body);const v=p.clone().sub(center),distance=v.length();if(distance<sphereRadius+r){v.multiplyScalar((sphereRadius+r-distance)/Math.max(distance,1e-8));p.add(v);previous?.add(v);}}} as CollisionWorld;
const before=body.cloth.points.map(p=>p.clone());for(let i=0;i<600;i++)body.cloth.step(1/120,contactWorld,null);
const contactLift=body.cloth.points[body.cloth.index(4,0)].y-before[body.cloth.index(4,0)].y,farLift=body.cloth.points[body.cloth.index(4,body.cloth.across)].y-before[body.cloth.index(4,body.cloth.across)].y;
report.contact={contactLift,farLift,tip:body.cloth.points[0].y};assert(contactLift>.10);assert(contactLift-farLift>.08,'collision translated the entire slice instead of draping');
// Deformed mesh vertices and material coordinates agree, even after folding.
body.updateGeometry();body.group.updateMatrixWorld(true);const surface=body.deformables[0],g=surface.mesh.geometry,p=g.attributes.position;let index=600;const face={a:g.index!.getX(index),b:g.index!.getX(index+1),c:g.index!.getX(index+2),normal:new T.Vector3(),materialIndex:0};
const hitPoint=new T.Vector3().fromBufferAttribute(p,face.a).add(new T.Vector3().fromBufferAttribute(p,face.b)).add(new T.Vector3().fromBufferAttribute(p,face.c)).multiplyScalar(1/3);surface.mesh.localToWorld(hitPoint);
const recovered=body.restPoint({object:surface.mesh,point:hitPoint,face} as T.Intersection,new T.Vector3());const expected=new T.Vector3().fromArray(surface.base,face.a*3).add(new T.Vector3().fromArray(surface.base,face.b*3)).add(new T.Vector3().fromArray(surface.base,face.c*3)).multiplyScalar(1/3);assert(recovered.distanceTo(expected)<1e-5);
// Cooling increases bending resistance using the same solver.
Object.assign(params,{temperature:42,stiffness:91,sag:.23});body.cloth.reset();for(let i=0;i<720;i++)body.cloth.step(1/120,collisions,null);report.frozenSag=-body.cloth.offsets[0].y;assert(report.frozenSag<-report.hanging.offset[1]*.65);
console.log(JSON.stringify({passed:true,report},null,2));

Object.assign(params,presets.neapolitan);body.cloth.reset();for(let i=0;i<300;i++)body.cloth.step(1/120,collisions,null);
for(const node of body.cloth.rest){const upper=node.clone().setY(.080),lower=node.clone().setY(.055);assert(Math.abs(body.worldPoint(upper,new T.Vector3()).distanceTo(body.worldPoint(lower,new T.Vector3()))-.025)<1e-7,'fold lost dough thickness');}
body.updateGeometry();for(const topping of body.toppings){const up=new T.Vector3(0,1,0).applyQuaternion(topping.mesh.quaternion.clone().multiply(topping.rotation.clone().invert())),normal=body.cloth.surfaceNormal(topping.binding,new T.Vector3());assert(up.distanceTo(normal)<1e-7,'basil orientation did not follow the surface');}
console.log('PASS: volumetric layer thickness and locally oriented toppings.');
