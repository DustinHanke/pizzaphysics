import * as T from 'three';

// All active cheese connections share one dynamic ribbon buffer per material.
// The shallow, three-column cross section catches light without reading as a pipe.
const SEGMENTS=20, ACROSS=3, CAPACITY=128, VERTS=(SEGMENTS+1)*ACROSS;
const batches=new WeakMap<T.Material,RibbonBatch>();
const liveBatches=new Set<RibbonBatch>();
const tangent=new T.Vector3(),widthAxis=new T.Vector3(),surfaceNormal=new T.Vector3(),up=new T.Vector3(0,1,0),fallback=new T.Vector3(1,0,0),point=new T.Vector3(),before=new T.Vector3(),after=new T.Vector3();

class RibbonBatch {
 mesh:T.Mesh;positions:Float32Array;normals:Float32Array;thickness:Float32Array;uvs:Float32Array;free:number[]=[];refs=0;private active=new Set<number>();private dirtyMin=Infinity;private dirtyMax=-1;
 constructor(public scene:T.Scene,material:T.Material){
  this.positions=new Float32Array(CAPACITY*VERTS*3);this.normals=new Float32Array(this.positions.length);this.thickness=new Float32Array(CAPACITY*VERTS);
  const uv=this.uvs=new Float32Array(CAPACITY*VERTS*2),indices:number[]=[];
  for(let slot=0;slot<CAPACITY;slot++){
   this.free.push(CAPACITY-1-slot);const base=slot*VERTS;
   for(let i=0;i<=SEGMENTS;i++)for(let j=0;j<ACROSS;j++){const v=base+i*ACROSS+j;uv[v*2]=j/(ACROSS-1);uv[v*2+1]=i/SEGMENTS;
    if(i<SEGMENTS&&j<ACROSS-1){indices.push(v,v+ACROSS,v+1,v+1,v+ACROSS,v+ACROSS+1);}}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('normal',new T.BufferAttribute(this.normals,3).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.BufferAttribute(uv,2).setUsage(T.DynamicDrawUsage));g.setAttribute('sssThickness',new T.BufferAttribute(this.thickness,1).setUsage(T.DynamicDrawUsage));g.setIndex(indices);
  this.mesh=new T.Mesh(g,material);this.mesh.name='Batched torn mozzarella web';this.mesh.frustumCulled=false;this.mesh.castShadow=this.mesh.receiveShadow=true;this.mesh.visible=false;scene.add(this.mesh);liveBatches.add(this);
 }
 acquire(){const slot=this.free.pop();if(slot===undefined)return -1;this.refs++;this.active.add(slot);return slot;}
 release(slot:number){if(slot<0)return;this.hide(slot);this.free.push(slot);this.active.delete(slot);this.refs--;}
 mark(slot:number){this.dirtyMin=Math.min(this.dirtyMin,slot);this.dirtyMax=Math.max(this.dirtyMax,slot);}
 hide(slot:number){if(slot<0)return;this.mark(slot);const start=slot*VERTS*3;for(let i=0;i<VERTS*3;i++)this.positions[start+i]=0;}
 flush(){const g=this.mesh.geometry;this.mesh.visible=this.refs>0;
  if(this.dirtyMax<0)return;
  for(const value of Object.values(g.attributes)){const attr=value as T.BufferAttribute;attr.addUpdateRange(this.dirtyMin*VERTS*attr.itemSize,(this.dirtyMax-this.dirtyMin+1)*VERTS*attr.itemSize);attr.needsUpdate=true;}
  let last=-1;for(const slot of this.active)last=Math.max(last,slot);g.setDrawRange(0,(last+1)*SEGMENTS*(ACROSS-1)*6);
  this.dirtyMin=Infinity;this.dirtyMax=-1;
 }
}

/** Camera-independent, double-sided, tapered sheet strand. Never a hollow tube. */
export class CheeseRenderer {
 mesh:T.Mesh;curve:T.CatmullRomCurve3;positions:Float32Array;thicknesses:Float32Array;private batch:RibbonBatch;private slot:number;private uvA:T.Vector2;private uvB:T.Vector2;
 constructor(scene:T.Scene,material:T.MeshPhysicalMaterial,points:T.Vector3[],uvAnchors?:[T.Vector2,T.Vector2]){
  this.curve=new T.CatmullRomCurve3(points,false,'centripetal');let batch=batches.get(material);if(!batch){batch=new RibbonBatch(scene,material);batches.set(material,batch);}this.batch=batch;this.mesh=batch.mesh;this.slot=batch.acquire();this.positions=batch.positions;this.thicknesses=batch.thickness;
  this.uvA=uvAnchors?.[0].clone()??new T.Vector2(.5+points[0].x/5.3,.5+points[0].z/5.3);this.uvB=uvAnchors?.[1].clone()??new T.Vector2(.5+points[points.length-1].x/5.3,.5+points[points.length-1].z/5.3);
 }
 setVisible(visible:boolean){if(!visible)this.batch.hide(this.slot);}
 sampleUV(t:number,out:T.Vector2){return out.set(T.MathUtils.lerp(this.uvA.x,this.uvB.x,t),T.MathUtils.lerp(this.uvA.y,this.uvB.y,t));}
 update(radius:number,taper=0,rootRadius=radius,spread=1,secondRoot=false,damage=0,weakPoint=.5){
  if(this.slot<0)return;this.batch.mark(this.slot);radius=Math.max(.00012,radius);rootRadius=Math.max(radius,rootRadius);const base=this.slot*VERTS;
  for(let i=0;i<=SEGMENTS;i++){
   const t=i/SEGMENTS;this.curve.getPoint(t,point);this.curve.getPoint(Math.max(0,t-.006),before);this.curve.getPoint(Math.min(1,t+.006),after);tangent.copy(after).sub(before).normalize();
   widthAxis.crossVectors(tangent,up);if(widthAxis.lengthSq()<1e-7)widthAxis.crossVectors(tangent,fallback);widthAxis.normalize();surfaceNormal.crossVectors(tangent,widthAxis).normalize();
   const edge=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.20),root=Math.max(Math.exp(-t*15),secondRoot?Math.exp(-(1-t)*15):0);
   const organic=1+.11*Math.sin(t*17+spread*11)*Math.sin(Math.PI*t)+.045*Math.sin(t*39+spread*23)*Math.sin(Math.PI*t);
   const neck=(1-.92*damage*Math.exp(-Math.pow((t-weakPoint)/.055,2)))*(1-taper*Math.pow(Math.abs(t-weakPoint)*2,5));
   // Flared roots feed into a sharply thinning mid-span under tension.
   const width=Math.max(.00008,(radius+(rootRadius-radius)*root)*edge*organic*neck*(.72+.28*spread));
   for(let j=0;j<ACROSS;j++){
    const u=j/(ACROSS-1)*2-1,idx=base+i*ACROSS+j,camber=(1-u*u)*width*.25,materialU=T.MathUtils.lerp(this.uvA.x,this.uvB.x,t)+widthAxis.x*u*width/5.3,materialV=T.MathUtils.lerp(this.uvA.y,this.uvB.y,t)+widthAxis.z*u*width/5.3;
    // Carry the actual mozzarella-pool coordinates through the pull. A full
    // 0–1 UV per bridge had magnified one whole-pizza texture over a few cm.
    this.batch.uvs[idx*2]=materialU;this.batch.uvs[idx*2+1]=materialV;
    this.positions[idx*3]=point.x+widthAxis.x*u*width+surfaceNormal.x*camber;
    this.positions[idx*3+1]=point.y+widthAxis.y*u*width+surfaceNormal.y*camber;
    this.positions[idx*3+2]=point.z+widthAxis.z*u*width+surfaceNormal.z*camber;
    this.thicknesses[idx]=T.MathUtils.clamp(width/.035,.025,1);
    const nx=surfaceNormal.x-widthAxis.x*u*.2,ny=surfaceNormal.y-widthAxis.y*u*.2,nz=surfaceNormal.z-widthAxis.z*u*.2,nl=Math.hypot(nx,ny,nz)||1;
    this.batch.normals[idx*3]=nx/nl;this.batch.normals[idx*3+1]=ny/nl;this.batch.normals[idx*3+2]=nz/nl;
   }
  }
 }
 static flush(){for(const batch of liveBatches)batch.flush();}
 dispose(){this.batch.release(this.slot);this.slot=-1;}
}
