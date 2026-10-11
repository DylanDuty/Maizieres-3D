import * as THREE from 'three';
import {flat} from './toon-materials.js';

// V2.6 Poussey diorama — poetic water: an unlit, clear turquoise ribbon (no mud, no plastic), slow drifting light
// strokes along the flow (ribbon uv.x = metres along, uv.y = side), a pale foam edge against the banks. Applied to the
// V2.4 water mesh (same geometry).
// V2.9.1 (`style:'v291'`): a little brighter and deeper at once (teal body, never cyan), a sky reflection that grows at
// grazing angles (the far river reads as a light ribbon), slow drifting glints, and the same foam edge.
// V3.0 (`style:'v30'`): a natural blue-green, darker in the body, slow and quiet: drifting light strokes kept but softer,
// a sky reflection at grazing angles, rare small glints, and a bank that melts into the grass instead of a white foam.
function waterV30(uniforms){return flat(new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.96,side:THREE.DoubleSide}),'water-v30',`
  float t=uTime;vec3 deep=vec3(.16,.29,.3),light=vec3(.27,.42,.41),stroke=vec3(.46,.6,.59),bankC=vec3(.36,.45,.32);
  float body=vnoise(vWorld.xz*.1+vec2(t*.035,-t*.018))*.7+vnoise(vWorld.xz*.37+vec2(-t*.02,t*.03))*.3;vec3 col=mix(deep,light,body);
  float s=vnoise(vec2(vUvM.x*.5-t*.9,vUvM.y*2.4+vWorld.x*.03));float s2=vnoise(vec2(vUvM.x*.8-t*.6+7.,vUvM.y*2.9));
  col=mix(col,stroke,smoothstep(.66,.76,s)*.32+smoothstep(.7,.78,s2)*.22);
  vec3 vd=normalize(cameraPosition-vWorld);float graze=pow(clamp(1.-vd.y,0.,1.),3.);col=mix(col,vec3(.52,.64,.7),graze*.3);
  float gl=vnoise(vWorld.xz*1.7+vec2(t*.3,t*.18))*vnoise(vWorld.xz*2.3-vec2(t*.22,-t*.27));col=mix(col,vec3(.8,.85,.82),smoothstep(.47,.58,gl)*.3*(1.-smoothstep(500.,1400.,length(cameraPosition-vWorld))));
  float bank=1.-smoothstep(0.,.16,min(vUvM.y,1.-vUvM.y));col=mix(col,bankC,bank*.55);
  diffuseColor.rgb=col;`,uniforms);}
export function waterMaterialV26({style='v26'}={}){
 if(style==='v30'){const uniforms={uTime:{value:0}};const m=waterV30(uniforms);return {material:m,update:t=>{uniforms.uTime.value=t;}};}
 const uniforms={uTime:{value:0}};const v291=style==='v291',v29=style==='v29'||v291;
 const m=flat(new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,side:THREE.DoubleSide}),v291?'water-v291':v29?'water-v29':'water',`
  float t=uTime;vec3 deep=${v291?'vec3(.25,.55,.65)':v29?'vec3(.31,.57,.66)':'vec3(.3,.6,.73)'},light=${v291?'vec3(.5,.79,.83)':v29?'vec3(.5,.75,.79)':'vec3(.47,.74,.83)'},foam=vec3(.88,.94,.93),stroke=${v29?'vec3(.78,.91,.92)':'vec3(.8,.93,.95)'};
  float body=vnoise(vWorld.xz*.12+vec2(t*.04,-t*.02));vec3 col=mix(deep,light,body);
  float s=vnoise(vec2(vUvM.x*.55-t*1.1,vUvM.y*2.6+vWorld.x*.03));float s2=vnoise(vec2(vUvM.x*.9-t*.7+7.,vUvM.y*3.1));
  col=mix(col,stroke,smoothstep(.62,.72,s)*.55+smoothstep(.68,.76,s2)*.4);
  ${v291?`vec3 vd=normalize(cameraPosition-vWorld);float graze=pow(clamp(1.-vd.y,0.,1.),3.);col=mix(col,vec3(.74,.87,.9),graze*.32);
  float gl=vnoise(vWorld.xz*1.7+vec2(t*.35,t*.2))*vnoise(vWorld.xz*2.3-vec2(t*.25,-t*.3));col=mix(col,vec3(.97,.99,.96),smoothstep(.42,.55,gl)*.6*(1.-smoothstep(600.,1600.,length(cameraPosition-vWorld))));`:''}
  float bank=1.-smoothstep(0.,.13,min(vUvM.y,1.-vUvM.y));col=mix(col,foam,bank*.8);
  diffuseColor.rgb=col;`,uniforms);
 return {material:m,update:t=>{uniforms.uTime.value=t;}};
}
