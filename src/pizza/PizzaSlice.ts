import * as T from 'three';
import {updateNormals} from '../performance/geometry';
import {quality} from '../performance/quality';
import {BoundaryExtrusions, type MozzarellaExtrusion, type PullState} from '../cheese/BoundaryExtrusion';
export type {MozzarellaExtrusion} from '../cheese/BoundaryExtrusion';
import { DoughCloth, type DoughBinding } from '../physics/DoughCloth';
const sample=new T.Vector3(),deformed=new T.Vector3(),va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3(),bary=new T.Vector3();
import { Materials, rand, noise, crumbCavity } from './materials';
import { outline, rimPoint, rimShape, cheeseField, cheeseHeight, CHEESE_EDGE, DOUGH_BOTTOM, DOUGH_TOP, DOUGH_NEUTRAL, SAUCE_BOTTOM, SAUCE_TOP, CHEESE_BOTTOM, shoulderHeight, cutAngle } from './surface';
export const RADIUS=2.6, SLICE_COUNT=6, SECTOR=Math.PI*2/SLICE_COUNT;
const boundaries=Array.from({length:SLICE_COUNT+1},(_,i)=>-Math.PI/3+i*SECTOR+(i===SLICE_COUNT?rand(411):rand(411+i*13))*.07-.035);
type BoundaryEdge={a:number,b:number,r0:number,r1:number};
export class PizzaSlice {
 group=new T.Group();velocity=new T.Vector3();angularVelocity=new T.Vector3();home=new T.Vector3();theta:number;halfAngle:number;bend=0;bendVelocity=0;twist=0;twistVelocity=0;previousVelocity=new T.Vector3();detached=false;sleeping=false;sleepTime=0;held=false;hasCheese=false;
 cloth:DoughCloth;cheeseNecks:{local:T.Vector3,direction:T.Vector3,amount:number,width:number}[]=[];surfaceDirty=false;private cheeseMesh?:T.Mesh;private extrusions?:BoundaryExtrusions;private cheeseBoundary:[BoundaryEdge[],BoundaryEdge[]]=[[],[]];
 deformables:{mesh:T.Mesh,base:Float32Array,bindings:DoughBinding[],neckInfluences?:WeakMap<object,Float32Array>,hadNeck?:boolean}[]=[];toppings:{mesh:T.Mesh,base:T.Vector3,rotation:T.Quaternion,binding:DoughBinding}[]=[];collisionPoints:T.Vector3[]=[];
 constructor(public id:number,public materials:Materials){
  this.theta=(boundaries[id]+boundaries[id+1])/2;this.halfAngle=(boundaries[id+1]-boundaries[id])/2;this.home.set(Math.cos(this.theta)*1.48,0,Math.sin(this.theta)*1.48);this.group.position.copy(this.home);this.cloth=new DoughCloth(this);
  this.layer(2.45,DOUGH_BOTTOM,DOUGH_TOP,materials.dough,quality.mobile?28:40,quality.mobile?18:24,true);
  this.layer(2.28,SAUCE_BOTTOM,SAUCE_TOP,materials.sauce,quality.mobile?32:48,quality.mobile?20:30);
  this.mozzarella();this.crust();this.leaves();
  this.group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.userData.slice=this;}});
  for(const a of [-.48,0,.48])for(const r of [1.2,2.57])this.collisionPoints.push(new T.Vector3(Math.cos(this.theta+a)*r-this.home.x,.055,Math.sin(this.theta+a)*r-this.home.z));
  this.collisionPoints.push(new T.Vector3(-this.home.x,.055,-this.home.z));
 }
 private addMesh(p:number[],uv:number[],indices:number[],material:T.Material|T.Material[]){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const floorUV:number[]=[];for(let i=0;i<p.length;i+=3)floorUV.push(.5+(p[i]+this.home.x)/5.3,.5+(p[i+2]+this.home.z)/5.3);g.setAttribute('uv1',new T.Float32BufferAttribute(floorUV,2));
  const thickness=new Float32Array(p.length/3);for(let i=0;i<thickness.length;i++){const radial=Math.hypot(p[i*3]+this.home.x,p[i*3+2]+this.home.z);thickness[i]=material===this.materials.cheese?T.MathUtils.clamp((p[(i%(p.length/6))*3+1]-CHEESE_BOTTOM)/.065,.12,1):material===this.materials.dough?T.MathUtils.lerp(.20,.52,T.MathUtils.smoothstep(radial,1.25,2.45)):material===this.materials.crumb?.65:Array.isArray(material)&&material.includes(this.materials.crust)?T.MathUtils.clamp(.9-(p[i*3+1]-.1)*.8,.28,.9):Array.isArray(material)?T.MathUtils.lerp(.24,.95,T.MathUtils.smoothstep(radial,1.5,2.5)):1;}g.setAttribute('sssThickness',new T.BufferAttribute(thickness,1));
  const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.slice=this;this.group.add(mesh);this.deformables.push({mesh,base:new Float32Array(p),bindings:Array.from({length:p.length/3},(_,i)=>this.cloth.bind(p[i*3],p[i*3+2]))});return mesh;
 }
 private layer(radius:number,bottom:number,top:number,material:T.Material,na:number,nr:number,bakedBase=false){
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let layer=0;layer<2;layer++)for(let j=0;j<=nr;j++)for(let i=0;i<=na;i++){
   const sauce=material===this.materials.sauce,a=this.theta-this.halfAngle+(this.halfAngle*2)*i/na;
   // Global angular variation joins neighboring slices and stays stable while orbiting.
   const spread=sauce?1+(noise(Math.cos(a)*7+81,Math.sin(a)*7+34)-.5)*.047:1;
   const r=radius*j/nr*outline(a)*spread,cut=cutAngle(a,r),x=Math.cos(cut)*r,z=Math.sin(cut)*r;
   const uneven=(noise(x*3+11,z*3+20)-.5)*.010*Math.sin(Math.PI*j/nr);
   const edge=sauce?1-T.MathUtils.smoothstep(j/nr,.92,1):1;
   const height=sauce&&layer?bottom+.0004+(top-bottom-.0004)*edge+(noise(x*13+42,z*13+28)-.5)*.003*edge:(layer?top:bottom);
   p.push(x-this.home.x,height+uneven+(layer||!bakedBase?shoulderHeight(x,z):0),z-this.home.z);uv.push(.5+x/5.3,.5+z/5.3);
  }
  const n=(na+1)*(nr+1);
  for(let j=0;j<nr;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+1,c=a+na+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const bottomCount=indices.length;
  for(let j=0;j<nr;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i+n,b=a+1,c=a+na+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const join=(a:number,b:number)=>indices.push(a,b,a+n,b,b+n,a+n);
  for(let i=0;i<na;i++)join(nr*(na+1)+i,nr*(na+1)+i+1);
  for(let j=0;j<nr;j++){join(j*(na+1),(j+1)*(na+1));join((j+1)*(na+1)+na,j*(na+1)+na);}
  const mesh=this.addMesh(p,uv,indices,bakedBase?[this.materials.underside,material]:material);
  if(bakedBase){mesh.name="Thin baked base";mesh.geometry.addGroup(0,bottomCount,0);mesh.geometry.addGroup(bottomCount,indices.length-bottomCount,1);}
 }
 rebuildMozzarella(){
  for(let i=this.deformables.length-1;i>=0;i--){const d=this.deformables[i];if(d.mesh.material===this.materials.cheese){d.mesh.removeFromParent();d.mesh.geometry.dispose();this.deformables.splice(i,1);}}
  this.mozzarella();
  for(const topping of this.toppings){const x=topping.base.x+this.home.x,z=topping.base.z+this.home.z;topping.base.y=(cheeseField(x,z)>=CHEESE_EDGE?cheeseHeight(x,z):SAUCE_TOP+shoulderHeight(x,z))+.015;}
  this.updateGeometry();
 }
 private mozzarella(){
  // Contour-clipped triangles create actual gaps, not a white disk with painted sauce.
  const na=64,nr=42,p:number[]=[],uv:number[]=[],indices:number[]=[],field:number[]=[],intersections=new Map<string,number>();
  for(let j=0;j<=nr;j++)for(let i=0;i<=na;i++){
   const a=this.theta-this.halfAngle+(this.halfAngle*2)*i/na,r=2.255*j/nr*outline(a),cut=cutAngle(a,r),x=Math.cos(cut)*r,z=Math.sin(cut)*r,f=cheeseField(x,z);
   p.push(x-this.home.x,cheeseHeight(x,z,f),z-this.home.z);uv.push(.5+x/5.3,.5+z/5.3);field.push(f);
  }
  const crossing=(a:number,b:number)=>{
   const key=a<b?`${a}:${b}`:`${b}:${a}`,existing=intersections.get(key);if(existing!==undefined)return existing;
   const t=(CHEESE_EDGE-field[a])/(field[b]-field[a]),x=T.MathUtils.lerp(p[a*3],p[b*3],t),z=T.MathUtils.lerp(p[a*3+2],p[b*3+2],t),n=p.length/3;
   p.push(x,cheeseHeight(x+this.home.x,z+this.home.z,CHEESE_EDGE),z);uv.push(T.MathUtils.lerp(uv[a*2],uv[b*2],t),T.MathUtils.lerp(uv[a*2+1],uv[b*2+1],t));field.push(CHEESE_EDGE);intersections.set(key,n);return n;
  };
  const clip=(tri:number[])=>{
   const polygon:number[]=[];for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],inside=field[a]>=CHEESE_EDGE,nextInside=field[b]>=CHEESE_EDGE;if(inside)polygon.push(a);if(inside!==nextInside)polygon.push(crossing(a,b));}
   for(let i=1;i<polygon.length-1;i++)indices.push(polygon[0],polygon[i],polygon[i+1]);
  };
  for(let j=0;j<nr;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+1,c=a+na+1,d=c+1;clip([a,b,c]);clip([b,d,c]);}
  // Cache clipped radial edge segments from the actual generated mozzarella
  // surface. Primary pulls reuse these exact vertex IDs as extrusion roots.
  this.cheeseBoundary=[[],[]];
  for(let side=0;side<2;side++){
   const i=side===0?0:na,list=this.cheeseBoundary[side];
   for(let j=0;j<nr;j++){
    const a=j*(na+1)+i,b=(j+1)*(na+1)+i,insideA=field[a]>=CHEESE_EDGE,insideB=field[b]>=CHEESE_EDGE;
    if(!insideA&&!insideB)continue;
    const va=insideA?a:crossing(a,b),vb=insideB?b:crossing(a,b),r0=Math.hypot(p[va*3]+this.home.x,p[va*3+2]+this.home.z),r1=Math.hypot(p[vb*3]+this.home.x,p[vb*3+2]+this.home.z);
    list.push({a:va,b:vb,r0,r1});
   }
   list.sort((a,b)=>a.r0-b.r0);
  }
  // Give every mozzarella island a closed underside and a soft vertical edge.
  const topCount=p.length/3,topIndices=[...indices],edges=new Map<string,{a:number,b:number,count:number}>();
  for(let i=0;i<topCount;i++){p.push(p[i*3],CHEESE_BOTTOM+shoulderHeight(p[i*3]+this.home.x,p[i*3+2]+this.home.z),p[i*3+2]);uv.push(uv[i*2],uv[i*2+1]);}
  for(let i=0;i<topIndices.length;i+=3){const a=topIndices[i],b=topIndices[i+1],c=topIndices[i+2];indices.push(a+topCount,c+topCount,b+topCount);for(const [x,y] of [[a,b],[b,c],[c,a]]){const key=x<y?`${x}:${y}`:`${y}:${x}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a:x,b:y,count:1});}}
  for(const {a,b,count} of edges.values())if(count===1)indices.push(b,a,a+topCount,b,a+topCount,b+topCount);
  this.cheeseMesh=this.addMesh(p,uv,indices,this.materials.cheese);
  this.extrusions=new BoundaryExtrusions(this.cheeseMesh,topCount);
  // Pull faces belong to this mesh for continuity, but are not grab targets.
  this.cheeseMesh.raycast=function(raycaster,hits){
   const local:T.Intersection[]=[];T.Mesh.prototype.raycast.call(this,raycaster,local);
   for(const hit of local)if(hit.faceIndex!<(this.geometry.userData.extrusionFaceStart??Infinity))hits.push(hit);
  };
 }
 private boundaryPatch(side:number,r:number){
  const edges=this.cheeseBoundary[side<0?0:1];
  const nearest=edges.findIndex(e=>r>=e.r0-.003&&r<=e.r1+.003);if(nearest<0)return;
  let lo=nearest,hi=nearest;
  // A short real surface boundary feeds 2–4 lanes. Never bridge over bare sauce.
  while(hi-lo<3){
   if(lo>0&&edges[lo-1].b===edges[lo].a){lo--;continue;}
   if(hi+1<edges.length&&edges[hi].b===edges[hi+1].a){hi++;continue;}break;
  }
  return [edges[lo].a,...edges.slice(lo,hi+1).map(e=>e.b)];
 }
 canExtrudeMozzarella(side:number,r:number){return !!this.cheeseMesh&&!!this.boundaryPatch(side,r);}
 private cheeseVertexWorld(index:number,out:T.Vector3){
  if(!this.cheeseMesh)return out.set(0,0,0);
  this.cheeseMesh.updateWorldMatrix(true,false);
  return out.fromBufferAttribute(this.cheeseMesh.geometry.getAttribute('position'),index).applyMatrix4(this.cheeseMesh.matrixWorld);
 }
 mozzarellaAnchor(indices:number[],out:T.Vector3){
  const surface=this.deformables.find(d=>d.mesh===this.cheeseMesh);out.set(0,0,0);
  // Store rest coordinates. worldPoint applies cloth deformation exactly once.
  if(surface)for(const index of indices)out.add(sample.fromArray(surface.base,index*3));
  return out.multiplyScalar(1/Math.max(1,indices.length));
 }
 createMozzarellaExtrusion(neighbor:PizzaSlice,side:number,r:number,seed:number):MozzarellaExtrusion|undefined{
  if(!this.extrusions||!neighbor.cheeseMesh)return;
  const source=this.boundaryPatch(side,r),target=neighbor.boundaryPatch(-side,r);if(!source||!target)return;
  return this.extrusions.add(source,target,side,seed,(id,out,bottom=false)=>neighbor.cheeseVertexWorld(id+(bottom?neighbor.extrusions!.topCount:0),out),(id,name,component)=>neighbor.cheeseMesh!.geometry.getAttribute(name).array[id*neighbor.cheeseMesh!.geometry.getAttribute(name).itemSize+component]);
 }
 updateMozzarellaExtrusion(ex:MozzarellaExtrusion,curve:T.CatmullRomCurve3,state:PullState){this.extrusions?.update(ex,curve,state);}
 releaseMozzarellaExtrusion(ex:MozzarellaExtrusion){this.extrusions?.remove(ex);}
 private crust(){
  // Parametric subdivision keeps the hand-shaped rim smooth while preserving the existing silhouette scale.
  const p:number[]=[],uv:number[]=[],indices:number[]=[],lower:number[]=[],na=quality.mobile?72:108,nb=quality.mobile?40:56;
  for(let i=0;i<=na;i++){
   const a=this.theta-this.halfAngle+(this.halfAngle*2)*i/na;
   for(let j=0;j<=nb;j++){
    const b=j/nb*Math.PI*2,point=rimPoint(a,b);
    p.push(Math.cos(a)*point.r-this.home.x,point.y,Math.sin(a)*point.r-this.home.z);uv.push(a/(Math.PI*2),1-j/nb);
    if(i<na&&j<nb){const k=i*(nb+1)+j;(j<nb/2?indices:lower).push(k,k+1,k+nb+1,k+1,k+nb+2,k+nb+1);}
   }
  }
  const crownCount=indices.length;indices.push(...lower);
  // Both curved faces are one continuous baked-dough surface. The UV already
  // maps crown, inner/outer walls and underside across the same shared material.
  const mesh=this.addMesh(p,uv,indices,[this.materials.crust,this.materials.crust]);mesh.name='Cornicione';mesh.geometry.addGroup(0,crownCount,0);mesh.geometry.addGroup(crownCount,lower.length,1);
  for(const side of [-1,1]){
   const a=this.theta+side*this.halfAngle,shape=rimShape(a),p:number[]=[],uv:number[]=[],indices:number[]=[],rings=quality.mobile?16:20,around=quality.mobile?56:80;
   const centerY=.105+shape.height*.43;
   // Large alveoli have real inward depth; micro-pores stay in the material. The perimeter remains sealed.
   for(let ring=0;ring<=rings;ring++)for(let j=0;j<=around;j++){
    const t=ring/rings,segment=j/around*nb,lo=Math.floor(segment),fraction=segment-lo,pa=rimPoint(a,lo/nb*Math.PI*2),pb=rimPoint(a,Math.min(nb,lo+1)/nb*Math.PI*2);
    const r=T.MathUtils.lerp(shape.center,T.MathUtils.lerp(pa.r,pb.r,fraction),t),y=T.MathUtils.lerp(centerY,T.MathUtils.lerp(pa.y,pb.y,fraction),t);
    const u=.5+(r-shape.center)/(shape.width*2.1),v=(y-.055)/(shape.height+.065);
    const variant=(this.id*2+(side>0?1:0))%4;
    const cavity=crumbCavity(u,v,variant,true),edge=1-T.MathUtils.smoothstep(t,.82,1);
    const inset=-side*edge*(cavity*(.042+.037*noise(u*8+variant*9,v*8))+.003*noise(u*25,v*25));
    p.push(Math.cos(a)*r-Math.sin(a)*inset-this.home.x,y,Math.sin(a)*r+Math.cos(a)*inset-this.home.z);uv.push((variant+T.MathUtils.clamp(u,.005,.995))/4,T.MathUtils.clamp(v,.005,.995));
    if(ring<rings&&j<around){const k=ring*(around+1)+j;if(side<0)indices.push(k,k+1,k+around+1,k+1,k+around+2,k+around+1);else indices.push(k,k+around+1,k+1,k+1,k+around+1,k+around+2);}
   }
   const cut=this.addMesh(p,uv,indices,this.materials.crumb);cut.name='Airy crumb';
  }
 }
 private leaves(){
  if(![0,2,4].includes(this.id))return;
  const seed=this.id*17+2,r=.16+rand(seed)*.13,a=this.theta+(rand(seed+1)-.5)*.48,positions:number[]=[],indices:number[]=[],uv:number[]=[],colors:number[]=[];
  for(let j=0;j<=16;j++)for(let side=0;side<5;side++){
   const t=j/16,cross=(side-2)/2,x=cross*Math.sin(t*Math.PI)*(.14+.015*Math.sin(t*5)),z=t*.53-.265;
   const ridge=(1-Math.abs(cross))*.028*Math.sin(t*Math.PI),y=.027*Math.sin(t*Math.PI)+ridge+.014*Math.sin(t*6+cross);
   positions.push(x,y,z);uv.push(side/4,t);const c=.66+rand(j*3+side+seed)*.20;colors.push(c,.85+rand(j+seed)*.13,c*.64);
   if(j<16&&side<4){const n=j*5+side;indices.push(n,n+5,n+1,n+1,n+5,n+6);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('sssThickness',new T.BufferAttribute(new Float32Array(positions.length/3).fill(.12),1));g.setIndex(indices);g.computeVertexNormals();
  const leaf=new T.Mesh(g,this.materials.basil);leaf.name='Basil';const x=Math.cos(a)*r,z=Math.sin(a)*r;leaf.position.set(x-this.home.x,cheeseHeight(x,z)+.015,z-this.home.z);leaf.rotation.y=rand(seed+2)*6;leaf.rotation.z=(rand(seed+3)-.5)*.35;leaf.rotation.x=(rand(seed+4)-.5)*.3;leaf.scale.set(.85+rand(seed+5)*.3,1,.85+rand(seed+6)*.3);this.group.add(leaf);this.toppings.push({mesh:leaf,base:leaf.position.clone(),rotation:leaf.quaternion.clone(),binding:this.cloth.bind(leaf.position.x,leaf.position.z)});
 }
 deformation(x:number,z:number){sample.set(x,DOUGH_NEUTRAL,z);return this.cloth.deform(sample,deformed).y-DOUGH_NEUTRAL;}
 updateGeometry(onlyCheese=false,alpha=1){
  this.cloth.prepareRender(alpha);
  for(const surface of this.deformables){
   const {mesh,base,bindings}=surface,cheeseSurface=mesh.material===this.materials.cheese;
   if(onlyCheese&&!cheeseSurface)continue;
   const activeNecks=cheeseSurface?this.cheeseNecks.filter(n=>n.amount!==0):[];
   if(onlyCheese&&!this.surfaceDirty&&!activeNecks.length&&!surface.hadNeck&&!this.cloth.active)continue;
   surface.hadNeck=activeNecks.length>0;
   const p=mesh.geometry.getAttribute('position') as T.BufferAttribute;
   for(let i=0;i<base.length/3;i++){sample.fromArray(base,i*3);this.cloth.deformRender(sample,deformed,bindings[i]);p.setXYZ(i,deformed.x,deformed.y,deformed.z);}
   // Material-space influence is invariant during a pull. Cache sparse weights
   // once, rather than scanning every cheese vertex against every neck each frame.
   for(const neck of activeNecks){
    const cache=surface.neckInfluences??=new WeakMap<object,Float32Array>();let weights=cache.get(neck);
    if(!weights){const entries:number[]=[];for(let i=0;i<base.length/3;i++){
     const x=base[i*3],y=base[i*3+1],z=base[i*3+2],d=(x-neck.local.x)**2+(z-neck.local.z)**2;
     if(d>=neck.width*neck.width*5)continue;
     const height=y-CHEESE_BOTTOM-shoulderHeight(x+this.home.x,z+this.home.z);
     if(height>.001)entries.push(i,Math.exp(-d/(neck.width*neck.width))*Math.min(1,height/.018));
    }weights=new Float32Array(entries);cache.set(neck,weights);}
    for(let j=0;j<weights.length;j+=2){const i=weights[j],weight=weights[j+1]*neck.amount;p.setXYZ(i,p.getX(i)+neck.direction.x*weight,p.getY(i)+neck.direction.y*weight,p.getZ(i)+neck.direction.z*weight);}
   }
   p.needsUpdate=true;updateNormals(mesh.geometry);mesh.geometry.computeBoundingSphere();
  }
  this.surfaceDirty=false;
  for(const {mesh,base,rotation,binding} of this.toppings){this.cloth.deform(base,mesh.position,binding,alpha);this.cloth.surfaceNormal(binding,sample,alpha);mesh.quaternion.setFromUnitVectors(va.set(0,1,0),sample).multiply(rotation);}
 }
 /** Ray hits on folded dough must recover material coordinates, not subtract a height. */
 restPoint(hit:T.Intersection,out:T.Vector3){
  const surface=this.deformables.find(d=>d.mesh===hit.object),face=hit.face;
  if(surface&&face&&Math.max(face.a,face.b,face.c)<surface.base.length/3){sample.copy(hit.point);hit.object.worldToLocal(sample);const p=surface.mesh.geometry.attributes.position;
   va.fromBufferAttribute(p,face.a);vb.fromBufferAttribute(p,face.b);vc.fromBufferAttribute(p,face.c);T.Triangle.getBarycoord(sample,va,vb,vc,bary);
   va.fromArray(surface.base,face.a*3);vb.fromArray(surface.base,face.b*3);vc.fromArray(surface.base,face.c*3);return out.set(0,0,0).addScaledVector(va,bary.x).addScaledVector(vb,bary.y).addScaledVector(vc,bary.z);
  }
  const topping=this.toppings.find(t=>t.mesh===hit.object);if(topping)return out.copy(topping.base);
  return this.group.worldToLocal(out.copy(hit.point));
 }
 localAnchor(side:number,r:number){const a=cutAngle(this.theta+side*(this.halfAngle-.014),r),x=Math.cos(a)*r,z=Math.sin(a)*r;return new T.Vector3(x-this.home.x,cheeseHeight(x,z),z-this.home.z);}
 worldPoint(local:T.Vector3,out:T.Vector3){this.cloth.deform(local,out);return out.applyQuaternion(this.group.quaternion).add(this.group.position);}
 reset(){this.sleeping=false;this.sleepTime=0;this.cloth.reset();this.group.position.copy(this.home);this.group.quaternion.identity();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.bend=this.bendVelocity=this.twist=this.twistVelocity=0;this.previousVelocity.set(0,0,0);this.detached=this.held=this.hasCheese=false;this.updateGeometry();}
}

/** Average resting normals at matching world-space cut vertices. The render meshes
 * remain independent; only the joined resting appearance is smoothed. Once a slice
 * moves its geometry updates its own normals and the physical cut becomes visible. */
export function weldSliceSeamNormals(slices:PizzaSlice[]){
 type Group={slice:PizzaSlice,mesh:T.Mesh,indices:number[],sum:T.Vector3,count:number,matrix:T.Matrix3};
 const buckets=new Map<string,Map<PizzaSlice,Group>>(),point=new T.Vector3(),normal=new T.Vector3();
 for(const slice of slices){if(slice.detached||slice.group.position.distanceToSquared(slice.home)>1e-8)continue;slice.group.updateMatrixWorld(true);
  for(const surface of slice.deformables){const mesh=surface.mesh,position=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');if(!position||!normals)continue;mesh.updateMatrixWorld(true);const materials=Array.isArray(mesh.material)?mesh.material.map(m=>m.uuid).sort().join(','):mesh.material.uuid,matrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
   for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);if(Math.hypot(point.x,point.z)<.08)continue;
    const key=`${materials}:${Math.round(point.x*10000)},${Math.round(point.y*10000)},${Math.round(point.z*10000)}`;
    let bySlice=buckets.get(key);if(!bySlice)buckets.set(key,bySlice=new Map());let group=bySlice.get(slice);
    if(!group){group={slice,mesh,indices:[],sum:new T.Vector3(),count:0,matrix};bySlice.set(slice,group);}
    normal.fromBufferAttribute(normals,i).applyMatrix3(matrix).normalize();group.sum.add(normal);group.count++;group.indices.push(i);
   }
  }
 }
 for(const bySlice of buckets.values()){
  if(bySlice.size<2)continue;const average=new T.Vector3();for(const group of bySlice.values())average.add(group.sum.clone().normalize());average.normalize();
  for(const group of bySlice.values()){const local=average.clone().applyMatrix3(group.matrix.clone().invert()).normalize(),attribute=group.mesh.geometry.getAttribute('normal');for(const index of group.indices)attribute.setXYZ(index,local.x,local.y,local.z);attribute.needsUpdate=true;}
 }
}
