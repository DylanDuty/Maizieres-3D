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
uniform vec3 uSun;uniform float uSunMax,uRim,uBands;uniform vec3 uRimColor,uShadowTint;float gLit=1.;
float toonRamp(float v){float banded=smoothstep(.06,.2,v)*.5+smoothstep(.4,.6,v)*.5;return mix(clamp(v*1.4,0.,1.),banded,uBands);}
`;
const LAMBERT=`
varying vec3 vViewPosition;
struct LambertMaterial{vec3 diffuseColor;float specularStrength;};
void RE_Direct_Lambert(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in LambertMaterial material,inout ReflectedLight reflectedLight){
 float nl=saturate(dot(geometryNormal,directLight.direction));
 float lum=max(directLight.color.r,max(directLight.color.g,directLight.color.b));
 float sh=clamp(lum/max(uSunMax,1e-4),0.,1.);
 float lit=toonRamp(nl*sh);gLit=lit;
 reflectedLight.directDiffuse+=lit*uSun*BRDF_Lambert(material.diffuseColor);}
void RE_IndirectDiffuse_Lambert(const in vec3 irradiance,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in LambertMaterial material,inout ReflectedLight reflectedLight){
 vec3 tint=mix(uShadowTint,vec3(1.),gLit);
 reflectedLight.indirectDiffuse+=irradiance*tint*BRDF_Lambert(material.diffuseColor);
 float rim=pow(1.-saturate(dot(geometryNormal,geometryViewDir)),3.)*uRim;
 reflectedLight.indirectDiffuse+=rim*uRimColor*material.diffuseColor;}
#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;
// Shared light uniforms (one object, updated by the orchestrator when the key light changes).
export const SHADING={uSun:{value:new THREE.Color('#ffffff')},uSunMax:{value:1},uRim:{value:.12},uRimColor:{value:new THREE.Color('#fff4e4')},uShadowTint:{value:new THREE.Color('#8f9ac6')},uBands:{value:1}};
export function setKeyLight(color,intensity){SHADING.uSun.value.copy(color).multiplyScalar(intensity);const c=SHADING.uSun.value;SHADING.uSunMax.value=Math.max(c.r,c.g,c.b);}

const VARYINGS='varying vec3 vWorld;varying vec2 vUvM;';
const vertexHook=s=>s.replace('#include <common>','#include <common>\n'+VARYINGS).replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vUvM=uv;');
// Toon Lambert: colour chunk runs after <color_fragment> (diffuseColor is the flat / vertex colour).
export function toon(material,key,chunk='',uniforms={}){
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,SHADING,uniforms);shader.vertexShader=vertexHook(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+VARYINGS+NOISE+RAMP).replace('#include <lights_lambert_pars_fragment>',LAMBERT).replace('#include <color_fragment>','#include <color_fragment>\n'+chunk);};
 material.customProgramCacheKey=()=>'v26-'+key;return material;}
// Unlit flat material (water, dashes): colour fully decided by the chunk, fog kept.
export function flat(material,key,chunk='',uniforms={}){
 const decl=Object.keys(uniforms).map(k=>`uniform float ${k};`).join('');
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=vertexHook(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+VARYINGS+NOISE+decl).replace('#include <color_fragment>','#include <color_fragment>\n'+chunk);};
 material.customProgramCacheKey=()=>'v26-'+key;return material;}

export function makeMaterialsV26(){
 const lam=o=>new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide,...o});
 const M={};
 // Walls: flat pastel, a soft darker base band, a whisper of hand-painted unevenness.
 M.wall=toon(lam({}),'wall',`diffuseColor.rgb*=mix(.84,1.,smoothstep(0.,1.2,vUvM.y));diffuseColor.rgb*=.985+.03*vnoise(vWorld.xz*.4+vWorld.y*.3);`);
 // Tiled roofs: faint rows across the slope (uv.y = metres across), plain roofs: flat with a soft variation.
 M.roofTile=toon(lam({}),'roof-tile',`float row=fract(vUvM.y/.46);diffuseColor.rgb*=1.-.08*smoothstep(.74,.9,row);diffuseColor.rgb*=.975+.05*vnoise(vWorld.xz*.5);`);
 M.roofPlain=toon(lam({}),'roof-plain',`diffuseColor.rgb*=.975+.05*vnoise(vWorld.xz*.5);`);
 M.detail=toon(lam({}),'detail');
 // Vegetation: double-sided crowns, slightly stronger rim so the masses read as soft volumes.
 M.leaf=toon(lam({side:THREE.DoubleSide}),'leaf',`diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.9+vWorld.y*.4);`);
 M.leaf.onBeforeCompile=(f=>s=>{f(s);s.uniforms.uRim={value:.26};})(M.leaf.onBeforeCompile);M.leaf.customProgramCacheKey=()=>'v26-leaf';
 M.trunk=toon(lam({}),'trunk');
 // Roads: warm grey asphalt with a pale edge, sand paths, cream shoulders (vertex colour of the V2.5 strips ignored).
 M.shoulder=toon(lam({vertexColors:false,color:'#d6ccab'}),'shoulder',`diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.6);`);
 M.asphalt=toon(lam({vertexColors:false,color:'#9598a0'}),'asphalt',`float e=smoothstep(.0,.09,min(vUvM.y,1.-vUvM.y));diffuseColor.rgb*=mix(1.18,1.,e);diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.08);`);
 M.earth=toon(lam({vertexColors:false,color:'#d9c49c'}),'earth',`diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.5);`);
 M.dash=flat(new THREE.MeshBasicMaterial({color:'#f4efdf',transparent:true,depthWrite:false}),'dash',`float d=step(.55,fract(vUvM.x/9.));diffuseColor.a*=d*.85;`);
 return M;
}
