import * as T from 'three';
import { PizzaSlice, SLICE_COUNT, weldSliceSeamNormals } from '../src/pizza/PizzaSlice';
import { cutAngle } from '../src/pizza/surface';

function assert(ok:boolean,message:string){if(!ok)throw new Error(message);}
const material=()=>new T.MeshPhysicalMaterial();
const materials={dough:material(),sauce:material(),cheese:material(),crust:material(),crumb:material(),underside:material(),basil:material(),strand:material()} as any;
const slices=Array.from({length:SLICE_COUNT},(_,i)=>new PizzaSlice(i,materials));
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const edgePoints=(slice:PizzaSlice,meshIndex:number,edge:number)=>{
 const mesh=slice.deformables[meshIndex].mesh,position=mesh.geometry.getAttribute('position'),result:T.Vector3[]=[];
 for(let i=0;i<position.count;i++){
  const p=new T.Vector3().fromBufferAttribute(position,i);p.x+=slice.group.position.x;p.z+=slice.group.position.z;
  const a=Math.atan2(p.z,p.x),r=Math.hypot(p.x,p.z),expected=cutAngle(edge,r);if(r>.1&&Math.abs(wrap(a-expected))<.00035)result.push(p);
 }
 return result;
};
let maxRestGap=0,checked=0,gapAt='',gapPoint='';
let savedA:T.Vector3[]=[],savedB:T.Vector3[];
for(let i=0;i<SLICE_COUNT;i++){
 const left=slices[i],right=slices[(i+1)%SLICE_COUNT],edge=left.theta+left.halfAngle;
 for(const mesh of [0,1,2,3]){
  const a=edgePoints(left,mesh,edge),b=edgePoints(right,mesh,edge);
  assert(a.length>0&&b.length>0,`Missing shared edge vertices at slice ${i}, mesh ${mesh}`);
  if(i===1&&mesh===0){savedA=a.map(p=>p.clone());savedB=b.map(p=>p.clone());}
  for(const p of a){let nearest=Infinity,nearestPoint:T.Vector3|undefined;for(const q of b){const d=p.distanceTo(q);if(d<nearest){nearest=d;nearestPoint=q;}}if(nearest>maxRestGap){maxRestGap=nearest;gapAt=`slice ${i}, mesh ${mesh}, point ${p.toArray()}`;gapPoint=nearestPoint?.toArray().join(',')??'';}checked++;}
 }
}
assert(maxRestGap<.001,`Resting slice seam gap ${maxRestGap} exceeds tolerance at ${gapAt}; nearest=${gapPoint}`);
weldSliceSeamNormals(slices);
let minNormalDot=1;
for(let i=0;i<SLICE_COUNT;i++){
 const left=slices[i],right=slices[(i+1)%SLICE_COUNT],edge=left.theta+left.halfAngle;
 for(const meshIndex of [0,1,2,3]){
  const lm=left.deformables[meshIndex].mesh,rm=right.deformables[meshIndex].mesh,lp=lm.geometry.getAttribute('position'),rp=rm.geometry.getAttribute('position'),ln=lm.geometry.getAttribute('normal'),rn=rm.geometry.getAttribute('normal');
  for(let x=0;x<lp.count;x++){
   const p=new T.Vector3().fromBufferAttribute(lp,x);p.x+=left.group.position.x;p.z+=left.group.position.z;if(Math.hypot(p.x,p.z)<=.1||Math.abs(wrap(Math.atan2(p.z,p.x)-cutAngle(edge,Math.hypot(p.x,p.z))))>=.00035)continue;
   let best=-1,distance=.00001;
   for(let y=0;y<rp.count;y++){const q=new T.Vector3().fromBufferAttribute(rp,y);q.x+=right.group.position.x;q.z+=right.group.position.z;const d=p.distanceTo(q);if(d<distance){distance=d;best=y;}}
   if(best>=0){const n=new T.Vector3().fromBufferAttribute(ln,x),m=new T.Vector3().fromBufferAttribute(rn,best);if(n.lengthSq()>.5&&m.lengthSq()>.5)minNormalDot=Math.min(minNormalDot,n.dot(m));}
  }
 }
}
assert(minNormalDot>.985,`Resting seam normals diverge (dot=${minNormalDot})`);
// The same cut becomes visible when its selected slice is physically displaced.
slices[1].group.position.x+=.05;
const seamGap=savedA.reduce((max,p,i)=>Math.max(max,p.distanceTo(savedB[i].add(new T.Vector3(.05,0,0)))),0);
assert(seamGap>.04,`A moving slice did not expose a separation (gap=${seamGap})`);
console.log(JSON.stringify({checked,maximumRestGap:maxRestGap,minimumRestNormalDot:minNormalDot,openedGap:seamGap}));
