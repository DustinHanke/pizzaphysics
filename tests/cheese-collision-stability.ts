import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
{
 const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
 const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),cheese=new CheeseSystem(slices,scene,materials.strand),world=new PhysicsWorld(slices,cheese);
 const slice=slices[1];slice.detached=slice.held=true;const local=new T.Vector3(Math.cos(slice.theta)*2.3-slice.home.x,.25,Math.sin(slice.theta)*2.3-slice.home.z),target=new T.Vector3();slice.worldPoint(local,target);world.drag={body:slice,local,target};const start=target.clone();cheese.spawn(slice);
 let maxExcursion=0,maxVelocity=0,maxLength=0;
 for(let frame=0;frame<360;frame++){
  target.copy(start);target.y+=Math.min(frame/120,1)*.8;target.x+=Math.min(frame/120,1)*.5;world.step(1/120);
  for(const s of cheese.strands){let len=0;const a=s.points[0],b=s.points.at(-1)!;for(let i=1;i<s.points.length-1;i++){const p=s.points[i],ab=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),1e-9),0,1);maxExcursion=Math.max(maxExcursion,p.distanceTo(a.clone().addScaledVector(ab,t)));maxVelocity=Math.max(maxVelocity,p.distanceTo(s.previous[i])*120);len+=p.distanceTo(s.points[i-1]);}maxLength=Math.max(maxLength,len);}
 }
 assert(maxExcursion<.5,`slow pull scattered cheese ${maxExcursion} units from bridge`);
 assert(maxVelocity<50,`collision injected cheese velocity: ${maxVelocity}`);
 assert(maxLength<4,`bridge exploded into a long tangle: ${maxLength}`);
 assert(cheese.metrics.active>0,'fixture lost all cheese connections');
 console.log({maxExcursion,maxVelocity,maxLength,active:cheese.metrics.active});cheese.clear();
}
