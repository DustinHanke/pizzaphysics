import assert from 'node:assert/strict';
import * as T from 'three';
import { PizzaSlice } from '../src/pizza/PizzaSlice';
import { CheeseSystem } from '../src/cheese/CheeseSystem';
const material=new T.MeshPhysicalMaterial(),materials:any={cheese:material,dough:material,underside:material,crumb:material,crust:material,sauce:material,basil:material,strand:material};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),system=new CheeseSystem(slices,scene,material);
system.spawn(slices[1]);slices[1].group.position.add(new T.Vector3(.45,.35,.12));for(let i=0;i<24;i++)system.update(1/120);system.render();
function closed(mesh:T.Mesh){
 const geometry=mesh.geometry,indices=geometry.index!,edges=new Map<string,{count:number,orientation:number}>();
 for(let i=0;i<indices.count;i+=3){const tri=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`,entry=edges.get(key)??{count:0,orientation:0};entry.count++;entry.orientation+=a<b?1:-1;edges.set(key,entry);}}
 for(const [edge,entry] of edges){assert.equal(entry.count,2,`${mesh.name}: open/nonmanifold edge ${edge}`);assert.equal(entry.orientation,0,`${mesh.name}: inconsistent winding ${edge}`);}
 for(const attribute of ['position','normal','uv','sssThickness']){const buffer=geometry.getAttribute(attribute);assert(buffer);for(const value of buffer.array)assert(Number.isFinite(value));}
}
let checked=0;for(const s of system.strands)for(const renderer of s.renders){closed(renderer.mesh);checked++;}
for(const web of system.webs){closed(web.renderer.mesh);checked++;for(const membrane of web.membranes){closed(membrane.mesh);checked++;}}
assert(system.strands.filter(s=>s.primary).length>=2&&system.strands.filter(s=>s.primary).length<=4);assert(system.webs.length>=1&&system.webs.length<=4);assert(system.webs.reduce((n,w)=>n+w.membranes.length,0)<=3);
// The new webs must contain real apertures, not opaque root paddles.
for(const web of system.webs)for(const membrane of web.membranes){
 const g=membrane.mesh.geometry,index=g.index!,uv=g.attributes.uv,half=uv.count/2,vertices=new Set<number>(),edges=new Set<string>();let faces=0,area=0;
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(const n of tri)vertices.add(n);for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];edges.add(a<b?`${a}:${b}`:`${b}:${a}`);}faces++;
  if(tri.every(n=>n<half)){const [a,b,c]=tri;area+=Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a)))/2;}
 }
 const euler=vertices.size-edges.size+faces;assert(euler<=0,'web must have at least one through-hole');assert(area>.20&&area<.85,`film coverage ${area}`);
 const positions=g.attributes.position;let maxThickness=0;for(let i=0;i<half;i++)maxThickness=Math.max(maxThickness,new T.Vector3().fromBufferAttribute(positions,i).distanceTo(new T.Vector3().fromBufferAttribute(positions,i+half)));assert(maxThickness<.014,'web remains a thin film');
}
// Rounded root closures are only a small flare, and shrink with the body.
for(const strand of system.strands){
 const renderer=strand.renders[0],center=new T.Vector3(),point=new T.Vector3();
 const width=(ring:number,t:number)=>{renderer.curve.getPoint(t,center);let size=0;for(let j=0;j<12;j++){point.fromArray(renderer.positions,(1+ring*12+j)*3);size=Math.max(size,point.distanceTo(center));}return size;};
 assert(width(19,.5)<width(3,0)*.65,'strand body must taper substantially away from its root');
 const previous=strand.stretch;strand.stretch=12;strand.render();const thin=width(3,0);strand.stretch=2;strand.render();assert(thin<width(3,0)*.5,'root must thin with stretching');strand.stretch=previous;strand.render();
}
// A damage neck is localized: shoulders retain volume while the weak section thins.
const hero=system.strands.find(s=>s.primary)!,renderer=hero.renders[0],weak=(hero.breakIndex+.5)/9;
const widthAt=(ring:number)=>{const t=(ring-3)/32,center=renderer.curve.getPoint(t);let size=0;for(let j=0;j<12;j++)size=Math.max(size,new T.Vector3().fromArray(renderer.positions,(1+ring*12+j)*3).distanceTo(center));return size;};
const weakRing=3+Math.round(weak*32);renderer.update(.02,0,.024,.15,true,0,weak);const beforeWeak=widthAt(weakRing),beforeShoulder=widthAt(5);renderer.update(.02,0,.024,.15,true,.95,weak);assert(widthAt(weakRing)<beforeWeak*.2);assert(widthAt(5)>beforeShoulder*.95);
const strand=system.strands.find(s=>s.primary)!;strand.broken=true;strand.age=.25;for(let i=0;i<24;i++)system.update(1/120);system.render();
assert.equal(strand.renders[0].mesh.visible,false);assert(strand.renders[1].mesh.visible&&strand.renders[2].mesh.visible);for(const r of strand.renders)closed(r.mesh);
for(let i=0;i<240;i++)system.update(1/120);system.render();system.clear();assert.equal(scene.children.length,0);assert.equal(system.webs.length,0);
console.log(JSON.stringify({passed:true,closedMeshesChecked:checked,openEdges:0,brokenEnds:'closed',reset:'all meshes disposed'}));
