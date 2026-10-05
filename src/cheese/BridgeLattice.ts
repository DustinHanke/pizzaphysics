import * as T from 'three';
import type {PizzaSlice} from '../pizza/PizzaSlice';
import type {CollisionWorld} from '../physics/CollisionWorld';

/** Small damped 3×10 surface proxy. The existing strand remains the tension spine. */
export class BridgeLattice {
 readonly points=Array.from({length:30},()=>new T.Vector3());
 private previous=this.points.map(()=>new T.Vector3());
 private goals=this.points.map(()=>new T.Vector3());
 private corners=Array.from({length:4},()=>new T.Vector3());
 private center=new T.Vector3();private offset=new T.Vector3();private delta=new T.Vector3();
 private a=new T.Vector3();private b=new T.Vector3();private initialized=false;
 constructor(private owners:[PizzaSlice,PizzaSlice],private anchors:T.Vector3[]){}
 step(dt:number,spine:T.CatmullRomCurve3,collisions?:CollisionWorld){
  for(let i=0;i<4;i++)this.owners[i<2?0:1].worldPoint(this.anchors[i],this.corners[i]);
  for(let row=0;row<10;row++){
   const t=row/9;spine.getPoint(t,this.center);
   for(let col=0;col<3;col++){
    const u=col/2,id=row*3+col;
    this.a.copy(this.corners[0]).lerp(this.corners[1],u);this.b.copy(this.corners[2]).lerp(this.corners[3],u);
    this.offset.copy(this.corners[0]).lerp(this.corners[1],.5).lerp(this.b.copy(this.corners[2]).lerp(this.corners[3],.5),t);
    this.b.copy(this.corners[2]).lerp(this.corners[3],u);
    this.goals[id].copy(this.a).lerp(this.b,t).sub(this.offset).add(this.center);
    const p=this.points[id],old=this.previous[id];
    if(!this.initialized||row===0||row===9){p.copy(this.goals[id]);old.copy(p);}
    else {this.delta.subVectors(p,old).multiplyScalar(Math.exp(-dt*12));old.copy(p);p.add(this.delta);p.y-=dt*dt*3.4;}
   }
  }
  this.initialized=true;
  const constrain=(i:number,j:number,strength:number)=>{
   this.delta.subVectors(this.points[j],this.points[i]);const length=this.delta.length(),rest=this.goals[i].distanceTo(this.goals[j]);if(length<1e-7)return;
   const wi=i<3||i>=27?0:1,wj=j<3||j>=27?0:1;if(!wi&&!wj)return;
   this.delta.multiplyScalar((length-rest)/length*strength/(wi+wj));if(wi)this.points[i].add(this.delta);if(wj)this.points[j].sub(this.delta);
  };
  for(let iteration=0;iteration<5;iteration++){
   for(let row=0;row<10;row++)for(let col=0;col<3;col++){
    const id=row*3+col;if(col<2)constrain(id,id+1,.65);if(row<9)constrain(id,id+3,.55);
    if(row<8)constrain(id,id+6,.09);if(row<9&&col<2)constrain(id,id+4,.12);
   }
   // Compliant coupling to the viscous spine keeps the sheet from fluttering.
   for(let i=3;i<27;i++)this.points[i].lerp(this.goals[i],.045);
  }
  for(let i=3;i<27;i++){
   if(collisions)collisions.resolveParticle(this.points[i],this.previous[i],.004);
   // Bound local deviation; carry projection into history without adding energy.
   this.delta.subVectors(this.points[i],this.goals[i]);if(this.delta.lengthSq()>.0225){this.a.copy(this.points[i]);this.points[i].copy(this.goals[i]).add(this.delta.clampLength(0,.15));this.previous[i].add(this.a.sub(this.points[i]).negate());}
  }
 }
 sample(u:number,t:number,out:T.Vector3){
  const y=T.MathUtils.clamp(t,0,1)*9,row=Math.min(8,Math.floor(y)),x=T.MathUtils.clamp(u,0,1)*2,col=Math.min(1,Math.floor(x));
  this.a.copy(this.points[row*3+col]).lerp(this.points[row*3+col+1],x-col);
  this.b.copy(this.points[(row+1)*3+col]).lerp(this.points[(row+1)*3+col+1],x-col);
  return out.copy(this.a).lerp(this.b,y-row);
 }
}
