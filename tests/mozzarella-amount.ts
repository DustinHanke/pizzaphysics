import assert from 'node:assert/strict';
import * as T from 'three';
import {setMozzarellaAmount,cheeseField,CHEESE_EDGE,mozzarellaPopulation,getMozzarellaAmount,setMozzarellaSeed,getMozzarellaSeed,pools,rimShape} from '../src/pizza/surface';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene(),report:any[]=[];
setMozzarellaAmount(0);assert.equal(getMozzarellaAmount(),50);setMozzarellaAmount(300);assert.equal(getMozzarellaAmount(),200);
const originalPools=JSON.stringify(pools),originalRim=JSON.stringify(rimShape(.7)),originalAmount=getMozzarellaAmount();
setMozzarellaSeed(7123);const changedPools=JSON.stringify(pools);assert.notEqual(changedPools,originalPools);assert.equal(getMozzarellaSeed(),7123);assert.equal(getMozzarellaAmount(),originalAmount);assert.equal(JSON.stringify(rimShape(.7)),originalRim);
setMozzarellaSeed(85);setMozzarellaSeed(7123);assert.equal(JSON.stringify(pools),changedPools,'same seed must reproduce placement');setMozzarellaSeed(0);assert.equal(JSON.stringify(pools),originalPools);
let previousCoverage=-1,previousPopulation=-1;
for(const amount of [50,65,100,160,200]){
 setMozzarellaAmount(amount);for(const slice of slices)slice.rebuildMozzarella();let hits=0,total=0;for(let x=-2.1;x<=2.1;x+=.04)for(let z=-2.1;z<=2.1;z+=.04)if(Math.hypot(x,z)<2.1){total++;if(cheeseField(x,z)>=CHEESE_EDGE)hits++;}
 const coverage=hits/total,population=mozzarellaPopulation();assert(coverage>previousCoverage);assert(population>previousPopulation);assert(coverage<.85,'extra mozzarella formed a blanket');previousCoverage=coverage;previousPopulation=population;
 let count=0,branches=0,sheets=0,strength=0,n=0;
 const system=new CheeseSystem(slices,scene,materials.strand);
 for(let pull=0;pull<18;pull++){
  system.spawn(slices[pull%6]);count+=system.strands.length;branches+=system.strands.reduce((n,s)=>n+(s.extrusion?.lanes.length??0),0);sheets+=system.webs.reduce((sum,w)=>sum+w.membranes.length,0);
  for(const s of system.strands){for(const [owner,local] of [[s.moving,s.localA],[s.neighbor,s.localB]] as const)assert(cheeseField(local.x+owner.home.x,local.z+owner.home.z)>=CHEESE_EDGE,'strand rooted in tomato');strength+=s.amountStrength;n++;}
  system.clear();
 }
 const slice=slices[1];slice.group.position.y=.7;const transform=slice.group.position.clone(),cloth=slice.cloth;let disposed=false;const old=slice.deformables.find(d=>d.mesh.material===materials.cheese)!;old.mesh.geometry.addEventListener('dispose',()=>disposed=true);slice.rebuildMozzarella();assert(disposed);assert(slice.group.position.equals(transform));assert.equal(slice.cloth,cloth);const next=slice.deformables.filter(d=>d.mesh.material===materials.cheese);assert.equal(next.length,1);assert.equal(next[0].mesh.userData.slice,slice);assert(next[0].mesh.geometry.index!.count>0);slice.group.position.copy(slice.home);
 report.push({amount,population,coverage,averageStrands:count/18,averageBranches:branches/18,averageSheets:sheets/18,strength:n?strength/n:0});
}
assert(report[3].averageStrands>report[2].averageStrands);assert(report[2].averageStrands>report[1].averageStrands);assert(report[3].averageBranches>report[1].averageBranches);assert(report[4].strength>report[2].strength);setMozzarellaAmount(100);console.log(JSON.stringify({passed:true,report},null,2));
