import * as THREE from 'three';
import {flat} from './toon-materials.js';

// V2.6 Poussey diorama — poetic water: an unlit, clear turquoise ribbon (no mud, no plastic), slow drifting light
// strokes along the flow (ribbon uv.x = metres along, uv.y = side), a pale foam edge against the banks. Applied to the
// V2.4 water mesh (same geometry).
export function waterMaterialV26(){
 const uniforms={uTime:{value:0}};
 const m=flat(new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,side:THREE.DoubleSide}),'water',`
  float t=uTime;vec3 deep=vec3(.3,.6,.73),light=vec3(.47,.74,.83),foam=vec3(.86,.94,.94),stroke=vec3(.8,.93,.95);
  float body=vnoise(vWorld.xz*.12+vec2(t*.04,-t*.02));vec3 col=mix(deep,light,body);
  float s=vnoise(vec2(vUvM.x*.55-t*1.1,vUvM.y*2.6+vWorld.x*.03));float s2=vnoise(vec2(vUvM.x*.9-t*.7+7.,vUvM.y*3.1));
  col=mix(col,stroke,smoothstep(.62,.72,s)*.55+smoothstep(.68,.76,s2)*.4);
  float bank=1.-smoothstep(0.,.13,min(vUvM.y,1.-vUvM.y));col=mix(col,foam,bank*.8);
  diffuseColor.rgb=col;`,uniforms);
 return {material:m,update:t=>{uniforms.uTime.value=t;}};
}
