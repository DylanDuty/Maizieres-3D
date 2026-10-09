import * as THREE from 'three';
import {random} from '../geo.js';

// V2.5 Poussey prototype — procedural materials. Every texture is drawn in a canvas at start-up (no external asset):
// render (crépi), roof tiles, slates, corrugated steel, wood planks, concrete, asphalt, grass detail. Textures are
// greyscale-ish so vertex colours tint them per building; uv coordinates are expressed in metres everywhere.
const NOISE=`
float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
`;
function canvasTexture(size,metres,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size,random(size*7+Math.round(metres*13)));
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.repeat.set(1/metres,1/metres);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;return t;}
const grey=v=>`rgb(${v},${v},${v})`;
const speckle=(ctx,s,rng,n,lo,hi,r=1.2,alpha=.5)=>{ctx.globalAlpha=alpha;for(let i=0;i<n;i++){ctx.fillStyle=grey(Math.round(lo+rng()*(hi-lo)));const x=rng()*s,y=rng()*s,k=r*(.5+rng());ctx.fillRect(x,y,k,k);}ctx.globalAlpha=1;};

export function makeTextures(){
 const T={};
 // Crépi : near-white grain, a few soft blotches; 3 m tile.
 T.render=canvasTexture(256,3,(ctx,s,rng)=>{ctx.fillStyle=grey(242);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,9000,215,255,1.4,.4);ctx.globalAlpha=.08;for(let i=0;i<14;i++){ctx.fillStyle=grey(rng()<.5?190:255);ctx.beginPath();ctx.arc(rng()*s,rng()*s,20+rng()*40,0,6.3);ctx.fill();}ctx.globalAlpha=1;});
 // Tiles : staggered rounded tiles 0,25 × 0,33 m, a shadow line under each row; 2 m tile.
 T.tile=canvasTexture(512,2,(ctx,s,rng)=>{const tw=s/8,th=s/6;ctx.fillStyle=grey(170);ctx.fillRect(0,0,s,s);
  for(let r=0;r<7;r++)for(let c=-1;c<9;c++){const x=c*tw+(r%2?tw/2:0),y=r*th,v=205+Math.round(rng()*40);ctx.fillStyle=grey(v);ctx.beginPath();ctx.roundRect(x+1,y+2,tw-2,th-1,[0,0,tw*.35,tw*.35]);ctx.fill();
   ctx.fillStyle=grey(Math.min(255,v+14));ctx.fillRect(x+3,y+3,tw-6,2);ctx.fillStyle=grey(Math.max(90,v-60));ctx.fillRect(x+1,y+th-4,tw-2,4);}
  speckle(ctx,s,rng,2500,120,230,1.5,.25);});
 // Slates : flat rectangles 0,32 × 0,22 m; 2 m tile.
 T.slate=canvasTexture(512,2,(ctx,s,rng)=>{const tw=s/6,th=s/9;ctx.fillStyle=grey(120);ctx.fillRect(0,0,s,s);
  for(let r=0;r<10;r++)for(let c=-1;c<7;c++){const x=c*tw+(r%2?tw/2:0),y=r*th,v=195+Math.round(rng()*45);ctx.fillStyle=grey(v);ctx.fillRect(x+1,y+1,tw-2,th-2);ctx.fillStyle=grey(v-40);ctx.fillRect(x+1,y+th-3,tw-2,2);}});
 // Corrugated steel : vertical ribs every 0,25 m with a soft shading cycle; 2 m tile.
 T.metal=canvasTexture(256,2,(ctx,s,rng)=>{for(let x=0;x<s;x++){const t=(x/s*8)%1,v=195+40*Math.sin(t*6.283)+8*(rng()-.5);ctx.fillStyle=grey(Math.round(v));ctx.fillRect(x,0,1,s);}speckle(ctx,s,rng,1200,150,235,1,.2);});
 // Wood planks : horizontal boards 0,15 m with grain; 1,5 m tile.
 T.wood=canvasTexture(256,1.5,(ctx,s,rng)=>{const bh=s/10;for(let r=0;r<10;r++){const v=165+Math.round(rng()*45);ctx.fillStyle=grey(v);ctx.fillRect(0,r*bh,s,bh);ctx.fillStyle=grey(v-50);ctx.fillRect(0,r*bh+bh-2,s,2);ctx.globalAlpha=.25;for(let k=0;k<4;k++){ctx.fillStyle=grey(v-30+Math.round(rng()*20));ctx.fillRect(0,r*bh+2+rng()*(bh-5),s,1);}ctx.globalAlpha=1;}});
 // Concrete : fine grain + faint horizontal joints; 4 m tile.
 T.concrete=canvasTexture(256,4,(ctx,s,rng)=>{ctx.fillStyle=grey(215);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,7000,185,240,1.3,.4);ctx.fillStyle=grey(170);ctx.globalAlpha=.5;for(let y=0;y<s;y+=s/4)ctx.fillRect(0,y,s,1);ctx.globalAlpha=1;});
 // Membrane (flat roofs) : matte grain; 3 m tile.
 T.membrane=canvasTexture(256,3,(ctx,s,rng)=>{ctx.fillStyle=grey(215);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,6000,175,225,1.6,.35);});
 // Asphalt : dark fine grain, a few paler stones; 6 m tile.
 T.asphalt=canvasTexture(512,6,(ctx,s,rng)=>{ctx.fillStyle=grey(150);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,26000,120,185,1.2,.5);speckle(ctx,s,rng,1800,190,235,1,.25);ctx.globalAlpha=.07;for(let i=0;i<10;i++){ctx.fillStyle=grey(rng()<.5?70:160);ctx.beginPath();ctx.arc(rng()*s,rng()*s,30+rng()*90,0,6.3);ctx.fill();}ctx.globalAlpha=1;});
 // Earth / gravel for paths; 4 m tile.
 T.earth=canvasTexture(256,4,(ctx,s,rng)=>{ctx.fillStyle=grey(190);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,9000,150,225,1.5,.45);});
 // Grass detail multiplied over the painted ground; 4 m tile.
 T.grass=canvasTexture(256,4,(ctx,s,rng)=>{ctx.fillStyle=grey(205);ctx.fillRect(0,0,s,s);speckle(ctx,s,rng,14000,165,245,1.3,.5);ctx.globalAlpha=.12;for(let i=0;i<30;i++){ctx.fillStyle=grey(rng()<.5?160:240);ctx.beginPath();ctx.arc(rng()*s,rng()*s,8+rng()*22,0,6.3);ctx.fill();}ctx.globalAlpha=1;});
 return T;
}

// Adds a world-position varying, the metre uv varying and a colour chunk to a standard material.
function extend(material,key,chunk,uniforms={}){
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vUvM;').replace('#include <project_vertex>','#include <project_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vUvM=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld;varying vec2 vUvM;\n'+NOISE).replace('#include <color_fragment>','#include <color_fragment>\n'+chunk);};
 material.customProgramCacheKey=()=>key;return material;}

export function makeMaterials(T,envMap){
 const std=(o)=>{const m=new THREE.MeshStandardMaterial({roughness:.92,metalness:0,vertexColors:true,side:THREE.FrontSide,...o});m.envMap=envMap;m.envMapIntensity=.3;return m;};
 const M={};
 // Facades : render with plinth and a faint weathering gradient, wood boards, corrugated steel, concrete.
 M.render=extend(std({map:T.render}),'v25-render',`float plinth=1.-smoothstep(.4,.75,vUvM.y);diffuseColor.rgb*=mix(1.,.74,plinth);diffuseColor.rgb*=mix(.9,1.,smoothstep(0.,3.,vUvM.y));diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.35+vWorld.y*.2);`);
 M.wood=extend(std({map:T.wood,roughness:.85}),'v25-wood',`diffuseColor.rgb*=mix(.82,1.,smoothstep(0.,1.2,vUvM.y));`);
 M.metal=extend(std({map:T.metal,roughness:.55,metalness:.15}),'v25-metal',`diffuseColor.rgb*=mix(.86,1.,smoothstep(0.,1.5,vUvM.y));`);
 M.concrete=std({map:T.concrete});
 // Roofs : tiles, slates, steel sheet, membrane.
 M.tile=extend(std({map:T.tile,roughness:.8}),'v25-tile',`diffuseColor.rgb*=.95+.1*vnoise(vWorld.xz*.6);`);
 M.slate=std({map:T.slate,roughness:.6});
 M.sheet=extend(std({map:T.metal,roughness:.5,metalness:.2}),'v25-sheet',`diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.8);`);
 M.membrane=std({map:T.membrane,roughness:.95});
 // Details : fascia, parapets, chimneys, tower; openings.
 M.detail=std({roughness:.85});
 M.frame=new THREE.MeshStandardMaterial({color:'#f1ede4',roughness:.6});
 M.glass=new THREE.MeshStandardMaterial({color:'#36475a',roughness:.1,metalness:.05});M.glass.envMap=envMap;M.glass.envMapIntensity=1.6;
 M.shutter=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.75});
 M.door=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.7});
 M.garage=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:.1});
 // Roads and ground.
 M.asphalt=extend(std({map:T.asphalt,roughness:.95,vertexColors:false,color:'#8d9094'}),'v25-asphalt',`float e=smoothstep(.0,.1,min(vUvM.y,1.-vUvM.y));diffuseColor.rgb*=mix(1.12,1.,e);float tr=exp(-pow((vUvM.y-.27)/.07,2.))+exp(-pow((vUvM.y-.73)/.07,2.));diffuseColor.rgb*=1.-.07*tr;diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.07);`);
 M.earth=extend(std({map:T.earth,roughness:1,vertexColors:false,color:'#b6a07c'}),'v25-earth',`diffuseColor.rgb*=.94+.12*vnoise(vWorld.xz*.5);float c=exp(-pow((vUvM.y-.5)/.22,2.));diffuseColor.rgb*=1.+.06*c;`);
 M.shoulder=extend(std({roughness:1}),'v25-shoulder',`diffuseColor.rgb*=.9+.2*vnoise(vWorld.xz*.9);`);
 M.dash=new THREE.MeshBasicMaterial({color:'#e8e3d2',transparent:true,depthWrite:false,fog:false});
 extend(M.dash,'v25-dash',`float d=step(.55,fract(vUvM.x/9.));diffuseColor.a*=d*.8;`);
 // Vegetation.
 M.leaf=std({roughness:.95});M.leaf.side=THREE.DoubleSide;M.leaf.envMapIntensity=.25;
 M.trunk=std({roughness:1});M.trunk.envMapIntensity=.2;
 return M;
}
export {NOISE,extend};
