import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// V2.5 Poussey prototype — post-processing: scene render → GTAO (ground-truth ambient occlusion, denoised) → tone
// mapping and sRGB output → SMAA antialiasing → a very light vignette. Every pass can be switched off by the quality preset.
const VIGNETTE={uniforms:{tDiffuse:{value:null},strength:{value:.18}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float strength;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=distance(vUv,vec2(.5))*1.35;c.rgb*=1.-strength*smoothstep(.55,1.15,d);gl_FragColor=c;}`};
export function createPostV25(renderer,scene,camera,{ao=true,smaa=true,vignette=.18,aoBox=null}={}){
 const size=new THREE.Vector2();renderer.getSize(size);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 let gtao=null;
 if(ao){gtao=new GTAOPass(scene,camera,size.x,size.y);gtao.output=GTAOPass.OUTPUT.Default;gtao.blendIntensity=.85;
  gtao.updateGtaoMaterial({radius:3.2,distanceExponent:1.1,thickness:1.6,distanceFallOff:1,scale:1.15,samples:16,screenSpaceRadius:false});
  gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,radiusExponent:1,rings:2,samples:16});
  if(aoBox)gtao.setSceneClipBox(aoBox);composer.addPass(gtao);}
 composer.addPass(new OutputPass());
 if(smaa)composer.addPass(new SMAAPass());
 let vig=null;if(vignette>0){vig=new ShaderPass(VIGNETTE);vig.uniforms.strength.value=vignette;composer.addPass(vig);}
 return {composer,gtao,render:()=>composer.render(),setSize:(w,h)=>{composer.setSize(w,h);},dispose:()=>{composer.dispose();}};
}
