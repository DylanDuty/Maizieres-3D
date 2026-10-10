import * as THREE from 'three';
import {v25CameraFor} from '../v25/visual-v25.js';
import {buildRoadsV25} from '../v25/roads-v25.js';
import {makeMaterialsV26,setKeyLight,SHADING,toon} from '../v26/toon-materials.js';
import {buildHousesV26,footprintIndex} from '../v26/houses-v26.js';
import {waterMaterialV26} from '../v26/water-v26.js';
import {createPostV26} from '../v26/post-v26.js';
import {V26_LIGHT} from '../v26/visual-v26.js';
import {buildGroundV27} from './ground-v27.js';
import {buildVegetationV27} from './vegetation-v27.js';
import {specialBuildingsV28,warMemorialV28,landmarkIndex} from '../v28/landmarks-v28.js';
import {Tri} from '../v25/procedural-houses.js';

// V2.7 — the V2.6.1 diorama language generalised to the whole commune (?visual=cartoon-v27, alias cartoon-v28 since the
// V2.8 landmarks). Same light, palette,
// materials, houses, water, post-processing and click UX as Poussey; the ground is the V2.4 terrain repainted, the
// vegetation is budgeted (canopy masses for the woods, tiled instances), the rail and the roads take the cartoon
// materials, the four unique models get their own silhouettes. The frozen geography is read, never written.
export const V27_QUALITY={
 beauty:{label:'Beauté',dpr:2,shadow:4096,soft:true,ao:true,smaa:true,outline:true,tilt:true,texture:4096,veg:{lod:1,edgeStep:30,emergentStep:50,poplarStep:24,gardenCell:17,hedgeStep:3.6,houseShrubs:true,riparianStep:12}},
 balanced:{label:'Équilibré',dpr:1.5,shadow:2048,soft:true,ao:true,smaa:true,outline:true,tilt:false,texture:4096,veg:{lod:1,edgeStep:40,emergentStep:70,poplarStep:28,gardenCell:20,hedgeStep:4.5,houseShrubs:true,riparianStep:16}},
 performance:{label:'Performance',dpr:1,shadow:1024,soft:false,ao:false,smaa:false,outline:true,tilt:false,texture:2048,veg:{lod:0,edgeStep:40,emergentStep:0,poplarStep:30,gardenCell:26,hedgeStep:5,houseShrubs:false,riparianStep:24}}};
export const V27_LIGHT={...V26_LIGHT,fogNear:2400,fogFar:9800};
const SUN_DISTANCE=2600;

function skyDome(L){const geo=new THREE.SphereGeometry(16000,32,16);const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{zenith:{value:new THREE.Color(L.zenith)},horizon:{value:new THREE.Color(L.horizon)},below:{value:new THREE.Color(L.below)}},
 vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 zenith,horizon,below;varying vec3 vDir;void main(){float y=vDir.y;vec3 c=y>0.?mix(horizon,zenith,pow(clamp(y,0.,1.),.6)):mix(horizon,below,clamp(-y*6.,0.,1.));gl_FragColor=vec4(c,1.);}`});
 const m=new THREE.Mesh(geo,mat);m.name='v27-sky';m.renderOrder=-1;m.frustumCulled=false;return m;}

// Rail in the cartoon palette: warm pale ballast with soft ties (uv.x = metres along), slate rails, sand planks.
function restyleRail(v2,M){const names={'v2-ballast':toon(new THREE.MeshLambertMaterial({color:'#c3b79e'}),'ballast',`float tie=step(.5,fract(vUvM.x/.8));diffuseColor.rgb*=mix(1.,.8,tie*smoothstep(.1,.9,min(vUvM.y,1.-vUvM.y)*2.));`),
 'v2-rail':toon(new THREE.MeshLambertMaterial({color:'#737a84'}),'rails'),'v2-level-planks':toon(new THREE.MeshLambertMaterial({color:'#cdb995'}),'planks')};
 let n=0;for(const [name,mat] of Object.entries(names)){const o=v2.group.getObjectByName(name);if(o&&o.isMesh){o.material=mat;n++;}}return n;}

export async function buildVisualV27({scene,renderer,camera,sun,hemisphere,v2,items,enrichment,architecture,elevation,quality='beauty',diorama=false,poiAt=null}){
 const Q=V27_QUALITY[quality]||V27_QUALITY.beauty,L=V27_LIGHT,heightAt=v2.heightAt;
 scene.add(skyDome(L));
 scene.fog=new THREE.Fog(L.fog,L.fogNear,L.fogFar);renderer.setClearColor(L.horizon,1);renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
 sun.color.set(L.sun);sun.intensity=L.sunIntensity;sun.shadow.intensity=L.shadow;hemisphere.color.set(L.sky);hemisphere.groundColor.set(L.ground);hemisphere.intensity=L.hemisphere;setKeyLight(sun.color,sun.intensity);
 const dir=new THREE.Vector3(...L.direction).normalize(),sunOffset=dir.clone().multiplyScalar(SUN_DISTANCE);
 Object.assign(sun.shadow.camera,{near:50,far:7000});sun.shadow.mapSize.set(Q.shadow,Q.shadow);sun.shadow.bias=-.00025;sun.shadow.map?.dispose();sun.shadow.map=null;
 renderer.shadowMap.type=Q.soft?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;renderer.shadowMap.enabled=true;
 const M=makeMaterialsV26();SHADING.uBands.value=1;
 const group=new THREE.Group();group.name='v27';scene.add(group);
 const ground=buildGroundV27(v2,{size:Q.texture}),box=ground.box;
 for(const name of ['v2-roads','v2-road-marks']){const o=v2.group.getObjectByName(name);if(o)o.visible=false;}
 const railMeshes=restyleRail(v2,M);
 // V2.8: landmarks from documented references (church, water towers, memorial, mairie and fire-station accents).
 const special=specialBuildingsV28(elevation,landmarkIndex([...(v2.poiById?v2.poiById.values():[])]));
 const houses=buildHousesV26({items,enrichment,architecture,elevation,materials:M,special,occupied:footprintIndex(items)});group.add(houses.group);
 const extras=new Tri();const memorial=warMemorialV28(extras,poiAt,heightAt);
 if(extras.n){const g=extras.geometry(),m=new THREE.Mesh(g,M.detail);m.name='v27-landmarks';m.castShadow=true;m.receiveShadow=true;group.add(m);}
 const roads=buildRoadsV25(group,{v2,box,heightAt,materials:M});
 const vegetation=buildVegetationV27(group,{v2,box,buildings:items,heightAt,materials:M,q:Q.veg});
 const water=waterMaterialV26();const waterMesh=v2.group.getObjectByName('v2-water');if(waterMesh){waterMesh.material=water.material;waterMesh.renderOrder=1;}
 const aoBox=new THREE.Box3(new THREE.Vector3(box.minX-50,-80,box.minZ-50),new THREE.Vector3(box.maxX+50,160,box.maxZ+50));
 const post=createPostV26(renderer,scene,camera,{ao:Q.ao,smaa:Q.smaa,outline:Q.outline,tilt:Q.tilt,tiltAmount:diorama?2.4:.75,tiltBand:diorama?.16:.26,vignette:.14,aoBox});
 renderer.shadowMap.needsUpdate=true;
 const start=performance.now();
 return {group,pickMeshes:houses.pickMeshes,post,box,views:null,wholeMap:true,dynamicShadow:true,sunOffset:sunOffset.toArray(),quality,cameraFor:v25CameraFor,
  update:now=>{water.update((now-start)/1000);},
  setSize:(w,h)=>post.setSize(w,h),
  stats:{mode:'cartoon-v28',quality,diorama,landmarks:special.stats,tiltShift:Q.tilt?(diorama?'fort (2,4 px, bande 0,16)':'léger (0,75 px, bande 0,26)'):'aucun',buildings:houses.stats.buildings,byClass:houses.stats.byClass,houseVariants:houses.stats.variants,bigVariants:houses.stats.bigVariants,windows:houses.stats.windows,shutters:houses.stats.shutters,doors:houses.stats.doors,garageDoors:houses.stats.garageDoors,chimneys:houses.stats.chimneys,roads:roads.count,railMeshes,memorial,vegetation:vegetation.stats,ground:{texture:ground.texture,vertices:ground.vertices,box}}};
}
