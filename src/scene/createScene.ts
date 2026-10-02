import * as T from 'three';
import {quality} from '../performance/quality';
import {ResolutionBudget} from '../performance/ResolutionBudget';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
const studioEnvironmentUrl=new URL('../assets/pizza-studio-environment.hdr',import.meta.url).href;
export async function createScene(canvas:HTMLCanvasElement){
 // Dark, warm studio field follows the food-photography reference while the
 // editorial interface surrounding the viewport remains unchanged.
 const scene=new T.Scene();scene.background=new T.Color('#171513');scene.fog=new T.Fog('#171513',22,48);
 const camera=new T.PerspectiveCamera(35,1,.1,70);
 let renderer:any,backend='WebGL 2';
 if('gpu' in navigator){
  try{const {WebGPURenderer}=await import('three/webgpu');renderer=new WebGPURenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});await renderer.init();backend=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2';}catch{renderer?.dispose();renderer=null;}
 }
 if(!renderer)renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 const resolution=new ResolutionBudget(Math.min(devicePixelRatio,quality.mobile?1.5:1.75),Math.min(devicePixelRatio,quality.mobile?1.25:1));
 renderer.setPixelRatio(resolution.ratio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.outputColorSpace=T.SRGBColorSpace;
 const environment=new RoomEnvironment();
 try{
  const source=await new HDRLoader().loadAsync(studioEnvironmentUrl);source.mapping=T.EquirectangularReflectionMapping;
  if(renderer.isWebGPURenderer){const {PMREMGenerator}=await import('three/webgpu');const pmrem=new PMREMGenerator(renderer);scene.environment=(await (pmrem as any).fromEquirectangularAsync(source)).texture;pmrem.dispose();}
  else{const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(source).texture;pmrem.dispose();}
  source.dispose();
  // Soft world-space studio reflections add dimensional fill while the separate
  // key and rim lights continue to define the food and cast contact shadows.
  scene.environmentIntensity=.15;
 }catch(error){console.warn('Image-based studio lighting unavailable; using generated room and direct lights.',error);
  try{if(renderer.isWebGPURenderer){const {PMREMGenerator}=await import('three/webgpu');const pmrem=new PMREMGenerator(renderer);scene.environment=(await pmrem.fromSceneAsync(environment,.055)).texture;pmrem.dispose();}
   else{const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environment,.055).texture;pmrem.dispose();}scene.environmentIntensity=.16;
  }catch(fallbackError){console.warn('Studio reflections unavailable; using direct studio lights.',fallbackError);}
 }finally{environment.dispose();}
 const hemi=new T.HemisphereLight('#fff0dc','#51443a',.09);scene.add(hemi);
 // Three-point food-photography rig: a lower side key defines the crust,
 // a restrained opposite fill preserves shadow color, and a warm rear rim
 // picks up dough translucency and mozzarella edges without flattening the top.
 const key=new T.DirectionalLight('#fff0dc',1.75);key.position.set(-4.5,3.8,3.5);key.castShadow=true;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;key.shadow.mapSize.set(quality.mobile?1024:2048,quality.mobile?1024:2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.009;key.shadow.bias=-.0002;key.shadow.radius=6;scene.add(key);
 const fill=new T.DirectionalLight('#e7d9c6',.30);fill.position.set(5,2.6,1.5);scene.add(fill);
 const rim=new T.DirectionalLight('#ffc477',1.05);rim.position.set(-3.5,2.0,-5);scene.add(rim);
 const floor=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshStandardMaterial({color:'#25211d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.001;floor.receiveShadow=true;scene.add(floor);
 // A soft contact occlusion field grounds the thin dough without hard outlines.
 const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=128;const ctx=textureCanvas.getContext('2d')!;const grad=ctx.createRadialGradient(64,64,20,64,64,64);grad.addColorStop(0,'rgba(55,43,23,.21)');grad.addColorStop(.70,'rgba(55,43,23,.13)');grad.addColorStop(1,'rgba(55,43,23,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
 const contact=new T.Mesh(new T.PlaneGeometry(6.4,6.4),new T.MeshBasicMaterial({map:new T.CanvasTexture(textureCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.009;scene.add(contact);
 function resize(){const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);camera.aspect=w/h;const distance=Math.max(10.8,6.6/(camera.aspect*2*Math.tan(35*Math.PI/360)));if(camera.position.lengthSq()===0){camera.position.set(.275,.815,.55).normalize().multiplyScalar(distance);camera.lookAt(0,.25,0);}camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
 resize();new ResizeObserver(resize).observe(canvas.parentElement!);window.addEventListener('resize',resize);return{scene,camera,renderer,backend,key,rim,fill,resolution};
}
