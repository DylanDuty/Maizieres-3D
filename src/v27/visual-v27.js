import * as THREE from 'three';
import {v25CameraFor} from '../v25/visual-v25.js';
import {buildRoadsV25} from '../v25/roads-v25.js';
import {makeMaterialsV26,setKeyLight,SHADING,toon} from '../v26/toon-materials.js';
import {buildHousesV26,footprintIndex} from '../v26/houses-v26.js';
import {waterMaterialV26} from '../v26/water-v26.js';
import {createPostV26} from '../v26/post-v26.js';
import {V26_LIGHT} from '../v26/visual-v26.js';
import {buildGroundV27} from './ground-v27.js';
import {buildGroundV30} from '../v30/ground-v30.js';
import {buildVegetationV27} from './vegetation-v27.js';
import {buildParcelsV33,buildLimitMeshV33} from '../v33/parcels-v33.js';
import {buildHydroV29} from '../v29/hydro-v29.js';
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
// V2.9 — JRPG light: a warm golden key, a softer and slightly cooler sky fill, cooler blue-green shade, a lighter haze
// that starts nearer so the distance desaturates gently, a paler horizon.
export const V29_LIGHT={...V26_LIGHT,sun:'#ffe3b6',sunIntensity:2.0,direction:[-.42,.72,.55],shadow:.88,sky:'#d4e5f4',ground:'#eadfbd',hemisphere:1.06,fog:'#e7edef',fogNear:1700,fogFar:7400,zenith:'#86bce6',horizon:'#eff3f2',below:'#e3e7dc'};
// V2.9.1 — the quality pass: a golden key a little lower and warmer (longer, readable shadows), a bluer zenith, a cooler
// shade, the fog replaced by an aerial perspective (cool, desaturated distance under a capped veil: depth without white).
export const V291_LIGHT={...V26_LIGHT,sun:'#ffe4bd',sunIntensity:2.1,direction:[-.45,.66,.6],shadow:.9,sky:'#cfe1f3',ground:'#e6d6ae',hemisphere:1.0,fog:'#dce7ee',fogNear:2300,fogFar:10500,zenith:'#6aaee6',horizon:'#e6efef',below:'#dfe4d8',aerial:.45};
// V3.0 — late-morning light, illustrated: a slightly warm, higher sun (shorter, cleaner shadows), a fresh sky fill, blue-grey
// shade, a light aerial perspective (desaturated, brighter horizon, never a milky veil).
export const V30_LIGHT={...V26_LIGHT,sun:'#fff0d9',sunIntensity:2.0,direction:[-.4,.8,.46],shadow:.84,sky:'#d4e3f1',ground:'#e2d8bf',hemisphere:1.03,fog:'#e1e9ed',fogNear:2600,fogFar:12000,zenith:'#7fb2de',horizon:'#e9efee',below:'#e0e4da',aerial:.3};
// V3.1 — same late morning, more directional: a slightly stronger, warmer key against a more neutral, weaker sky fill (cleaner
// separation of volumes, cool shade without darker blacks), a touch more shadow, the aerial perspective a little lighter.
// V3.1 PERFORMANCE anti-aliasing default (FXAA, one full-screen pass), kept after the A/B test: without it, lisières, roof
// edges and parapets alias again on phones. `?fxaa=1` or `?fxaa=0` overrides it for a field test on a real device.
export const V31_FXAA_DEFAULT=true;
export const V31_LIGHT={...V30_LIGHT,sun:'#ffeed4',sunIntensity:2.15,shadow:.88,sky:'#d6e0e8',ground:'#ddd5c2',hemisphere:.94,aerial:.27};
// V3.0 detail texture of the ground (metres covered, pixels) per preset.
const V30_DETAIL={beauty:[1100,2048],balanced:[1100,2048],performance:[1000,1536]};
const SUN_DISTANCE=2600;

function skyDome(L){const geo=new THREE.SphereGeometry(16000,32,16);const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{zenith:{value:new THREE.Color(L.zenith)},horizon:{value:new THREE.Color(L.horizon)},below:{value:new THREE.Color(L.below)}},
 vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 zenith,horizon,below;varying vec3 vDir;void main(){float y=vDir.y;vec3 c=y>0.?mix(horizon,zenith,pow(clamp(y,0.,1.),.6)):mix(horizon,below,clamp(-y*6.,0.,1.));gl_FragColor=vec4(c,1.);}`});
 const m=new THREE.Mesh(geo,mat);m.name='v27-sky';m.renderOrder=-1;m.frustumCulled=false;return m;}

// Rail in the cartoon palette: warm pale ballast with soft ties (uv.x = metres along), slate rails, sand planks.
function restyleRail(v2,M){const names={'v2-ballast':toon(new THREE.MeshLambertMaterial({color:'#c3b79e'}),'ballast',`float tie=step(.5,fract(vUvM.x/.8));diffuseColor.rgb*=mix(1.,.8,tie*smoothstep(.1,.9,min(vUvM.y,1.-vUvM.y)*2.));`),
 'v2-rail':toon(new THREE.MeshLambertMaterial({color:'#737a84'}),'rails'),'v2-level-planks':toon(new THREE.MeshLambertMaterial({color:'#cdb995'}),'planks')};
 let n=0;for(const [name,mat] of Object.entries(names)){const o=v2.group.getObjectByName(name);if(o&&o.isMesh){o.material=mat;n++;}}return n;}

export async function buildVisualV27({scene,renderer,camera,sun,hemisphere,v2,items,enrichment,architecture,elevation,quality='beauty',diorama=false,poiAt=null,style='v28',target=null,fxaa=null}){
 const v33=style==='v33',v32=style==='v32'||v33,v31=style==='v31'||v32,v30=style==='v30'||v31,v291=style==='v291'||v30,v29=style==='v29'||v291,mat=v32?'v32':v31?'v31':v30?'v30':v291?'v291':v29?'v29':'v26';const Q=V27_QUALITY[quality]||V27_QUALITY.beauty,L=v31?V31_LIGHT:v30?V30_LIGHT:v291?V291_LIGHT:v29?V29_LIGHT:V27_LIGHT,heightAt=v2.heightAt;
 scene.add(skyDome(L));
 scene.fog=new THREE.Fog(L.fog,L.fogNear,L.fogFar);renderer.setClearColor(L.horizon,1);renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
 sun.color.set(L.sun);sun.intensity=L.sunIntensity;sun.shadow.intensity=L.shadow;hemisphere.color.set(L.sky);hemisphere.groundColor.set(L.ground);hemisphere.intensity=L.hemisphere;setKeyLight(sun.color,sun.intensity);
 const dir=new THREE.Vector3(...L.direction).normalize(),sunOffset=dir.clone().multiplyScalar(SUN_DISTANCE);
 Object.assign(sun.shadow.camera,{near:50,far:7000});sun.shadow.mapSize.set(Q.shadow,Q.shadow);sun.shadow.bias=-.00025;sun.shadow.map?.dispose();sun.shadow.map=null;
 renderer.shadowMap.type=Q.soft?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;renderer.shadowMap.enabled=true;
 const M=makeMaterialsV26({style:mat});SHADING.uBands.value=v30?4:v291?3:v29?2:1;SHADING.uShadowTint.value.set(v31?'#8294aa':v30?'#8597ac':v291?'#7f9eb8':v29?'#8ea9b6':'#8f9ac6');SHADING.uRim.value=v30?.1:v291?.14:v29?.15:.12;SHADING.uWarm.value.set(v31?'#fff0dc':v30?'#fff2e2':v291?'#fff4e4':'#ffffff');SHADING.uAerial.value=L.aerial||0;
 const group=new THREE.Group();group.name='v27';scene.add(group);
 // V3.3: interpreted plots, built once from the footprints, the classes, the streets and the land cover (src/v33).
 const parcels=v33?buildParcelsV33({items,architecture,enrichment,v2,heightAt,poiAt,performance:quality==='performance'}):null;
 const ground=v30?buildGroundV30(v2,{size:Q.texture,detailM:V30_DETAIL[quality]?.[0]||1100,detail:V30_DETAIL[quality]?.[1]||2048,lite:quality==='performance',v31,v32,v33,parcels,buildings:v31?items:null}):buildGroundV27(v2,{size:Q.texture,style:mat}),box=ground.box;
 for(const name of ['v2-roads','v2-road-marks']){const o=v2.group.getObjectByName(name);if(o)o.visible=false;}
 const railMeshes=restyleRail(v2,M);
 // V2.8: landmarks from documented references (church, water towers, memorial, mairie and fire-station accents).
 const special=specialBuildingsV28(elevation,landmarkIndex([...(v2.poiById?v2.poiById.values():[])]));
 const occupied=footprintIndex(items);const houses=buildHousesV26({items,enrichment,architecture,elevation,materials:M,special,occupied,style:mat});group.add(houses.group);
 // V3.3 limits as geometry in BEAUTÉ and ÉQUILIBRÉ (clipped hedges, low walls); PERFORMANCE keeps them painted on the ground.
 let limits=null;if(parcels&&quality!=='performance'){const lm=buildLimitMeshV33(parcels,{heightAt,occupied});if(lm.tri.n){const m=new THREE.Mesh(lm.tri.geometry(),M.leaf);m.name='v33-limits';m.castShadow=true;m.receiveShadow=true;group.add(m);limits={pieces:lm.pieces,triangles:lm.tri.n};}}
 const extras=new Tri();const memorial=warMemorialV28(extras,poiAt,heightAt);
 if(extras.n){const g=extras.geometry(),m=new THREE.Mesh(g,M.detail);m.name='v27-landmarks';m.castShadow=true;m.receiveShadow=true;group.add(m);}
 const roads=buildRoadsV25(group,{v2,box,heightAt,materials:M});
 const vegetation=buildVegetationV27(group,{v2,box,buildings:items,heightAt,materials:M,q:v30?{...Q.veg,riparianCorridor:11,v30:true,v31,v32,...(parcels?quality==='performance'?{skipGarden:parcels.onHard}:{lotTrees:parcels.lots.flatMap(l=>l.trees),skipGarden:parcels.inLot}:{})}:v291?{...Q.veg,riparianCorridor:11,v291:true}:v29?{...Q.veg,riparianCorridor:11}:Q.veg});
 const water=waterMaterialV26({style:mat});const waterMesh=v2.group.getObjectByName('v2-water');if(waterMesh){waterMesh.material=water.material;waterMesh.renderOrder=1;}
 const waterLines=v2.group.getObjectByName('v2-water-lines');let hydro=null;
 if(v29){if(waterLines)waterLines.visible=false;hydro=buildHydroV29(group,{v2,heightAt,material:water.material});}
 else if(waterLines){waterLines.material=water.material;waterLines.renderOrder=1;}
 const aoBox=new THREE.Box3(new THREE.Vector3(box.minX-50,-80,box.minZ-50),new THREE.Vector3(box.maxX+50,160,box.maxZ+50));
 // V3.0: a sober grade (no added saturation), a faint warm-grey ink only on strong silhouettes, a whisper of vignette, SMAA in
 // BEAUTÉ and ÉQUILIBRÉ, FXAA (one pass) in PERFORMANCE, which had no anti-aliasing.
 // V3.1: a gentle S-curve in the grade (mid-tone contrast without crushed shadows or burnt highlights), finer and slightly
 // stronger AO. PERFORMANCE anti-aliasing is set by `?fxaa=1|0` (V3.1 default: see V31_FXAA_DEFAULT).
 const aa=v31&&!Q.smaa?(fxaa==='1'?'fxaa':fxaa==='0'?false:V31_FXAA_DEFAULT?'fxaa':false):v30?(Q.smaa||(fxaa==='0'?false:'fxaa')):Q.smaa;
 const post=createPostV26(renderer,scene,camera,{ao:Q.ao,smaa:aa,aoRadius:v31?2.3:2.8,outline:Q.outline,tilt:Q.tilt,tiltAmount:diorama?2.4:v30?.55:.75,tiltBand:diorama?.16:v30?.3:.26,vignette:v30?.05:v29?.12:.14,aoBox,grade:v31?{warmth:.018,contrast:1.08,saturation:1.06,lift:.009,cool:1.15,curve:.16}:v30?{warmth:.014,contrast:1.07,saturation:1.04,lift:.005,cool:1.1}:v291?{warmth:.022,contrast:1.1,saturation:1.12,lift:.008,cool:1.35}:v29,ink:v30?'#55574d':v291?'#3b3652':null,outlineStrength:v30?.32:v291?.8:.75,aoIntensity:v31?.86:v30?.78:v291?.85:.7});
 renderer.shadowMap.needsUpdate=true;
 const start=performance.now();const lastCam=new THREE.Vector3(1e9,0,0),tv=new THREE.Vector3();let lastT=[1e9,1e9],lastMove=0;
 return {group,pickMeshes:houses.pickMeshes,post,box,views:null,wholeMap:true,dynamicShadow:true,sunOffset:sunOffset.toArray(),quality,cameraFor:v25CameraFor,
  update:now=>{water.update((now-start)/1000);
   // V3.2: chimneys only under 1,5 km of the target (below one pixel beyond).
   if(houses.chimneyMesh&&target){const t=target();houses.chimneyMesh.visible=camera.position.distanceTo(tv.set(t[0],heightAt(t[0],t[1]),t[1]))<1500;}
   if(v30&&ground.update&&target){const t=target(),c=camera.position;if(!lastCam.equals(c)||lastT[0]!==t[0]||lastT[1]!==t[1]){lastCam.copy(c);lastT=[t[0],t[1]];lastMove=now;}
    ground.update(t,c.distanceTo(tv.set(t[0],heightAt(t[0],t[1]),t[1])),now-lastMove>220);}},
  setSize:(w,h)=>post.setSize(w,h),
  stats:{get groundPaint(){return ground.stats?ground.stats():null;},antialias:aa===true?'SMAA':aa||'aucun',mode:v33?'premium-v33':v32?'premium-v32':v31?'premium-v31':v30?'premium-v30':v291?'cartoon-v291':v29?'cartoon-v29':'cartoon-v28',style,quality,diorama,landmarks:special.stats,hydro:hydro?.stats||null,tiltShift:Q.tilt?(diorama?'fort (2,4 px, bande 0,16)':v30?'léger (0,55 px, bande 0,30)':'léger (0,75 px, bande 0,26)'):'aucun',buildings:houses.stats.buildings,byClass:houses.stats.byClass,houseVariants:houses.stats.variants,bigVariants:houses.stats.bigVariants,windows:houses.stats.windows,shutters:houses.stats.shutters,doors:houses.stats.doors,garageDoors:houses.stats.garageDoors,chimneys:houses.stats.chimneys,...(v32?{architectureV32:{wingRoofs:houses.stats.wingRoofs,wings:houses.stats.wings,leanTo:houses.stats.leanTo,hipDerived:houses.stats.hipDerived,facades:houses.stats.facades,families:houses.stats.families}}:{}),...(parcels?{parcelsV33:{...parcels.stats,limits}}:{}),roads:roads.count,railMeshes,memorial,vegetation:vegetation.stats,ground:{texture:ground.texture,detail:ground.detail||null,contactVolumes:ground.contactVolumes||0,contactHouses:ground.contactHouses||0,vertices:ground.vertices,box}}};
}
