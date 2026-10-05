import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
import {cheeseField,CHEESE_EDGE} from '../src/pizza/surface';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),system=new CheeseSystem(slices,scene,materials.strand),moving=slices[1];
slices.forEach(s=>scene.add(s.group));
const mesh=moving.deformables.find(d=>d.mesh.material===materials.cheese)!.mesh,base=Array.from(mesh.geometry.index!.array),vertices=Float32Array.from(mesh.geometry.attributes.position.array);
system.spawn(moving);system.render();
assert.equal(mesh.geometry.drawRange.count,base.length,'dynamic sheets visible at rest');
assert.deepEqual(Array.from(mesh.geometry.index!.array).slice(0,base.length),base,'rest topology modified');
assert.deepEqual(Float32Array.from(mesh.geometry.attributes.position.array).slice(0,vertices.length),vertices,'rest surface modified');
const roots=new Set<string>();
for(const strand of system.strands){
 const ex=strand.extrusion!;assert(ex,'independent strings spawned');assert(ex.lanes.length>=2&&ex.lanes.length<=5);
 const region=moving.mozzarellaIntervals(strand.side).find(r=>strand.r>=r.r0&&strand.r<=r.r1)!;assert(region);assert(region.r1-region.r0<=.44);
 const key=`${strand.side}:${region.r0}`;assert(!roots.has(key),'duplicate bridges in one region');roots.add(key);
 for(const id of ex.source){const p=new T.Vector3().fromArray(vertices,id*3);assert(cheeseField(p.x+moving.home.x,p.z+moving.home.z)>=CHEESE_EDGE-.007,'bridge crosses bare sauce');}
}
let sag=0,peakTriangle=0;
for(let step=0;step<120;step++){
 moving.group.position.y=.65*Math.min(1,step/80);moving.group.position.x=moving.home.x+.2*Math.sin(step/80);
 moving.updateGeometry();system.update(1/120);system.render();
 for(const strand of system.strands){
  const lattice=strand.lattice!;for(let row=1;row<9;row++){
   const mid=lattice.points[row*3+1],line=lattice.points[1].clone().lerp(lattice.points[28],row/9);sag=Math.max(sag,line.y-mid.y);
  }
 }
}
const pos=mesh.geometry.attributes.position,index=mesh.geometry.index!,a=new T.Vector3(),b=new T.Vector3();
for(let i=base.length;i<mesh.geometry.drawRange.count;i+=3)for(let j=0;j<3;j++){a.fromBufferAttribute(pos,index.getX(i+j));b.fromBufferAttribute(pos,index.getX(i+(j+1)%3));peakTriangle=Math.max(peakTriangle,a.distanceTo(b));}
assert(sag>.015,'sheet has no gravity response');assert(peakTriangle<.5,`large polygon spans the pizza: ${peakTriangle}`);
system.clear();moving.reset();assert.deepEqual(Array.from(mesh.geometry.index!.array),base);
console.log({regions:roots.size,sag,peakTriangle,restUnchanged:true});
