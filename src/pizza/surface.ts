import { noise, rand } from '../utils/noise';
const TAU=Math.PI*2;
const angleDistance=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Periodic low-frequency fields give the rim a continuous, handmade silhouette. */
export function outline(a:number){return 1+(noise(Math.cos(a)*1.8+8,Math.sin(a)*1.8+5)-.5)*.095;}
export const airPockets=Array.from({length:7+Math.floor(rand(3201)*5)},(_,i)=>({angle:rand(i*31+771)*TAU,spread:.12+rand(i*13+631)*.20,rise:.035+Math.pow(rand(i*17+109),2.2)*.17,breadth:.018+Math.pow(rand(i*7+991),2)*.065,crown:.55+rand(i*23+438)*2.05}));
const collapsed=Array.from({length:5},(_,i)=>({angle:rand(i*41+291)*TAU,spread:.15+rand(i*19+378)*.28,depth:.045+rand(i*11+57)*.075}));
/** Medium blisters are modeled first; the crust bake texture samples this same field. */
export const crustBlisters=Array.from({length:76},(_,i)=>{
 const k=5101+i*29,cluster=rand(k)<.58?airPockets[Math.floor(rand(k+1)*airPockets.length)]:null;
 return {angle:cluster?cluster.angle+(rand(k+2)-.5)*cluster.spread*1.7:rand(k+3)*TAU,
  cross:cluster?cluster.crown+(rand(k+4)-.5)*.82:.48+rand(k+5)*2.3,
  angular:.035+Math.pow(rand(k+6),1.5)*.11,crossWidth:.16+rand(k+7)*.34,
  // Most blisters stay modest; a few rise enough to shape highlights and the crust silhouette.
  height:.016+Math.pow(rand(k+8),1.7)*.090,phase:rand(k+9)*TAU};
});
const folds=Array.from({length:18},(_,i)=>{const k=9401+i*31;return{angle:rand(k)*TAU,cross:.45+rand(k+1)*2.55,angular:.045+rand(k+2)*.13,crossWidth:.10+rand(k+3)*.20,depth:.006+rand(k+4)*.018,phase:rand(k+5)*TAU};});
/** Low-resolution cached field keeps the texture bake inexpensive and fixed in world space. */
const reliefWidth=384,reliefHeight=128,reliefGrid=new Float32Array(reliefWidth*reliefHeight);
for(let y=0;y<reliefHeight;y++)for(let x=0;x<reliefWidth;x++){
 const a=x/reliefWidth*TAU,b=y/reliefHeight*TAU;let value=0;
 for(const blister of crustBlisters){const da=angleDistance(a,blister.angle)/blister.angular,db=angleDistance(b,blister.cross)/blister.crossWidth;const d=da*da*1.55+db*db*1.35;value+=blister.height*Math.exp(-d);}
 for(const fold of folds){const da=angleDistance(a,fold.angle)/fold.angular,db=angleDistance(b,fold.cross)/fold.crossWidth;value-=fold.depth*Math.exp(-(da*da*1.3+db*db*1.2));}
 reliefGrid[y*reliefWidth+x]=value;
}
export function crustRelief(a:number,b:number){
 const x=((a/TAU%1)+1)%1*reliefWidth,y=((b/TAU%1)+1)%1*reliefHeight,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
 const at=(ix:number,iy:number)=>reliefGrid[((iy+reliefHeight)%reliefHeight)*reliefWidth+(ix+reliefWidth)%reliefWidth];
 const lo=at(x0,y0)*(1-fx)+at(x0+1,y0)*fx,hi=at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx;
 return lo*(1-fy)+hi*fy;
}
export function rimShape(a:number){
 const broad=noise(Math.cos(a)*1.55+14,Math.sin(a)*1.55+31),shoulder=noise(Math.cos(a)*2.6+43,Math.sin(a)*2.6+12);
 const local=noise(Math.cos(a)*4.4+19,Math.sin(a)*4.4+63),pinchField=noise(Math.cos(a)*7.1+57,Math.sin(a)*7.1+24);
 let rise=0,spread=0,collapse=0;
 for(const pocket of airPockets){const da=angleDistance(a,pocket.angle)/pocket.spread,weight=Math.exp(-da*da*1.15);rise+=pocket.rise*weight;spread+=pocket.breadth*weight;}
 for(const flat of collapsed){const da=angleDistance(a,flat.angle)/flat.spread;collapse+=flat.depth*Math.exp(-da*da*1.2);}
 const macro=(broad-.5)*.12,low=(shoulder-.5)*.14,localBulge=(local-.5)*.038,localPinch=Math.pow(TClamp((pinchField-.58)*2.3,0,1),2)*.024;
 // Fine cross-section changes sit on top of the preserved broad silhouette:
 // soft compression and local inflation keep the rim from reading as one hose.
 return {center:2.265*outline(a)+macro*.30,width:TClamp(.295+macro+Math.min(.085,spread)-collapse*.13+localBulge-localPinch,.20,.41),height:TClamp(.465+low+Math.min(.21,rise)-collapse+(local-.5)*.060-localPinch*.65,.28,.76),flatten:TClamp(.08+(1-shoulder)*.28+collapse*1.4+localPinch*.85,.05,.52),lean:(noise(Math.cos(a)*1.8+72,Math.sin(a)*1.8+18)-.5)*.13,pinch:(noise(Math.cos(a)*3.1+11,Math.sin(a)*3.1+19)-.5)*.12};
}
export function rimPoint(a:number,b:number){
 const s=rimShape(a),sin=Math.sin(b),cos=Math.cos(b),relief=crustRelief(a,b);
 const broadLobe=(noise(Math.cos(a)*1.55+14,Math.sin(a)*1.55+31)-.5)*.065;
 const sideBulge=s.width*(cos+s.lean*sin+s.pinch*cos*sin)+broadLobe*cos+relief*cos;
 const r=s.center+sideBulge+Math.max(0,sin)*Math.max(0,sin)*.026;
 // Variable crown flattening and asymmetric shoulders break the hose-like ellipse.
 const domeExponent=.88+.30*noise(Math.cos(a)*2.2+11,Math.sin(a)*2.2+19);
 const crown=Math.pow(Math.max(0,sin),domeExponent)*(1-s.flatten*Math.pow(Math.max(0,sin),2));
 const y=.105+(sin>=0?s.height*crown+relief*sin:.05*sin+relief*sin*.22);
 return {r,y};
}
function TClamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
let mozzarellaSeed=0;
function makePools(seed:number){const random=(key:number)=>rand(key+seed*104729);
return Array.from({length:43},(_,i)=>{
 const a=random(i*17+71)*TAU,r=Math.sqrt(random(i*11+163))*2.02;
 const rotation=random(i*23+302)*TAU;
 return {x:Math.cos(a)*r,z:Math.sin(a)*r,rx:.25+Math.pow(random(i*19+61),1.7)*.23,rz:.21+Math.pow(random(i*7+83),1.5)*.21,c:Math.cos(rotation),s:Math.sin(rotation)};
});}
export const pools=makePools(mozzarellaSeed);
export function getMozzarellaSeed(){return mozzarellaSeed;}
export function setMozzarellaSeed(value:number){mozzarellaSeed=Math.max(0,Math.min(999999,Math.trunc(Number.isFinite(value)?value:0)));pools.splice(0,pools.length,...makePools(mozzarellaSeed));}
let mozzarellaAmount=100;
export function setMozzarellaAmount(value:number){mozzarellaAmount=Math.max(50,Math.min(200,Number.isFinite(value)?value:100));}
export function getMozzarellaAmount(){return mozzarellaAmount;}
/** Stable nested pool population: adding cheese reveals new seeded islands, with modest growth. */
export function mozzarellaPopulation(){return mozzarellaAmount===0?0:Math.min(pools.length,25*Math.pow(mozzarellaAmount/100,.75));}
/** Globally shared field: pools and their irregular edges match across slice cuts. */
export function cheeseField(x:number,z:number){
 const wx=x+(noise(x*3+31,z*3+12)-.5)*.105,wz=z+(noise(x*3+4,z*3+48)-.5)*.105;
 let field=0;const population=mozzarellaPopulation(),size=1.16+.08*(mozzarellaAmount/100-1);
 for(let i=0;i<Math.ceil(population);i++){const p=pools[i],weight=Math.min(1,population-i);const dx=wx-p.x,dz=wz-p.z;const u=(dx*p.c+dz*p.s)/(p.rx*size),v=(-dx*p.s+dz*p.c)/(p.rz*size);const d=u*u+v*v;if(d<5)field+=weight*Math.exp(-1.4*d);}
 return field;
}
export const CHEESE_EDGE=.35;
// World scale: 60 mm/unit. A 1.5 mm baked center rises gently into the rim.
export const DOUGH_BOTTOM=.055, DOUGH_TOP=.080, DOUGH_NEUTRAL=.0675;
export const SAUCE_BOTTOM=.081, SAUCE_TOP=.084, CHEESE_BOTTOM=.084;
export function shoulderHeight(x:number,z:number){const t=Math.max(0,Math.min(1,(Math.hypot(x,z)-1.68)/.68));return .023*t*t*(3-2*t);}

export function cheeseHeight(x:number,z:number,field=cheeseField(x,z)){
 const density=Math.max(0,field-CHEESE_EDGE),mound=Math.pow(1-Math.exp(-density*2.1),.72);
 const fold=Math.pow(noise(x*10+41,z*10+62),2)*.012*mound*(1-mound*.4);
 const ripple=(noise(x*18+10,z*18+20)-.5)*.005*mound;
 // A thin melted perimeter rises smoothly into uneven, rounded centers without a flat plateau.
 return .094+shoulderHeight(x,z)+.074*mound+fold+ripple;
}

/** Small, shared cut-edge irregularity; zero at the center and cornicione. */
export function cutAngle(a:number,r:number){
 // The seam at 0/2π must use the same field as every other shared slice edge.
 const angle=a*13,field=noise(Math.cos(angle)*2.2+r*8+27,Math.sin(angle)*2.2+r*8+19);
 return a+(field-.5)*.004*Math.sin(Math.PI*Math.min(1,r/2.45));
}
