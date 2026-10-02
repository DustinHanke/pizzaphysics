import assert from 'node:assert/strict';
import * as T from 'three';
import { PizzaSlice } from '../src/pizza/PizzaSlice';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CheeseSystem } from '../src/cheese/CheeseSystem';
import { params,presets } from '../src/presets/presets';
const mat=new T.MeshStandardMaterial(),physical=new T.MeshPhysicalMaterial();
const materials:any={cheese:physical,underside:mat,crumb:mat,crust:mat,dough:mat,sauce:mat,basil:mat,strand:physical};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene();slices.forEach(s=>scene.add(s.group));
const cheese=new CheeseSystem(slices,scene,physical),world=new PhysicsWorld(slices,cheese);
const b=slices[1],local=new T.Vector3(.1,.33,.2),target=new T.Vector3();
function grab(){b.detached=b.held=true;b.worldPoint(local,target);world.drag={body:b,local,target};}
let peakStrain=1;
function finite(){for(const s of slices){assert(Number.isFinite(s.group.position.lengthSq()));assert(Math.abs(s.group.quaternion.length()-1)<1e-4);assert(s.group.position.y<5.01);if(s.cloth.active){for(const p of s.cloth.points)assert(Number.isFinite(p.lengthSq()));for(const l of s.cloth.links)if(!l.bend)peakStrain=Math.max(peakStrain,s.cloth.points[l.a].distanceTo(s.cloth.points[l.b])/l.length);}}for(const s of cheese.strands)for(const p of s.points)assert(Number.isFinite(p.lengthSq()));}
const report:any={};
grab();const start=target.clone();let activeAt2=0;const stages=new Set<number>();
for(let i=0;i<720;i++){target.copy(start).add(new T.Vector3(i/720*5,1.1,0));world.step(1/120);if(i===240)activeAt2=cheese.metrics.active;stages.add(cheese.metrics.active);finite();}
assert(cheese.initial>=4&&cheese.initial<=14);assert(activeAt2>0);assert(cheese.failures>0);assert(stages.size>=4);assert(b.bend>0);assert(Math.abs(b.group.quaternion.x)+Math.abs(b.group.quaternion.z)>.001);
cheese.render();report.slowPull={initial:cheese.initial,activeAt2,failed:cheese.failures,observedStrandCounts:[...stages],bend:b.bend};
const velocity=b.velocity.length();world.drag=null;b.held=false;const height=b.group.position.y;for(let i=0;i<480;i++)world.step(1/120);assert(b.group.position.y<height);finite();report.release={velocityBeforeRelease:velocity,finalHeight:b.group.position.y};
world.reset();assert(cheese.strands.length===0);assert(cheese.initial===0);assert(b.group.position.equals(b.home));
for(const [name,p] of Object.entries(presets)){
 Object.assign(params,p);world.reset();grab();const origin=target.clone();for(let i=0;i<1800;i++){target.set(origin.x+Math.sin(i*.073)*4.6,.6+Math.abs(Math.sin(i*.04))*3.5,origin.z+Math.cos(i*.09)*3.7);world.step(1/120);finite();if(i%30===0)cheese.render();}report[name]={failures:cheese.failures,maxPosition:b.group.position.length(),active:cheese.metrics.active};
}
Object.assign(params,presets.neapolitan);world.reset();world.advance(10);assert(world.steps>0);assert(world.accumulator<world.fixedDt*1.01);
// Validate outward top and crust normals, and all mesh indices.
for(const slice of slices)for(const {mesh} of slice.deformables){const g=mesh.geometry,idx=g.index!;for(let i=0;i<idx.count;i++)assert(idx.getX(i)<g.attributes.position.count);}
const crust=slices[0].deformables.find(d=>d.mesh.name==='Cornicione')!.mesh.geometry;const normal=crust.getAttribute('normal');assert(normal.getX(45*29+14)*Math.cos(slices[0].theta)<0,'inside torus surface points inward radially');
assert(peakStrain<1.15,'fast manipulation exceeded the dough stretch limit');
console.log(JSON.stringify({passed:true,peakStrain,report},null,2));

// Baked base is assigned only to downward faces; lower rim shares global UVs.
for(const slice of slices){
 const base=slice.deformables.find(d=>d.mesh.name==='Thin baked base')!.mesh;
 assert(Array.isArray(base.material)&&base.material[0]===materials.underside);
 const g=base.geometry;assert.equal(g.groups.length,2);assert.equal(g.groups.reduce((sum,group)=>sum+group.count,0),g.index!.count);
 const p=g.attributes.position,uv=g.attributes.uv1;assert.equal(uv.count,p.count);
 for(let i=0;i<g.groups[0].count;i+=3){const a=g.index!.getX(i),b=g.index!.getX(i+1),c=g.index!.getX(i+2);const cross=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert(cross<=1e-8);}
 for(const {mesh} of slice.deformables)for(const name of ['position','normal','uv1'])for(const value of mesh.geometry.attributes[name].array)assert(Number.isFinite(value));
 const rim=slice.deformables.find(d=>d.mesh.name==='Cornicione')!.mesh.geometry;assert.equal(rim.groups.length,2);
}
console.log('PASS: underside material groups, downward winding, shared floor UVs, finite cut-face relief.');

// Large crumb cavities recess inward, with a sealed rim and isolated atlas tiles.
for(const slice of slices){
 const cuts=slice.deformables.filter(d=>d.mesh.name==='Airy crumb');
 for(let j=0;j<cuts.length;j++){
  const side=j===0?-1:1,angle=slice.theta+side*slice.halfAngle,g=cuts[j].mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,tile=(slice.id*2+(side>0?1:0))%4;
  for(let i=0;i<p.count;i++){const tangent=-(p.getX(i)+slice.home.x)*Math.sin(angle)+(p.getZ(i)+slice.home.z)*Math.cos(angle);assert(tangent*side<=1e-6&&Math.abs(tangent)<.083,'crumb cavity must recess inside the crust');if(i>=p.count-113)assert(Math.abs(tangent)<1e-6,'cut perimeter no longer sealed');assert(uv.getX(i)>tile/4&&uv.getX(i)<(tile+1)/4,'crumb atlas bleed');}
 }
}
console.log('PASS: recessed cut cavities, sealed perimeters and isolated atlas UVs.');
