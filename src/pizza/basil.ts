import * as T from 'three';
import {noise,rand} from '../utils/noise';

/** Curved secondary veins meet the midrib and fade before the margin. */
function veins(cross:number,t:number){
 const distance=Math.abs(cross),side=cross<0?-.012:.012;
 let branch=0;
 for(let i=0;i<6;i++){
  const root=.13+i*.125+side;
  const curve=root+distance*.20+distance*distance*.055;
  const width=.012*(1-distance*.65);
  branch=Math.max(branch,Math.exp(-Math.pow((t-curve)/width,2))*(1-T.MathUtils.smoothstep(distance,.75,1)));
 }
 const midrib=Math.exp(-Math.pow(cross/.045,2))*(1-T.MathUtils.smoothstep(t,.86,1));
 return {midrib,branch};
}

export function createBasilGeometry(seed:number){
 const rows=32,columns=12,p:number[]=[],uv:number[]=[],colors:number[]=[],thickness:number[]=[],indices:number[]=[];
 const bend=(rand(seed+1)-.5)*.025,twist=(rand(seed+2)-.5)*.028;
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const t=j/rows,cross=i/columns*2-1,d=Math.abs(cross),envelope=Math.sin(Math.PI*t);
  const width=.19*Math.pow(envelope,.8)*(1.16-.32*t);
  const scallop=1+.025*Math.sin(t*Math.PI*14+cross*.8)*d*d;
  const x=cross*width*scallop*(1+cross*.055)+bend*envelope;
  const {midrib,branch}=veins(cross,t);
  const arch=.025*envelope,cupping=.035*d*d*envelope,tip=.045*t**5;
  const y=.012+arch+cupping+tip+twist*cross*envelope+.009*midrib*envelope+.004*branch*envelope;
  p.push(x,y,t*.64-.32);uv.push(i/columns,t);
  const tone=.94+rand(seed+3)*.06;
  colors.push(tone,.97,tone*.95);thickness.push(.10+.22*midrib+.07*branch);
  if(j<rows&&i<columns){const n=j*(columns+1)+i;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
 }
 // A short petiole shares the mesh and therefore follows the same cloth binding.
 const start=p.length/3;
 for(let j=0;j<=4;j++)for(let i=0;i<6;i++){
  const t=j/4,angle=i/6*Math.PI*2,radius=.006*(.7+t*.3);
  p.push(Math.cos(angle)*radius,.012+Math.sin(angle)*radius,-.39+t*.085);
  uv.push(.5,t*.06);colors.push(.82,.94,.67);thickness.push(.45);
  if(j<4){const a=start+j*6+i,b=start+j*6+(i+1)%6;indices.push(a,b,a+6,b,b+6,a+6);}
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setAttribute('sssThickness',new T.Float32BufferAttribute(thickness,1));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

export function createBasilMaterial(){
 const size=512,albedo=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const t=y/(size-1),cross=x/(size-1)*2-1,d=Math.abs(cross),{midrib,branch}=veins(cross,t);
  const grain=noise(cross*65+14,t*95),mottle=noise(cross*7+32,t*11);
  const vein=Math.max(midrib,branch*.65),edge=T.MathUtils.smoothstep(d,.8,1);
  const fine=Math.pow(Math.max(0,Math.sin(t*93+cross*24+noise(cross*12,t*17)*3)),12)*.10*(1-d);
  const i=(y*size+x)*4;
  albedo[i]=37+mottle*12+vein*27+edge*8;
  albedo[i+1]=87+mottle*20+vein*23-edge*5;
  albedo[i+2]=20+mottle*9+vein*8;
  const relief=110+vein*48+fine*22+(grain-.5)*8;
  const rough=190+mottle*45-vein*16+edge*15;
  for(let k=0;k<3;k++){height[i+k]=relief;roughness[i+k]=rough;}
  albedo[i+3]=height[i+3]=roughness[i+3]=255;
 }
 const texture=(pixels:Uint8Array,color=false)=>{
  const map=new T.DataTexture(pixels,size,size,T.RGBAFormat);
  map.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
  map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.anisotropy=8;map.needsUpdate=true;
  return map;
 };
 return new T.MeshPhysicalMaterial({map:texture(albedo,true),bumpMap:texture(height),bumpScale:.007,roughnessMap:texture(roughness),roughness:.58,metalness:0,ior:1.43,specularIntensity:.8,clearcoat:.12,clearcoatRoughness:.38,side:T.DoubleSide,vertexColors:true});
}
