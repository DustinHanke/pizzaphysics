import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CollisionWorld} from '../src/physics/CollisionWorld';
import {ResolutionBudget} from '../src/performance/ResolutionBudget';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),world=new CollisionWorld(slices),body=slices[1];
body.cloth.start();for(let i=0;i<body.cloth.offsets.length;i++){body.cloth.offsets[i].set(Math.sin(i)*.02,-i*.003,Math.cos(i)*.01);body.cloth.normals[i].set(.1,1,.03).normalize();}
let maxError=0;for(const alpha of [0,.35,1]){body.cloth.prepareRender(alpha);for(const surface of body.deformables)for(let i=0;i<surface.bindings.length;i+=7){const p=new T.Vector3().fromArray(surface.base,i*3),a=body.cloth.deform(p,new T.Vector3(),surface.bindings[i],alpha),b=body.cloth.deformRender(p,new T.Vector3(),surface.bindings[i]);maxError=Math.max(maxError,a.distanceTo(b));}}
assert(maxError<1e-12,`skin changed: ${maxError}`);
const broadBounds=[...world.bodyBounds.values(),...[...world.blocks.values()].flatMap(blocks=>blocks.map(b=>b.bounds))];const saved=broadBounds.map(b=>b.clone());let seed=41;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
for(let i=0;i<600;i++){
 const p=new T.Vector3((random()-.5)*7,random()*.8,(random()-.5)*7),previous=p.clone().add(new T.Vector3((random()-.5)*.4,(random()-.5)*.4,(random()-.5)*.4)),radius=.008+random()*.04;
 const optimized=p.clone(),old=previous.clone();world.resolveParticle(optimized,old,radius);
 for(const bounds of broadBounds){bounds.min.setScalar(-Infinity);bounds.max.setScalar(Infinity);}
 world.resolveParticle(p,previous,radius);
 let j=0;for(const bounds of broadBounds)bounds.copy(saved[j++]);
 assert(optimized.distanceTo(p)<1e-12&&old.distanceTo(previous)<1e-12,'broad phase changed contact');
}
const budget=new ResolutionBudget(1.4);for(let i=0;i<240;i++)budget.update(1/30);assert(budget.ratio>=1&&budget.ratio<1.4);for(let i=0;i<3000;i++)budget.update(1/60);assert.equal(budget.ratio,1.4);
console.log(JSON.stringify({passed:true,skinMaxError:maxError,collisionComparisons:600,resolutionRecovery:true}));
