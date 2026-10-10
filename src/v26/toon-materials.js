import * as THREE from 'three';

// V2.6 Poussey diorama — painted toon shading on top of MeshLambertMaterial (shadows, fog, instancing and vertex
// colours come for free). The Lambert lighting is replaced by a soft three-band ramp fed by the key light (shadow factor
// included), the ambient term is tinted cool inside the shade, and a faint rim light lifts the silhouettes. Everything is
// a drawing choice: no physically based response, flat colours, no textures.
export const NOISE=`
float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
`;
const RAMP=`
uniform vec3 uSun;uniform float uSunMax,uRim,uBands,uAerial;uniform vec3 uRimColor,uShadowTint,uWarm;float gLit=1.;
float toonRamp(float v){float banded=smoothstep(.06,.2,v)*.5+smoothstep(.4,.6,v)*.5;float soft=smoothstep(.03,.13,v)*.26+smoothstep(.2,.36,v)*.3+smoothstep(.46,.7,v)*.44;
 float paint=smoothstep(.02,.1,v)*.22+smoothstep(.14,.26,v)*.2+smoothstep(.3,.44,v)*.2+smoothstep(.5,.64,v)*.2+smoothstep(.7,.86,v)*.18;
 return uBands>2.5?paint:uBands>1.5?soft:mix(clamp(v*1.4,0.,1.),banded,uBands);}
`;
// V2.9.1 aerial perspective: the distance first cools and desaturates the colour, then a capped veil of the fog colour
// (never more than uAerial): depth without the white wash of the linear fog.
export const AERIAL=`#ifdef USE_FOG
 if(uAerial>0.){float tA=smoothstep(fogNear,fogFar,vFogDepth);vec3 cA=gl_FragColor.rgb;float lA=dot(cA,vec3(.299,.587,.114));
  cA=mix(cA,mix(vec3(lA),cA,.78)*vec3(.95,.99,1.05),pow(tA,1.3)*.7);gl_FragColor.rgb=mix(cA,fogColor,tA*tA*uAerial);}
 else{
 #ifdef FOG_EXP2
  float fogFactor=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
 #else
  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
 #endif
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);}
#endif`;
const LAMBERT=`
varying vec3 vViewPosition;
struct LambertMaterial{vec3 diffuseColor;float specularStrength;};
void RE_Direct_Lambert(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in LambertMaterial material,inout ReflectedLight reflectedLight){
 float nl=saturate(dot(geometryNormal,directLight.direction));
 float lum=max(directLight.color.r,max(directLight.color.g,directLight.color.b));
 float sh=clamp(lum/max(uSunMax,1e-4),0.,1.);
 float lit=toonRamp(nl*sh);gLit=lit;
 reflectedLight.directDiffuse+=lit*uSun*mix(vec3(1.),uWarm,lit)*BRDF_Lambert(material.diffuseColor);}
void RE_IndirectDiffuse_Lambert(const in vec3 irradiance,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in LambertMaterial material,inout ReflectedLight reflectedLight){
 vec3 tint=mix(uShadowTint,vec3(1.),gLit);
 reflectedLight.indirectDiffuse+=irradiance*tint*BRDF_Lambert(material.diffuseColor);
 float rim=pow(1.-saturate(dot(geometryNormal,geometryViewDir)),3.)*uRim;
 reflectedLight.indirectDiffuse+=rim*uRimColor*material.diffuseColor;}
#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;
// Shared light uniforms (one object, updated by the orchestrator when the key light changes).
export const SHADING={uSun:{value:new THREE.Color('#ffffff')},uSunMax:{value:1},uRim:{value:.12},uRimColor:{value:new THREE.Color('#fff4e4')},uShadowTint:{value:new THREE.Color('#8f9ac6')},uBands:{value:1},uAerial:{value:0},uWarm:{value:new THREE.Color('#ffffff')}};
export function setKeyLight(color,intensity){SHADING.uSun.value.copy(color).multiplyScalar(intensity);const c=SHADING.uSun.value;SHADING.uSunMax.value=Math.max(c.r,c.g,c.b);}

const VARYINGS='varying vec3 vWorld;varying vec2 vUvM;';
const vertexHook=s=>s.replace('#include <common>','#include <common>\n'+VARYINGS).replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vUvM=uv;');
// Toon Lambert: colour chunk runs after <color_fragment> (diffuseColor is the flat / vertex colour).
// opts.decl: declarations added after <common> (custom uniforms, helpers); opts.normal: code run after the normal maps
// (it may bend `normal`, in view space, before the lights).
export function toon(material,key,chunk='',uniforms={},opts={}){
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,SHADING,uniforms);shader.vertexShader=vertexHook(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+VARYINGS+NOISE+RAMP+(opts.decl||'')).replace('#include <lights_lambert_pars_fragment>',LAMBERT).replace('#include <color_fragment>','#include <color_fragment>\n'+chunk).replace('#include <fog_fragment>',AERIAL)
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+(opts.normal||''));};
 material.customProgramCacheKey=()=>'v26-'+key;return material;}
// Unlit flat material (water, dashes): colour fully decided by the chunk, fog kept.
export function flat(material,key,chunk='',uniforms={}){
 const decl=Object.keys(uniforms).map(k=>`uniform float ${k};`).join('')+'uniform float uAerial;';
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{uAerial:SHADING.uAerial},uniforms);shader.vertexShader=vertexHook(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+VARYINGS+NOISE+decl).replace('#include <color_fragment>','#include <color_fragment>\n'+chunk).replace('#include <fog_fragment>',AERIAL);};
 material.customProgramCacheKey=()=>'v26-'+key;return material;}

// V2.9 (`style:'v29'`): softer tile rows a little stronger, asphalt with a wider soft edge, warmer shoulders — the JRPG
// pass changes shaders and palettes, never geometry.
export function makeMaterialsV26({style='v26'}={}){const v291=style==='v291',v29=style==='v29'||v291;
 const lam=o=>new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide,...o});
 const M={};
 // Walls: flat pastel, a soft darker base band, a whisper of hand-painted unevenness.
 M.wall=toon(lam({}),'wall',`diffuseColor.rgb*=mix(.84,1.,smoothstep(0.,1.2,vUvM.y));diffuseColor.rgb*=.985+.03*vnoise(vWorld.xz*.4+vWorld.y*.3);`);
 // Tiled roofs: faint rows across the slope (uv.y = metres across), plain roofs: flat with a soft variation.
 M.roofTile=v29?toon(lam({}),'roof-tile-v29',`float row=fract(vUvM.y/.46);diffuseColor.rgb*=1.-.11*smoothstep(.7,.9,row);float col=fract(vUvM.x/.32+step(.5,fract(vUvM.y/.92))*.5);diffuseColor.rgb*=1.-.035*smoothstep(.8,.95,col);diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.5);`)
  :toon(lam({}),'roof-tile',`float row=fract(vUvM.y/.46);diffuseColor.rgb*=1.-.08*smoothstep(.74,.9,row);diffuseColor.rgb*=.975+.05*vnoise(vWorld.xz*.5);`);
 M.roofPlain=toon(lam({}),'roof-plain',`diffuseColor.rgb*=.975+.05*vnoise(vWorld.xz*.5);`);
 // V2.9.1 roofs: what reads at 420 m is the tone, not the tile. Rows and columns fade out with the screen size of a tile
 // (no moiré), a weathered mottle of 1,5–4 m patches (lichen, renewed tiles) and a faint lighter band toward the ridge
 // side of each 2 m course keep every roof alive; slates get a cool sheen in their own rows.
 if(v291){
  M.roofTile=toon(lam({}),'roof-tile-v291',`float fw=fwidth(vUvM.y);float near=1.-smoothstep(.06,.2,fw);float row=fract(vUvM.y/.46);diffuseColor.rgb*=1.-.12*near*smoothstep(.7,.9,row);
   float col=fract(vUvM.x/.32+step(.5,fract(vUvM.y/.92))*.5);diffuseColor.rgb*=1.-.04*near*smoothstep(.8,.95,col);
   float mot=vnoise(vWorld.xz*.55+3.1)*.6+vnoise(vWorld.xz*.21)*.4;diffuseColor.rgb*=.9+.17*mot;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.86,.93,.82),smoothstep(.72,.95,vnoise(vWorld.xz*.33+7.))*.35);
   diffuseColor.rgb*=1.+.05*smoothstep(.55,1.,fract(vUvM.y/2.1));`);
  M.roofPlain=toon(lam({}),'roof-plain-v291',`float fw=fwidth(vUvM.y);float near=1.-smoothstep(.05,.18,fw);float row=fract(vUvM.y/.32);diffuseColor.rgb*=1.-.09*near*smoothstep(.75,.92,row);
   float mot=vnoise(vWorld.xz*.45)*.6+vnoise(vWorld.xz*.17+2.)*.4;diffuseColor.rgb*=.92+.14*mot;diffuseColor.rgb+=vec3(.015,.02,.035)*smoothstep(.6,.9,vnoise(vWorld.xz*.8));`);
  M.roofSheet=toon(lam({}),'roof-sheet-v291',`float fw=fwidth(vUvM.x);float rib=smoothstep(.0,.1,abs(fract(vUvM.x/.95+.5)-.5)*.95);diffuseColor.rgb*=mix(1.,mix(.88,1.,rib),1.-smoothstep(.12,.4,fw));diffuseColor.rgb*=.93+.12*vnoise(vWorld.xz*.12)+.04*vnoise(vWorld.xz*.7);`);}
 // V2.6.1 big buildings: wall panels with a joint every 2,4 m and a darker base band; sheet roofs with ribs down the slope.
 M.wallPanels=toon(lam({}),'wall-panels',`float j=smoothstep(.0,.07,abs(fract(vUvM.x/2.4+.5)-.5)*2.4);diffuseColor.rgb*=mix(.84,1.,j);diffuseColor.rgb*=mix(.78,1.,smoothstep(1.05,1.2,vUvM.y));diffuseColor.rgb*=mix(1.,1.06,smoothstep(2.6,2.8,vUvM.y)*(1.-smoothstep(3.2,3.4,vUvM.y)));diffuseColor.rgb*=.985+.03*vnoise(vWorld.xz*.4+vWorld.y*.3);`);
 M.roofSheet=toon(lam({}),'roof-sheet',`float rib=smoothstep(.0,.1,abs(fract(vUvM.x/.95+.5)-.5)*.95);diffuseColor.rgb*=mix(.9,1.,rib);diffuseColor.rgb*=.975+.05*vnoise(vWorld.xz*.5);`);
 M.detail=toon(lam({}),'detail');
 // Vegetation: double-sided crowns, slightly stronger rim so the masses read as soft volumes.
 M.leaf=toon(lam({side:THREE.DoubleSide}),'leaf',`diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.9+vWorld.y*.4);`);
 M.leaf.onBeforeCompile=(f=>s=>{f(s);s.uniforms.uRim={value:.26};})(M.leaf.onBeforeCompile);M.leaf.customProgramCacheKey=()=>'v26-leaf';
 M.trunk=toon(lam({}),'trunk');
 // V2.9.1 canopy: the wood masses become a crowd of crowns. A world-space Voronoi of 6,5 m cells gives every crown a dome
 // (the normal is bent toward it, so the toon ramp paints a lit and a shaded side), dark gaps between crowns (depth),
 // and its own hue; it fades to the plain mass where a crown would be smaller than a few pixels. A second, 19 m level
 // (bouquets) carries the texture at mid-distance.
 if(v291){M.canopy=toon(lam({side:THREE.FrontSide}),'canopy-v291',`
   vec2 cp=vWorld.xz/6.5;vec4 cr=crownCell(cp);float cfw=fwidth(cp.x)+fwidth(cp.y);gCrownK=1.-smoothstep(.12,.45,cfw);
   float cd=length(cr.xy),ch=sqrt(max(0.,1.-cd*cd/.62));gCrown=vec3(-cr.xy,ch);
   vec2 cq=vWorld.xz/19.;vec4 cg=crownCell(cq+7.3);float gk=(1.-smoothstep(.1,.42,fwidth(cq.x)+fwidth(cq.y)))*(1.-gCrownK*.6);float gh=sqrt(max(0.,1.-dot(cg.xy,cg.xy)/.7));
   gCrown=mix(gCrown,vec3(-cg.xy*.8,gh),gk*(1.-gCrownK));gCrownK=max(gCrownK,gk*.75);
   diffuseColor.rgb*=mix(1.,mix(.74,1.07,smoothstep(.0,.8,gh)),gk);diffuseColor.rgb*=mix(vec3(1.),vec3(1.+(cg.z-.5)*.12,1.+(cg.z-.5)*.05,1.-(cg.z-.5)*.1),gk);
   diffuseColor.rgb*=mix(1.,mix(.66,1.08,smoothstep(.0,.75,ch)),1.-smoothstep(.12,.45,cfw));
   diffuseColor.rgb*=mix(vec3(1.),vec3(1.+(cr.z-.5)*.16,1.+(cr.z-.5)*.07,1.-(cr.z-.5)*.12),1.-smoothstep(.12,.45,cfw));
   diffuseColor.rgb*=.95+.1*vnoise(vWorld.xz*.035+3.);`,{},{decl:`float gCrownK=0.;vec3 gCrown=vec3(0.,0.,1.);
   vec4 crownCell(vec2 p){vec2 i=floor(p),f=fract(p);float d1=9.;vec2 b=vec2(0.);float id=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(h12(i+g),h12(i+g+17.3));vec2 r=g+.12+o*.76-f;float d=dot(r,r);if(d<d1){d1=d;b=r;id=h12(i+g+3.7);}}return vec4(b,id,d1);}`,
   normal:`if(gCrownK>0.){vec3 nW=normalize(vec3(gCrown.x*1.25,max(gCrown.z,.12)*1.1+.18,gCrown.y*1.25));vec3 nV=normalize((viewMatrix*vec4(nW,0.)).xyz);normal=normalize(mix(normal,nV,.62*gCrownK));}`});
  M.leaf=toon(lam({side:THREE.DoubleSide}),'leaf-v291',`diffuseColor.rgb*=.95+.1*vnoise(vWorld.xz*.9+vWorld.y*.4);diffuseColor.rgb*=mix(vec3(.93,.98,1.04),vec3(1.05,1.02,.93),smoothstep(-.4,.6,vnoise(vWorld.xz*.05+1.)-.3));`);
  M.leaf.onBeforeCompile=(f=>s=>{f(s);s.uniforms.uRim={value:.22};})(M.leaf.onBeforeCompile);M.leaf.customProgramCacheKey=()=>'v26-leaf-v291';}
 // Roads: warm grey asphalt with a pale edge, sand paths, cream shoulders (vertex colour of the V2.5 strips ignored).
 M.shoulder=toon(lam({vertexColors:false,color:v29?'#dbd1b3':'#d6ccab'}),v29?'shoulder-v29':'shoulder',`diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.6);`);
 // V2.9.1 roads: warm grey with a soft darker kerb line, light wear in the wheel tracks and a fine grain (no marking added).
 if(v291){M.asphalt=toon(lam({vertexColors:false,color:'#a3a29e'}),'asphalt-v291',`float m=min(vUvM.y,1.-vUvM.y);diffuseColor.rgb*=mix(.86,1.,smoothstep(.0,.05,m));diffuseColor.rgb*=mix(1.1,1.,smoothstep(.05,.2,m));
   float wheel=smoothstep(.12,.0,abs(m-.27))+smoothstep(.1,.0,abs(m-.42))*.6;diffuseColor.rgb*=1.+.035*wheel;diffuseColor.rgb*=.94+.08*vnoise(vWorld.xz*.06)+.04*vnoise(vWorld.xz*.8)+.02*vnoise(vWorld.xz*3.1);`);
  M.shoulder=toon(lam({vertexColors:false,color:'#d8cfae'}),'shoulder-v291',`diffuseColor.rgb*=.93+.1*vnoise(vWorld.xz*.6)+.04*vnoise(vWorld.xz*2.3);`);}
 else M.asphalt=v29?toon(lam({vertexColors:false,color:'#9c9ea3'}),'asphalt-v29',`float e=smoothstep(.0,.17,min(vUvM.y,1.-vUvM.y));diffuseColor.rgb*=mix(1.14,1.,e);diffuseColor.rgb*=.95+.09*vnoise(vWorld.xz*.07)+.03*vnoise(vWorld.xz*.9);`)
  :toon(lam({vertexColors:false,color:'#9598a0'}),'asphalt',`float e=smoothstep(.0,.09,min(vUvM.y,1.-vUvM.y));diffuseColor.rgb*=mix(1.18,1.,e);diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.08);`);
 M.earth=toon(lam({vertexColors:false,color:'#d9c49c'}),'earth',`diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.5);`);
 M.dash=flat(new THREE.MeshBasicMaterial({color:'#f4efdf',transparent:true,depthWrite:false}),'dash',`float d=step(.55,fract(vUvM.x/9.));diffuseColor.a*=d*.85;`);
 return M;
}
