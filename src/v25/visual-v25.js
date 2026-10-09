import * as THREE from 'three';
import {makeTextures,makeMaterials} from './procedural-materials.js';
import {buildHouses} from './procedural-houses.js';
import {buildVegetationV25} from './procedural-vegetation.js';
import {buildTerrainV25} from './terrain-v25.js';
import {buildRoadsV25} from './roads-v25.js';
import {waterMaterialV25} from './water-v25.js';
import {createPostV25} from './postprocessing-v25.js';

// V2.5 Poussey prototype — orchestrator of the ?visual=poussey-v25 mode. Inside the Poussey box the V2.4 drawing is
// replaced (procedural houses, composed trees, local ground, textured roads, living water); outside it the V2.4 scene
// stays. The frozen geography is read, never written. Three quality presets; BEAUTY is the one meant for judgement.
export const V25_BOX={minX:600,maxX:1850,minZ:-850,maxZ:-20};
export const inV25Box=(x,z)=>x>=V25_BOX.minX&&x<=V25_BOX.maxX&&z>=V25_BOX.minZ&&z<=V25_BOX.maxZ;
export const V25_QUALITY={beauty:{label:'Beauté',dpr:2,shadow:4096,soft:true,ao:true,smaa:true,trees:1,detail:1,texture:2048},balanced:{label:'Équilibré',dpr:1.5,shadow:2048,soft:true,ao:true,smaa:true,trees:.75,detail:1,texture:2048},performance:{label:'Performance',dpr:1,shadow:1024,soft:false,ao:false,smaa:false,trees:.4,detail:0,texture:1024}};
export const V25_LIGHT={sun:'#fff0d6',sunIntensity:3.1,direction:[-.38,.78,.5],shadow:.8,sky:'#b4d2ee',ground:'#c8b286',hemisphere:.6,exposure:1.0,fog:'#dbe5e3',fogNear:2600,fogFar:9500,zenith:'#5a98d6',horizon:'#d8e3ea',below:'#d6dbce'};
// Camera presets around Poussey: [name, target x z, distance, azimuth °, elevation °].
export const V25_VIEWS=[['V25_Poussey_Wide',[1180,-280],900,12,46],['V25_Poussey_Cinematic',[1300,-262],230,118,16],['V25_Poussey_StreetHigh',[1340,-262],130,32,13],['V25_Poussey_Houses',[1350,-262],170,28,30],['V25_Poussey_WaterTower',[1322,-214],200,215,18],['V25_Poussey_River',[1320,-395],150,15,18]];
export const v25CameraFor=([,t,d,az,el])=>{const a=az*Math.PI/180,e=el*Math.PI/180;return {position:[t[0]+d*Math.sin(a)*Math.cos(e),d*Math.sin(e),t[1]+d*Math.cos(a)*Math.cos(e)],target:[t[0],0,t[1]]};};

function skyDome(L){const geo=new THREE.SphereGeometry(16000,32,16);const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{zenith:{value:new THREE.Color(L.zenith)},horizon:{value:new THREE.Color(L.horizon)},below:{value:new THREE.Color(L.below)}},
 vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 zenith,horizon,below;varying vec3 vDir;void main(){float y=vDir.y;vec3 c=y>0.?mix(horizon,zenith,pow(clamp(y,0.,1.),.55)):mix(horizon,below,clamp(-y*6.,0.,1.));gl_FragColor=vec4(c,1.);}`});
 const m=new THREE.Mesh(geo,mat);m.name='v25-sky';m.renderOrder=-1;m.frustumCulled=false;return m;}

export async function buildVisualV25({scene,renderer,camera,sun,hemisphere,v2,items,enrichment,architecture,elevation,quality='beauty',onReady}){
 const Q=V25_QUALITY[quality]||V25_QUALITY.beauty,L=V25_LIGHT,heightAt=v2.heightAt;
 // Sky dome in the scene (needed by the post-processing), environment map from that same sky, atmosphere and light.
 const sky=skyDome(L);scene.add(sky);
 const pmrem=new THREE.PMREMGenerator(renderer);const envScene=new THREE.Scene();envScene.add(skyDome(L));const envMap=pmrem.fromScene(envScene,.04).texture;pmrem.dispose();
 scene.fog=new THREE.Fog(L.fog,L.fogNear,L.fogFar);renderer.setClearColor(L.horizon,1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=L.exposure;
 sun.color.set(L.sun);sun.intensity=L.sunIntensity;sun.shadow.intensity=L.shadow;hemisphere.color.set(L.sky);hemisphere.groundColor.set(L.ground);hemisphere.intensity=L.hemisphere;
 const cx=(V25_BOX.minX+V25_BOX.maxX)/2,cz=(V25_BOX.minZ+V25_BOX.maxZ)/2,dir=new THREE.Vector3(...L.direction).normalize();
 sun.target.position.set(cx,heightAt(cx,cz),cz);sun.position.copy(sun.target.position).add(dir.clone().multiplyScalar(2600));sun.target.updateMatrixWorld();
 Object.assign(sun.shadow.camera,{left:-760,right:760,top:760,bottom:-760,near:800,far:4800});sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(Q.shadow,Q.shadow);sun.shadow.bias=-.00025;sun.shadow.normalBias=Q.shadow>=4096?.35:.6;sun.shadow.map?.dispose();sun.shadow.map=null;
 renderer.shadowMap.type=Q.soft?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;renderer.shadowMap.enabled=true;
 const T=makeTextures(),M=makeMaterials(T,envMap);
 const group=new THREE.Group();group.name='v25';scene.add(group);
 const inside=items.filter(it=>{let x=0,z=0,n=0;for(const q of it.poly[0]){x+=q[0];z+=q[1];n++;}return inV25Box(x/n,z/n);});
 const ground=buildTerrainV25(group,{v2,box:V25_BOX,heightAt,T,envMap,size:Q.texture});
 const houses=buildHouses({items:inside,enrichment,architecture,elevation,materials:M,T});group.add(houses.group);
 const roads=buildRoadsV25(group,{v2,box:V25_BOX,heightAt,materials:M});
 const vegetation=buildVegetationV25(group,{v2,box:V25_BOX,buildings:inside,heightAt,materials:M,detail:Q.detail,budget:Q.trees});
 const water=waterMaterialV25(envMap);const waterMesh=v2.group.getObjectByName('v2-water');if(waterMesh){waterMesh.material=water.material;waterMesh.renderOrder=1;}
 const aoBox=new THREE.Box3(new THREE.Vector3(V25_BOX.minX-50,-40,V25_BOX.minZ-50),new THREE.Vector3(V25_BOX.maxX+50,120,V25_BOX.maxZ+50));
 const post=createPostV25(renderer,scene,camera,{ao:Q.ao,smaa:Q.smaa,vignette:.16,aoBox});
 renderer.shadowMap.needsUpdate=true;
 const start=performance.now();
 return {group,pickMeshes:houses.pickMeshes,post,envMap,box:V25_BOX,views:V25_VIEWS,quality,
  update:now=>{water.update((now-start)/1000);},
  setSize:(w,h)=>post.setSize(w,h),
  stats:{quality,buildings:houses.stats.buildings,byClass:houses.stats.byClass,houseVariants:houses.stats.variants,windows:houses.stats.windows,shutters:houses.stats.shutters,doors:houses.stats.doors,garageDoors:houses.stats.garageDoors,chimneys:houses.stats.chimneys,roads:roads.count,vegetation:vegetation.stats,ground:ground}};
}
