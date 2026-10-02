import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CollisionWorld} from '../src/physics/CollisionWorld';
import {updateNormals} from '../src/performance/geometry';
const mats:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()])),slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,mats)),world=new CollisionWorld(slices),scene=new T.Scene();slices.forEach(s=>scene.add(s.group));scene.updateMatrixWorld(true);
let error=0;for(const surface of slices[1].deformables){const g=surface.mesh.geometry.clone();g.computeVertexNormals();const expected=g.attributes.normal.array.slice();updateNormals(g);const actual=g.attributes.normal.array;for(let i=0;i<actual.length;i++)error=Math.max(error,Math.abs(actual[i]-expected[i]));g.dispose();}assert(error<1e-6,`normals differ ${error}`);
const rays=Array.from({length:120},(_,i)=>new T.Ray(new T.Vector3(Math.cos(i*.17)*1.8,5,Math.sin(i*.17)*1.8),new T.Vector3(0,-1,0))),raycaster=new T.Raycaster();
const start=performance.now();for(const ray of rays){raycaster.ray.copy(ray);raycaster.intersectObjects(slices.map(s=>s.group),true);}const exact=performance.now()-start;
const fastStart=performance.now();for(const ray of rays)assert(world.pick(ray),'hover missed pizza interior');const proxy=performance.now()-fastStart;assert.equal(world.pick(new T.Ray(new T.Vector3(10,5,10),new T.Vector3(0,-1,0))),null);
console.log(JSON.stringify({normalError:error,hover120EventsMs:{exact,proxy}}));
// Compare the new body/patch broad phase against the same solver with only
// the original per-proxy AABB tests, including movement during solver passes.
const referenceSlices=Array.from({length:6},(_,i)=>new PizzaSlice(i,mats)),reference=new CollisionWorld(referenceSlices),bodyBoxes=new Set(reference.bodyBounds.values());
for(const box of [...reference.bodyBounds.values(),...reference.proxies.map(p=>p.bounds)]){const original=box.intersectsBox.bind(box);box.intersectsBox=(other:T.Box3)=>bodyBoxes.has(other)||original(other);}
for(const list of [slices,referenceSlices])for(let i=0;i<2;i++){const s=list[i];s.detached=true;s.cloth.start();s.group.position.add(new T.Vector3(-.08*i,.03,.05));}
for(let step=0;step<8;step++){
 for(const collision of [world,reference]){collision.solve();collision.solveDough();}
 for(let i=0;i<6;i++){assert(slices[i].group.position.distanceTo(referenceSlices[i].group.position)<1e-12);for(let j=0;j<slices[i].cloth.points.length;j++)assert(slices[i].cloth.points[j].distanceTo(referenceSlices[i].cloth.points[j])<1e-12);}
}
console.log(JSON.stringify({collisionSolverEquivalent:true,passes:8}));
