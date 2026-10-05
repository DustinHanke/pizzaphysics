import * as T from 'three';
import { PizzaSlice, SLICE_COUNT, type MozzarellaExtrusion } from '../pizza/PizzaSlice';
import { rand } from '../pizza/materials';
import { cheeseField,CHEESE_EDGE,getMozzarellaAmount } from '../pizza/surface';
import { params, warmth, reducedMotion } from '../presets/presets';
import { BridgeLattice } from './BridgeLattice';
import { CheeseRenderer } from './CheeseRenderer';
import { CheeseWeb } from './CheeseWeb';
import type {CollisionWorld} from '../physics/CollisionWorld';
const anchorInverse=new T.Quaternion();
const COUNT=10,delta=new T.Vector3(),temp=new T.Vector3(),midpoint=new T.Vector3(),unprojected=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
export class CheeseStrand {
 points:T.Vector3[]=[];previous:T.Vector3[]=[];renders:CheeseRenderer[]=[];midA=new T.Vector3();midB=new T.Vector3();curve:T.CatmullRomCurve3;lattice?:BridgeLattice;extrusion?:MozzarellaExtrusion;
 neckA:{local:T.Vector3,direction:T.Vector3,amount:number,width:number};neckB:{local:T.Vector3,direction:T.Vector3,amount:number,width:number};
 localA:T.Vector3;localB:T.Vector3;restLength:number;threshold:number;radius:number;thicknessStrength=1;rendered=false;broken=false;age=0;length=0;stretch=1;segmentRest=.055;neck=0;load=1;damage=0;yieldLength=0;hardLimit=0;breakIndex=4;amountStrength=1;time=0;
 constructor(public moving:PizzaSlice,public neighbor:PizzaSlice,public side:number,public r:number,public seed:number,scene:T.Scene,material:T.MeshPhysicalMaterial,public primary=false){
  this.amountStrength=.82+.18*Math.sqrt(getMozzarellaAmount()/100);
  this.localA=moving.localAnchor(side,r);this.localB=neighbor.localAnchor(-side,r);
  this.restLength=primary?.035+rand(seed+1)*.045:.025+rand(seed+1)*.040;this.threshold=(.78+rand(seed+2)*.48)*(primary?1.3:.68);
  // Secondary connections carry the medium-width work: broader than wisps,
  // with enough variation that each mozzarella-rich pull forms dense clusters.
  this.radius=primary?.006+Math.pow(rand(seed+3),1.7)*.009:.0025+Math.pow(rand(seed+3),1.45)*.005;
  this.thicknessStrength=T.MathUtils.clamp(Math.sqrt(this.radius/(primary?.07:.02)),.48,1.22);
  const lateral=new T.Vector3(.38+rand(seed+12)*.9,0,-.3+rand(seed+13)*.8).normalize(),sag=.055+rand(seed+14)*.17;
  moving.worldPoint(this.localA,a);neighbor.worldPoint(this.localB,b);
  for(let i=0;i<COUNT;i++){const t=i/(COUNT-1),p=a.clone().lerp(b,t),arch=Math.sin(t*Math.PI);p.y-=arch*sag;p.addScaledVector(lateral,arch*(rand(seed+15)-.5)*.20);this.points.push(p);this.previous.push(p.clone());}
  this.curve=new T.CatmullRomCurve3(this.points,false,'centripetal');this.breakIndex=2+Math.floor(rand(seed+19)*5);this.midA.copy(this.points[this.breakIndex]);this.midB.copy(this.points[this.breakIndex+1]);
  if(primary)this.extrusion=moving.createMozzarellaExtrusion(neighbor,side,r,seed);
  if(primary&&!this.extrusion)this.primary=false; // Occupied roots can only add secondary fibers.
  if(this.extrusion){this.thicknessStrength=.82+.08*Math.min(4,this.extrusion.lanes.length);moving.mozzarellaAnchor(this.extrusion.source,this.localA);neighbor.mozzarellaAnchor(this.extrusion.target,this.localB);moving.worldPoint(this.localA,a);neighbor.worldPoint(this.localB,b);for(let i=0;i<COUNT;i++){const t=i/(COUNT-1),p=a.clone().lerp(b,t),arch=Math.sin(t*Math.PI);p.y-=arch*sag;this.points[i].copy(p);this.previous[i].copy(p);}}
  if(this.extrusion){const ex=this.extrusion,anchors=[new T.Vector3(),new T.Vector3(),new T.Vector3(),new T.Vector3()];moving.mozzarellaAnchor([ex.source[0]],anchors[0]);moving.mozzarellaAnchor([ex.source[ex.source.length-1]],anchors[1]);neighbor.mozzarellaAnchor([ex.target[0]],anchors[2]);neighbor.mozzarellaAnchor([ex.target[ex.target.length-1]],anchors[3]);this.lattice=new BridgeLattice([moving,neighbor],anchors);this.lattice.step(1/120,this.curve);ex.sampleSurface=(u,t,out)=>this.lattice!.sample(u,t,out);}
  this.neckA={local:this.localA,direction:new T.Vector3(),amount:0,width:primary?.15:.08};this.neckB={local:this.localB,direction:new T.Vector3(),amount:0,width:primary?.15:.08};moving.cheeseNecks.push(this.neckA);neighbor.cheeseNecks.push(this.neckB);
  const uvA=new T.Vector2(.5+(moving.home.x+this.localA.x)/5.3,.5+(moving.home.z+this.localA.z)/5.3),uvB=new T.Vector2(.5+(neighbor.home.x+this.localB.x)/5.3,.5+(neighbor.home.z+this.localB.z)/5.3);
  if(!this.extrusion)this.renders.push(new CheeseRenderer(scene,material,this.points,[uvA,uvB]));
 }
 update(dt:number,collisions?:CollisionWorld){
  this.time+=dt;
  this.moving.worldPoint(this.localA,a);this.neighbor.worldPoint(this.localB,b);
  const distance=a.distanceTo(b);this.length=distance;this.stretch=Math.max(1,distance/this.restLength);
  // Yield is time-dependent; an absolute material limit prevents immortal cables.
  const material=(.62+params.stretch*.006)*(.66+warmth()*.46)*(.76+params.strength*.004);
  this.hardLimit=(this.primary?2.35+rand(this.seed+2)*1.10:.85+rand(this.seed+2)*.70)*material*this.amountStrength*this.thicknessStrength/Math.pow(this.load,.32);
  this.yieldLength=this.hardLimit*(this.primary?.68:.54);
  const excess=Math.max(0,(distance-this.yieldLength)/Math.max(.1,this.hardLimit-this.yieldLength));
  const speed=this.moving.velocity.length();
  if(!this.broken)this.damage+=dt*excess*excess*(this.primary?.72:2.3)*(1+Math.max(0,speed-2)*.055);
  this.neck=T.MathUtils.clamp(Math.max(this.damage,T.MathUtils.smoothstep(distance/this.hardLimit,.65,1)),0,1);
  if(!this.broken&&(this.damage>=1||distance>=this.hardLimit)){this.broken=true;this.age=0;}
  if(this.broken){this.age+=dt;if(this.age>1.3){this.neckA.amount=this.neckB.amount=0;return;}}
  const draw=this.extrusion?0:T.MathUtils.smoothstep(distance,.006,.085)*(this.broken?Math.max(0,1-this.age/.6):1)*(this.primary?.012:.005);temp.copy(b).sub(a).normalize();
  this.neckA.direction.copy(temp).applyQuaternion(anchorInverse.copy(this.moving.group.quaternion).invert());this.neckB.direction.copy(temp).negate().applyQuaternion(anchorInverse.copy(this.neighbor.group.quaternion).invert());this.neckA.amount=this.neckB.amount=draw;
  a.addScaledVector(temp,draw);b.addScaledVector(temp,-draw);
  const drag=(this.broken?.925:reducedMotion.matches?.92:.98)-params.viscosity*.00035;
  for(let i=1;i<COUNT-1;i++){
   const p=this.points[i],old=this.previous[i];delta.copy(p).sub(old).multiplyScalar(drag);old.copy(p);p.add(delta);p.y-=dt*dt*(params.gravity/65)*6.8;
  }
  // Viscoelastic rest-length adaptation provides extensibility; XPBD-style relaxation
  // distributes the remaining strain over a fixed set of particles.
  const desired=Math.max(this.restLength/(COUNT-1),distance/(COUNT-1)*(1.04+(.025*params.viscosity/100)/this.stretch));
  if(!this.broken)this.segmentRest=T.MathUtils.lerp(this.segmentRest,desired,Math.min(1,dt*(21-params.viscosity*.12)));
  const rest=this.broken?Math.max(.008,this.segmentRest*(.05+.95*Math.exp(-this.age*9))):this.segmentRest,stiffness=this.broken?.54:.62;
  for(let pass=0;pass<7;pass++){
   this.points[0].copy(a);this.points[COUNT-1].copy(b);
   for(let i=0;i<COUNT-1;i++){
    if(this.broken&&i===this.breakIndex)continue;
    const p=this.points[i],n=this.points[i+1];delta.copy(n).sub(p);const d=delta.length();if(d<1e-7)continue;
    const w0=i===0?0:1,w1=i+1===COUNT-1?0:1;delta.multiplyScalar((d-rest)/d*stiffness/(w0+w1));if(w0)p.add(delta);if(w1)n.sub(delta);
   }
   for(let i=1;i<COUNT-1;i++){this.points[i].y=Math.max(.052,this.points[i].y);if(collisions&&pass>=5)collisions.resolveParticle(this.points[i],this.previous[i],Math.max(.006,this.radius/Math.sqrt(this.stretch)*.6));}
  }
  this.points[0].copy(a);this.points[COUNT-1].copy(b);
  if(collisions)for(let i=0;i<COUNT-1;i++){
   if(this.broken&&i===this.breakIndex)continue;midpoint.copy(this.points[i]).lerp(this.points[i+1],.5);unprojected.copy(midpoint);collisions.resolveParticle(midpoint,undefined,Math.max(.005,this.radius/Math.sqrt(this.stretch)*.45));delta.copy(midpoint).sub(unprojected).clampLength(0,.08);const scale=i===0||i===COUNT-2?2:1;
   if(i>0){this.points[i].addScaledVector(delta,scale);this.previous[i].addScaledVector(delta,scale*.8);}if(i+1<COUNT-1){this.points[i+1].addScaledVector(delta,scale);this.previous[i+1].addScaledVector(delta,scale*.8);}
  }
  if(!this.broken)this.lattice?.step(dt,this.curve,collisions);
  if(!this.broken&&distance>.35){
   const resistance=Math.min(.12,Math.max(0,distance-.35)*.12)*(.3+params.strength/100)*(this.primary?1:.24);
   temp.copy(b).sub(a).normalize().multiplyScalar(resistance);this.moving.cloth.applyForce(this.localA,temp,dt);
   if(this.neighbor.detached){temp.negate();this.neighbor.cloth.applyForce(this.localB,temp,dt);}
  }
 }
 sample(t:number,out:T.Vector3){return this.curve.getPoint(t,out);}
 sampleUV(t:number,out:T.Vector2){return out.set(T.MathUtils.lerp(.5+(this.moving.home.x+this.localA.x)/5.3,.5+(this.neighbor.home.x+this.localB.x)/5.3,t),T.MathUtils.lerp(.5+(this.moving.home.z+this.localA.z)/5.3,.5+(this.neighbor.home.z+this.localB.z)/5.3,t));}
 render(){
  this.rendered=true;
  if(this.broken){this.midA.copy(this.points[this.breakIndex]);this.midB.copy(this.points[this.breakIndex+1]);}else{this.midA.copy(this.points[this.breakIndex]).lerp(this.points[this.breakIndex+1],.5);this.midB.copy(this.midA);}
  const fade=this.broken?Math.max(0,1-Math.max(0,this.age-.2)/1.4):1;
  // Delay the shift to hairlines until the pull is genuinely long. The older
  // inverse-square-root response made ordinary 5–10 cm pulls look threadbare.
  const visualStretch=1+Math.max(0,this.stretch-1)*.42;
  const radius=Math.max(this.primary?.0012:.0007,this.radius/Math.pow(visualStretch,.80))*fade;
  const rootRadius=radius*(1.48+.22*(1-this.neck));
  if(this.extrusion)this.moving.updateMozzarellaExtrusion(this.extrusion,this.curve,{length:this.length,limit:this.hardLimit,neck:this.neck,broken:this.broken,age:this.age,time:this.time,breakPoint:(this.breakIndex+.5)/(COUNT-1)});
  else if(this.renders[0]){this.renders[0].setVisible(fade>.01);if(fade>.01)this.renders[0].update(radius,this.broken?.94:0,rootRadius,.10+rand(this.seed+7)*.10,true,this.neck,(this.breakIndex+.5)/(COUNT-1));}
 }
 dispose(){this.renders.forEach(r=>r.dispose());if(this.extrusion)this.moving.releaseMozzarellaExtrusion(this.extrusion);this.moving.cheeseNecks.splice(this.moving.cheeseNecks.indexOf(this.neckA),1);this.neighbor.cheeseNecks.splice(this.neighbor.cheeseNecks.indexOf(this.neckB),1);this.moving.surfaceDirty=this.neighbor.surfaceDirty=true;}
}
export class CheeseSystem {
 collisions?:CollisionWorld;
 strands:CheeseStrand[]=[];webs:CheeseWeb[]=[];initial=0;failures=0; pulls=0;private renderTick=0;
 constructor(public slices:PizzaSlice[],public scene:T.Scene,public material:T.MeshPhysicalMaterial){}
 spawn(slice:PizzaSlice){
  slice.hasCheese=true;const seed=slice.id*173+(++this.pulls)*997,created:CheeseStrand[]=[];
  const amount=getMozzarellaAmount()/100;if(amount===0)return;
  // An existing bridge already follows both slices. Grabbing its neighbor
  // must not create a second full cheese network on the same physical cut.
  const availableSides=[-1,1].filter(side=>{const neighbor=this.slices[(slice.id+side+SLICE_COUNT)%SLICE_COUNT];return !this.strands.some(s=>!s.broken&&((s.moving===slice&&s.neighbor===neighbor)||(s.moving===neighbor&&s.neighbor===slice)));});
  // One solver chain per contiguous covered region, never one per sampling point.
  // The render extension resolves it into 2–5 paths independent of sampling density.
  for(const side of availableSides){
   const neighbor=this.slices[(slice.id+side+SLICE_COUNT)%SLICE_COUNT];
   for(const region of slice.mozzarellaIntervals(side)){
    const r=(region.r0+region.r1)*.5,other=neighbor.mozzarellaIntervals(-side).find(p=>r>=p.r0&&r<=p.r1);
    if(!other)continue;
    const localA=slice.localAnchor(side,r),localB=neighbor.localAnchor(-side,r);
    if(Math.min(cheeseField(localA.x+slice.home.x,localA.z+slice.home.z),cheeseField(localB.x+neighbor.home.x,localB.z+neighbor.home.z))<CHEESE_EDGE)continue;
    slice.worldPoint(localA,a);neighbor.worldPoint(localB,b);if(a.distanceTo(b)>.85)continue;
    const strand=new CheeseStrand(slice,neighbor,side,r,seed+created.length*61,this.scene,this.material,true);
    if(!strand.extrusion){strand.dispose();continue;}
    this.strands.push(strand);created.push(strand);this.initial++;
   }
  }

 }
 beginPull(slice:PizzaSlice){if(slice.group.position.distanceTo(slice.home)<.42&&!this.strands.some(s=>s.moving===slice&&!s.broken))slice.hasCheese=false;}
 update(dt:number){
  for(const slice of this.slices)if(slice.detached&&!slice.hasCheese&&slice.group.position.distanceTo(slice.home)>.075)this.spawn(slice);
  for(let i=this.strands.length-1;i>=0;i--){const s=this.strands[i],was=s.broken;s.update(dt,this.collisions);if(!was&&s.broken){this.failures++;for(const survivor of this.strands)if(survivor!==s&&survivor.moving===s.moving&&!survivor.broken)survivor.load+=.09;}if(s.broken&&s.age>1.65){s.dispose();this.strands.splice(i,1);}}
  for(let i=this.webs.length-1;i>=0;i--){const web=this.webs[i],was=web.broken;web.update(dt,this.collisions);if(!was&&web.broken)this.failures++;if(web.broken&&web.age>.75){web.dispose();this.webs.splice(i,1);}}
  this.selfContact();
  if(this.collisions)for(const s of this.strands)for(let i=1;i<COUNT-1;i++)this.collisions.resolveParticle(s.points[i],s.previous[i],Math.max(.003,s.radius/Math.sqrt(s.stretch)*.45));
 }
 // Soft self-contact between separate particle chains; excludes fixed roots.
 private contactBounds=new WeakMap<object,T.Box3>();
 private bounds(chain:{points:T.Vector3[]}){let box=this.contactBounds.get(chain);if(!box){box=new T.Box3();this.contactBounds.set(chain,box);}return box;}
 private nearby(x:T.Box3,y:T.Box3,r:number){return x.min.x<=y.max.x+r&&x.max.x>=y.min.x-r&&x.min.y<=y.max.y+r&&x.max.y>=y.min.y-r&&x.min.z<=y.max.z+r&&x.max.z>=y.min.z-r;}
 private selfContact(){
  for(const chain of this.strands)this.bounds(chain).setFromPoints(chain.points);for(const chain of this.webs)this.bounds(chain).setFromPoints(chain.points);
  for(let i=0;i<this.strands.length;i++)for(let j=i+1;j<this.strands.length;j++){
   const x=this.strands[i],y=this.strands[j],radius=Math.max(.003,(x.radius/Math.sqrt(x.stretch)+y.radius/Math.sqrt(y.stretch))*.45);
   const xb=this.bounds(x),yb=this.bounds(y);if(!this.nearby(xb,yb,radius))continue;
   for(let a=2;a<COUNT-2;a++)for(let b=2;b<COUNT-2;b++){delta.copy(x.points[a]).sub(y.points[b]);const d=delta.lengthSq();if(d<radius*radius&&d>1e-10){delta.multiplyScalar((radius/Math.sqrt(d)-1)*.35);x.points[a].add(delta);y.points[b].sub(delta);xb.expandByPoint(x.points[a]);yb.expandByPoint(y.points[b]);x.previous[a].addScaledVector(delta,.8);y.previous[b].addScaledVector(delta,-.8);}}
  }
  for(const web of this.webs)for(const strand of this.strands)if(strand!==web.left&&strand!==web.right){const radius=.008+strand.radius/Math.sqrt(strand.stretch)*.40;const wb=this.bounds(web),sb=this.bounds(strand);if(!this.nearby(wb,sb,radius))continue;for(let i=1;i<6;i++)for(let j=2;j<COUNT-2;j++){delta.copy(web.points[i]).sub(strand.points[j]);const d=delta.lengthSq();if(d>1e-10&&d<radius*radius){delta.multiplyScalar((radius/Math.sqrt(d)-1)*.45);web.points[i].add(delta);wb.expandByPoint(web.points[i]);web.previous[i].addScaledVector(delta,.8);}}}
 }
 render(camera?:T.PerspectiveCamera,viewportHeight=800){
  this.renderTick++;for(const s of this.strands){const pixelRadius=camera?s.radius/Math.sqrt(s.stretch)*viewportHeight/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(1,camera.position.distanceTo(s.points[4]))):Infinity;
   // Sub-pixel secondary fibers retain full physics, but need fewer buffer uploads.
   if(!s.primary&&!s.broken&&s.rendered&&pixelRadius<.7&&this.renderTick%2)continue;s.render();
  }for(const web of this.webs)web.render(this.collisions);CheeseRenderer.flush();
 }
 get metrics(){let count=0,length=0,stretch=0;for(const s of this.strands)if(!s.broken){count++;length=Math.max(length,s.length);stretch+=s.stretch;}for(const web of this.webs)if(!web.broken){count++;length=Math.max(length,web.length);stretch+=Math.max(1,web.length/web.restLength);}return{active:count,length:Math.round(length*60),stretch:count?Math.max(0,Math.round((stretch/count-1)*100)):0,integrity:this.initial?Math.round((this.initial-this.failures)/this.initial*100):100};}
 clear(){for(const s of this.strands)s.dispose();for(const w of this.webs)w.dispose();this.webs=[];this.strands=[];this.initial=this.failures=0;}
}
