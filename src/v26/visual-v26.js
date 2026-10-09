import * as THREE from 'three';
import {V25_BOX,inV25Box,v25CameraFor} from '../v25/visual-v25.js';
import {buildRoadsV25} from '../v25/roads-v25.js';
import {makeMaterialsV26,setKeyLight,SHADING} from './toon-materials.js';
import {buildHousesV26} from './houses-v26.js';
import {buildVegetationV26} from './vegetation-v26.js';
import {buildGroundV26} from './ground-v26.js';
import {waterMaterialV26} from './water-v26.js';
import {createPostV26} from './post-v26.js';

// V2.6 Poussey diorama — orchestrator of the ?visual=poussey-v26 mode: the same box and plumbing as the V2.5
// prototype (V2.4 drawing replaced inside, untouched outside, frozen geography read only) with an assumed illustrated
// direction: painted toon shading, pastel palette, soft vegetation masses, clear water, ink outlines, miniature focus.
export const V26_BOX=V25_BOX;export const inV26Box=inV25Box;
export const V26_QUALITY={beauty:{label:'Beauté',dpr:2,shadow:4096,soft:true,ao:true,smaa:true,outline:true,tilt:true,trees:1,detail:1,texture:2048},balanced:{label:'Équilibré',dpr:1.5,shadow:2048,soft:true,ao:true,smaa:true,outline:true,tilt:false,trees:.8,detail:1,texture:2048},performance:{label:'Performance',dpr:1,shadow:1024,soft:false,ao:false,smaa:false,outline:true,tilt:false,trees:.5,detail:0,texture:1024}};
// Light: warm late-morning key light, cool sky fill (shadows go lavender), light haze, pastel sky, no tone mapping (flat colours stay what they are).
export const V26_LIGHT={sun:'#ffe8c8',sunIntensity:2.15,direction:[-.4,.76,.52],shadow:.92,sky:'#cfe0f7',ground:'#e4d4b0',hemisphere:1.0,fog:'#e2ebef',fogNear:2000,fogFar:7600,zenith:'#78b3e4',horizon:'#e9f0f3',below:'#dfe5dc'};
export const V26_VIEWS=[['V26_Poussey_Wide',[1180,-280],900,12,46],['V26_Poussey_Oblique',[1300,-250],430,22,40],['V26_Poussey_Houses',[1350,-262],190,30,32],['V26_Poussey_WaterTower',[1322,-214],210,215,22],['V26_Poussey_River',[1320,-395],170,15,24],['V26_Poussey_Street',[1300,-262],230,118,18]];

function skyDome(L){const geo=new THREE.SphereGeometry(16000,32,16);const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{zenith:{value:new THREE.Color(L.zenith)},horizon:{value:new THREE.Color(L.horizon)},below:{value:new THREE.Color(L.below)}},
 vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 zenith,horizon,below;varying vec3 vDir;void main(){float y=vDir.y;vec3 c=y>0.?mix(horizon,zenith,pow(clamp(y,0.,1.),.6)):mix(horizon,below,clamp(-y*6.,0.,1.));gl_FragColor=vec4(c,1.);}`});
 const m=new THREE.Mesh(geo,mat);m.name='v26-sky';m.renderOrder=-1;m.frustumCulled=false;return m;}

export async function buildVisualV26({scene,renderer,camera,sun,hemisphere,v2,items,enrichment,architecture,elevation,quality='beauty'}){
 const Q=V26_QUALITY[quality]||V26_QUALITY.beauty,L=V26_LIGHT,heightAt=v2.heightAt,box=V26_BOX;
 scene.add(skyDome(L));
 scene.fog=new THREE.Fog(L.fog,L.fogNear,L.fogFar);renderer.setClearColor(L.horizon,1);renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
 sun.color.set(L.sun);sun.intensity=L.sunIntensity;sun.shadow.intensity=L.shadow;hemisphere.color.set(L.sky);hemisphere.groundColor.set(L.ground);hemisphere.intensity=L.hemisphere;setKeyLight(sun.color,sun.intensity);
 const cx=(box.minX+box.maxX)/2,cz=(box.minZ+box.maxZ)/2,dir=new THREE.Vector3(...L.direction).normalize();
 sun.target.position.set(cx,heightAt(cx,cz),cz);sun.position.copy(sun.target.position).add(dir.clone().multiplyScalar(2600));sun.target.updateMatrixWorld();
 Object.assign(sun.shadow.camera,{left:-760,right:760,top:760,bottom:-760,near:800,far:4800});sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(Q.shadow,Q.shadow);sun.shadow.bias=-.00025;sun.shadow.normalBias=Q.shadow>=4096?.35:.6;sun.shadow.map?.dispose();sun.shadow.map=null;
 renderer.shadowMap.type=Q.soft?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;renderer.shadowMap.enabled=true;
 const M=makeMaterialsV26();SHADING.uBands.value=1;
 const group=new THREE.Group();group.name='v26';scene.add(group);
 const inside=items.filter(it=>{let x=0,z=0,n=0;for(const q of it.poly[0]){x+=q[0];z+=q[1];n++;}return inV26Box(x/n,z/n);});
 const ground=buildGroundV26(group,{v2,box,heightAt,size:Q.texture});
 const houses=buildHousesV26({items:inside,enrichment,architecture,elevation,materials:M});group.add(houses.group);
 const roads=buildRoadsV25(group,{v2,box,heightAt,materials:M});
 const vegetation=buildVegetationV26(group,{v2,box,buildings:inside,heightAt,materials:M,detail:Q.detail,budget:Q.trees});
 const water=waterMaterialV26();const waterMesh=v2.group.getObjectByName('v2-water');if(waterMesh){waterMesh.material=water.material;waterMesh.renderOrder=1;}
 const aoBox=new THREE.Box3(new THREE.Vector3(box.minX-50,-40,box.minZ-50),new THREE.Vector3(box.maxX+50,120,box.maxZ+50));
 const post=createPostV26(renderer,scene,camera,{ao:Q.ao,smaa:Q.smaa,outline:Q.outline,tilt:Q.tilt,vignette:.14,aoBox});
 renderer.shadowMap.needsUpdate=true;
 const start=performance.now();
 return {group,pickMeshes:houses.pickMeshes,post,box,views:V26_VIEWS,quality,cameraFor:v25CameraFor,
  update:now=>{water.update((now-start)/1000);},
  setSize:(w,h)=>post.setSize(w,h),
  stats:{mode:'poussey-v26',quality,buildings:houses.stats.buildings,byClass:houses.stats.byClass,houseVariants:houses.stats.variants,windows:houses.stats.windows,shutters:houses.stats.shutters,doors:houses.stats.doors,garageDoors:houses.stats.garageDoors,chimneys:houses.stats.chimneys,roads:roads.count,vegetation:vegetation.stats,ground}};
}
