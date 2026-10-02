import * as T from 'three';
import {rand} from '../utils/noise';

const ROWS=28, ACROSS=3, LAYER=ROWS*ACROSS;
type Lane={source:[number,number],target:[number,number],first:number,limit:number,brokenAt:number,cut:number};
export type MozzarellaExtrusion={
 source:number[],target:number[],side:number,seed:number,active:boolean,lanes:Lane[],
 sampleTarget:(id:number,out:T.Vector3,bottom?:boolean)=>void,
 targetAttribute:(id:number,name:string,component:number)=>number,
 fragments?:[T.CatmullRomCurve3,T.CatmullRomCurve3],uvReady?:boolean,
 core:number[],holes:{center:number,span:number,width:number,phase:number}[],sourcePoints:T.Vector3[],targetPoints:T.Vector3[],
};
export type PullState={length:number,limit:number,neck:number,broken:boolean,age:number,time:number,breakPoint:number};

/** Extensions of one existing mozzarella mesh, sharing its root vertex IDs and material.
 * GPU buffers are replaced atomically on topology changes; never resized in place.
 * The original surface is retained verbatim and restored after the last extension.
 */
export class BoundaryExtrusions {
 readonly restCount:number;
 readonly baseIndex:number[];
 readonly pulls:MozzarellaExtrusion[]=[];
 private dirty=false;
 private rowCurves=new Float64Array(ROWS*6);
 private p=new T.Vector3();private a=new T.Vector3();private b=new T.Vector3();private c=new T.Vector3();private d=new T.Vector3();
 private center=new T.Vector3();private offset=new T.Vector3();private normal=new T.Vector3();private tangent=new T.Vector3();private before=new T.Vector3();private after=new T.Vector3();
 private srcCenter=new T.Vector3();private dstCenter=new T.Vector3();private targetLeft=new T.Vector3();private targetRight=new T.Vector3();
 private rootLeft=new T.Vector3();private rootRight=new T.Vector3();private farLeft=new T.Vector3();private farRight=new T.Vector3();
 private clump=new T.Vector3();private clumpNormal=new T.Vector3();
 private inv=new T.Matrix4();private normalMatrix=new T.Matrix3();
 constructor(readonly mesh:T.Mesh,readonly topCount:number){
  this.restCount=mesh.geometry.attributes.position.count;this.baseIndex=Array.from(mesh.geometry.index!.array);
 }
 add(source:number[],target:number[],side:number,seed:number,sampleTarget:MozzarellaExtrusion['sampleTarget'],targetAttribute:MozzarellaExtrusion['targetAttribute']):MozzarellaExtrusion|undefined{
  const occupied=new Set(this.pulls.flatMap(p=>p.lanes.map(l=>`${l.source[0]}:${l.source[1]}`)));
  const lanes:Lane[]=[];
  for(let i=0;i<Math.min(source.length,target.length)-1;i++){
   if(source[i]===source[i+1]||target[i]===target[i+1]||occupied.has(`${source[i]}:${source[i+1]}`))continue;
   lanes.push({source:[source[i],source[i+1]],target:[target[i],target[i+1]],first:0,limit:.76+rand(seed+i*47)*.24,brokenAt:-1,cut:9+Math.floor(rand(seed+i*31)*9)});
  }
  if(!lanes.length)return;
  // Keep anchors local to the exact selected contiguous source region.
  // Vary the material flow independently of the uniformly tessellated source edge.
  const hero=Math.floor(rand(seed+701)*lanes.length),weights=lanes.map((_,i)=>i===hero?2.4:.28+rand(seed+i*53+709)*1.05),sum=weights.reduce((a,b)=>a+b,0),core=[0];
  for(const width of weights)core.push(core[core.length-1]+width/sum);
  const holes=lanes.slice(1).map((_,i)=>({center:.25+rand(seed+i*59+719)*.50,span:.15+rand(seed+i*61+727)*.24,width:.72+rand(seed+i*67+733)*.25,phase:rand(seed+i*71+739)*6.28}));
  const pull:MozzarellaExtrusion={source:[...new Set(lanes.flatMap(l=>l.source))],target:[...new Set(lanes.flatMap(l=>l.target))],side,seed,active:true,lanes,sampleTarget,targetAttribute,core,holes,sourcePoints:[],targetPoints:[]};
  pull.sourcePoints=pull.source.map(()=>new T.Vector3());pull.targetPoints=pull.target.map(()=>new T.Vector3());
  this.pulls.push(pull);this.rebuild();return pull;
 }
 private boundary(points:T.Vector3[],u:number,out:T.Vector3){const f=T.MathUtils.clamp(u,0,1)*(points.length-1),lo=Math.min(points.length-2,Math.floor(f));return out.copy(points[lo]).lerp(points[lo+1],f-lo);}
 private flowEnvelope(t:number,opening:number){return 1-.42*opening*Math.pow(Math.sin(Math.PI*t),.85);}
 private flowBoundary(pull:MozzarellaExtrusion,k:number,t:number,opening:number){
  let value=pull.core[k];
  if(k>0&&k<pull.core.length-1){
   const span=Math.min(pull.core[k]-pull.core[k-1],pull.core[k+1]-pull.core[k]);
   value+=span*.04*Math.sin(t*8+pull.holes[k-1].phase)*Math.sin(Math.PI*t)*opening;
  }
  const sway=.035*Math.sin(t*7+pull.seed)*Math.sin(Math.PI*t)*opening;
  return .5+(value-.5)*this.flowEnvelope(t,opening)+sway;
 }
 private aperture(pull:MozzarellaExtrusion,k:number,t:number,opening:number){
  const hole=pull.holes[k];if(!hole)return 0;
  const span=hole.span*(.45+.55*opening),d=(t-hole.center)/span;
  // An enclosed lens, not a full-length slot: neighboring paths rejoin above/below it.
  return Math.sqrt(Math.max(0,1-d*d))*hole.width*opening;
 }
 private id(l:Lane,row:number,col:number,bottom=false){
  if(row===0)return l.source[col===2?1:0]+(bottom?this.topCount:0);
  return l.first+(bottom?LAYER:0)+(row-1)*ACROSS+col;
 }
 private rebuild(){
  const old=this.mesh.geometry,total=this.restCount+this.pulls.reduce((n,p)=>n+p.lanes.length*LAYER*2,0),g=new T.BufferGeometry();
  for(const [name,attr] of Object.entries(old.attributes)){
   const previous=attr as T.BufferAttribute,next=new Float32Array(total*attr.itemSize);next.set((attr.array as Float32Array).subarray(0,this.restCount*attr.itemSize));
   g.setAttribute(name,new T.BufferAttribute(next,attr.itemSize).setUsage(T.DynamicDrawUsage));
   let first=this.restCount;
   for(const p of this.pulls)for(const lane of p.lanes){
    if(lane.first>=this.restCount)next.set((previous.array as Float32Array).subarray(lane.first*attr.itemSize,(lane.first+2*LAYER)*attr.itemSize),first*attr.itemSize);
    else for(let layer=0;layer<2;layer++)for(let row=1;row<=ROWS;row++)for(let col=0;col<ACROSS;col++){
     const u=col/(ACROSS-1),a=lane.source[0]+layer*this.topCount,b=lane.source[1]+layer*this.topCount,id=first+layer*LAYER+(row-1)*ACROSS+col;
     for(let k=0;k<attr.itemSize;k++)next[id*attr.itemSize+k]=T.MathUtils.lerp(previous.array[a*attr.itemSize+k],previous.array[b*attr.itemSize+k],u);
    }
    first+=2*LAYER;
   }
  }
  let first=this.restCount;for(const pull of this.pulls)for(const lane of pull.lanes){lane.first=first;first+=2*LAYER;}
  this.mesh.geometry=g;this.reindex();g.computeBoundingSphere();
  // The base index template restores rest topology; release the old GPU allocation.
  old.dispose();
 }
 private reindex(){
  const removed=new Set<string>();for(const p of this.pulls)for(const l of p.lanes)removed.add([l.source[0],l.source[1]].sort((a,b)=>a-b).join(':'));
  const indices:number[]=[];
  for(let i=0;i<this.baseIndex.length;i+=3){
   const tri=this.baseIndex.slice(i,i+3),mixed=tri.some(n=>n<this.topCount)&&tri.some(n=>n>=this.topCount);
   const edge=[...new Set(tri.map(n=>n%this.topCount))].sort((a,b)=>a-b).join(':');
   if(!mixed||!removed.has(edge))indices.push(...tri);
  }
  this.mesh.geometry.userData.extrusionFaceStart=indices.length/3;
  for(const pull of this.pulls)for(const lane of pull.lanes){
   const tri=(a:number,b:number,c:number)=>{if(a!==b&&b!==c&&a!==c)indices.push(...(pull.side<0?[a,c,b]:[a,b,c]));};
   const quad=(a:number,b:number,c:number,d:number)=>{tri(a,c,b);tri(b,c,d);};
   for(let row=0;row<ROWS;row++){
    if(lane.brokenAt>=0&&row===lane.cut)continue;
    for(let col=0;col<ACROSS-1;col++){
     quad(this.id(lane,row,col),this.id(lane,row,col+1),this.id(lane,row+1,col),this.id(lane,row+1,col+1));
     quad(this.id(lane,row,col+1,true),this.id(lane,row,col,true),this.id(lane,row+1,col+1,true),this.id(lane,row+1,col,true));
    }
    for(const col of [0,ACROSS-1]){
     const a=this.id(lane,row,col),b=this.id(lane,row+1,col),c=this.id(lane,row,col,true),d=this.id(lane,row+1,col,true);
     if(col===0)quad(a,b,c,d);else quad(b,a,d,c);
    }
   }
   const cap=(row:number,reverse:boolean)=>{for(let col=0;col<ACROSS-1;col++){
    const a=this.id(lane,row,col),b=this.id(lane,row,col+1),c=this.id(lane,row,col,true),d=this.id(lane,row,col+1,true);
    if(reverse)quad(a,b,c,d);else quad(b,a,d,c);
   }};
   cap(ROWS,true);if(lane.brokenAt>=0){cap(lane.cut,true);cap(lane.cut+1,false);}
  }
  const g=this.mesh.geometry;
  if(!g.index)g.setIndex(new T.BufferAttribute(new Uint32Array(indices),1).setUsage(T.DynamicDrawUsage));
  else { (g.index.array as Uint32Array).fill(0);(g.index.array as Uint32Array).set(indices);g.index.needsUpdate=true; }
  g.setDrawRange(0,indices.length);this.dirty=false;
 }
 update(pull:MozzarellaExtrusion,curve:T.CatmullRomCurve3,state:PullState){
  if(!pull.active)return;
  this.mesh.updateWorldMatrix(true,false);this.inv.copy(this.mesh.matrixWorld).invert();this.normalMatrix.getNormalMatrix(this.inv);
  const g=this.mesh.geometry,pos=g.attributes.position,normal=g.attributes.normal,sss=g.attributes.sssThickness;
  // Correct endpoints without mutating the simulation's particles.
  const sourceCenter=this.srcCenter.set(0,0,0),targetCenter=this.dstCenter.set(0,0,0);
  for(let i=0;i<pull.source.length;i++)sourceCenter.add(pull.sourcePoints[i].fromBufferAttribute(pos,pull.source[i]).applyMatrix4(this.mesh.matrixWorld));sourceCenter.multiplyScalar(1/pull.source.length);
  for(let i=0;i<pull.target.length;i++){pull.sampleTarget(pull.target[i],pull.targetPoints[i]);targetCenter.add(pull.targetPoints[i]);}targetCenter.multiplyScalar(1/pull.target.length);
  if(state.broken&&!pull.fragments){
   const split=Math.round(state.breakPoint*(curve.points.length-1)-.5);
   pull.fragments=[new T.CatmullRomCurve3(curve.points.slice(0,split+1),false,'centripetal'),new T.CatmullRomCurve3(curve.points.slice(split+1),false,'centripetal')];
  }
  // Intact lanes share one centerline: sample it once, not three times per lane.
  for(let row=1;row<=ROWS;row++){const t=row/ROWS,k=(row-1)*6;curve.getPoint(t,this.center);curve.getPoint(Math.max(0,t-.008),this.before);curve.getPoint(Math.min(1,t+.008),this.after);this.tangent.copy(this.after).sub(this.before).normalize();this.center.toArray(this.rowCurves,k);this.tangent.toArray(this.rowCurves,k+3);}
  const relative=state.length/Math.max(.1,state.limit),perforation=T.MathUtils.smoothstep(state.length,.12,1.15);
  for(let laneIndex=0;laneIndex<pull.lanes.length;laneIndex++){
   const lane=pull.lanes[laneIndex];
   if(lane.brokenAt<0&&(state.broken||relative>lane.limit)){lane.brokenAt=state.time;this.dirty=true;}
   this.a.fromBufferAttribute(pos,lane.source[0]).applyMatrix4(this.mesh.matrixWorld);this.b.fromBufferAttribute(pos,lane.source[1]).applyMatrix4(this.mesh.matrixWorld);
   pull.sampleTarget(lane.target[0],this.c);pull.sampleTarget(lane.target[1],this.d);
   const tearAge=lane.brokenAt<0?0:Math.max(0,state.time-lane.brokenAt);
   const tip=(lane.cut+.5)/ROWS,neck=T.MathUtils.smoothstep(relative/lane.limit,.84,1);
   for(let row=1;row<=ROWS;row++){
    const t=row/ROWS,onLeft=row<=lane.cut,freeEnd=onLeft?lane.cut/ROWS:(lane.cut+1)/ROWS;
    let pathT=t;
    if(lane.brokenAt>=0){const recoil=(1-Math.exp(-tearAge*7))*.26;pathT=onLeft?t*(1-recoil):1-(1-t)*(1-recoil);}
    const fragment=pull.fragments?.[onLeft?0:1];
    const uPath=onLeft?Math.min(1,pathT/(lane.cut/ROWS)):Math.max(0,(pathT-(lane.cut+1)/ROWS)/(1-(lane.cut+1)/ROWS));
    if(lane.brokenAt<0){this.center.fromArray(this.rowCurves,(row-1)*6);this.tangent.fromArray(this.rowCurves,(row-1)*6+3);}else{
    if(fragment)fragment.getPoint(uPath,this.center);else curve.getPoint(pathT,this.center);
    (fragment??curve).getPoint(Math.max(0,(fragment?uPath:pathT)-.008),this.before);(fragment??curve).getPoint(Math.min(1,(fragment?uPath:pathT)+.008),this.after);this.tangent.copy(this.after).sub(this.before).normalize();
    }
    // Curve particles are sampled in world space, root offsets remain material-space coherent.
    this.center.addScaledVector(this.offset.copy(sourceCenter).sub(curve.points[0]),1-pathT).addScaledVector(this.offset.copy(targetCenter).sub(curve.points[curve.points.length-1]),pathT);

    this.offset.copy(this.b).sub(this.a).lerp(this.p.copy(this.d).sub(this.c),t);
    this.normal.crossVectors(this.tangent,this.offset).normalize();if(this.normal.lengthSq()<.1)this.normal.set(0,1,0);
    if(pull.side<0)this.normal.negate();this.normal.applyMatrix3(this.normalMatrix).normalize();
    const root=Math.min(1,Math.exp(-t*14)+Math.exp(-(1-t)*14));
    const morph=T.MathUtils.smoothstep(t,.015,.23)*T.MathUtils.smoothstep(1-t,.015,.23);
    const laneWidth=(pull.core[laneIndex+1]-pull.core[laneIndex])*this.flowEnvelope(t,perforation);
    const left=this.flowBoundary(pull,laneIndex,t,perforation)+this.aperture(pull,laneIndex-1,t,perforation)*laneWidth*.44;
    const right=this.flowBoundary(pull,laneIndex+1,t,perforation)-this.aperture(pull,laneIndex,t,perforation)*laneWidth*.44;
    this.boundary(pull.sourcePoints,left,this.rootLeft).lerp(this.a,1-morph);
    this.boundary(pull.sourcePoints,right,this.rootRight).lerp(this.b,1-morph);
    this.boundary(pull.targetPoints,left,this.farLeft).lerp(this.c,1-morph);
    this.boundary(pull.targetPoints,right,this.farRight).lerp(this.d,1-morph);
    const weak=1-.90*neck*Math.exp(-Math.pow((t-tip)/.10,2));
    const torn=lane.brokenAt<0?1:Math.max(.015,Math.min(1,Math.abs(t-freeEnd)*6));
    const widthScale=weak*torn;
    // Surface tension gathers a torn ribbon into a low, folded root mound.
    // Keep mass visible during retraction instead of fading a long loose flap.
    const gather=lane.brokenAt<0?0:1-Math.exp(-tearAge*8);
    const settle=state.broken?1-T.MathUtils.smoothstep(state.age,1.05,1.6):1;
    for(let col=0;col<ACROSS;col++){
     const u=col/(ACROSS-1),edge=Math.sin(Math.PI*t);
     const laneU=.5+(u-.5)*widthScale;
     this.offset.copy(this.rootLeft).lerp(this.rootRight,laneU).sub(sourceCenter).multiplyScalar(1-t);
     this.offset.addScaledVector(this.p.copy(this.farLeft).lerp(this.farRight,laneU).sub(targetCenter),t);
     this.p.copy(this.center).add(this.offset);
     // Shared sag keeps joined regions continuous; depth is inherited from the particle chain.
     this.p.y-=edge*.010*perforation;
     if(gather>0){
      const travel=onLeft?t/(lane.cut/ROWS):(1-t)/(1-(lane.cut+1)/ROWS);
      const rootA=onLeft?this.a:this.c,rootB=onLeft?this.b:this.d;
      this.clump.copy(rootA).lerp(rootB,.5+(u-.5)*(1-.65*travel));
      this.clumpNormal.fromBufferAttribute(normal,lane.source[0]).transformDirection(this.mesh.matrixWorld);
      this.offset.copy(onLeft?targetCenter:sourceCenter).sub(onLeft?sourceCenter:targetCenter).normalize();
      this.clump.addScaledVector(this.offset,.032*Math.sin(travel*Math.PI*.8)*settle);
      this.clump.addScaledVector(this.clumpNormal,(.022*Math.sin(travel*Math.PI*.85)+.007*Math.sin(travel*Math.PI*3)**2)*settle);
      this.p.lerp(this.clump,gather);
     }
     this.p.applyMatrix4(this.inv);
     const thick=T.MathUtils.lerp((.0025+.007*root)/Math.sqrt(1+state.length*1.2),.014*settle,gather)*(.65+.35*Math.sin(Math.PI*u));
     const top=lane.first+(row-1)*ACROSS+col,bottom=top+LAYER;
     pos.setXYZ(top,this.p.x+this.normal.x*thick*.5,this.p.y+this.normal.y*thick*.5,this.p.z+this.normal.z*thick*.5);
     pos.setXYZ(bottom,this.p.x-this.normal.x*thick*.5,this.p.y-this.normal.y*thick*.5,this.p.z-this.normal.z*thick*.5);
     normal.setXYZ(top,this.normal.x,this.normal.y,this.normal.z);normal.setXYZ(bottom,-this.normal.x,-this.normal.y,-this.normal.z);
     // Material coordinates are sampled from the source surface, never reset to 0..1 per strip.
     if(!pull.uvReady)for(const key of ['uv','uv1']){const attr=g.attributes[key];const x=T.MathUtils.lerp(T.MathUtils.lerp(attr.getX(lane.source[0]),attr.getX(lane.source[1]),u),T.MathUtils.lerp(pull.targetAttribute(lane.target[0],key,0),pull.targetAttribute(lane.target[1],key,0),u),t),y=T.MathUtils.lerp(T.MathUtils.lerp(attr.getY(lane.source[0]),attr.getY(lane.source[1]),u),T.MathUtils.lerp(pull.targetAttribute(lane.target[0],key,1),pull.targetAttribute(lane.target[1],key,1),u),t);attr.setXY(top,x,y);attr.setXY(bottom,x,y);}
     sss.setX(top,T.MathUtils.clamp(thick/.025,.035,.55));sss.setX(bottom,sss.getX(top));
     if(row===ROWS){
      this.p.copy(this.c).lerp(this.d,u).applyMatrix4(this.inv);pos.setXYZ(top,this.p.x,this.p.y,this.p.z);
      pull.sampleTarget(lane.target[0],this.targetLeft,true);pull.sampleTarget(lane.target[1],this.targetRight,true);
      this.p.copy(this.targetLeft).lerp(this.targetRight,u).applyMatrix4(this.inv);pos.setXYZ(bottom,this.p.x,this.p.y,this.p.z);
      sss.setX(top,T.MathUtils.lerp(pull.targetAttribute(lane.target[0],'sssThickness',0),pull.targetAttribute(lane.target[1],'sssThickness',0),u));
     }
    }
   }
  }
  if(this.dirty)this.reindex();for(const name of ['position','normal','sssThickness'])g.attributes[name].needsUpdate=true;
  if(!pull.uvReady){g.attributes.uv.needsUpdate=true;g.attributes.uv1.needsUpdate=true;pull.uvReady=true;}
  // The slice update already bounds the base. Expand only for this extension,
  // rather than scanning the whole shared mozzarella mesh for every bridge.
  if(!g.boundingSphere)g.computeBoundingSphere();
  for(const lane of pull.lanes)for(let i=lane.first;i<lane.first+LAYER*2;i++)g.boundingSphere!.expandByPoint(this.p.fromBufferAttribute(pos,i));
 }
 remove(pull:MozzarellaExtrusion){
  if(!pull.active)return;pull.active=false;this.pulls.splice(this.pulls.indexOf(pull),1);
  // Repack from live spans instead of leaving frozen degenerate triangles attached to the food.
  this.rebuild();
 }
}
