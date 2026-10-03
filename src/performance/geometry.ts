import * as T from 'three';
/** Same area-weighted normals as BufferGeometry, over contiguous numeric buffers. */
export function updateNormals(geometry:T.BufferGeometry){
 const position=geometry.attributes.position as T.BufferAttribute,normal=geometry.attributes.normal as T.BufferAttribute,index=geometry.index;
 if(!index||!normal){geometry.computeVertexNormals();return;}
 const p=position.array,n=normal.array,ids=index.array;n.fill(0);
 for(let i=geometry.drawRange.start;i<Math.min(ids.length,geometry.drawRange.start+geometry.drawRange.count);i+=3){
  const a=ids[i]*3,b=ids[i+1]*3,c=ids[i+2]*3;
  const x=p[c]-p[b],y=p[c+1]-p[b+1],z=p[c+2]-p[b+2],u=p[a]-p[b],v=p[a+1]-p[b+1],w=p[a+2]-p[b+2];
  const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
  n[a]+=nx;n[a+1]+=ny;n[a+2]+=nz;n[b]+=nx;n[b+1]+=ny;n[b+2]+=nz;n[c]+=nx;n[c+1]+=ny;n[c+2]+=nz;
 }
 for(let i=0;i<n.length;i+=3){const inverse=1/(Math.sqrt(n[i]*n[i]+n[i+1]*n[i+1]+n[i+2]*n[i+2])||1);n[i]*=inverse;n[i+1]*=inverse;n[i+2]*=inverse;}
 normal.needsUpdate=true;
}
