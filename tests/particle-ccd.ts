import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CollisionWorld} from '../src/physics/CollisionWorld';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),world=new CollisionWorld(slices),fixture=world.proxies[0],results=[];
for(const reverse of [false,true]){
 if(reverse)for(const blocks of world.blocks.values()){blocks.reverse();for(const block of blocks)block.parts.reverse();}
 for(const start of [.6,.9,1.4]){const point=fixture.center.clone(),previous=point.clone();previous.y=start;point.y=-.2;world.resolveParticle(point,previous,.012);assert(point.y>.13,'overlapping rim ejected swept particle beneath dough');assert(Number.isFinite(point.lengthSq()));results.push(point.clone());}
}
for(let i=0;i<3;i++)assert(results[i].distanceTo(results[i+3])<1e-8,'CCD depends on proxy iteration order');
// A sphere arriving from below hits the underside rather than tunnelling through.
const under=fixture.center.clone(),old=under.clone();old.y=.038;under.y=.8;world.resolveParticle(under,old,.012);assert(under.y<.056);
console.log(JSON.stringify({passed:true,heights:results.map(p=>p.y),proxyOrderIndependent:true,underside:under.y}));
