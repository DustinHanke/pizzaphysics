import * as T from 'three';
import {quality} from '../performance/quality';
import type { Materials } from './materials';

const profiles={
 cheese:{strength:3.0,tint:'#fff0d1',power:1.8},
 // Stretched mozzarella uses the same scattering profile as the source pool.
 strand:{strength:3.0,tint:'#fff0d1',power:1.8},
 underside:{strength:3.1,tint:'#ffb96c',power:1.7},
 dough:{strength:5.2,tint:'#ffc77e',power:1.8},
 crust:{strength:4.5,tint:'#ffd08a',power:1.7},
 sauce:{strength:.3,tint:'#ed6f27',power:2.3},
 basil:{strength:1.2,tint:'#d5f39a',power:1.6},
 crumb:{strength:3.8,tint:'#ffcb81',power:1.8},
};

/** Stronger single-scattering translucency approximation, kept albedo- and thickness-aware. */
export async function applyScattering(materials:Materials,nodeRenderer:boolean){
 // Phone shaders keep albedo, roughness, normal and SSS, but avoid a second
 // derivative bump evaluation and barely-visible layered specular lobes.
 if(quality.mobile)for(const base of Object.values(materials)){
  base.clearcoat=0;base.sheen=0;
  for(const map of [base.map,base.normalMap,base.bumpMap,base.roughnessMap])if(map)map.anisotropy=2;
 }
 if(nodeRenderer){
  const [{MeshSSSNodeMaterial},{attribute,color,float,texture,normalMap,bumpMap,normalView,vec2,uniform}]=await Promise.all([import('three/webgpu'),import('three/tsl')]);
  for(const name of Object.keys(profiles) as (keyof typeof profiles)[]){
   const base=materials[name],profile=profiles[name];
   const material=new MeshSSSNodeMaterial({
    color:base.color,map:base.map,metalness:base.metalness,ior:base.ior,specularIntensity:base.specularIntensity,specularColor:base.specularColor,roughness:base.roughness,roughnessMap:base.roughnessMap,
    bumpMap:base.bumpMap,bumpScale:base.bumpScale,normalMap:base.normalMap,normalScale:base.normalScale,side:base.side,vertexColors:base.vertexColors,
    clearcoat:base.clearcoat,clearcoatRoughness:base.clearcoatRoughness,
    sheen:base.sheen,sheenColor:base.sheenColor,sheenRoughness:base.sheenRoughness,
   });
   // Three.js normally chooses normalMap OR bumpMap. Explicitly combine both.
   if(base.normalMap&&base.bumpMap&&!quality.mobile){
    const surfaceNormal=normalMap(texture(base.normalMap),vec2(base.normalScale.x,base.normalScale.y));
    const fineBump=bumpMap(texture(base.bumpMap).r,float(base.bumpScale));
    material.normalNode=surfaceNormal.add(fineBump.sub(normalView)).normalize();
   }
   const thickness=attribute('sssThickness','float').clamp((name==='cheese'||name==='strand') ? .02 : .08,1);
   const penetration=float(1).sub(thickness.mul(.72));
   // Albedo modulation keeps scorched crust dark; thinner cheese scatters more.
   const albedo=base.map?texture(base.map).rgb.mul(color(base.color)):color(base.color);
   material.thicknessColorNode=color(profile.tint).mul(albedo).mul(penetration);
   material.thicknessDistortionNode=float(.95);
   material.thicknessAmbientNode=float(.14);
   const attenuation=uniform(profile.strength);material.thicknessAttenuationNode=attenuation;material.userData.scatterStrength=attenuation;
   material.thicknessPowerNode=float(profile.power);
   material.thicknessScaleNode=float(7.2);
   material.name=`${name} / subsurface`;
   // Both material families expose the physical properties consumed by the pizza.
   materials[name]=material as unknown as T.MeshPhysicalMaterial;
   base.dispose();
  }
 }else{
  for(const name of Object.keys(profiles) as (keyof typeof profiles)[]){
   const material=materials[name],profile=profiles[name];
   const strength={value:profile.strength};material.userData.scatterStrength=strength;
   material.onBeforeCompile=shader=>{
    shader.uniforms.pizzaScatterColor={value:new T.Color(profile.tint)};
    shader.uniforms.pizzaScatterStrength=strength;
    shader.uniforms.pizzaScatterPower={value:profile.power};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float sssThickness;\nvarying float vPizzaThickness;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPizzaThickness = sssThickness;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',quality.mobile?'#include <normal_fragment_maps>':`#include <normal_fragment_maps>
     #if defined(USE_NORMALMAP_TANGENTSPACE) && defined(USE_BUMPMAP)
      normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
     #endif
    `).replace('#include <common>',`#include <common>
     uniform vec3 pizzaScatterColor;
     uniform float pizzaScatterStrength;
     uniform float pizzaScatterPower;
     varying float vPizzaThickness;
    `).replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
     void RE_Direct_Pizza(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
      RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
      vec3 scatteringHalf = normalize(directLight.direction + geometryNormal * 0.45);
      float backlight = pow(saturate(dot(geometryViewDir, -scatteringHalf)), pizzaScatterPower) * 6.8;
      float minThickness = ${name==='cheese'||name==='strand'?'.02':'.08'};
      float penetration = 1.0 - clamp(vPizzaThickness, minThickness, 1.0) * 0.64;
      reflectedLight.directDiffuse += (backlight + 0.14) * pizzaScatterColor * material.diffuseColor * penetration * pizzaScatterStrength * directLight.color;
     }
     #undef RE_Direct
     #define RE_Direct RE_Direct_Pizza
    `);
   };
   material.customProgramCacheKey=()=>`pizza-subsurface-layered-normal-v4`;
   material.needsUpdate=true;
  }
 }
}

/** Development-only callers can tune scattering without recompiling materials. */
export function setScatteringMultiplier(materials:Materials,multiplier:number){for(const name of Object.keys(profiles) as (keyof typeof profiles)[]){const control=materials[name].userData.scatterStrength;if(control)control.value=profiles[name].strength*T.MathUtils.clamp(multiplier,0,3);}}
