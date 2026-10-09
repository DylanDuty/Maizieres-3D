import * as THREE from 'three';
import {NOISE} from './procedural-materials.js';

// V2.5 Poussey prototype — living water: a standard material (sky reflection from the environment map) whose colour
// and normal are perturbed by two drifting noise fields, darker toward the banks (ribbon uv.y), slightly translucent so
// the painted bed shows through. Applied to the existing V2.4 water mesh (same geometry).
export function waterMaterialV25(envMap){
 const m=new THREE.MeshStandardMaterial({color:'#5e8aa0',roughness:.2,metalness:0,transparent:true,opacity:.86,side:THREE.DoubleSide,vertexColors:true});
 m.envMap=envMap;m.envMapIntensity=1.1;const uniforms={uTime:{value:0}};
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vWuv;').replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vWuv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vWuv;uniform float uTime;\n'+NOISE)
   .replace('#include <color_fragment>',`#include <color_fragment>
   vec2 wp=vWorld.xz;float t=uTime;
   float n1=vnoise(wp/2.4+vec2(t*.11,t*.05));float n2=vnoise(wp/1.05-vec2(t*.06,t*.1));float rip=(n1*.6+n2*.4)-.5;
   diffuseColor.rgb*=1.+rip*.22;
   float bank=smoothstep(0.,.42,min(vWuv.y,1.-vWuv.y));diffuseColor.rgb*=mix(vec3(.62,.72,.7),vec3(1.),bank);
   diffuseColor.a*=mix(.98,.8,bank);`)
   .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   {vec2 wq=vWorld.xz*1.3+vec2(uTime*.08,-uTime*.05);float e=.35;float hx=vnoise(wq+vec2(e,0.))-vnoise(wq-vec2(e,0.));float hz=vnoise(wq+vec2(0.,e))-vnoise(wq-vec2(0.,e));normal=normalize(normal+vec3(hx*.45,0.,hz*.45));}`);};
 m.customProgramCacheKey=()=>'v25-water';
 return {material:m,update:t=>{uniforms.uTime.value=t;}};
}
