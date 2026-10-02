import * as T from 'three';
import {CollisionWorld} from './CollisionWorld';
import { PizzaSlice } from '../pizza/PizzaSlice';
import { params, reducedMotion } from '../presets/presets';
import type { CheeseSystem } from '../cheese/CheeseSystem';
export interface DragConstraint { body:PizzaSlice; local:T.Vector3; target:T.Vector3; }
const point=new T.Vector3(), arm=new T.Vector3(), force=new T.Vector3(), torque=new T.Vector3(), axis=new T.Vector3(), q=new T.Quaternion();
export class PhysicsWorld {
 drag:DragConstraint|null=null; accumulator=0; timeMs=0; fixedDt=1/120; steps=0;
 collisions:CollisionWorld;
 constructor(public slices:PizzaSlice[],public cheese:CheeseSystem){this.collisions=new CollisionWorld(slices);cheese.collisions=this.collisions;}
 advance(delta:number){const start=performance.now();this.accumulator+=Math.min(delta,.05);let iterations=0;while(this.accumulator>=this.fixedDt&&iterations<6){this.step(this.fixedDt);this.accumulator-=this.fixedDt;iterations++;}this.timeMs=performance.now()-start;}
 step(dt:number){
  const gravity=params.gravity/65*6.3;
  for(const b of this.slices){
   if(!b.detached||b.sleeping)continue;
   b.cloth.snapshot();b.velocity.y-=gravity*dt;
   if(this.drag?.body===b&&Math.hypot(this.drag.local.x+b.home.x,this.drag.local.z+b.home.z)>=2.05){
    point.copy(this.drag.local).applyQuaternion(b.group.quaternion).add(b.group.position);arm.copy(point).sub(b.group.position);
    force.copy(this.drag.target).sub(point).multiplyScalar(105);
    torque.copy(b.angularVelocity).cross(arm);torque.add(b.velocity);force.addScaledVector(torque,-(reducedMotion.matches?22:15));force.clampLength(0,70);
    b.velocity.addScaledVector(force,dt);torque.copy(arm).cross(force).multiplyScalar(.55);torque.clampLength(0,14);b.angularVelocity.addScaledVector(torque,dt);
    // Low rotational stiffness keeps the mass stable without fixing its orientation.
    torque.set(b.group.quaternion.x,b.group.quaternion.y*.15,b.group.quaternion.z).multiplyScalar(-7);b.angularVelocity.addScaledVector(torque,dt);
   }
   if(b.held){torque.set(b.group.quaternion.x,0,b.group.quaternion.z).multiplyScalar(-1.5);b.angularVelocity.addScaledVector(torque,dt);}
   b.velocity.multiplyScalar(Math.exp(-dt*(b.held?4.5:.65)));b.velocity.clampLength(0,10);
   b.angularVelocity.multiplyScalar(Math.exp(-dt*(b.held?3.1:1.3)));b.angularVelocity.clampLength(0,3.5);
   b.group.position.addScaledVector(b.velocity,dt);
   const angle=b.angularVelocity.length()*dt;if(angle>1e-7){axis.copy(b.angularVelocity).normalize();q.setFromAxisAngle(axis,angle);b.group.quaternion.premultiply(q).normalize();}
   for(const key of ['x','z'] as const){if(Math.abs(b.group.position[key])>6.8){b.group.position[key]=Math.sign(b.group.position[key])*6.8;b.velocity[key]*=-.2;}}
   if(b.group.position.y>5){b.group.position.y=5;b.velocity.y=Math.min(0,b.velocity.y);}
   if(!Number.isFinite(b.group.position.lengthSq()))b.reset();
  }
  for(const b of this.slices)if(b.detached&&!b.sleeping)b.cloth.prepare();
  this.collisions.solve();
  for(const b of this.slices)if(b.detached&&!b.sleeping){
   const last=b.bend,lastTwist=b.twist;b.cloth.step(dt,this.collisions,this.drag?.body===b?this.drag:null);
   b.bend=-b.cloth.offsets[0].y;b.twist=b.cloth.offsets[b.cloth.index(3,0)].y-b.cloth.offsets[b.cloth.index(3,b.cloth.across)].y;
   b.bendVelocity=T.MathUtils.lerp(b.bendVelocity,(b.bend-last)/dt,.15);b.twistVelocity=T.MathUtils.lerp(b.twistVelocity,(b.twist-lastTwist)/dt,.15);
   for(const proxy of this.collisions.byBody.get(b)!)proxy.update();
  }
  this.collisions.solveDough();
  this.cheese.update(dt);
  for(const b of this.slices)if(b.detached&&!b.held&&!b.sleeping){
   const quiet=b.velocity.lengthSq()<.003&&b.angularVelocity.lengthSq()<.003&&b.cloth.points.every((p,i)=>p.distanceToSquared(b.cloth.previous[i])<.000002);
   b.sleepTime=quiet?b.sleepTime+dt:0;if(b.sleepTime>1.6){b.sleeping=true;b.velocity.set(0,0,0);b.angularVelocity.set(0,0,0);b.updateGeometry();}
  }
  this.steps++;
 }
 wakeAll(){for(const b of this.slices){b.sleeping=false;b.sleepTime=0;}}
 reset(){this.drag=null;this.accumulator=0;this.cheese.clear();for(const b of this.slices)b.reset();this.collisions.update(true);}
}
