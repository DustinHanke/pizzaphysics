import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {CheeseSystem} from '../src/cheese/CheeseSystem';
const materials:any=Object.fromEntries(['cheese','underside','crumb','crust','dough','sauce','basil','strand'].map(k=>[k,new T.MeshPhysicalMaterial()]));
function run(hz:number){const body=new PizzaSlice(1,materials),scene=new T.Scene(),cheese=new CheeseSystem([body],scene,materials.strand),world=new PhysicsWorld([body],cheese);body.detached=true;body.hasCheese=true;body.group.position.y=1;body.velocity.set(.2,0,.1);for(let i=0;i<hz*8;i++)world.advance(1/hz);return {body,world};}
const baseline=run(120);assert(baseline.body.sleeping,'a settled slice should go to sleep');
for(const hz of [30,60,90]){const {body,world}=run(hz);assert(Math.abs(world.steps-baseline.world.steps)<=1);assert(body.group.position.distanceTo(baseline.body.group.position)<.002);assert(body.cloth.points[0].distanceTo(baseline.body.cloth.points[0])<.002);assert(body.sleeping);}
const before=baseline.body.cloth.points.map(p=>p.clone());for(let i=0;i<120;i++)baseline.world.step(1/120);assert(before.every((p,i)=>p.equals(baseline.body.cloth.points[i])));baseline.world.wakeAll();assert(!baseline.body.sleeping);
assert.equal(baseline.world.cheese.metrics.stretch,0);assert.equal(baseline.world.cheese.metrics.active,0);assert.equal(baseline.world.cheese.metrics.length,0);
console.log('PASS: equivalent 30/60/90/120 Hz trajectories, resting sleep, wake, and zero-rest telemetry.');
