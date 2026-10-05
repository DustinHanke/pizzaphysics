import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {writeFileSync} from 'node:fs';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial({side:T.DoubleSide})]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene();slices.forEach(s=>scene.add(s.group));
const cheese=new CheeseSystem(slices,scene,materials.strand),world=new PhysicsWorld(slices,cheese),moving=slices[1];
const cheeseMesh=(s:PizzaSlice)=>s.deformables.find(d=>d.mesh.material===materials.cheese)!.mesh;
const original=slices.map(s=>{const m=cheeseMesh(s);return{position:Float32Array.from(m.geometry.attributes.position.array),index:Array.from(m.geometry.index!.array),material:m.material};});
const crust=slices.map(s=>s.deformables.find(d=>d.mesh.name==='Cornicione')!);
const crustOriginal=crust.map(s=>({base:s.base.slice(),material:s.mesh.material,index:Array.from(s.mesh.geometry.index!.array)}));
let totalLanes=0,peakVertices=0;const p=new T.Vector3(),q=new T.Vector3();
function closedExtensions(){
 const g=cheeseMesh(moving).geometry,base=original[1].position.length/3,edges=new Map<string,[number,number]>();
 const index=g.index!;for(let i=0;i<g.drawRange.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(new Set(tri).size<3)continue;
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(a<base&&b<base)continue;const key=a<b?`${a}:${b}`:`${b}:${a}`,value=edges.get(key)??[0,0];value[0]++;value[1]+=a<b?1:-1;edges.set(key,value);}
 }
 for(const [key,value] of edges){assert.deepEqual(value,[2,0],`open/inconsistently wound extension ${key}`);}
}
function validate(){
 for(const s of slices){const mesh=cheeseMesh(s),g=mesh.geometry,count=g.attributes.position.count;
  peakVertices=Math.max(peakVertices,count);assert.deepEqual(Array.from(g.index!.array).slice(0,original[s.id].index.length),original[s.id].index,'bridge removed resting surface faces');
  for(const [name,attr] of Object.entries(g.attributes)){assert.equal(attr.count,count,name+' count mismatch');for(const value of attr.array)assert(Number.isFinite(value),name+' has NaN');}
  for(const index of g.index!.array)assert(index>=0&&index<count,'invalid triangle index');
  assert.equal(mesh.material,materials.cheese,'surface material changed');assert(Number.isFinite(g.boundingSphere!.radius));assert(g.boundingSphere!.radius<12,'exploded bounds');
 }
}
for(let cycle=0;cycle<4;cycle++){
 cheese.spawn(moving);const primaries=cheese.strands.filter(s=>s.extrusion);assert(primaries.length>=2,'missing boundary extensions');
 const used=new Set<string>();for(const strand of primaries)for(const lane of strand.extrusion!.lanes){const key=`${strand.side}:${strand.r}:${lane.u0}`;assert(!used.has(key),'duplicate primary root');used.add(key);totalLanes++;}
 moving.group.position.add(new T.Vector3(.20,.55,.1));moving.group.rotation.set(.11,-.07,.15);moving.detached=true;
 // Include actual cloth sag, rendered surface updates and physics independently.
 for(let i=0;i<100;i++){
  moving.cloth.snapshot();moving.cloth.step(1/120,world.collisions,null);cheese.update(1/120);
  for(const s of slices)s.updateGeometry();cheese.render();if(i%20===0)validate();
 }
 // Render must never write back into Verlet particles (camera/render rate independence).
 const particles=cheese.strands.map(s=>s.points.map(p=>p.clone()));cheese.render();cheese.render();
 for(let i=0;i<particles.length;i++)particles[i].forEach((p,j)=>assert(p.equals(cheese.strands[i].points[j]),'render mutated solver particles'));
 for(const strand of primaries){const ex=strand.extrusion!,mesh=cheeseMesh(moving),g=mesh.geometry,target=cheeseMesh(strand.neighbor);mesh.updateWorldMatrix(true,false);target.updateWorldMatrix(true,false);
  for(const lane of ex.lanes){
   const last=lane.first+28*3;
   for(const c of [0,2]){p.fromBufferAttribute(g.attributes.position,last+c).applyMatrix4(mesh.matrixWorld);const u=c===0?lane.u0:lane.u1,f=u*(ex.target.length-1),j=Math.min(ex.target.length-2,Math.floor(f));q.fromBufferAttribute(target.geometry.attributes.position,ex.target[j]).lerp(new T.Vector3().fromBufferAttribute(target.geometry.attributes.position,ex.target[j+1]),f-j).applyMatrix4(target.matrixWorld);assert(p.distanceTo(q)<.0011,'far endpoint detached from mozzarella');}
  }
  const edges=new Map<string,number>();const id=g.index!;for(let i=0;i<id.count;i+=3)for(let j=0;j<3;j++){const a=id.getX(i+j),b=id.getX(i+(j+1)%3);if(a===b)continue;const key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}
  for(const lane of ex.lanes){const [a,b]=lane.source,key=a<b?`${a}:${b}`:`${b}:${a}`;assert.equal(edges.get(key),2,'resting topping boundary was opened');}
 }
 if(cycle===0){const m=cheeseMesh(moving);writeFileSync('/tmp/pizza-pull-geometry.json',JSON.stringify({position:Array.from(m.geometry.attributes.position.array),index:Array.from(m.geometry.index!.array),base:original[1].position.length/3,matrix:m.matrixWorld.toArray(),ranges:primaries.filter(s=>s.extrusion!.lanes.length>=3).slice(0,1).flatMap(s=>s.extrusion!.lanes.map(l=>[l.first,l.first+174]))}));}
 closedExtensions();
 // Start a local tear; return toward rest must never heal it.
 for(const strand of primaries){strand.hardLimit=Math.max(.1,strand.length*.9);strand.render();assert(strand.extrusion!.lanes.some(l=>l.brokenAt>=0));const broken=strand.extrusion!.lanes.map(l=>l.brokenAt);strand.hardLimit=100;strand.render();assert.deepEqual(strand.extrusion!.lanes.map(l=>l.brokenAt),broken);}
 validate();
 // Broken chains have two independent particle curves: no face can span the solver gap.
 for(const strand of primaries){strand.broken=true;strand.age=0;strand.time+=.01;}
 for(let step=0;step<75;step++){
  cheese.update(1/120);moving.updateGeometry();cheese.render();if(step%25===0)validate();
 }
 for(const strand of primaries)assert(strand.extrusion!.fragments,'missing independently recoiling ends');
 closedExtensions();
 // Pull-face ray hits are excluded and folded food hits still yield finite rest coordinates.
 const m=cheeseMesh(moving);m.updateWorldMatrix(true,false);const ray=new T.Raycaster(new T.Vector3(moving.home.x,6,moving.home.z),new T.Vector3(0,-1,0));
 for(const hit of ray.intersectObject(m,false)){assert(hit.faceIndex!<m.geometry.userData.extrusionFaceStart);assert(Number.isFinite(moving.restPoint(hit,p).lengthSq()));}
 // Remove middle spans first to exercise index compaction of surviving bridges.
 const one=primaries[Math.floor(primaries.length/2)];one.dispose();cheese.strands.splice(cheese.strands.indexOf(one),1);cheese.render();validate();
 world.reset();
 for(let i=0;i<slices.length;i++){const m=cheeseMesh(slices[i]);assert.equal(m.geometry.attributes.position.count,original[i].position.length/3,'leaked vertices on reset');assert.deepEqual(Array.from(m.geometry.index!.array),original[i].index,'rest topology changed');assert.deepEqual(Float32Array.from(m.geometry.attributes.position.array),original[i].position,'rest vertices changed');assert.equal(m.material,original[i].material);assert.equal(crust[i].mesh.material,crustOriginal[i].material);assert.deepEqual(crust[i].base,crustOriginal[i].base);assert.deepEqual(Array.from(crust[i].mesh.geometry.index!.array),crustOriginal[i].index);}
}
console.log(JSON.stringify({passed:true,cycles:4,totalLanes,peakVertices,checks:['finite buffers','shared manifold roots','exact destination anchors','no solver mutation from rendering','persistent local tears','safe re-grabbing','removal compaction','exact reset','unchanged crust']}));
