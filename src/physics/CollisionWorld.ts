import {SAUCE_TOP,shoulderHeight} from '../pizza/surface';
import * as T from 'three';
import { PizzaSlice } from '../pizza/PizzaSlice';
import { rimShape } from '../pizza/surface';
const a=new T.Vector3(),b=new T.Vector3(),axis=new T.Vector3(),separation=new T.Vector3(),relative=new T.Vector3(),contact=new T.Vector3(),arm=new T.Vector3(),spin=new T.Vector3(),bestNormal=new T.Vector3(),sweepNormal=new T.Vector3(),sweepEnd=new T.Vector3(),sweepMotion=new T.Vector3(),shiftX=new T.Vector3(),shiftY=new T.Vector3();
export class ConvexProxy {
 bodyBounds?:T.Box3;patchBounds?:T.Box3;
 bindings:ReturnType<PizzaSlice['cloth']['bind']>[]=[];directionCount=0;vertices:T.Vector3[];normals:T.Vector3[];directions:T.Vector3[];center=new T.Vector3();bounds=new T.Box3();faces:number[][]=[];edges:[number,number][]=[];
 constructor(public body:PizzaSlice,public local:T.Vector3[],public soft=false,public clothIndices:number[]=[]){
  this.bindings=local.map(p=>body.cloth.bind(p.x,p.z));const n=local.length/2;this.vertices=local.map(()=>new T.Vector3());this.faces.push(Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i));
  for(let i=0;i<n;i++){const j=(i+1)%n;this.faces.push([i,j,j+n,i+n]);this.edges.push([i,j],[i,i+n]);}
  this.normals=this.faces.map(()=>new T.Vector3());this.directions=this.edges.map(()=>new T.Vector3());this.update();
 }
 translate(offset:T.Vector3){for(const vertex of this.vertices)vertex.add(offset);this.center.add(offset);this.bounds.translate(offset);this.bodyBounds?.union(this.bounds);this.patchBounds?.union(this.bounds);}
 update(){
  this.center.set(0,0,0);this.bounds.makeEmpty();for(let i=0;i<this.local.length;i++){this.body.cloth.deform(this.local[i],this.vertices[i],this.bindings[i]);this.vertices[i].applyQuaternion(this.body.group.quaternion).add(this.body.group.position);this.center.add(this.vertices[i]);this.bounds.expandByPoint(this.vertices[i]);}this.center.multiplyScalar(1/this.vertices.length);this.bodyBounds?.union(this.bounds);this.patchBounds?.union(this.bounds);
  this.faces.forEach((face,i)=>{const p=this.vertices[face[0]];a.copy(this.vertices[face[1]]).sub(p);b.copy(this.vertices[face[2]]).sub(p);const normal=this.normals[i].crossVectors(a,b).normalize();a.copy(p).sub(this.center);if(normal.dot(a)<0)normal.negate();});
  this.directionCount=0;for(const [i,j] of this.edges){a.copy(this.vertices[j]).sub(this.vertices[i]).normalize();let duplicate=false;for(let k=0;k<this.directionCount;k++)if(Math.abs(a.dot(this.directions[k]))>.9998){duplicate=true;break;}if(!duplicate)this.directions[this.directionCount++].copy(a);}
 }
}
/** Deforming convex wedges: thin dough fans plus separate thicker crust regions. */
export class CollisionWorld {
 bodyBounds=new Map<PizzaSlice,T.Box3>();
 blocks=new Map<PizzaSlice,{bounds:T.Box3,parts:ConvexProxy[]}[]>();
 proxies:ConvexProxy[]=[];byBody=new Map<PizzaSlice,ConvexProxy[]>();contacts=0;
 constructor(public slices:PizzaSlice[]){
  for(const body of slices){const parts:ConvexProxy[]=[];
   const point=(angle:number,r:number,y:number)=>new T.Vector3(Math.cos(angle)*r-body.home.x,y,Math.sin(angle)*r-body.home.z);
   for(let i=0;i<3;i++){
    const left=body.theta-body.halfAngle+(body.halfAngle*2)*i/3,right=body.theta-body.halfAngle+(body.halfAngle*2)*(i+1)/3;
    const profile=[[-.84,-.047],[.88,-.047],[.94,.25],[.48,.82],[0,.97],[-.55,.76],[-.92,.18]];
    const ring=(angle:number)=>{const shape=rimShape(angle);return profile.map(([width,height])=>point(angle,shape.center+shape.width*width,height<0?.058:.105+shape.height*height));};
    parts.push(new ConvexProxy(body,[...ring(left),...ring(right)]));
   }
   for(const triangle of body.cloth.triangles){
    const footprint=triangle.map(index=>body.cloth.rest[index]);
    parts.unshift(new ConvexProxy(body,[...footprint.map(p=>new T.Vector3(p.x,.055,p.z)),...footprint.map(p=>new T.Vector3(p.x,SAUCE_TOP+.025+shoulderHeight(p.x+body.home.x,p.z+body.home.z),p.z))],triangle.some(i=>i<body.cloth.index(body.cloth.radial-1,0)),triangle));
   }
   const bounds=new T.Box3();for(const part of parts){bounds.union(part.bounds);part.bodyBounds=bounds;}this.bodyBounds.set(body,bounds);
   const blocks=[];for(let i=0;i<parts.length;i+=8){const subset=parts.slice(i,i+8),bounds=new T.Box3();for(const p of subset){bounds.union(p.bounds);p.patchBounds=bounds;}blocks.push({bounds,parts:subset});}this.blocks.set(body,blocks);
   this.byBody.set(body,parts);this.proxies.push(...parts);
  }
 }
 update(force=false){for(const [body,parts] of this.byBody)if(force||(body.detached&&!body.sleeping)){this.bodyBounds.get(body)!.makeEmpty();for(const block of this.blocks.get(body)!)block.bounds.makeEmpty();for(const proxy of parts)proxy.update();}}
 /** Hover uses the already-deformed convex proxies, not hundreds of thousands
  * of render triangles. Pointer-down still uses exact surface/UV picking. */
 pick(ray:T.Ray){
  let closest=Infinity,body:PizzaSlice|null=null;
  for(const proxy of this.proxies){
   if(!ray.intersectsBox(proxy.bounds))continue;
   let enter=0,exit=Infinity;
   for(let i=0;i<proxy.faces.length;i++){
    const n=proxy.normals[i],vertex=proxy.vertices[proxy.faces[i][0]],distance=n.dot(ray.origin)-n.dot(vertex),speed=n.dot(ray.direction);
    if(Math.abs(speed)<1e-9){if(distance>0){exit=-1;break;}continue;}
    const t=-distance/speed;if(speed<0)enter=Math.max(enter,t);else exit=Math.min(exit,t);
    if(enter>exit)break;
   }
   if(enter<=exit&&enter<closest){closest=enter;body=proxy.body;}
  }return body;
 }
 private overlap(x:ConvexProxy,y:ConvexProxy){
  if(!x.bounds.intersectsBox(y.bounds))return 0;
  let depth=Infinity;
  const check=(n:T.Vector3)=>{if(n.lengthSq()<1e-9)return true;let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const p of x.vertices){const d=p.dot(n);xmin=Math.min(xmin,d);xmax=Math.max(xmax,d);}for(const p of y.vertices){const d=p.dot(n);ymin=Math.min(ymin,d);ymax=Math.max(ymax,d);}const overlap=Math.min(xmax-ymin,ymax-xmin);if(overlap<=0)return false;if(overlap<depth){depth=overlap;bestNormal.copy(n);}return true;};
  for(const n of x.normals)if(!check(n))return 0;for(const n of y.normals)if(!check(n))return 0;
  for(let i=0;i<x.directionCount;i++)for(let j=0;j<y.directionCount;j++){axis.crossVectors(x.directions[i],y.directions[j]);if(axis.lengthSq()>1e-8){axis.normalize();if(!check(axis))return 0;}}
  separation.copy(y.center).sub(x.center);if(bestNormal.dot(separation)<0)bestNormal.negate();return depth;
 }
 solve(){
  this.contacts=0;this.update();for(const body of this.slices)if(!body.sleeping)body.grounded=false;
  for(let pass=0;pass<4;pass++){
   for(let i=0;i<this.slices.length;i++)for(let j=i+1;j<this.slices.length;j++){
    const x=this.slices[i],y=this.slices[j];if((!x.detached||x.sleeping)&&(!y.detached||y.sleeping))continue;if(x.group.position.distanceToSquared(y.group.position)>20)continue;
    if(!this.bodyBounds.get(x)!.intersectsBox(this.bodyBounds.get(y)!))continue;
    for(const px of this.byBody.get(x)!){
     if(!px.bounds.intersectsBox(this.bodyBounds.get(y)!))continue;
     for(const py of this.byBody.get(y)!){
     const wx=x.detached&&!px.soft?(x.held?.65:1):0,wy=y.detached&&!py.soft?(y.held?.65:1):0;if(!(wx+wy))continue;
     const depth=this.overlap(px,py);if(depth<=.006)continue;this.contacts++;if(depth>.012){if(x.detached)x.sleeping=false;if(y.detached)y.sleeping=false;}
     const correction=Math.min(.12,(depth-.006)*.75)/(wx+wy);separation.copy(bestNormal).multiplyScalar(correction);if(wx)x.group.position.addScaledVector(separation,-wx);if(wy)y.group.position.addScaledVector(separation,wy);
      relative.copy(y.velocity).sub(x.velocity);const speed=relative.dot(bestNormal);if(speed<0){const impulse=-speed*.16/(wx+wy);if(wx)x.velocity.addScaledVector(bestNormal,-impulse*wx);if(wy)y.velocity.addScaledVector(bestNormal,impulse*wy);
      contact.copy(px.center).add(py.center).multiplyScalar(.5);if(wx){arm.copy(contact).sub(x.massCenter(a));spin.crossVectors(arm,bestNormal).multiplyScalar(-impulse*wx*.06).clampLength(0,.25);x.angularVelocity.add(spin);}if(wy){arm.copy(contact).sub(y.massCenter(a));spin.crossVectors(arm,bestNormal).multiplyScalar(impulse*wy*.06).clampLength(0,.25);y.angularVelocity.add(spin);}
     }
     shiftX.copy(separation).multiplyScalar(-wx);shiftY.copy(separation).multiplyScalar(wy);
     if(wx)for(const p of this.byBody.get(x)!)p.translate(shiftX);if(wy)for(const p of this.byBody.get(y)!)p.translate(shiftY);
    }}
   }
   for(const body of this.slices)if(body.detached&&!body.sleeping){
    const parts=this.byBody.get(body)!;let low=Infinity;
    for(const proxy of parts)if(!proxy.soft)low=Math.min(low,proxy.bounds.min.y);
    if(low<.026){
     body.grounded=true;
     contact.set(0,0,0);let count=0;
     for(const proxy of parts)if(!proxy.soft)for(const vertex of proxy.vertices)if(vertex.y<low+.018){contact.add(vertex);count++;}
     if(!count)continue;contact.multiplyScalar(1/count);
     shiftX.set(0,Math.max(0,.025-low),0);body.group.position.add(shiftX);contact.add(shiftX);
     // An off-center support applies torque. This lets the rim roll onto its
     // broad base instead of cancelling gravity while leaving it balanced on an edge.
     arm.copy(contact).sub(body.massCenter(a));
     relative.crossVectors(body.angularVelocity,arm).add(body.velocity);
     const inverseMass=1/body.crustMass,lever=arm.x*arm.x+arm.z*arm.z;
     if(relative.y<0){
      const impulse=-relative.y/(inverseMass+lever*body.inverseInertia);
      body.velocity.y+=impulse*inverseMass;
      spin.set(-arm.z,0,arm.x).multiplyScalar(impulse*body.inverseInertia);body.angularVelocity.add(spin);
      // Coulomb-style sliding friction is limited by the normal impulse.
      relative.crossVectors(body.angularVelocity,arm).add(body.velocity);relative.y=0;
      const speed=relative.length();if(speed>1e-8){relative.multiplyScalar(-Math.min(speed/(inverseMass+arm.lengthSq()*body.inverseInertia),impulse*.55)/speed);body.velocity.addScaledVector(relative,inverseMass);spin.crossVectors(arm,relative).multiplyScalar(body.inverseInertia);body.angularVelocity.add(spin);}
     }
     // Soft baked dough dissipates rolling/contact motion without choosing an orientation.
     body.angularVelocity.multiplyScalar(.96);
     for(const proxy of parts)proxy.translate(shiftX);
    }
   }
  }
 }
 /** Resolve patch intersections locally after integration, including edge-on-sheet contact.
  * Averaging corrections per particle prevents adjacent triangles multiplying an impulse. */
 solveDough(){
  for(let pass=0;pass<6;pass++){
   for(let i=0;i<this.slices.length;i++)for(let j=i+1;j<this.slices.length;j++){
    const x=this.slices[i],y=this.slices[j];if((!x.detached||x.sleeping)&&(!y.detached||y.sleeping))continue;
    if(x.group.position.distanceToSquared(y.group.position)>25)continue;
    if(!this.bodyBounds.get(x)!.intersectsBox(this.bodyBounds.get(y)!))continue;
    for(const px of this.byBody.get(x)!){
     if(!px.bounds.intersectsBox(this.bodyBounds.get(y)!))continue;
     for(const py of this.byBody.get(y)!){
     const wx=x.detached&&x.cloth.active&&px.soft?1:0,wy=y.detached&&y.cloth.active&&py.soft?1:0;if(!(wx+wy))continue;
     const depth=this.overlap(px,py);if(depth<=.008)continue;this.contacts++;if(depth>.012){if(x.detached)x.sleeping=false;if(y.detached)y.sleeping=false;}
     separation.copy(bestNormal).multiplyScalar(Math.min(.12,(depth-.005)*.9)/(wx+wy));
     if(wy)y.cloth.addContact(py.clothIndices,separation);if(wx)x.cloth.addContact(px.clothIndices,separation.negate());
    }}
   }
   let changed=false;for(const body of this.slices)if(body.cloth.active&&!body.sleeping&&body.cloth.applyContacts()){changed=true;for(const p of this.byBody.get(body)!)p.update();}if(!changed)break;
  }
 }
 /** Project a small sphere out of a convex proxy and damp normal velocity. */
 resolveParticle(point:T.Vector3,previous:T.Vector3|undefined,radius:number,exclude?:PizzaSlice){
  // Conservative body bounds reject whole sleeping slices before testing their
  // many deformable patches. Proxy updates expand these bounds during solving.
  for(const [body,parts] of this.byBody){
   if(body===exclude)continue;const bounds=this.bodyBounds.get(body)!;
   const px=previous?.x??point.x,py=previous?.y??point.y,pz=previous?.z??point.z;
   if(Math.max(point.x,px)<bounds.min.x-radius||Math.min(point.x,px)>bounds.max.x+radius||Math.max(point.y,py)<bounds.min.y-radius||Math.min(point.y,py)>bounds.max.y+radius||Math.max(point.z,pz)<bounds.min.z-radius||Math.min(point.z,pz)>bounds.max.z+radius)continue;
   for(const block of this.blocks.get(body)!){
   const bb=block.bounds,ox=previous?.x??point.x,oy=previous?.y??point.y,oz=previous?.z??point.z;
   if(Math.max(point.x,ox)<bb.min.x-radius||Math.min(point.x,ox)>bb.max.x+radius||Math.max(point.y,oy)<bb.min.y-radius||Math.min(point.y,oy)>bb.max.y+radius||Math.max(point.z,oz)<bb.min.z-radius||Math.min(point.z,oz)>bb.max.z+radius)continue;
   for(const proxy of block.parts){const box=proxy.bounds;
   const outsideBox=point.x<box.min.x-radius||point.x>box.max.x+radius||point.y<box.min.y-radius||point.y>box.max.y+radius||point.z<box.min.z-radius||point.z>box.max.z+radius;
   if(previous&&point.distanceToSquared(previous)>radius*radius*4){
    const misses=Math.max(point.x,previous.x)<box.min.x-radius||Math.min(point.x,previous.x)>box.max.x+radius||Math.max(point.y,previous.y)<box.min.y-radius||Math.min(point.y,previous.y)>box.max.y+radius||Math.max(point.z,previous.z)<box.min.z-radius||Math.min(point.z,previous.z)>box.max.z+radius;
    if(!misses){let enter=0,exit=1,hit=false,reject=false;
     for(let i=0;i<proxy.faces.length;i++){const n=proxy.normals[i],vertex=proxy.vertices[proxy.faces[i][0]],from=a.copy(previous).sub(vertex).dot(n)-radius,to=b.copy(point).sub(vertex).dot(n)-radius;
      if(from>0&&to>0){reject=true;break;}if(from<=0&&to<=0)continue;const t=from/(from-to);if(from>to){if(t>=enter){enter=t;sweepNormal.copy(n);hit=true;}}else exit=Math.min(exit,t);if(enter>exit){reject=true;break;}}
     if(!reject&&hit&&enter<=exit&&enter>=0&&enter<=1){sweepEnd.copy(point);point.lerpVectors(previous,sweepEnd,Math.max(0,enter-.0001));sweepMotion.copy(sweepEnd).sub(point);sweepMotion.addScaledVector(sweepNormal,-Math.min(0,sweepMotion.dot(sweepNormal)));point.addScaledVector(sweepMotion,.88);a.copy(point).sub(sweepEnd);previous.add(a);a.copy(point).sub(previous);const inward=a.dot(sweepNormal);if(inward<0)previous.addScaledVector(sweepNormal,inward);}
    }else if(outsideBox)continue;
   }else if(outsideBox)continue;
   let nearest=-Infinity,face=-1,outside=false;
   for(let i=0;i<proxy.faces.length;i++){a.copy(point).sub(proxy.vertices[proxy.faces[i][0]]);const d=a.dot(proxy.normals[i]);if(d>radius){outside=true;break;}if(d>nearest){nearest=d;face=i;}}
   if(outside||face<0)continue;const normal=proxy.normals[face],amount=radius-nearest-.003;if(amount<=0)continue;
   point.addScaledVector(normal,amount);if(previous){previous.addScaledVector(normal,amount);a.copy(point).sub(previous);const inward=a.dot(normal);if(inward<0)previous.addScaledVector(normal,inward*.85);}
  }}
  }
  if(point.y<.025+radius){const dy=.025+radius-point.y;point.y+=dy;if(previous){previous.y=Math.min(point.y,previous.y+dy);previous.x=T.MathUtils.lerp(previous.x,point.x,.10);previous.z=T.MathUtils.lerp(previous.z,point.z,.10);}}
 }
 maxPenetration(){this.update(true);let maximum=0;for(let i=0;i<this.proxies.length;i++)for(let j=i+1;j<this.proxies.length;j++){const x=this.proxies[i],y=this.proxies[j];if(x.body!==y.body&&(x.body.detached||y.body.detached))maximum=Math.max(maximum,this.overlap(x,y));}return maximum;}
}
