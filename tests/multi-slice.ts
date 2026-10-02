import assert from 'node:assert/strict';
import * as T from 'three';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
const material=new T.MeshPhysicalMaterial();
const system=()=>{const c=new CheeseSystem([],new T.Scene(),material);for(let i=0;i<80;i++){const points=Array.from({length:10},(_,j)=>new T.Vector3((i%8)*.16+Math.sin(i+j)*.013,j*.035,Math.floor(i/8)*.014));c.strands.push({points,previous:points.map(p=>p.clone()),radius:.012+(i%3)*.008,stretch:1.3} as any);}return c;};
const fast=system(),reference=system();(reference as any).nearby=()=>true;
for(let pass=0;pass<5;pass++){
 (fast as any).selfContact();(reference as any).selfContact();
 for(let i=0;i<fast.strands.length;i++)for(let j=0;j<10;j++){assert(fast.strands[i].points[j].distanceTo(reference.strands[i].points[j])<1e-12);assert(fast.strands[i].previous[j].distanceTo(reference.strands[i].previous[j])<1e-12);}
}
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,material]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),cheese=new CheeseSystem(slices,new T.Scene(),material);
slices[1].detached=true;cheese.spawn(slices[1]);
const pair=()=>cheese.strands.filter(s=>(s.moving===slices[1]&&s.neighbor===slices[0])||(s.moving===slices[0]&&s.neighbor===slices[1]));
const before=pair().length;assert(before>0);slices[0].detached=true;cheese.spawn(slices[0]);assert.equal(pair().length,before,'same cut generated duplicate bridges');cheese.clear();
console.log(JSON.stringify({selfContactEquivalent:true,chains:80,passes:5,sharedCutBridges:before,noDuplicateNetworks:true}));
