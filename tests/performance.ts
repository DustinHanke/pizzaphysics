import * as T from 'three';
import {quality} from '../src/performance/quality';
quality.mobile=process.env.PIZZA_MOBILE==='1';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),cheese=new CheeseSystem(slices,scene,materials.strand),world=new PhysicsWorld(slices,cheese);
slices.forEach(s=>scene.add(s.group));
const totals:Record<string,number>={};
function measure(object:any,key:string,label=key){const original=object[key];object[key]=function(...args:any[]){const t=performance.now();const result=original.apply(this,args);totals[label]=(totals[label]??0)+performance.now()-t;return result;};}
measure(world.collisions,'resolveParticle');measure(world.collisions,'solve');measure(world.collisions,'solveDough');measure(cheese,'update','cheesePhysics');measure(cheese,'render','cheeseMesh');for(const s of slices)measure(s,'updateGeometry','sliceMesh');
const slice=slices[1];slice.detached=slice.held=true;slice.group.position.y=.65;slice.cloth.start();cheese.spawn(slice);world.drag={body:slice,local:slice.localAnchor(0,2.3),target:new T.Vector3()};slice.worldPoint(world.drag.local,world.drag.target);
if(process.env.PIZZA_MULTI==='1')for(const i of [0,2,4]){const b=slices[i];b.detached=true;b.group.position.y=.3;b.cloth.start();cheese.spawn(b);}
const samples:number[]=[];
for(let frame=0;frame<90;frame++){
 if(frame===30)for(const key in totals)totals[key]=0;
 const t=performance.now();world.advance(1/60);
 for(const s of slices){if(s.detached&&!s.sleeping)s.updateGeometry(false,world.accumulator/world.fixedDt);else if(s.cheeseNecks.length||s.surfaceDirty)s.updateGeometry(true);}
 cheese.render();if(frame>=30)samples.push(performance.now()-t);
}
samples.sort((a,b)=>a-b);console.log(JSON.stringify({cpuFrameMs:{median:samples[30],p95:samples[57]},meanStageMs:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/60])),strands:cheese.strands.length,vertices:slices.reduce((n,s)=>n+s.deformables.reduce((n,d)=>n+d.base.length/3,0),0)}));
cheese.clear();
