import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';

const cheese=new T.MeshPhysicalMaterial(),other=new T.MeshPhysicalMaterial();
const materials={cheese,strand:cheese,underside:other,crumb:other,crust:other,dough:other,sauce:other,basil:other};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials));
const scene=new T.Scene(),slice=slices[1],system=new CheeseSystem(slices,scene,cheese);
for(const s of slices)scene.add(s.group);
system.spawn(slice);slice.group.position.y+=.85;
for(let i=0;i<90;i++)system.update(1/120);
for(const s of slices)s.updateGeometry();
system.render();
const strand=system.strands.find(s=>s.extrusion?.lanes.length===4);
assert(strand?.extrusion,'four-lane fixture must exist');
const surface=slice.deformables.find(d=>d.mesh.material===cheese);
assert(surface,'mozzarella mesh must exist');
const geometry=surface.mesh.geometry,pos=geometry.attributes.position,normals=geometry.attributes.normal;
const point=(id:number)=>new T.Vector3().fromBufferAttribute(pos,id);
const normal=(id:number)=>new T.Vector3().fromBufferAttribute(normals,id);
let rounded=0;
for(const lane of strand.extrusion.lanes){
 const left=lane.first+14*3,center=left+1,right=left+2,layer=29*3;
 const width=point(left).distanceTo(point(right));
 const crown=point(center).distanceTo(point(center+layer));
 const edge=point(left).distanceTo(point(left+layer));
 assert(crown>edge*2,'stretched cheese needs a rounded crown, not a flat slab');
 assert(normal(center).dot(normal(left))<.9,'edge normals must turn around the strand');
 assert(normal(center).dot(normal(right))<.9,'both edges must curve away from the crown');
 assert(crown<width,'thin pull must not inflate beyond its width');
 for(const id of [left,center,right,left+layer,center+layer,right+layer]){
  assert(Math.abs(normal(id).length()-1)<1e-5,'profile normals must remain unit length');
  assert(point(id).toArray().every(Number.isFinite),'profile positions must remain finite');
 }
 rounded++;
}
system.clear();
console.log(JSON.stringify({passed:true,roundedLanes:rounded}));
