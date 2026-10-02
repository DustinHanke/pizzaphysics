import * as T from 'three';
import {updateNormals} from '../performance/geometry';
import type { CheeseStrand } from './CheeseSystem';
import { CheeseRenderer } from './CheeseRenderer';
import { rand } from '../pizza/materials';
import type {CollisionWorld} from '../physics/CollisionWorld';
import {getMozzarellaAmount} from '../pizza/surface';
import { params } from '../presets/presets';
const ROWS=36,COLS=24;
const l=new T.Vector3(),r=new T.Vector3(),along=new T.Vector3(),across=new T.Vector3(),normal=new T.Vector3(),p=new T.Vector3(),q=new T.Vector3(),delta=new T.Vector3(),uvL=new T.Vector2(),uvR=new T.Vector2(),uvP=new T.Vector2();
/** Small, perforating mozzarella remnant. Its holes expand with local strand strain. */
export class CheeseMembrane {
 mesh:T.Mesh;positions:Float32Array;thicknesses:Float32Array;private indices:Uint16Array;private topologyBucket=-1;
 private coordinates:Float32Array;private uvs:Float32Array;private count:number;private holes:{u:number,v:number,rx:number,ry:number,phase:number,birth:number}[]=[];start:number;span:number;skew:number;tear=0;
 constructor(public left:CheeseStrand,public right:CheeseStrand,public reverse:boolean,public seed:number,scene:T.Scene,material:T.MeshPhysicalMaterial){
  this.start=.018+rand(seed+431)*.055;this.span=(.035+rand(seed+433)*.075)*(.86+.14*Math.sqrt(getMozzarellaAmount()/100));this.skew=(rand(seed+437)-.5)*.035;
  const coords:number[]=[];for(let i=0;i<=ROWS;i++)for(let j=0;j<=COLS;j++)coords.push(j/COLS,i/ROWS);this.coordinates=new Float32Array(coords);this.count=coords.length/2;
  const holeCount=5+Math.floor(rand(seed+319)*7);
  for(let i=0;i<holeCount;i++)this.holes.push({u:.13+rand(seed+i*11+1)*.74,v:.12+rand(seed+i*13+2)*.76,rx:.025+rand(seed+i*17+3)*.065,ry:.035+rand(seed+i*19+4)*.095,phase:rand(seed+i*23+5)*6.28,birth:rand(seed+i*29+6)*.56});
  this.positions=new Float32Array(this.count*2*3);this.thicknesses=new Float32Array(this.count*2);this.indices=new Uint16Array(ROWS*COLS*2*2*3);
  const uv=this.uvs=new Float32Array(this.count*2*2);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(this.positions.length),3).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.BufferAttribute(uv,2).setUsage(T.DynamicDrawUsage));g.setAttribute('sssThickness',new T.BufferAttribute(this.thicknesses,1).setUsage(T.DynamicDrawUsage));g.setIndex(new T.BufferAttribute(this.indices,1).setUsage(T.DynamicDrawUsage));
  this.mesh=new T.Mesh(g,material);this.mesh.name='Perforated mozzarella fragment';this.mesh.frustumCulled=false;this.mesh.castShadow=this.mesh.receiveShadow=true;this.mesh.renderOrder=2;scene.add(this.mesh);
 }
 private insideHole(u:number,v:number){for(const h of this.holes){const open=T.MathUtils.smoothstep(this.tear,h.birth,h.birth+.42),growth=.16+1.70*open,rx=h.rx*growth,ry=h.ry*growth,dx=(u-h.u)/rx,dy=(v-h.v)/ry,a=Math.atan2(dy,dx),edge=1+.20*Math.sin(a*3+h.phase)+.10*Math.sin(a*7-h.phase)+.045*Math.sin(a*11+h.phase*.7);if(Math.hypot(dx,dy)<edge)return true;}return false;}
 private rebuildTopology(){
  let k=0;const baseIndex=(a:number,b:number,c:number)=>{this.indices[k++]=a;this.indices[k++]=b;this.indices[k++]=c;};
  for(let i=0;i<ROWS;i++)for(let j=0;j<COLS;j++){
   const a=i*(COLS+1)+j,b=a+1,c=a+COLS+1,d=c+1;
   const tris=[[a,c,b],[b,c,d]];for(const tri of tris){const u=(this.coordinates[tri[0]*2]+this.coordinates[tri[1]*2]+this.coordinates[tri[2]*2])/3,v=(this.coordinates[tri[0]*2+1]+this.coordinates[tri[1]*2+1]+this.coordinates[tri[2]*2+1])/3,keep=!this.insideHole(u,v);
    if(keep){baseIndex(tri[0],tri[1],tri[2]);baseIndex(tri[0]+this.count,tri[2]+this.count,tri[1]+this.count);}else{baseIndex(tri[0],tri[0],tri[0]);baseIndex(tri[0]+this.count,tri[0]+this.count,tri[0]+this.count);}
   }
  }
  this.mesh.geometry.index!.needsUpdate=true;
 }
 render(fade:number,collisions?:CollisionWorld){
  this.mesh.visible=fade>.015;if(!this.mesh.visible)return;
  const stretch=Math.max(this.left.stretch,this.right.stretch),baseThickness=Math.max(.00018,.0012/Math.sqrt(stretch)),bucket=Math.floor(this.tear*14);
  if(bucket!==this.topologyBucket){this.topologyBucket=bucket;this.rebuildTopology();}
  for(let i=0;i<this.count;i++){
   const u=this.coordinates[i*2],v=this.coordinates[i*2+1],curve=.025*Math.sin(Math.PI*u)*(Math.pow(1-v,3)-Math.pow(v,3));
   const taper=1-.72*this.tear*T.MathUtils.smoothstep(v,.03,.78);const t=T.MathUtils.clamp(this.start+v*this.span*taper+curve,.006,.985),otherT=T.MathUtils.clamp(this.start+this.skew+v*this.span*taper*(.72+rand(this.seed+449)*.48)+curve,.006,.985);
   this.left.sample(t,l);this.right.sample(otherT,r);this.left.sample(T.MathUtils.clamp(t+.005,0,1),p);this.left.sample(T.MathUtils.clamp(t-.005,0,1),q);along.copy(p).sub(q);across.copy(r).sub(l);normal.crossVectors(along,across);
   if(normal.lengthSq()<1e-10)normal.set(0,1,0);else normal.normalize();
   // Pull inherited from both particle chains; thin film folds with their lag.
   const warp=u+Math.sin(Math.PI*u)*Math.sin(v*8+this.seed)*.09,acrossScale=1-.58*this.tear*T.MathUtils.smoothstep(v,.02,.72),pullU=.5+(warp-.5)*acrossScale;
   p.copy(l).lerp(r,pullU);const interior=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);this.left.sampleUV(t,uvL);this.right.sampleUV(otherT,uvR);uvP.copy(uvL).lerp(uvR,pullU);
   p.y-=interior*(.025+rand(this.seed+451)*.025)/Math.pow(stretch,.25);
   p.addScaledVector(normal,interior*.014*Math.sin(v*9+u*5+this.seed)/Math.sqrt(stretch));
   if(collisions)collisions.resolveParticle(p,undefined,baseThickness);
   const tearThin=1-.76*this.tear*T.MathUtils.smoothstep(v,.02,.72),rootFlare=.72+.48*Math.exp(-Math.min(u,1-u)*13),half=baseThickness*(.76+.20*Math.sin(u*13+v*19+this.seed)**2)*Math.max(.025,fade)*tearThin*rootFlare;
   for(let layer=0;layer<2;layer++){const n=layer*this.count+i,sign=layer===0?1:-1;this.positions[n*3]=p.x+normal.x*half*sign;this.positions[n*3+1]=p.y+normal.y*half*sign;this.positions[n*3+2]=p.z+normal.z*half*sign;this.thicknesses[n]=T.MathUtils.clamp(half/.13,.02,1);this.uvs[n*2]=uvP.x;this.uvs[n*2+1]=uvP.y;}
  }
  this.mesh.geometry.attributes.position.needsUpdate=true;this.mesh.geometry.attributes.uv.needsUpdate=true;this.mesh.geometry.attributes.sssThickness.needsUpdate=true;updateNormals(this.mesh.geometry);
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();}
}
/** Secondary diagonal filament and optional near-root sheets, sharing the strand motion. */
export class CheeseWeb {
 points=Array.from({length:7},()=>new T.Vector3());previous=Array.from({length:7},()=>new T.Vector3());renderer:CheeseRenderer;membranes:CheeseMembrane[]=[];
 broken=false;age=0;length=0;damage=0;tear=0;restLength:number;tLeft:number;tRight:number;
 constructor(public left:CheeseStrand,public right:CheeseStrand,public seed:number,sheets:boolean,scene:T.Scene,material:T.MeshPhysicalMaterial){
  this.tLeft=.10+rand(seed+2)*.54;this.tRight=T.MathUtils.clamp(this.tLeft+(rand(seed+3)-.5)*.15,.07,.88);left.sample(this.tLeft,l);right.sample(this.tRight,r);this.restLength=Math.max(.018,l.distanceTo(r)*(.76+rand(seed+6)*.20));
  for(let i=0;i<7;i++){const t=i/6;this.points[i].copy(l).lerp(r,t);this.points[i].y-=Math.sin(t*Math.PI)*(.065+rand(seed+29)*.085);this.points[i].x+=Math.sin(t*Math.PI)*(rand(seed+31)-.5)*.12;this.previous[i].copy(this.points[i]);}
  this.renderer=new CheeseRenderer(scene,material,this.points,[left.sampleUV(this.tLeft,uvL),right.sampleUV(this.tRight,uvR)]);this.renderer.mesh.name='Batched secondary mozzarella web';
  if(sheets){this.membranes.push(new CheeseMembrane(left,right,false,seed,scene,material));}
 }
 update(dt:number,collisions?:CollisionWorld){
  this.left.sample(this.tLeft,l);this.right.sample(this.tRight,r);this.length=l.distanceTo(r);
  const parentStrain=Math.max(this.left.stretch,this.right.stretch),yieldPoint=2.8+rand(this.seed+4)*.9;
  this.damage+=dt*Math.pow(Math.max(0,parentStrain-yieldPoint)*1.55,2)*.72;
  if(!this.broken&&(this.damage>=1||parentStrain>yieldPoint*1.55||this.left.broken&&this.right.broken||this.length>.46+rand(this.seed+5)*.22))this.broken=true;
  this.tear=Math.max(this.tear,T.MathUtils.smoothstep(Math.max(parentStrain,1),1.25,2.65));
  for(const membrane of this.membranes)membrane.tear=this.tear;
  if(this.broken)this.age+=dt;
  for(let i=1;i<6;i++){const point=this.points[i];delta.copy(point).sub(this.previous[i]).multiplyScalar(.95);this.previous[i].copy(point);point.add(delta);point.y-=dt*dt*2.8*(params.gravity/65);}
  const rest=Math.max(this.restLength/6,this.length/6*(1.035+.025*params.viscosity/100));
  for(let iteration=0;iteration<5;iteration++){
   this.points[0].copy(l);this.points[6].copy(r);
   for(let i=0;i<6;i++){delta.copy(this.points[i+1]).sub(this.points[i]);const distance=delta.length();if(distance<1e-7)continue;const w0=i===0?0:1,w1=i===5?0:1;delta.multiplyScalar((distance-rest)/distance*.68/(w0+w1));if(w0)this.points[i].add(delta);if(w1)this.points[i+1].sub(delta);}
   for(let i=1;i<6;i++){this.points[i].y=Math.max(.055,this.points[i].y);if(collisions&&iteration>=3)collisions.resolveParticle(this.points[i],this.previous[i],.009);}
  }
  this.points[0].copy(l);this.points[6].copy(r);
 }
 render(collisions?:CollisionWorld){
  const fade=this.broken?Math.max(0,1-this.age/.72):1;this.renderer.setVisible(fade>.015);
  if(fade>.015){const stretch=Math.max(1,this.length/this.restLength),visualStretch=1+Math.max(0,stretch-1)*.36,radius=Math.max(.0008,(.0022+Math.pow(rand(this.seed+7),1.35)*.0038)/Math.pow(visualStretch,.72))*fade;this.renderer.update(radius,.18,radius*1.58,.08+rand(this.seed+9)*.08,true,this.tear,(this.tLeft+this.tRight)*.5);}
  for(const membrane of this.membranes)membrane.render(fade,collisions);
 }
 dispose(){this.renderer.dispose();for(const m of this.membranes)m.dispose();}
}
