import assert from 'node:assert/strict';
import * as T from 'three';
import { PizzaSlice } from '../src/pizza/PizzaSlice';
import { crustBlisters, crustRelief, rimPoint, rimShape } from '../src/pizza/surface';

// Geometry field remains stable, asymmetric and visibly varied around the rim.
const samples=Array.from({length:512},(_,i)=>rimShape(i/512*Math.PI*2));
const widths=samples.map(s=>s.width),heights=samples.map(s=>s.height),centers=samples.map(s=>s.center);
assert(Math.max(...widths)-Math.min(...widths)>.08,'rim width should vary materially');
assert(Math.max(...heights)-Math.min(...heights)>.18,'rim inflation should vary materially');
assert(Math.max(...centers)-Math.min(...centers)>.06,'outer silhouette should be imperfect');
assert(crustBlisters.length>=60,'medium geometry blister population missing');
assert(crustBlisters.some(b=>b.height>.035)&&crustBlisters.some(b=>b.height<.02),'blister scale distribution collapsed');
assert(crustRelief(0,Math.PI/2)>0,'blister field should displace geometry');

// Sampled rim has real relief in both radius and height, not only a texture.
const points=Array.from({length:256},(_,i)=>rimPoint(i/256*Math.PI*2,0));
assert(Math.max(...points.map(p=>p.r))-Math.min(...points.map(p=>p.r))>.20,'inflated lobes should affect silhouette');
const crown=Array.from({length:256},(_,i)=>rimPoint(i/256*Math.PI*2,Math.PI/2).y);
assert(Math.max(...crown)-Math.min(...crown)>.25,'rim height relief is too subtle');

const mat=new T.MeshStandardMaterial(),physical=new T.MeshPhysicalMaterial();
const materials:any={cheese:physical,underside:mat,crumb:mat,crust:mat,dough:mat,sauce:mat,basil:mat,strand:physical};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials));
for(const slice of slices){
 const geometry=slice.deformables.find(d=>d.mesh.name==='Cornicione')!.mesh.geometry;
 assert(geometry.attributes.position.count>6000,'cornicione subdivision density regressed');
 for(const value of geometry.attributes.position.array)assert(Number.isFinite(value));
}
console.log(JSON.stringify({passed:true,blisters:crustBlisters.length,widthRange:[Math.min(...widths),Math.max(...widths)],heightRange:[Math.min(...heights),Math.max(...heights)],rimSubdivision:slices[0].deformables.find(d=>d.mesh.name==='Cornicione')!.mesh.geometry.attributes.position.count}));
