import * as T from 'three';
import {rand,noise,loopNoise} from '../utils/noise';
const toppingDetailUrl=new URL('../assets/topping-skin-detail.png',import.meta.url).href;
type GeneratedTile={pixels:Uint8ClampedArray,heightPixels:Uint8ClampedArray,roughPixels:Uint8ClampedArray,width:number,height:number};
const generatedTiles:Record<'crust'|'tomato'|'mozzarella',GeneratedTile>={} as Record<'crust'|'tomato'|'mozzarella',GeneratedTile>;
export {rand,noise} from '../utils/noise';
import {cheeseField,CHEESE_EDGE,crustBlisters,crustRelief,rimPoint} from './surface';
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function tex(c:HTMLCanvasElement,color=true){const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
let toppingDetail:Uint8ClampedArray;
async function loadGeneratedTiles(){
 const entries=[
  ['tomato',new URL('../assets/material-maps/sauce-albedo.webp',import.meta.url).href,new URL('../assets/material-maps/sauce-height.webp',import.meta.url).href,new URL('../assets/material-maps/sauce-roughness.webp',import.meta.url).href],
  ['mozzarella',new URL('../assets/material-maps/mozzarella-albedo.webp',import.meta.url).href,new URL('../assets/material-maps/mozzarella-height.webp',import.meta.url).href,new URL('../assets/material-maps/mozzarella-roughness.webp',import.meta.url).href]
 ] as const;
 const pixels=async(url:string)=>{const image=new Image();image.src=url;await image.decode();const c=canvas(image.width,image.height),ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);return{pixels:ctx.getImageData(0,0,image.width,image.height).data,width:image.width,height:image.height};};
 await Promise.all(entries.map(async([name,colorUrl,heightUrl,roughUrl])=>{const [color,height,rough]=await Promise.all([pixels(colorUrl),pixels(heightUrl),pixels(roughUrl)]);generatedTiles[name]={pixels:color.pixels,heightPixels:height.pixels,roughPixels:rough.pixels,width:color.width,height:color.height};}));
 // Versions 36–38 used this stronger Neapolitan photo tile directly for the
 // cornicione. The legacy relief response is sampled from its own albedo.
 const crust=await pixels(new URL('../assets/crust-neapolitan-v2.webp',import.meta.url).href);
 generatedTiles.crust={pixels:crust.pixels,heightPixels:crust.pixels,roughPixels:crust.pixels,width:crust.width,height:crust.height};
}
function generatedPixel(kind:'crust'|'tomato'|'mozzarella',u:number,v:number){const tile=generatedTiles[kind],x=Math.floor(((u%1+1)%1)*tile.width),y=Math.floor(((v%1+1)%1)*tile.height),i=(y*tile.width+x)*4;return[tile.pixels[i],tile.pixels[i+1],tile.pixels[i+2]] as const;}
function generatedGray(pixels:Uint8ClampedArray,width:number,height:number,u:number,v:number){const x=Math.floor(((u%1+1)%1)*width),y=Math.floor(((v%1+1)%1)*height),i=(y*width+x)*4;return(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255;}
function generatedRelief(kind:'crust'|'tomato'|'mozzarella',u:number,v:number){const tile=generatedTiles[kind],stepU=2/tile.width,stepV=2/tile.height,pixels=kind==='crust'?tile.pixels:tile.heightPixels,lum=(a:number,b:number)=>generatedGray(pixels,tile.width,tile.height,a,b);return(lum(u+stepU,v)+lum(u-stepU,v)+lum(u,v+stepV)+lum(u,v-stepV))*.25-lum(u,v);}
function generatedRoughness(kind:'crust'|'tomato'|'mozzarella',u:number,v:number){const tile=generatedTiles[kind];return generatedGray(tile.roughPixels,tile.width,tile.height,u,v);}
async function loadToppingDetail(){
 const image=new Image();image.src=toppingDetailUrl;await image.decode();
 const c=canvas(256,128),ctx=c.getContext('2d')!;ctx.drawImage(image,0,0,256,128);toppingDetail=ctx.getImageData(0,0,256,128).data;
}
/** High-pass photographic grain only; neither photographed lighting nor white
 * specular pixels are copied into the tomato/cheese albedo. Shared XZ sampling
 * makes this stable through camera movement, deformation and slice boundaries. */
function sampleToppingDetail(kind:'cheese'|'sauce',u:number,v:number){
 const tile=kind==='sauce'?0:128;
 const sample=(a:number,b:number)=>{
  const x=((a%1)+1)%1*128,y=((b%1)+1)%1*128,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const at=(px:number,py:number)=>toppingDetail[(((py+128)%128)*256+tile+(px+128)%128)*4]/255-.5;
  return T.MathUtils.lerp(T.MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),T.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);
 };
 const scale=kind==='sauce'?10.2:8.8,warp=(noise(u*17+29,v*17+8)-.5)*.19,blend=noise(u*13+9,v*13+53);
 return sample(u*scale+warp,v*scale-warp)*(1-blend*.42)+sample(-v*scale+.37,u*scale+.61)*blend*.42;
}
const SURFACE_SIZE=512,SURFACE_CHANNELS=9;
let surfaceDetailCache:Uint8Array;
/** Seed-stable detail is baked once. Amount/placement changes then update the
 * pool field and material masks without resampling photographic grain/noise. */
function surfaceDetails(){
 if(surfaceDetailCache)return surfaceDetailCache;
 const size=SURFACE_SIZE,result=new Uint8Array(size*size*SURFACE_CHANNELS);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,i=(y*size+x)*SURFACE_CHANNELS;
  result[i]=noise(u*9+13,v*9+9)*255;result[i+1]=noise(u*120,v*120)*255;result[i+2]=noise(u*250+8,v*250+10)*255;
  result[i+3]=noise(u*38+22,v*38+5)*255;result[i+4]=T.MathUtils.smoothstep(noise(u*46+9,v*46+12),.57,.85)*255;
  result[i+5]=T.MathUtils.smoothstep(noise(u*21+43,v*21+61),.46,.73)*255;result[i+6]=noise(u*51+19,v*51+2)*255;
  result[i+7]=(sampleToppingDetail('cheese',u,v)+.5)*255;result[i+8]=(sampleToppingDetail('sauce',u,v)+.5)*255;
 }
 surfaceDetailCache=result;return result;
}
async function crustTextures(){
 const w=1536,h=384,c=canvas(w,h),height=canvas(w,h),rough=canvas(w,h),ctx=c.getContext('2d')!,hc=height.getContext('2d')!,rc=rough.getContext('2d')!;
 // The photo strip contributed long directional bands when wrapped around the
 // toroidal rim. Use a generated baked-skin tile at matched physical scale,
 // with the seed-stable blister/bake masks below retaining the thermal art direction.
 // Baking uses the actual rim form, cached at the same resolution as its geometry relief.
 // Bilinear sampling avoids recalculating the shape field for every 1536×384 texture texel.
 const formW=384,formH=128,formGrid=new Float32Array(formW*formH);
 for(let gy=0;gy<formH;gy++)for(let gx=0;gx<formW;gx++){
  const a=gx/formW*Math.PI*2,v=gy/formH,b=(1-v)*Math.PI*2,point=rimPoint(a,b),relief=crustRelief(a,b),raised=T.MathUtils.clamp((point.y-.18)/.53,0,1);
  formGrid[gy*formW+gx]=raised*.7+T.MathUtils.clamp(relief/.075,0,1)*.3;
 }
 const sampleForm=(u:number,v:number)=>{const x=u*formW,y=v*formH,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,at=(ix:number,iy:number)=>formGrid[((iy+formH)%formH)*formW+(ix+formW)%formW],lo=at(x0,y0)*(1-fx)+at(x0+1,y0)*fx,hi=at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx;return lo*(1-fy)+hi*fy;};
 const spots=Array.from({length:112+Math.floor(rand(8221)*25)},(_,i)=>{const k=8300+i*19,blister=crustBlisters[Math.floor(rand(k)*crustBlisters.length)],largeChance=rand(k+4),large=largeChance<.70?Math.pow(rand(k+11),2)*.22:largeChance<.95?.22+rand(k+12)*.52:.74+rand(k+13)*.26,bottomFace=rand(k+8)<.27,nearForm=rand(k+1)<(large>.52?.94:.76),angle=nearForm?blister.angle+(rand(k+2)-.5)*blister.angular*1.65:rand(k+3)*Math.PI*2,u=((angle/(Math.PI*2))%1+1)%1;
  // Texture v is the inverse of the rim's cross-section parameter b.
  const b=bottomFace?Math.PI+.28+rand(k+5)*2.35:nearForm?blister.cross+(rand(k+5)-.5)*blister.crossWidth*.95:.35+rand(k+5)*2.4;
  return {u,v:1-b/(Math.PI*2),rx:.0016+large*.022,ry:.006+large*.071,phase:rand(k+6)*6.28,strength:.58+rand(k+7)*.42,edge:.26+rand(k+9)*.60,hotCore:rand(k+10)<.37,core:.10+rand(k+14)*.19};});
 const columns=Array.from({length:w},(_,x)=>spots.filter(s=>Math.abs(Math.atan2(Math.sin((x/w-s.u)*Math.PI*2),Math.cos((x/w-s.u)*Math.PI*2))/(Math.PI*2))<s.rx*1.65));
 const image=ctx.createImageData(w,h),hi=hc.createImageData(w,h),ri=rc.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h,a=u*Math.PI*2,b=(1-v)*Math.PI*2,top=Math.max(0,Math.sin(b)),bottomFace=Math.max(0,-Math.sin(b)),faceExposure=Math.max(T.MathUtils.smoothstep(top,.10,.52),T.MathUtils.smoothstep(bottomFace,.10,.48)*.78);
  const broad=noise(Math.cos(a)*3+20,Math.sin(a)*3+v*5+17),patch=loopNoise(u,v,51,7,11),medium=loopNoise(u,v,190,27,3),fine=loopNoise(u,v,640,85,9),micro=loopNoise(u,v,1100,190,4);
  const exposure=sampleForm(u,v);
  const oven=patch*.36+medium*.23+fine*.12+exposure*.29,blister=T.MathUtils.smoothstep(oven,.50,.79);
  const char=T.MathUtils.smoothstep(oven,.70,.90)*faceExposure;
  const freckles=T.MathUtils.smoothstep(fine*.73+medium*.27,.68,.87)*faceExposure*.92;
  let baked=0,halo=0,hotChar=0;for(const spot of columns[x]){const dx=Math.atan2(Math.sin((u-spot.u)*Math.PI*2),Math.cos((u-spot.u)*Math.PI*2))/(Math.PI*2)/spot.rx,dy=(v-spot.v)/spot.ry;if(Math.abs(dy)>1.8)continue;
   const angle=Math.atan2(dy,dx),edge=1+.22*Math.sin(angle*3+spot.phase)+.095*Math.sin(angle*7-spot.phase),d=Math.hypot(dx,dy+.16*Math.sin(dx*3+spot.phase))/edge;
   // Each blister has its own thermal edge: some stay soft, others develop a
   // crisp toasted lip and a tiny char core. Major marks cluster on actual relief.
   baked=Math.max(baked,(1-T.MathUtils.smoothstep(d,spot.edge,1.02))*spot.strength);halo=Math.max(halo,1-T.MathUtils.smoothstep(d,.58,1.72));
   if(spot.hotCore)hotChar=Math.max(hotChar,(1-T.MathUtils.smoothstep(d,spot.core,spot.core+.27))*spot.strength);}
  // Broad oven exposure remains visible between the discrete leopard marks.
  const golden=loopNoise(u,v,4,2,72)*.72+loopNoise(u,v,9,3,217)*.28,mottle=loopNoise(u,v,37,12,113);
  const outer=(1+Math.cos(v*Math.PI*2))*.5,shelter=(1-top)*(1-outer)*(.6+.4*(1-exposure));
  const flourField=loopNoise(u,v,83,19,741),flour=T.MathUtils.smoothstep(flourField,.74,.91)*(.025+.15*shelter)*(1-Math.max(baked,char));
  const bake=T.MathUtils.clamp(.05+top*.12+outer*.04+(golden-.46)*.78+(broad-.5)*.34+(mottle-.5)*.23+exposure*.20-shelter*.16,0,1);
  const carbon=Math.max(baked,char*.20,freckles*.50,hotChar),flourMask=flour;
  const caramel=T.MathUtils.smoothstep(bake,.54,.84),wheat=T.MathUtils.smoothstep(bake,.06,.54);
  const pore=T.MathUtils.smoothstep(micro,.72,.91),crease=Math.pow(Math.max(0,.22-medium),2)*90;
  const i=(y*w+x)*4;
  for(let k=0;k<3;k++){
   // Even lightly exposed skin stays recognizably baked; pale cream is reserved for sheltered folds.
   const base=T.MathUtils.lerp(T.MathUtils.lerp([231,210,173][k],[211,172,117][k],wheat),[156,106,65][k],caramel*.82);
   const toasted=T.MathUtils.lerp(base,[151,99,58][k],halo*.78);
   const browned=T.MathUtils.lerp(toasted,[83,54,34][k],T.MathUtils.smoothstep(carbon,.12,.78)*.94);
   const rareChar=T.MathUtils.smoothstep(hotChar,.78,.98)*T.MathUtils.smoothstep(carbon,.90,.99);
   const procedural=T.MathUtils.lerp(T.MathUtils.lerp(browned,[36,27,21][k],rareChar*.48),[241,229,203][k],flourMask*.13);
   // The rim circumference is much longer than its cross-section. Match texel
   // density in world units to avoid directional photographic streaks.
   const texU=u*3.4+Math.sin(v*5)*.035,texV=v*.82,generated=generatedPixel('crust',texU,texV);
   // Match the v36–38 crust: strong photographic albedo carries the oven
   // blistering, while the stable procedural bake field adds restrained variety.
   image.data[i+k]=T.MathUtils.lerp(procedural,generated[k],.98);
   hi.data[i+k]=137+blister*9+baked*6+(fine-.5)*5+(micro-.5)*3-pore*6-crease*.7+generatedRelief('crust',texU,texV)*22;
   // Toasted skin is a little smoother; flour and char both remain mostly matte.
   const dryFlour=flourMask*.48;
   ri.data[i+k]=T.MathUtils.clamp(240-caramel*21-blister*12+dryFlour*34+carbon*18+(medium-.5)*10,194,255);
  }
  image.data[i+3]=hi.data[i+3]=ri.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);hc.putImageData(hi,0,0);rc.putImageData(ri,0,0);
 const map=tex(c),bump=tex(height,false),roughness=tex(rough,false);for(const t of [map,bump,roughness])t.wrapS=t.wrapT=T.RepeatWrapping;return{map,bump,roughness};
}
function surfaceTextures(kind:'cheese'|'sauce'){
 const size=SURFACE_SIZE,detail=surfaceDetails(),c=canvas(size,size),b=canvas(size,size),r=canvas(size,size),ctx=c.getContext('2d')!,bc=b.getContext('2d')!,rc=r.getContext('2d')!;
 const data=ctx.createImageData(size,size),height=bc.createImageData(size,size),rough=rc.createImageData(size,size);
 const gridSize=128,fieldGrid=kind==='cheese'?new Float32Array((gridSize+1)**2):null;
 if(fieldGrid)for(let y=0;y<=gridSize;y++)for(let x=0;x<=gridSize;x++)fieldGrid[y*(gridSize+1)+x]=cheeseField((x/gridSize-.5)*5.3,(.5-y/gridSize)*5.3);
 const sampleField=(u:number,v:number)=>{const gx=u*gridSize,gy=v*gridSize,x=Math.floor(gx),y=Math.floor(gy),i=y*(gridSize+1)+x;return T.MathUtils.lerp(T.MathUtils.lerp(fieldGrid![i],fieldGrid![i+1],gx-x),T.MathUtils.lerp(fieldGrid![i+gridSize+1],fieldGrid![i+gridSize+2],gx-x),gy-y);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,j=(y*size+x)*SURFACE_CHANNELS,i=(y*size+x)*4;
  const broad=detail[j]/255,fine=detail[j+1]/255,grain=detail[j+2]/255,meso=detail[j+3]/255,oil=detail[j+4]/255,skin=detail[j+(kind==='cheese'?7:8)]/255-.5;
  const du=u-.5,dv=v-.5,radial=Math.hypot(du,dv),theta=(Math.atan2(dv,du)+Math.PI*2+noise(28,83)*Math.PI*2)%(Math.PI*2),spiralRadius=.045+theta*.028+.003*Math.sin(theta*2.1+.4),oilDrizzle=Math.exp(-Math.pow((radial-spiralRadius)/.0026,2));
  let rv:number,bump:number;
  if(kind==='cheese'){
   const f=sampleField(u,v),edge=1-T.MathUtils.smoothstep(f,CHEESE_EDGE,CHEESE_EDGE+.68);
   const toast=T.MathUtils.smoothstep(detail[j+6]/255*.67+meso*.33,.72,.91);
   // Opaque creamy centers, a thin warm melt at their perimeter. The stain is
   // keyed to real pool thickness; it is never a white overlay on the tomato.
   const melt=edge*(.34+broad*.18),cream=[229-broad*8,220-broad*9,198-broad*10];
   const photoU=u*1.8+Math.sin(v*8)*.035+.23,photoV=v*1.8+.41,photo=generatedPixel('mozzarella',photoU,photoV),base=cream.map((value,k)=>T.MathUtils.lerp(T.MathUtils.lerp(value,[232,204,149][k],melt),[180,126,64][k],toast*.42)+skin*14);
   for(let k=0;k<3;k++){const pooled=T.MathUtils.lerp(base[k],T.MathUtils.clamp(photo[k],[184,165,138][k],[246,239,222][k]),.96);data.data[i+k]=T.MathUtils.lerp(pooled,[204,158,57][k],oilDrizzle*.38);}
   bump=128+((fine-.5)*5+(meso-.5)*9+(grain-.5)*2+skin*54+generatedRelief('mozzarella',photoU,photoV)*170)*(.40+.60*(1-edge))+toast*5*(1-edge);
   // Patchy whey/oil sheen, with rounded cheese remaining softer and less wet
   // than tomato. Effective roughness is .28–.49, independent of the color map.
   const cheeseRoughness=T.MathUtils.clamp(T.MathUtils.lerp(generatedRoughness('mozzarella',photoU,photoV),.46+broad*.045+(fine-.5)*.025-oil*.08-edge*.018-oilDrizzle*.11,.38),.31,.61);
   rv=255*cheeseRoughness/.70;
  }else{
   const pulp=T.MathUtils.smoothstep(meso*.66+fine*.34,.32,.70);
   const water=detail[j+5]/255*(1-pulp*.60);
   const fleck=T.MathUtils.smoothstep(fine,.66,.86);
   // Warm San Marzano reds. Pulp, oil and watery highlights cannot desaturate
   // this albedo: photographed white highlights contribute to relief only.
   const tomato=T.MathUtils.smoothstep(broad,.18,.83),concentration=pulp*.13+fleck*.055;
   const photoU=u*2.6+Math.sin(v*6)*.04+.37,photoV=v*2.6+.19,photo=generatedPixel('tomato',photoU,photoV),base=[0,1,2].map(k=>T.MathUtils.lerp(T.MathUtils.lerp([143,25,9][k],[199,44,13][k],tomato),[127,22,8][k],concentration)+water*[9,6,1][k]+skin*[18,4,1][k]);
   const cooked=[T.MathUtils.clamp(photo[0],94,216),T.MathUtils.clamp(photo[1],13,72),T.MathUtils.clamp(photo[2],4,43)];
   for(let k=0;k<3;k++){const pulpColor=T.MathUtils.lerp(base[k],cooked[k],.78);data.data[i+k]=T.MathUtils.lerp(pulpColor,[207,155,46][k],oilDrizzle*.44);}
   bump=128+(pulp-.5)*20+(fine-.5)*10*(1-water*.70)+(grain-.5)*3+skin*42*(1-water*.28)+generatedRelief('tomato',photoU,photoV)*82-water*5+fleck*5;
   // Keep the generated tomato map in relief; its pale wet pixels were tinting
   // the red albedo pink. Moisture is now carried by restrained roughness.
   const wetRoughness=T.MathUtils.clamp(T.MathUtils.lerp(generatedRoughness('tomato',photoU,photoV),.39+pulp*.12-water*.065-oil*.014-oilDrizzle*.13,.44),.24,.52);
   rv=255*wetRoughness/.50;
  }
  data.data[i+3]=255;
  for(let k=0;k<3;k++){height.data[i+k]=bump;rough.data[i+k]=rv;}height.data[i+3]=rough.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);bc.putImageData(height,0,0);rc.putImageData(rough,0,0);return{map:tex(c),bump:tex(b,false),roughness:tex(r,false)};
}

/** Tileable multi-octave height noise. Kept in linear data space, independent of color. */
function noiseBump(kind:'dough'|'strand'){
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
function normalFromHeight(height:T.CanvasTexture,strength:number,repeatMultiplier=4){
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


/** Four non-repeating cut-crumb maps: large alveoli, medium cells, fine pores.
 * Large cavities also drive cut-face recesses; small pores remain in bump. */
function crumbCells(seed:number){
 const cells:{u:number,v:number,rx:number,ry:number,c:number,s:number,phase:number}[]=[];
 const add=(u:number,v:number,rx:number,ry:number,angle:number,key:number)=>cells.push({u,v,rx,ry,c:Math.cos(angle),s:Math.sin(angle),phase:rand(key)*Math.PI*2});
 for(const [i,cell] of [[.25,.57,.18,.23,-.4],[.63,.54,.145,.20,.2],[.52,.83,.17,.085,-.1],[.29,.23,.11,.12,.4]].entries()){
  const k=seed+i*37;add(cell[0]+(rand(k)-.5)*.07,cell[1]+(rand(k+1)-.5)*.055,cell[2]*(.85+rand(k+2)*.30),cell[3]*(.85+rand(k+3)*.30),cell[4]+(rand(k+4)-.5)*.4,k+5);
 }
 for(let i=0;i<340&&cells.length<58;i++){
  const k=seed+i*19+401,u=.04+rand(k)*.92,v=.045+rand(k+1)*.91;
  const size=i<90?.037+rand(k+2)**2*.045:.007+rand(k+2)**2*.025;
  // Rejection packing leaves irregular thin walls, without rows or equal spacing.
  if(cells.some(c=>{const dx=u-c.u,dy=v-c.v,x=(dx*c.c+dy*c.s)/(c.rx+size*.80),y=(-dx*c.s+dy*c.c)/(c.ry+size*.80);return x*x+y*y<1.05;}))continue;
  add(u,v,size*(.72+rand(k+3)*.50),size*(.6+rand(k+4)*.7),rand(k+5)*Math.PI,k+6);
 }
 return cells;
}
const crumbVariants=Array.from({length:4},(_,i)=>crumbCells(122+i*971));
export function crumbCavity(u:number,v:number,variant=0,macroOnly=false){
 let cavity=0;
 for(const c of crumbVariants[variant]){
  if(macroOnly&&Math.max(c.rx,c.ry)<.075)continue;
  const dx=u-c.u,dy=v-c.v;if(Math.abs(dx)>Math.max(c.rx,c.ry)*1.2||Math.abs(dy)>Math.max(c.rx,c.ry)*1.2)continue;
  const x=(dx*c.c+dy*c.s)/c.rx,y=(-dx*c.s+dy*c.c)/c.ry,a=Math.atan2(y,x);
  const d=Math.hypot(x,y)/(1+.10*Math.sin(a*3+c.phase)+.055*Math.sin(a*5-c.phase)+.022*Math.sin(a*9+c.phase));
  cavity=Math.max(cavity,1-T.MathUtils.smoothstep(d,.66,1));
 }
 return cavity;
}
function crumbTextures(){
 const size=384,w=size*4,c=canvas(w,size),b=canvas(w,size),ctx=c.getContext('2d')!,bc=b.getContext('2d')!;
 const data=ctx.createImageData(w,size),height=bc.createImageData(w,size);
 for(let y=0;y<size;y++)for(let x=0;x<w;x++){
  const variant=Math.floor(x/size),u=(x%size)/size,v=1-y/size,cavity=crumbCavity(u,v,variant),fine=noise(u*230+variant*41,v*230),grain=(fine-.5)*6,i=(y*w+x)*4;
  const fiber=(noise(u*95+variant*19,v*155)-.5)*9*(1-cavity),warm=noise(u*14+variant*17,v*14);
  data.data[i]=245-cavity*(43+warm*13)+grain+fiber;data.data[i+1]=229-cavity*(56+warm*15)+grain+fiber;data.data[i+2]=190-cavity*(67+warm*16)+grain+fiber;data.data[i+3]=255;
  const pore=Math.pow(Math.max(0,(fine-.66)*2.94),2)*20*(1-cavity);
  for(let k=0;k<3;k++)height.data[i+k]=181-cavity*95+grain+fiber*.6-pore;
  height.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);bc.putImageData(height,0,0);return{map:tex(c),bump:tex(b,false)};
}

/** Oven-floor contact: dry flour, broad bake mottling and opaque carbon flecks.
 * Global XZ UVs keep this continuous across every slice and the lower rim. */
function undersideTextures(){
 const size=768,c=canvas(size,size),b=canvas(size,size),r=canvas(size,size),ctx=c.getContext('2d')!,bc=b.getContext('2d')!,rc=r.getContext('2d')!;
 const data=ctx.createImageData(size,size),height=bc.createImageData(size,size),rough=rc.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,wx=u+(noise(u*11,v*11)-.5)*.065,wy=v+(noise(u*11+8,v*11+3)-.5)*.065;
  const broad=noise(wx*15+24,wy*15+5),medium=noise(wx*49+15,wy*49+37),fine=noise(u*340+11,v*340+63);
  const toast=T.MathUtils.smoothstep(broad*.65+medium*.35,.38,.77);
  const patch=T.MathUtils.smoothstep(medium*.63+broad*.37,.65,.83);
  const fleck=T.MathUtils.smoothstep(fine,.73,.90)*(.20+.80*T.MathUtils.smoothstep(broad,.30,.65));
  const carbon=Math.max(patch,fleck),flour=T.MathUtils.smoothstep(noise(u*87+6,v*87+21),.72,.92)*.24;
  const center=1-T.MathUtils.smoothstep(Math.hypot(u-.5,v-.5),.29,.45),grain=(fine-.5)*12,i=(y*size+x)*4;
  const base=[224-toast*83,185-toast*100-center*10,124-toast*82-center*9];
  for(let k=0;k<3;k++){data.data[i+k]=T.MathUtils.lerp(T.MathUtils.lerp(base[k],22+k*2,carbon),[241,226,195][k],flour)+grain;height.data[i+k]=139+(medium-.5)*14+(fine-.5)*22-carbon*13;rough.data[i+k]=234+flour*50-carbon*10;}
  data.data[i+3]=height.data[i+3]=rough.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);bc.putImageData(height,0,0);rc.putImageData(rough,0,0);
 const result={map:tex(c),bump:tex(b,false),roughness:tex(r,false)};
 for(const t of Object.values(result))t.channel=1;
 return result;
}

function basilTextures(){
 const size=256,c=canvas(size,size),b=canvas(size,size),ctx=c.getContext('2d')!,bc=b.getContext('2d')!,data=ctx.createImageData(size,size),height=bc.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,d=Math.abs(u-.5),center=Math.exp(-d*d*1600),branch=Math.exp(-Math.pow(Math.sin((v+d*.6)*Math.PI*9),2)*180)*(1-d*1.8),n=noise(u*55,v*85),vein=Math.max(center,branch*.55),i=(y*size+x)*4;
  data.data[i]=61+vein*15+n*12;data.data[i+1]=104+vein*19+n*15;data.data[i+2]=31+vein*10+n*8;data.data[i+3]=255;
  for(let k=0;k<3;k++)height.data[i+k]=125+vein*35+(n-.5)*8;height.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);bc.putImageData(height,0,0);return{map:tex(c),bump:tex(b,false)};
}
export async function createMaterials(){
 await Promise.all([loadGeneratedTiles(),loadToppingDetail()]);
 const crust=await crustTextures();
 const cheese=surfaceTextures('cheese'),sauce=surfaceTextures('sauce'),doughBump=noiseBump('dough'),crumb=crumbTextures(),underside=undersideTextures(),basil=basilTextures();
 const baseNormal=normalFromHeight(doughBump,4.5);baseNormal.channel=1;
 const cheeseMaterial=new T.MeshPhysicalMaterial({map:cheese.map,metalness:0,ior:1.38,specularIntensity:.52,roughness:.70,roughnessMap:cheese.roughness,bumpMap:cheese.bump,bumpScale:.034,normalMap:normalFromHeight(cheese.bump,4.0,1),normalScale:new T.Vector2(.34,.34),clearcoat:.025,clearcoatRoughness:.48,sheen:.055,sheenColor:new T.Color('#f2dfbf'),sheenRoughness:.88,side:T.DoubleSide});
 // A cloned surface material keeps the exact same photo maps and map transforms.
 // Only the vertex thickness attribute changes optically as the cheese stretches.
 const strandMaterial=cheeseMaterial.clone();
 return {
 underside:new T.MeshPhysicalMaterial({map:underside.map,roughness:.98,roughnessMap:underside.roughness,bumpMap:underside.bump,bumpScale:.035,normalMap:baseNormal,normalScale:new T.Vector2(.23,.23)}),
 crumb:new T.MeshPhysicalMaterial({map:crumb.map,bumpMap:crumb.bump,bumpScale:.017,roughness:.96,side:T.DoubleSide}),
 cheese:cheeseMaterial,
 dough:new T.MeshPhysicalMaterial({color:'#e2c79f',roughness:.93,bumpMap:doughBump,bumpScale:.045,normalMap:normalFromHeight(doughBump,7),normalScale:new T.Vector2(.40,.40)}),
 sauce:new T.MeshPhysicalMaterial({map:sauce.map,metalness:0,ior:1.36,specularIntensity:.38,roughness:.50,roughnessMap:sauce.roughness,bumpMap:sauce.bump,bumpScale:.018,normalMap:normalFromHeight(sauce.bump,2.6,1),normalScale:new T.Vector2(.24,.24),clearcoat:0,clearcoatRoughness:.42}),
 crust:new T.MeshPhysicalMaterial({map:crust.map,metalness:0,ior:1.45,specularIntensity:.65,roughness:.98,roughnessMap:crust.roughness,bumpMap:crust.bump,bumpScale:.025,normalMap:normalFromHeight(crust.bump,2.6,1),normalScale:new T.Vector2(.19,.19)}),
 strand:strandMaterial,
 basil:new T.MeshPhysicalMaterial({map:basil.map,bumpMap:basil.bump,bumpScale:.008,roughness:.56,side:T.DoubleSide,vertexColors:true}),
 };
}
export type Materials=Awaited<ReturnType<typeof createMaterials>>;

/** Reuse texture identities so WebGPU SSS nodes keep reading the updated distribution. */
export function refreshMozzarellaMaterial(material:T.MeshPhysicalMaterial){
 const next=surfaceTextures('cheese');
 for(const [property,key] of [['map','map'],['bumpMap','bump'],['roughnessMap','roughness']] as const){const current=material[property];if(current){current.image=next[key].image;current.needsUpdate=true;}next[key].dispose();}
 // The normal is now pool-specific, so amount/seed updates must refresh it too.
 // Preserve its texture object for the already compiled WebGPU normal node.
 const nextNormal=normalFromHeight(material.bumpMap as T.CanvasTexture,2.4,1);
 if(material.normalMap){material.normalMap.image=nextNormal.image;material.normalMap.needsUpdate=true;}nextNormal.dispose();
}
