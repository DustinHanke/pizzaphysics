import * as T from 'three';
const requestedSeed=typeof location==='undefined'?null:new URLSearchParams(location.search).get('seed');
export const pizzaSeed=requestedSeed!==null&&/^\d+$/.test(requestedSeed)?Number(requestedSeed)>>>0:typeof window==='undefined'?73471:crypto.getRandomValues(new Uint32Array(1))[0];
export function rand(seed: number) { const s = Math.sin((seed+pizzaSeed*.0137) * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise(x: number, y: number) { const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy); return T.MathUtils.lerp(T.MathUtils.lerp(rand(ix+iy*157),rand(ix+1+iy*157),u),T.MathUtils.lerp(rand(ix+(iy+1)*157),rand(ix+1+(iy+1)*157),u),v); }
/** Value noise with a periodic horizontal domain, for seamless cylindrical textures. */
export function loopNoise(u:number,v:number,nx:number,ny:number,seed:number){
 const x=u*nx,y=v*ny+seed*.731,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const hash=(a:number,b:number)=>rand(((a%nx+nx)%nx)+b*157+seed*331);
 return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
}
