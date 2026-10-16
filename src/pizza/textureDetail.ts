import * as T from 'three';
import {rand} from '../utils/noise';

export const CHEESE_NORMAL_STRENGTH=3.2;
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function tex(c:HTMLCanvasElement,color=true){const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
/** Tileable multi-octave height noise. Kept in linear data space, independent of color. */
export function noiseBump(kind:'dough'|'strand'){
 const size=256,c=canvas(size,size),ctx=c.getContext('2d')!,data=ctx.createImageData(size,size);
 const hash=(x:number,y:number,n:number)=>rand(((x%n+n)%n)+((y%n+n)%n)*157);
 const tile=(x:number,y:number,n:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy,n),hash(ix+1,iy,n),u),T.MathUtils.lerp(hash(ix,iy+1,n),hash(ix+1,iy+1,n),u),v);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,medium=tile(u*16,v*16,16),fine=tile(u*48,v*48,48),micro=tile(u*96,v*96,96);
  const pore=kind==='dough'?Math.pow(Math.max(0,(fine-.59)*2.44),2)*54:0;
  const h=128+(medium-.5)*30+(fine-.5)*20+(micro-.5)*8-pore,i=(y*size+x)*4;
  data.data[i]=data.data[i+1]=data.data[i+2]=h;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);const t=tex(c,false);t.wrapS=t.wrapT=T.RepeatWrapping;if(kind==='dough')t.repeat.set(5,5);return t;
}


/** Convert the broader height gradients into a tangent-space normal map.
 * Fine height bump remains a separate shader layer, so the two add detail at different scales.
 */
export function normalFromHeight(height:T.CanvasTexture,strength:number,repeatMultiplier=4){
 const source=height.image as HTMLCanvasElement,w=source.width,h=source.height;
 const pixels=source.getContext('2d')!.getImageData(0,0,w,h).data;
 const c=canvas(w,h),ctx=c.getContext('2d')!,data=ctx.createImageData(w,h);
 const sample=(x:number,y:number)=>{x=height.wrapS===T.RepeatWrapping?(x%w+w)%w:Math.max(0,Math.min(w-1,x));y=height.wrapT===T.RepeatWrapping?(y%h+h)%h:Math.max(0,Math.min(h-1,y));return pixels[(y*w+x)*4]/255;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(sample(x+2,y)-sample(x-2,y))*.65+(sample(x+5,y)-sample(x-5,y))*.35;
  const dy=(sample(x,y+2)-sample(x,y-2))*.65+(sample(x,y+5)-sample(x,y-5))*.35;
  const nx=-dx*strength,ny=dy*strength,length=Math.hypot(nx,ny,1),i=(y*w+x)*4;
  data.data[i]=(nx/length*.5+.5)*255;data.data[i+1]=(ny/length*.5+.5)*255;data.data[i+2]=(1/length*.5+.5)*255;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);const map=tex(c,false);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.copy(height.repeat).multiplyScalar(repeatMultiplier);return map;
}
