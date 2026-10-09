import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// V2.6 Poussey diorama — post-processing: scene → light ambient occlusion → ink outline from the depth buffer (a thin
// tinted line on the near side of every silhouette, the "illustrated map" cue) → sRGB output → SMAA → miniature
// tilt-shift (soft focus band, the diorama cue) → light vignette. Every pass is switchable by the quality preset.
// The scene is drawn into a private target (colour + depth) then copied into the composer chain, so the outline pass can
// read that depth without ever sampling the buffer it writes to.
class ScenePass extends Pass{constructor(scene,camera,target){super();this.scene=scene;this.camera=camera;this.target=target;this.needsSwap=false;this.copy=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.clone(CopyShader.uniforms),vertexShader:CopyShader.vertexShader,fragmentShader:CopyShader.fragmentShader,depthTest:false,depthWrite:false});this.quad=new FullScreenQuad(this.copy);}
 render(renderer,writeBuffer,readBuffer){renderer.setRenderTarget(this.target);renderer.clear();renderer.render(this.scene,this.camera);this.copy.uniforms.tDiffuse.value=this.target.texture;renderer.setRenderTarget(this.renderToScreen?null:readBuffer);this.quad.render(renderer);}
 setSize(w,h){this.target.setSize(w,h);}get lastTarget(){return this.target;}}
const OUTLINE={uniforms:{tDiffuse:{value:null},tDepth:{value:null},res:{value:new THREE.Vector2(1,1)},near:{value:1},far:{value:1000},strength:{value:.75},width:{value:1.1},maxDist:{value:1500},ink:{value:new THREE.Color('#433d58')}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse,tDepth;uniform vec2 res;uniform float near,far,strength,width,maxDist;uniform vec3 ink;varying vec2 vUv;
 float lin(float z){float n=2.*z-1.;return 2.*near*far/(far+near-n*(far-near));}
 void main(){vec4 c=texture2D(tDiffuse,vUv);float d0=lin(texture2D(tDepth,vUv).x);vec2 px=width/res;float e=0.;
  e=max(e,lin(texture2D(tDepth,vUv+vec2(px.x,0.)).x)-d0);e=max(e,lin(texture2D(tDepth,vUv-vec2(px.x,0.)).x)-d0);e=max(e,lin(texture2D(tDepth,vUv+vec2(0.,px.y)).x)-d0);e=max(e,lin(texture2D(tDepth,vUv-vec2(0.,px.y)).x)-d0);
  e/=d0;float th=.014+d0*2.5e-5;float edge=smoothstep(th,th*2.2,e)*(1.-smoothstep(maxDist*.55,maxDist,d0));
  c.rgb=mix(c.rgb,c.rgb*ink,edge*strength);gl_FragColor=c;}`};
class OutlinePass extends ShaderPass{constructor(scenePass,camera){super(OUTLINE);this.scenePass=scenePass;this.camera=camera;}
 render(renderer,writeBuffer,readBuffer,deltaTime,maskActive){this.uniforms.tDepth.value=this.scenePass.target.depthTexture;this.uniforms.res.value.set(readBuffer.width,readBuffer.height);this.uniforms.near.value=this.camera.near;this.uniforms.far.value=this.camera.far;super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);}}
const TILT={uniforms:{tDiffuse:{value:null},res:{value:new THREE.Vector2(1,1)},dir:{value:new THREE.Vector2(1,0)},focus:{value:.55},band:{value:.2},amount:{value:1.9}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 res,dir;uniform float focus,band,amount;varying vec2 vUv;
 void main(){float r=amount*smoothstep(band,band+.34,abs(vUv.y-focus));vec2 st=dir/res*r;
  vec4 c=texture2D(tDiffuse,vUv)*.2270270270;c+=(texture2D(tDiffuse,vUv+st*1.3846153846)+texture2D(tDiffuse,vUv-st*1.3846153846))*.3162162162;c+=(texture2D(tDiffuse,vUv+st*3.2307692308)+texture2D(tDiffuse,vUv-st*3.2307692308))*.0702702703;gl_FragColor=c;}`};
const VIGNETTE={uniforms:{tDiffuse:{value:null},strength:{value:.14}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float strength;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=distance(vUv,vec2(.5))*1.35;c.rgb*=1.-strength*smoothstep(.6,1.15,d);gl_FragColor=c;}`};

export function createPostV26(renderer,scene,camera,{ao=true,smaa=true,outline=true,tilt=true,vignette=.14,aoBox=null,outlineStrength=.75}={}){
 const size=renderer.getDrawingBufferSize(new THREE.Vector2());
 const depthTexture=new THREE.DepthTexture(size.x,size.y);depthTexture.type=THREE.UnsignedIntType;
 const sceneTarget=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,depthTexture});
 const composer=new EffectComposer(renderer);const scenePass=new ScenePass(scene,camera,sceneTarget);composer.addPass(scenePass);
 let gtao=null;
 if(ao){gtao=new GTAOPass(scene,camera,size.x,size.y);gtao.output=GTAOPass.OUTPUT.Default;gtao.blendIntensity=.7;
  gtao.updateGtaoMaterial({radius:2.8,distanceExponent:1.1,thickness:1.4,distanceFallOff:1,scale:1.05,samples:16,screenSpaceRadius:false});
  gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,radiusExponent:1,rings:2,samples:16});
  if(aoBox)gtao.setSceneClipBox(aoBox);composer.addPass(gtao);}
 let outlinePass=null;if(outline){outlinePass=new OutlinePass(scenePass,camera);outlinePass.uniforms.strength.value=outlineStrength;composer.addPass(outlinePass);}
 composer.addPass(new OutputPass());
 if(smaa)composer.addPass(new SMAAPass());
 const tilts=[];if(tilt){for(const d of [[1,0],[0,1]]){const p=new ShaderPass(TILT);p.uniforms.dir.value.set(...d);composer.addPass(p);tilts.push(p);}}
 if(vignette>0){const vig=new ShaderPass(VIGNETTE);vig.uniforms.strength.value=vignette;composer.addPass(vig);}
 const setSize=(w,h)=>{composer.setSize(w,h);const s=renderer.getDrawingBufferSize(new THREE.Vector2());for(const p of tilts)p.uniforms.res.value.copy(s);};setSize(size.x,size.y);
 return {composer,gtao,outline:outlinePass,render:()=>composer.render(),setSize,dispose:()=>{composer.dispose();}};
}
