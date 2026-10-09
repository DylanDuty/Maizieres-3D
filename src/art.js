import * as THREE from 'three';
// Shared art direction: soft toon bands, warm light, cool shade. V2.4 widens the ramp (five steps, no hard cut), adds the
// water, rail and terrain shading used by the assembled V2 view and keeps the painted V1 shaders for the diagnostic views.
// Everything here is presentation only; no geographic value is computed in these shaders.
const ramp=new THREE.DataTexture(new Uint8Array([112,150,188,224,255]),5,1,THREE.RedFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
export function toon(options={}){return new THREE.MeshToonMaterial({gradientMap:ramp,...options});}

export const palette={
 sky:'#a9d2ea',horizon:'#e4ecdf',sun:'#fff0d4',skyLight:'#c3dcf2',groundLight:'#dcc79c',
 meadow:'#abc779',lawn:'#b5d087',wood:'#6f9a5a',scrub:'#88a76a',water:'#6fb8d2',waterEdge:'#9fbf86',
 asphalt:'#9b9ea3',asphaltEdge:'#f2e7cb',track:'#d2c29a',trackEdge:'#c3b48c',yard:'#cdbf9f',activity:'#d8cdb4',
 pitch:'#8fbd75',line:'#f4f1dd',hedge:'#6f9c55',hedgeSide:'#5b8a4c'
};

// V2.4 lighting presets. DAY_CLEAR is the default (late morning, sun from the south-south-east);
// GOLDEN_HOUR is an optional warmer, lower light (?light=golden or the « Lumière » button).
export const LIGHT_PRESETS={
 DAY_CLEAR:{sun:'#fff3dc',sunIntensity:2.05,direction:[-.42,.80,.43],shadow:.58,sky:'#cfe0f3',ground:'#d8c9a4',hemisphere:.92,exposure:1.04,fog:'#dfe8e3',fogNear:2600,fogFar:15000,apron:'#d9dfcc',css:'day'},
 GOLDEN_HOUR:{sun:'#ffcf96',sunIntensity:2.2,direction:[-.78,.42,.46],shadow:.68,sky:'#dcd3e6',ground:'#d7b78c',hemisphere:.72,exposure:1.0,fog:'#ead9c6',fogNear:1800,fogFar:11000,apron:'#dfd3bc',css:'golden'}};

const NOISE=`
float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
`;

// Adds a world-position varying and a fragment colour chunk to a built-in material.
function worldShader(material,key,chunk,uniforms={},{anchor='#include <color_fragment>'}={}){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;').replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;\n'+NOISE).replace(anchor,anchor+'\n'+chunk);
 };
 material.customProgramCacheKey=()=>key;return material;
}

// Painted ground: very low-frequency mottling so large lawns do not read as flat GIS fills.
export function paintedGround(options={}){
 return worldShader(toon(options),'painted-ground',`
 vec2 gp=vWorld.xz;
 float gn=vnoise(gp/210.)*.62+vnoise(gp/53.)*.38;
 diffuseColor.rgb*=.93+.14*gn;
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.05,1.03,.9),smoothstep(.35,.8,vnoise(gp/760.+7.)));
 `);
}

// Artistic field mosaic. Parcels, colours and furrows are procedural decoration:
// they never describe the crops or cadastral parcels actually present.
export function fieldMosaic(){
 return worldShader(toon({vertexColors:true,side:THREE.DoubleSide}),'field-mosaic',`
 vec2 fp=vWorld.xz;
 vec2 block=floor(vec2(fp.x*.93+fp.y*.36,-fp.x*.36+fp.y*.93)/760.);
 float ba=h12(block+3.1)*3.14159;
 mat2 rot=mat2(cos(ba),-sin(ba),sin(ba),cos(ba));
 vec2 q=rot*fp;
 float rowH=62.+58.*h12(block+9.7);
 float row=floor(q.y/rowH);
 float cellL=130.+190.*h12(vec2(row,block.x+block.y));
 float shift=h12(vec2(row,5.3))*400.;
 float cell=floor((q.x+shift)/cellL);
 float id=h12(vec2(row*1.7+block.x,cell+block.y*3.1));
 vec3 c1=vec3(.92,.74,.34),c2=vec3(.95,.83,.5),c3=vec3(.57,.73,.32),c4=vec3(.45,.64,.33),c5=vec3(.73,.51,.32),c6=vec3(.84,.65,.42),c7=vec3(.75,.77,.36);
 vec3 fc=id<.22?c1:id<.3?c2:id<.48?c3:id<.62?c4:id<.72?c5:id<.84?c6:c7;
 fc*=.93;
 fc*=.96+.08*vnoise(fp/37.);
 // Thin darker parcel margins, faded at distance to avoid shimmer.
 vec2 local=vec2(fract((q.x+shift)/cellL)*cellL,fract(q.y/rowH)*rowH);
 float edge=min(min(local.x,cellL-local.x),min(local.y,rowH-local.y));
 float w=fwidth(q.y);
 float margin=1.-smoothstep(.9,.9+w*1.5,edge);
 fc=mix(fc,fc*vec3(.78,.83,.7),margin*clamp(1.2-w*.9,0.,1.));
 // Furrows follow each parcel's own direction.
 float along=id>.5?q.y:q.x+shift;
 float stripe=smoothstep(.35,.65,abs(fract(along/(4.2+id*3.))-.5)*2.);
 fc*=1.-.07*stripe*clamp(1.-w*.45,0.,1.);
 diffuseColor.rgb=fc*mix(vec3(1.),diffuseColor.rgb,.25);
 `);
}

// Woodland floor painted as a clumped canopy seen from above (decorative, not tree positions).
export function canopyGround(){
 return worldShader(toon({vertexColors:true,side:THREE.DoubleSide}),'canopy-ground',`
 vec2 cp=vWorld.xz;
 float cn=vnoise(cp/16.)*.55+vnoise(cp/41.+3.)*.45;
 float clump=smoothstep(.42,.62,cn);
 float wc=fwidth(cp.x);
 clump=mix(clump,.5,clamp(wc/9.,0.,.8));
 diffuseColor.rgb*=mix(vec3(.78,.84,.8),vec3(1.1,1.08,.98),clump);
 diffuseColor.rgb*=.95+.1*vnoise(cp/300.);
 `);
}

// V2.4 water: matte surface with a static fine ripple, a touch of sky at grazing angles, darker close to the banks
// (the bank distance comes from the ribbon's own uv.y). No animation: the scene renders on demand only.
export function waterMaterial(color){
 const m=new THREE.MeshLambertMaterial({color,vertexColors:true,side:THREE.DoubleSide});
 m.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vWuv;').replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vWuv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vWuv;\n'+NOISE).replace('#include <color_fragment>',`#include <color_fragment>
  vec2 wp=vWorld.xz;
  float rip=vnoise(wp/2.3+vec2(vnoise(wp/9.)*1.5))*.5+vnoise(wp/5.1+7.)*.5;
  float wf=clamp(1.-fwidth(wp.x)*.6,0.,1.);
  diffuseColor.rgb*=1.+(rip-.5)*.16*wf;
  float bank=smoothstep(0.,.45,min(vWuv.y,1.-vWuv.y));
  diffuseColor.rgb*=mix(vec3(.74,.82,.84),vec3(1.),bank);
  vec3 vd=normalize(cameraPosition-vWorld);
  float fres=pow(1.-clamp(vd.y,0.,1.),2.5);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.92,.97),fres*.42);`);
 };
 m.customProgramCacheKey=()=>'v24-water';return m;
}

// V2.4 rail bed: ballast ribbon whose uv.x is the distance along the track; dark cross ties are drawn in the shader
// (nothing is instanced), and fade out at distance so the line reads as a clean dark band from afar.
export function ballastMaterial(color){
 const m=new THREE.MeshLambertMaterial({color,vertexColors:true,side:THREE.DoubleSide});
 m.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vRuv;').replace('#include <project_vertex>','#include <project_vertex>\nvRuv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRuv;\n'+NOISE).replace('#include <color_fragment>',`#include <color_fragment>
  float t=fract(vRuv.x/.62);
  float tie=smoothstep(.02,.12,t)*(1.-smoothstep(.34,.44,t));
  float across=smoothstep(.06,.14,vRuv.y)*(1.-smoothstep(.86,.94,vRuv.y));
  float fade=clamp(1.-fwidth(vRuv.x)*3.2,0.,1.);
  diffuseColor.rgb*=.96+.08*vnoise(vRuv*vec2(3.,40.));
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.54,.5),tie*across*fade*.9);`);
 };
 m.customProgramCacheKey=()=>'v24-ballast';return m;
}

// V2.4 terrain: the draped land-cover texture, lit by the scene plus a gentle painted hillshade carried by the vertex
// colours (computed once from the display grid; the relief itself is never exaggerated).
export function terrainMaterial(texture){
 return new THREE.MeshLambertMaterial({map:texture,vertexColors:true});
}

// Shares identical vertices so the crown gets smooth normals (tiny local version of mergeVertices).
function weld(source){const p=source.getAttribute('position'),keys=new Map(),positions=[],index=[];
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e4)).join();let k=keys.get(key);if(k===undefined){k=positions.length/3;keys.set(key,k);positions.push(p.getX(i),p.getY(i),p.getZ(i));}index.push(k);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(index);source.dispose();return g;}

// Soft rounded crown with a few bumps, shaded darker at the base (vertex colours).
export function crownGeometry({lobes=4,flatten=.9,seed=0,detail=1}={}){
 const g=weld(new THREE.IcosahedronGeometry(1,detail));const p=g.getAttribute('position'),colors=[];
 const bumps=Array.from({length:lobes},(_,i)=>{const a=i/lobes*Math.PI*2+seed,y=.15+.35*((i*7+seed*3)%5)/5;return new THREE.Vector3(Math.cos(a)*.8,y,Math.sin(a)*.8).normalize();});
 bumps.push(new THREE.Vector3(0,1,0));
 const v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).normalize();let r=.86;for(const b of bumps)r+=.16*Math.max(0,v.dot(b))**6;v.multiplyScalar(r);v.y=v.y*flatten+(v.y<0?v.y*.15:0);p.setXYZ(i,v.x,v.y,v.z);
  const t=THREE.MathUtils.clamp((v.y+1)/2,0,1),light=.7+.34*t;colors.push(light,light*1.01,light*.93);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
