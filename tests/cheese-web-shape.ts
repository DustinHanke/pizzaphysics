import assert from 'node:assert/strict';
import * as T from 'three';
import {writeFileSync} from 'node:fs';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),system=new CheeseSystem(slices,scene,materials.strand),slice=slices[1];slices.forEach(s=>scene.add(s.group));
system.spawn(slice);slice.group.position.y+=.85;
for(let i=0;i<90;i++)system.update(1/120);for(const s of slices)s.updateGeometry();system.render();
const strand=system.strands.find(s=>s.extrusion?.lanes.length===4)!;assert(strand,'need four-lane fixture');const ex=strand.extrusion!,mesh=slice.deformables.find(d=>d.mesh.material===materials.cheese)!.mesh,pos=mesh.geometry.attributes.position;
const point=(lane:number,row:number,col:number)=>new T.Vector3().fromBufferAttribute(pos,ex.lanes[lane].first+row*3+col);
const widths=ex.lanes.map((_,i)=>point(i,14,0).distanceTo(point(i,14,2)));assert(Math.max(...widths)/Math.min(...widths)>2,'uniform-width comb');
let open=0,joined=0;for(let i=0;i<3;i++)for(let row=2;row<28;row++){const gap=point(i,row,2).distanceTo(point(i+1,row,0));if(gap>.003)open++;if(gap<.0015)joined++;}
assert(open>5,'no visible perforations');assert(joined>5,'only disconnected parallel slots');assert(!strand.broken,'broad root prematurely ruptured');
writeFileSync('/tmp/pizza-pull-geometry.json',JSON.stringify({position:Array.from(pos.array),index:Array.from(mesh.geometry.index!.array),base:slice.deformables.find(d=>d.mesh===mesh)!.base.length/3,matrix:mesh.matrixWorld.toArray(),ranges:ex.lanes.map(l=>[l.first,l.first+174])}));
console.log(JSON.stringify({passed:true,mediumWidths:widths,openSections:open,joinedSections:joined,ruptured:strand.broken}));
// Torn lanes must gather at their own roots, not remain long fading flaps.
strand.broken=true;strand.age=0;strand.render();
const lane=ex.lanes[0],root=new T.Vector3().fromBufferAttribute(pos,lane.first).lerp(new T.Vector3().fromBufferAttribute(pos,lane.first+2),.5);
const before=point(0,lane.cut,1).distanceTo(root);
strand.time+=.65;strand.age=.65;strand.render();
const after=point(0,lane.cut,1).distanceTo(root);
assert(after<before*.35,`torn flap did not gather: ${before} -> ${after}`);
assert(after<.065,'gathered cheese extends too far from root');
console.log(JSON.stringify({clumping:true,before,after}));
system.clear();
