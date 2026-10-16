import assert from 'node:assert/strict';
import * as T from 'three';
import {PizzaSlice} from '../src/pizza/PizzaSlice';
import {CheeseSystem} from '../src/cheese/CheeseSystem';

const material=new T.MeshPhysicalMaterial();
const materials={cheese:material,underside:material,crumb:material,crust:material,dough:material,sauce:material,basil:material,strand:material};
const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials)),scene=new T.Scene();
slices.forEach(slice=>scene.add(slice.group));
const system=new CheeseSystem(slices,scene,material),moving=slices[1];
system.spawn(moving);
const strand=system.strands.find(value=>value.extrusion?.lanes.length===4);
assert(strand?.extrusion,'four-lane fixture required');
const extrusion=strand.extrusion;
for(const other of system.strands)if(other!==strand)other.dispose();
system.strands=[strand];system.initial=1;system.failures=0;
strand.update(0);
const maxLane=Math.max(...extrusion.lanes.map(lane=>lane.limit));
const a=new T.Vector3(),b=new T.Vector3();
function positionAtFraction(fraction:number){
 moving.group.position.copy(moving.home);
 moving.worldPoint(strand.localA,a);strand.neighbor.worldPoint(strand.localB,b);
 const length=strand.hardLimit*fraction;
 moving.group.position.y=Math.sqrt(length*length-(a.x-b.x)**2-(a.z-b.z)**2)-(a.y-b.y);
}

// Given a stretched bridge, rendering alone must not advance its rupture state.
positionAtFraction(maxLane+.005);
strand.length=strand.hardLimit*(maxLane+.005);
slices.forEach(slice=>slice.updateGeometry());system.render();system.render();
assert(extrusion.lanes.every(lane=>lane.brokenAt<0),'render advanced simulation rupture');

// When physics crosses some lane limits, retain the final load-bearing lane.
positionAtFraction(maxLane-.005);system.update(0);
const torn=extrusion.lanes.filter(lane=>lane.brokenAt>=0).length;
assert(torn>0&&torn<extrusion.lanes.length,'physics must preserve partial lane tears without rendering');
assert.equal(strand.broken,false);assert.equal(system.metrics.active,1);
const partialTimes=extrusion.lanes.map(lane=>lane.brokenAt);
positionAtFraction(.2);system.update(0);
assert.deepEqual(extrusion.lanes.map(lane=>lane.brokenAt),partialTimes,'unloading healed a lane');

// When the final lane tears, force and metrics stop in that same update.
positionAtFraction(maxLane+.005);moving.cloth.start();moving.cheeseForceBudget=0;
const previous=moving.cloth.previous.map(point=>point.clone());
system.update(1/120);
assert(extrusion.lanes.every(lane=>lane.brokenAt>=0));
assert.equal(strand.broken,true,'all lanes severed but parent remains force-carrying');
assert.equal(system.metrics.active,0);assert.equal(system.metrics.integrity,0);
assert.equal(moving.cheeseForceBudget,0,'severed bridge spent cloth force budget');
assert(previous.every((point,index)=>point.equals(moving.cloth.previous[index])),'severed bridge displaced cloth');
const times=extrusion.lanes.map(lane=>lane.brokenAt);
slices.forEach(slice=>slice.updateGeometry());system.render();system.render();
assert.deepEqual(extrusion.lanes.map(lane=>lane.brokenAt),times);
assert(extrusion.fragments,'torn bridge did not render independent fragments');
console.log({partialTorn:torn,totalLanes:extrusion.lanes.length,active:system.metrics.active,forceBudget:moving.cheeseForceBudget,renderIndependent:true});
system.clear();
