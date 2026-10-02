import './style.css';
import {quality} from './performance/quality';
import * as T from 'three';
import { createScene } from './scene/createScene';
import {setMozzarellaAmount,setMozzarellaSeed,getMozzarellaSeed} from './pizza/surface';
import { createMaterials,refreshMozzarellaMaterial } from './pizza/materials';
import { applyScattering,setScatteringMultiplier } from './pizza/scattering';
import { PizzaSlice, weldSliceSeamNormals } from './pizza/PizzaSlice';
import { CheeseSystem } from './cheese/CheeseSystem';
import { PhysicsWorld } from './physics/PhysicsWorld';
import {OrbitCamera} from './interaction/OrbitCamera';
import {pizzaSeed} from './utils/noise';
import { DragController } from './interaction/DragController';
import { mountUI } from './ui/Controls';
import { params } from './presets/presets';
mountUI();
async function start(){
 const canvas=document.querySelector('#scene') as HTMLCanvasElement;
 const {scene,camera,renderer,backend,key,rim,fill,resolution}=await createScene(canvas);
 let shadowsDirty=true,lastShadow=0;
 document.querySelector('#control-body')!.addEventListener('input',()=>{shadowsDirty=true;});
 document.querySelector('#loading-message')!.textContent='PREPARING MOZZARELLA';
 await new Promise<void>(r=>requestAnimationFrame(()=>r()));
 setMozzarellaAmount(params.mozzarella);
 const materials=await createMaterials();await applyScattering(materials,!!renderer.isWebGPURenderer);
 const slices=Array.from({length:6},(_,i)=>new PizzaSlice(i,materials));slices.forEach(s=>scene.add(s.group));weldSliceSeamNormals(slices);
 const cheese=new CheeseSystem(slices,scene,materials.strand),world=new PhysicsWorld(slices,cheese);
 document.querySelector('#control-body')!.addEventListener('input',()=>world.wakeAll());
 const orbit=new OrbitCamera(canvas,camera,world);
 const controller=new DragController(canvas,camera,world,()=>document.querySelector('#hint')!.classList.add('hidden'),orbit);
 let amountTimer:ReturnType<typeof setTimeout>|undefined;
 const applyAmount=()=>{shadowsDirty=true;clearTimeout(amountTimer);setMozzarellaAmount(params.mozzarella);cheese.clear();
  refreshMozzarellaMaterial(materials.cheese);for(const slice of slices){slice.rebuildMozzarella();slice.hasCheese=slice.group.position.distanceTo(slice.home)>.42;}weldSliceSeamNormals(slices);world.wakeAll();};
 // Debounce expensive contour/texture rebuilding while the native slider stays responsive.
 document.querySelector('#mozzarella-input')!.addEventListener('input',()=>{clearTimeout(amountTimer);amountTimer=setTimeout(applyAmount,120);});
 document.querySelector('#mozzarella-input')!.addEventListener('change',applyAmount);
 const seedInput=document.querySelector('#mozzarella-seed') as HTMLInputElement;
 const changeSeed=()=>{setMozzarellaSeed(seedInput.valueAsNumber);seedInput.value=String(getMozzarellaSeed());canvas.dataset.mozzarellaSeed=seedInput.value;applyAmount();};
 seedInput.addEventListener('change',changeSeed);
 document.querySelector('#shuffle-mozzarella')!.addEventListener('click',()=>{let next=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;if(next===getMozzarellaSeed())next=(next+1)%1000000;seedInput.value=String(next);changeSeed();});
 canvas.dataset.mozzarellaSeed=String(getMozzarellaSeed());
 document.querySelector('#camera-reset')!.addEventListener('click',()=>orbit.reset());document.querySelector('#hold')!.addEventListener('click',controller.togglePin);
 function reset(){shadowsDirty=true;controller.release();world.reset();weldSliceSeamNormals(slices);document.querySelector('#hint')!.classList.remove('hidden');}
 document.querySelector('#reset')!.addEventListener('click',reset);
 document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'&&!(e.target instanceof HTMLInputElement)&&!e.metaKey&&!e.ctrlKey)reset();});
 const elements=Object.fromEntries(['stretch','length','active','bend','integrity','integrity-bar','status','fps','physics'].map(id=>[id,document.getElementById(id)!]));
 let previous=performance.now(),lastUI=0,frames=0,elapsed=0,smoothedPhysics=0;
 canvas.dataset.seed=String(pizzaSeed);
 const debug=import.meta.env.DEV&&new URLSearchParams(location.search).has('debug');
 let debugPoints:T.Points|undefined,debugPositions:Float32Array|undefined;
 if(debug){
  const lighting={setEnvironment:(intensity:number,rotation=scene.environmentRotation.y)=>{scene.environmentIntensity=T.MathUtils.clamp(intensity,0,3);scene.environmentRotation.y=rotation;},setKey:(intensity:number,x:number,y:number,z:number)=>{key.intensity=T.MathUtils.clamp(intensity,0,8);key.position.set(x,y,z);shadowsDirty=true;},setExposure:(value:number)=>renderer.toneMappingExposure=T.MathUtils.clamp(value,.3,2),setSSS:(value:number)=>setScatteringMultiplier(materials,value)};
  Object.assign(window,{pizzaLighting:lighting});
  debugPositions=new Float32Array(1200*3);const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(debugPositions,3));geometry.setDrawRange(0,0);debugPoints=new T.Points(geometry,new T.PointsMaterial({color:'#d537bb',size:.06,depthTest:false}));debugPoints.frustumCulled=false;scene.add(debugPoints);Object.assign(window,{pizzaDebug:{world,cheese,slices,renderer,backend,seed:pizzaSeed,orbit,scene,key,rim,fill}});}
 const frame=(now:number)=>{
  const frameSeconds=(now-previous)/1000,dt=Math.min(frameSeconds,.05);previous=now;
  if(document.hidden)return;
  if(resolution.update(frameSeconds))renderer.setPixelRatio(resolution.ratio);
  const movingSurface=slices.some(s=>(s.detached&&!s.sleeping)||s.surfaceDirty||s.cheeseNecks.length>0)||cheese.strands.length>0;
  world.advance(dt);smoothedPhysics=smoothedPhysics*.94+world.timeMs*.06;
  for(const s of slices){if(s.detached&&!s.sleeping)s.updateGeometry(false,world.accumulator/world.fixedDt);else if(s.cheeseNecks.length||s.surfaceDirty)s.updateGeometry(true);}
  orbit.update(dt);cheese.render(camera,canvas.clientHeight);
  if(debugPoints&&debugPositions){let i=0;for(const s of [...cheese.strands,...slices.filter(s=>s.cloth.active).map(s=>({points:s.cloth.points}))])for(const p of s.points){debugPositions[i++]=p.x;debugPositions[i++]=p.y;debugPositions[i++]=p.z;}debugPoints.geometry.setDrawRange(0,i/3);debugPoints.geometry.attributes.position.needsUpdate=true;}
  shadowsDirty ||= movingSurface;
  key.shadow.needsUpdate=shadowsDirty&&(!quality.mobile||now-lastShadow>=1000/30);
  if(key.shadow.needsUpdate){lastShadow=now;shadowsDirty=false;}
  renderer.render(scene,camera);frames++;elapsed+=frameSeconds;
  if(now-lastUI>200){const m=cheese.metrics;elements.stretch.textContent=String(m.stretch);elements.length.textContent=String(m.length);elements.active.textContent=String(m.active);const deflection=Math.max(...slices.map(s=>Math.max(0,s.bend)));elements.bend.textContent=String(Math.round(Math.atan2(deflection,2.34)*180/Math.PI));elements.integrity.textContent=`${m.integrity}%`;elements['integrity-bar'].style.width=`${m.integrity}%`;elements['integrity-bar'].style.background=m.integrity<35?'#b94d2c':'#777e5c';const status=m.integrity===0?'PIZZA REMAINS EDIBLE':m.integrity<60?'MOZZARELLA EXCEEDS SPECIFICATION':m.stretch>600?'CHEESE TENSION CRITICAL':'MOZZARELLA INTEGRITY NOMINAL';if(elements.status.textContent!==status)elements.status.textContent=status;elements.fps.textContent=String(Math.round(frames/Math.max(.001,elapsed)));elements.physics.textContent=smoothedPhysics.toFixed(1);lastUI=now;frames=elapsed=0;}
 };
 renderer.setAnimationLoop(frame);document.querySelector('#loading')!.classList.add('done');
 canvas.addEventListener('webglcontextlost',(e:Event)=>{e.preventDefault();controller.release();document.querySelector('#error')!.removeAttribute('hidden');});
}
start().catch(error=>{console.error('Pizza Physics could not initialize',error);document.querySelector('#loading')!.classList.add('done');document.querySelector('#error')!.removeAttribute('hidden');});
