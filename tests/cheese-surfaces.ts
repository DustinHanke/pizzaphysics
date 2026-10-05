import assert from 'node:assert/strict';
import * as T from 'three';
import { PizzaSlice } from '../src/pizza/PizzaSlice';
import { CheeseSystem } from '../src/cheese/CheeseSystem';
const material=new T.MeshPhysicalMaterial(),materials:any={cheese:material,dough:material,underside:material,crumb:material,crust:material,sauce:material,basil:material,strand:material};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),system=new CheeseSystem(slices,scene,material);
system.spawn(slices[1]);slices[1].group.position.add(new T.Vector3(.45,.35,.12));for(let i=0;i<24;i++)system.update(1/120);system.render();
function closed(mesh:T.Mesh){
 const geometry=mesh.geometry,indices=geometry.index!,edges=new Map<string,{count:number,orientation:number}>();
 for(let i=0;i<Math.min(indices.count,geometry.drawRange.count);i+=3){const tri=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`,entry=edges.get(key)??{count:0,orientation:0};entry.count++;entry.orientation+=a<b?1:-1;edges.set(key,entry);}}
 for(const [edge,entry] of edges){assert.equal(entry.count,2,`${mesh.name}: open/nonmanifold edge ${edge}`);assert.equal(entry.orientation,0,`${mesh.name}: inconsistent winding ${edge}`);}
 for(const attribute of ['position','normal','uv','sssThickness']){const buffer=geometry.getAttribute(attribute);assert(buffer);for(const value of buffer.array)assert(Number.isFinite(value));}
}
// Check actual active geometry, including secondary batches and membrane shells.
const meshes=new Set<T.Mesh>();for(const strand of system.strands)for(const renderer of strand.renders)meshes.add(renderer.mesh);
for(const web of system.webs){meshes.add(web.renderer.mesh);for(const membrane of web.membranes)meshes.add(membrane.mesh);}
assert(system.strands.some(s=>s.extrusion),'missing local bridges');for(const mesh of meshes)closed(mesh);
for(const web of system.webs)for(const membrane of web.membranes)for(let bucket=0;bucket<=14;bucket++){membrane.tear=bucket/14;membrane.render(1);closed(membrane.mesh);}
// Direct fixture isolates one batch slot. The two skins remain close together,
// carry identical source UVs, and neck locally rather than disappearing.
const {CheeseRenderer}=await import('../src/cheese/CheeseRenderer');
const fixtureMaterial=new T.MeshPhysicalMaterial(),fixtureScene=new T.Scene();
const points=Array.from({length:10},(_,i)=>new T.Vector3(i/9,Math.sin(i/9*Math.PI)*-.15,0));
const renderer=new CheeseRenderer(fixtureScene,fixtureMaterial,points,[new T.Vector2(.2,.3),new T.Vector2(.4,.5)]);
const width=(row:number)=>new T.Vector3().fromArray(renderer.positions,row*9).distanceTo(new T.Vector3().fromArray(renderer.positions,row*9+6));
renderer.update(.02,0,.04,1,true,0,.5);CheeseRenderer.flush();closed(renderer.mesh);
const centerWidth=width(10),shoulder=width(3),positions=renderer.mesh.geometry.attributes.position,uv=renderer.mesh.geometry.attributes.uv;
for(let i=0;i<63;i++){const thickness=new T.Vector3().fromBufferAttribute(positions,i).distanceTo(new T.Vector3().fromBufferAttribute(positions,i+63));assert(thickness>0&&thickness<.01,'ribbon lost its thin closed volume');assert.equal(uv.getX(i),uv.getX(i+63));assert.equal(uv.getY(i),uv.getY(i+63));}
renderer.update(.02,0,.04,1,true,.95,.5);assert(width(10)<centerWidth*.2);assert(width(3)>shoulder*.95);closed(renderer.mesh);
renderer.dispose();CheeseRenderer.flush();assert.equal(renderer.mesh.visible,false);assert.equal(renderer.mesh.geometry.drawRange.count,0);
// Reuse slots rather than adding objects/buffers on every pull.
for(let i=0;i<10;i++){const r=new CheeseRenderer(fixtureScene,fixtureMaterial,points);r.update(.01);r.dispose();}CheeseRenderer.flush();assert.equal(fixtureScene.children.length,1);
system.clear();system.render();assert.equal(system.strands.length,0);assert.equal(system.webs.length,0);
console.log(JSON.stringify({passed:true,closedMeshesChecked:meshes.size+1,openEdges:0,thinVolume:true,localizedNeck:true,batchReuse:true}));
