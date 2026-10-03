import {DOUGH_NEUTRAL} from '../pizza/surface';
import * as T from 'three';
import type { PizzaSlice } from '../pizza/PizzaSlice';
import type { CollisionWorld } from './CollisionWorld';
import { params, warmth, reducedMotion } from '../presets/presets';

export interface DoughBinding { ids: number[]; weights: number[]; }
interface Link { a:number; b:number; length:number; bend:boolean; lambda:number; }
const delta=new T.Vector3(),target=new T.Vector3(),old=new T.Vector3(),local=new T.Vector3(),normal=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),inverse=new T.Quaternion();
/** A thin, almost inextensible sheet carried by a stiffer cornicione.
 * World-space particles preserve inertia; only the outer ring follows the rigid crust.
 * Render layers, collision patches, toppings and cheese all sample this same sheet. */
export class DoughCloth {
 readonly radial=6; readonly across=4; readonly radius=2.34;
 lastOffsets:T.Vector3[]=[];lastNormals:T.Vector3[]=[];rest:T.Vector3[]=[];points:T.Vector3[]=[];previous:T.Vector3[]=[];offsets:T.Vector3[]=[];normals:T.Vector3[]=[];
 private renderOffsets=new Float64Array((1+this.radial*(this.across+1))*3);private renderNormals=new Float64Array((1+this.radial*(this.across+1))*3);
 private bindingCache=new WeakMap<T.Vector3,{x:number,z:number,value:DoughBinding}>();
 links:Link[]=[];triangles:number[][]=[];inverseMass:number[]=[];active=false;contacts=0;rootReaction=new T.Vector3();rootTorque=new T.Vector3();
 particleMass:number[]=[];meanMass=1;
 contactOffsets:T.Vector3[]=[];contactCounts:number[]=[];
 private grabBinding:DoughBinding|null=null;private grabLocal=new T.Vector3(Infinity,0,0);
 constructor(public body:PizzaSlice){
  this.rest.push(new T.Vector3(-body.home.x,DOUGH_NEUTRAL,-body.home.z));
  for(let r=1;r<=this.radial;r++)for(let a=0;a<=this.across;a++){
   const angle=body.theta+(a/this.across*2-1)*body.halfAngle,radius=r/this.radial*this.radius;
   this.rest.push(new T.Vector3(Math.cos(angle)*radius-body.home.x,DOUGH_NEUTRAL,Math.sin(angle)*radius-body.home.z));
  }
  for(let i=0;i<this.rest.length;i++){this.lastOffsets.push(new T.Vector3());this.lastNormals.push(new T.Vector3(0,1,0));this.contactOffsets.push(new T.Vector3());this.contactCounts.push(0);this.points.push(new T.Vector3());this.previous.push(new T.Vector3());this.offsets.push(new T.Vector3());this.normals.push(new T.Vector3(0,1,0));this.inverseMass.push(i>=this.index(this.radial,0)?0:1);}
  const edges=new Set<string>();const link=(a:number,b:number,bend=false)=>{if(a===b)return;const key=[Math.min(a,b),Math.max(a,b),bend].join(':');if(edges.has(key))return;edges.add(key);this.links.push({a,b,length:this.rest[a].distanceTo(this.rest[b]),bend,lambda:0});};
  for(let r=0;r<this.radial;r++)for(let a=0;a<this.across;a++){
   const i=this.index(r,a),j=this.index(r,a+1),k=this.index(r+1,a),l=this.index(r+1,a+1);
   if(r)this.triangles.push([i,j,k]);this.triangles.push([j,l,k]);
   link(i,j);link(i,k);link(j,l);link(k,l);link(j,k);if(r)link(i,l);
  }
  // Tributary triangle area gives light tip particles and heavier outer patches.
  this.particleMass=this.rest.map(()=>0);
  for(const [a,b,c] of this.triangles){u.subVectors(this.rest[b],this.rest[a]);v.subVectors(this.rest[c],this.rest[a]);const area=u.cross(v).length()/6;for(const i of [a,b,c])this.particleMass[i]+=area;}
  let area=0,count=0;for(let i=0;i<this.rest.length;i++)if(this.inverseMass[i]){area+=this.particleMass[i];count++;}
  this.meanMass=body.centerMass/count;
  for(let i=0;i<this.rest.length;i++){this.particleMass[i]*=body.centerMass/area;if(this.inverseMass[i])this.inverseMass[i]=this.meanMass/this.particleMass[i];}
  for(let r=0;r<=this.radial;r++)for(let a=0;a<=this.across;a++){
   if(r+2<=this.radial)link(this.index(r,a),this.index(r+2,a),true);
   if(a+2<=this.across&&r)link(this.index(r,a),this.index(r,a+2),true);
  }
 }
 index(r:number,a:number){return r===0?0:1+(r-1)*(this.across+1)+a;}
 bind(x:number,z:number):DoughBinding {
  const gx=x+this.body.home.x,gz=z+this.body.home.z,r=T.MathUtils.clamp(Math.hypot(gx,gz)/this.radius*this.radial,0,this.radial);
  const angle=Math.atan2(Math.sin(Math.atan2(gz,gx)-this.body.theta),Math.cos(Math.atan2(gz,gx)-this.body.theta));
  const a=T.MathUtils.clamp((angle/this.body.halfAngle+1)*.5*this.across,0,this.across),r0=Math.min(this.radial-1,Math.floor(r)),a0=Math.min(this.across-1,Math.floor(a)),fr=r-r0,fa=a-a0;
  return {ids:[this.index(r0,a0),this.index(r0,a0+1),this.index(r0+1,a0),this.index(r0+1,a0+1)],weights:[(1-fr)*(1-fa),(1-fr)*fa,fr*(1-fa),fr*fa]};
 }
 binding(point:T.Vector3){const cached=this.bindingCache.get(point);if(cached&&cached.x===point.x&&cached.z===point.z)return cached.value;const value=this.bind(point.x,point.z);this.bindingCache.set(point,{x:point.x,z:point.z,value});return value;}
 /** Prebound geometry avoids trig and allocation during buffer updates. */
 deform(point:T.Vector3,out:T.Vector3,binding?:DoughBinding,alpha=1){
  out.copy(point);if(!this.active)return out;const b=binding??this.binding(point);normal.set(0,0,0);
  for(let i=0;i<4;i++){out.addScaledVector(this.offsets[b.ids[i]],b.weights[i]*alpha).addScaledVector(this.lastOffsets[b.ids[i]],b.weights[i]*(1-alpha));normal.addScaledVector(this.normals[b.ids[i]],b.weights[i]*alpha).addScaledVector(this.lastNormals[b.ids[i]],b.weights[i]*(1-alpha));}
  normal.normalize();normal.y-=1;return out.addScaledVector(normal,point.y-DOUGH_NEUTRAL);
 }
 /** Interpolate the coarse sheet once per rendered slice, not per skin vertex. */
 prepareRender(alpha:number){
  for(let i=0;i<this.offsets.length;i++)for(const [k,axis] of ['x','y','z'].entries()){
   const a=axis as 'x'|'y'|'z';this.renderOffsets[i*3+k]=this.offsets[i][a]*alpha+this.lastOffsets[i][a]*(1-alpha);
   this.renderNormals[i*3+k]=this.normals[i][a]*alpha+this.lastNormals[i][a]*(1-alpha);
  }
 }
 deformRender(point:T.Vector3,out:T.Vector3,binding:DoughBinding){
  if(!this.active)return out.copy(point);
  let x=0,y=0,z=0,nx=0,ny=0,nz=0;const offsets=this.renderOffsets,normals=this.renderNormals;
  for(let i=0;i<4;i++){const index=binding.ids[i]*3,w=binding.weights[i];x+=offsets[index]*w;y+=offsets[index+1]*w;z+=offsets[index+2]*w;nx+=normals[index]*w;ny+=normals[index+1]*w;nz+=normals[index+2]*w;}
  const inverse=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1),height=point.y-DOUGH_NEUTRAL;
  return out.set(point.x+x+nx*inverse*height,point.y+y+(ny*inverse-1)*height,point.z+z+nz*inverse*height);
 }
 start(){if(this.active)return;this.active=true;for(let i=0;i<this.rest.length;i++){this.points[i].copy(this.rest[i]).applyQuaternion(this.body.group.quaternion).add(this.body.group.position);this.previous[i].copy(this.points[i]);}this.cache();}
 private pin(){for(let i=this.index(this.radial,0);i<this.points.length;i++){this.points[i].copy(this.rest[i]).applyQuaternion(this.body.group.quaternion).add(this.body.group.position);this.previous[i].copy(this.points[i]);}}
 snapshot(){for(let i=0;i<this.offsets.length;i++){this.lastOffsets[i].copy(this.offsets[i]);this.lastNormals[i].copy(this.normals[i]);}}
 prepare(){if(this.active){this.pin();this.cache();}}
 addContact(indices:number[],correction:T.Vector3){for(const i of indices)if(this.inverseMass[i]){this.contactOffsets[i].add(correction);this.contactCounts[i]++;}}
 limitStretch(){let changed=false;for(let pass=0;pass<6;pass++)for(const link of this.links)if(!link.bend){delta.copy(this.points[link.b]).sub(this.points[link.a]);const length=delta.length(),wx=this.inverseMass[link.a],wy=this.inverseMass[link.b];if(length>link.length*1.12&&wx+wy){changed=true;delta.multiplyScalar((length-link.length*1.12)/length/(wx+wy));this.points[link.a].addScaledVector(delta,wx);this.points[link.b].addScaledVector(delta,-wy);this.previous[link.a].addScaledVector(delta,wx*.7);this.previous[link.b].addScaledVector(delta,-wy*.7);}}return changed;}
 applyContacts(){let changed=false;for(let i=0;i<this.points.length;i++)if(this.contactCounts[i]){changed=true;delta.copy(this.contactOffsets[i]).multiplyScalar(1/this.contactCounts[i]).clampLength(0,.12);this.points[i].add(delta);this.previous[i].add(delta);this.contactOffsets[i].set(0,0,0);this.contactCounts[i]=0;}changed=this.limitStretch()||changed;if(changed)this.cache();return changed;}
 surfaceNormal(binding:DoughBinding,out:T.Vector3,alpha=1){out.set(0,0,0);for(let i=0;i<4;i++)out.addScaledVector(this.normals[binding.ids[i]],binding.weights[i]*alpha).addScaledVector(this.lastNormals[binding.ids[i]],binding.weights[i]*(1-alpha));return out.normalize();}
 applyForce(point:T.Vector3,force:T.Vector3,dt:number){if(!this.active||this.body.sleeping)return;
  // Shared per-slice force budget: more visual strands cannot multiply the load.
  const magnitude=force.length(),scale=Math.min(1,Math.max(0,.16-this.body.cheeseForceBudget)/Math.max(magnitude,1e-9));this.body.cheeseForceBudget+=magnitude*scale;
  const b=this.binding(point);for(let i=0;i<4;i++)if(this.inverseMass[b.ids[i]])this.previous[b.ids[i]].addScaledVector(force,-dt*dt*b.weights[i]*scale*this.inverseMass[b.ids[i]]/this.meanMass);}
 step(dt:number,collisions:CollisionWorld,grab:{local:T.Vector3;target:T.Vector3}|null){
  this.start();this.contacts=0;const gravity=params.gravity/65*6.3,soft=T.MathUtils.clamp(params.sag*(1-params.stiffness/125)*(.65+warmth()*.6),.035,1.6);
  for(let i=0;i<this.points.length;i++)if(this.inverseMass[i]){
   const p=this.points[i],prev=this.previous[i];delta.copy(p).sub(prev).multiplyScalar(Math.exp(-dt*(reducedMotion.matches?9:4.5))).clampLength(0,dt*11);old.copy(p);p.add(delta);p.y-=gravity*dt*dt;prev.copy(old);
  }
  if(grab&&!this.grabLocal.equals(grab.local)){this.grabBinding=this.bind(grab.local.x,grab.local.z);this.grabLocal.copy(grab.local);}
  for(const link of this.links)link.lambda=0;
  this.pin();this.rootReaction.set(0,0,0);this.rootTorque.set(0,0,0);
  for(let pass=0;pass<9;pass++){
   for(const link of this.links){const x=this.points[link.a],y=this.points[link.b],wx=this.inverseMass[link.a],wy=this.inverseMass[link.b];if(!(wx+wy))continue;delta.copy(y).sub(x);const length=delta.length();if(length<1e-7)continue;
    const alpha=(link.bend?.0028*soft:.0000003)/(dt*dt),dl=(-(length-link.length)-alpha*link.lambda)/(wx+wy+alpha);link.lambda+=dl;
    delta.multiplyScalar(dl/length);x.addScaledVector(delta,-wx);y.addScaledVector(delta,wy);if(!link.bend){if(!wx){this.rootReaction.addScaledVector(delta,-1);u.copy(x).sub(this.body.massCenter(target)).cross(delta);this.rootTorque.sub(u);}if(!wy){this.rootReaction.add(delta);u.copy(y).sub(this.body.massCenter(target)).cross(delta);this.rootTorque.add(u);}}
   }
   // Weak shape memory prevents permanent creasing; the warm center remains very pliable.
   for(let i=0;i<this.points.length;i++)if(this.inverseMass[i]){const radius=Math.hypot(this.rest[i].x+this.body.home.x,this.rest[i].z+this.body.home.z)/this.radius;
    const memory=(.000012+.003*Math.pow(radius,10))/(soft*soft);target.copy(this.rest[i]).applyQuaternion(this.body.group.quaternion).add(this.body.group.position);this.points[i].lerp(target,Math.min(.13,memory));
   }
   if(grab&&this.grabBinding){const b=this.grabBinding;target.set(0,0,0);let weight=0;for(let i=0;i<4;i++){target.addScaledVector(this.points[b.ids[i]],b.weights[i]);weight+=b.weights[i]*b.weights[i]*this.inverseMass[b.ids[i]];}
    if(weight>.00001){delta.copy(grab.target).sub(target);local.set(0,grab.local.y-DOUGH_NEUTRAL,0).applyQuaternion(this.body.group.quaternion);delta.sub(local).clampLength(0,.035);for(let i=0;i<4;i++)this.points[b.ids[i]].addScaledVector(delta,.38*b.weights[i]*this.inverseMass[b.ids[i]]/(weight+.1));}
   }
   // Contact is solved per patch, never by flattening or translating the entire center.
   if(pass>=4)for(let i=0;i<this.points.length;i++)if(this.inverseMass[i]){old.copy(this.points[i]);collisions.resolveParticle(this.points[i],this.previous[i],.026,this.body);if(old.distanceToSquared(this.points[i])>1e-10)this.contacts++;}
   this.pin();
  }
  // The sheet transfers its load to the crust even after release, not only during a center grab.
  {const pinched=grab&&Math.hypot(grab.local.x+this.body.home.x,grab.local.z+this.body.home.z)<2.05;
   delta.copy(this.rootReaction).multiplyScalar((this.meanMass/this.body.crustMass)/dt).clampLength(0,dt*(pinched?54:2));this.body.velocity.add(delta);
   delta.copy(this.rootTorque).multiplyScalar((pinched?.006:this.meanMass*this.body.inverseInertia)/dt).clampLength(0,dt*3);this.body.angularVelocity.add(delta);
  }
  this.limitStretch();this.cache();
 }
 cache(){
  inverse.copy(this.body.group.quaternion).invert();for(let i=0;i<this.points.length;i++){this.offsets[i].copy(this.points[i]).sub(this.body.group.position).applyQuaternion(inverse).sub(this.rest[i]);this.normals[i].set(0,0,0);}
  for(const [a,b,c] of this.triangles){u.copy(this.points[b]).sub(this.points[a]);v.copy(this.points[c]).sub(this.points[a]);normal.crossVectors(u,v).applyQuaternion(inverse);this.normals[a].add(normal);this.normals[b].add(normal);this.normals[c].add(normal);}
  for(let i=0;i<this.normals.length;i++){this.normals[i].normalize();if(!this.inverseMass[i])this.normals[i].set(0,1,0);}
 }
 reset(){this.active=false;this.grabBinding=null;this.grabLocal.x=Infinity;for(const p of this.lastOffsets)p.set(0,0,0);for(const n of this.lastNormals)n.set(0,1,0);for(const p of this.offsets)p.set(0,0,0);for(const n of this.normals)n.set(0,1,0);}
}
