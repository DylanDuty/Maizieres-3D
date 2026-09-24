import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {projection,polygons,bounds,insidePoly} from './geo.js';
import {buildLandscape} from './landscape.js';
import {buildBuildings,PROVENANCE_COLORS} from './buildings.js';
import './style.css';
import {benchmark} from './benchmark.js';
import {qualitySettings} from './quality.js';
import {createCatalogue} from './cartography.js';
import {installSelection} from './selection.js';
import {buildingItems} from './building-source.js';
import {palette} from './art.js';
const loading=document.querySelector('#loading');
async function start(){
  const t0=performance.now();
  const responses=await Promise.all(['maizieres.geojson','commune.geojson','building-enrichment.json','ign-landscape.geojson','named-zones.geojson','bible-annotations.json','buildings.geojson'].map(name=>fetch(`${import.meta.env.BASE_URL}data/${name}`)));
  if(responses.some(r=>!r.ok))throw Error('Les données locales sont introuvables.');
  const [data,boundary,enrichment,ignLandscape,namedZones,bible,buildingReference]=await Promise.all(responses.map(r=>r.json()));
  const project=projection(data.metadata.origin),boundaryPolys=polygons(boundary,project),b=bounds(boundaryPolys.flat(2));
  const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(palette.horizon,5600,19000);
  const device={dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory};let quality=qualitySettings('fluid',device);
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.setPixelRatio(quality.pixelRatio);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.domElement.setAttribute('aria-label','Vue 3D navigable : flèches pour déplacer, + et − pour zoomer, R pour recentrer.');renderer.domElement.tabIndex=0;document.querySelector('#map').appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,1,20000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.13;controls.rotateSpeed=.75;controls.maxPolarAngle=Math.PI*.475;controls.minDistance=35;controls.maxDistance=10500;controls.screenSpacePanning=false;controls.zoomSpeed=.8;controls.target.set(200,0,150);
  const sun=new THREE.DirectionalLight(palette.sun,1.95);sun.position.set(-1300,2200,-900);sun.castShadow=true;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);Object.assign(sun.shadow.camera,{left:-2200,right:2200,top:2200,bottom:-2200,near:50,far:6000});sun.shadow.bias=-.00012;sun.shadow.normalBias=1.2;sun.shadow.intensity=.62;scene.add(sun.target);scene.add(sun,new THREE.HemisphereLight(palette.skyLight,palette.groundLight,.95));
  // Give the browser a frame to paint loading feedback before building static batches.
  await new Promise(resolve=>requestAnimationFrame(resolve));
  // V1.5: building footprints come from the unified reference (IGN BD TOPO first, OSM complement).
  const reference=buildingItems(buildingReference,project,extent),diagnostic=new URLSearchParams(location.search).get('diagnostic')==='provenance';
  const terrain=buildLandscape(scene,data,project,extent,ignLandscape,reference.items);
  for(const f of data.features)if(f.geometry.type==='Point'&&['school','townhall','community_centre'].includes(f.properties.amenity)){const p=project(f.geometry.coordinates);const building=terrain.buildings.find(b=>insidePoly(p,b.poly));if(building){building.t={...building.t,amenity:f.properties.amenity,name:f.properties.name};}}
  const buildings=buildBuildings(scene,terrain.buildings,enrichment,{diagnostic});
  if(diagnostic){const legend=document.createElement('div');legend.id='diagnostic-legend';legend.innerHTML=Object.entries({'ign+osm':'IGN et OSM','ign+osm-partiel':'IGN, OSM partiel','ign':'IGN seul','osm':'OSM seul'}).map(([k,v])=>`<span><i style="background:${PROVENANCE_COLORS[k]}"></i>${v} · ${reference.items.filter(i=>i.provenance===k).length}</span>`).join('');document.body.appendChild(legend);}
  // A fine administrative line distinguishes the real commune from the context rectangle.
  for(const poly of boundaryPolys){const pts=poly[0].map(([x,z])=>new THREE.Vector3(x,.4,z));const geo=new THREE.BufferGeometry().setFromPoints(pts);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:'#e0d9bb',dashSize:9,gapSize:7,transparent:true,opacity:.65}));line.computeLineDistances();scene.add(line);}
  const catalogue=createCatalogue(data,enrichment,project,extent,terrain.buildings,namedZones,bible);
  const selection=installSelection({scene,camera,canvas:renderer.domElement,catalogue,meshes:buildings.pickMeshes,buildingInfo:buildings.info,invalidate,target:()=>controls.target});
  const labelItems=[];for(const l of [...buildings.landmarks,...terrain.landmarks])if(!labelItems.some(o=>o.name===l.name&&Math.hypot(o.position[0]-l.position[0],o.position[2]-l.position[2])<80))labelItems.push(l);
  for(const r of catalogue.records.filter(r=>r.type==='point'&&(r.kind==='Lieu-dit / secteur'||r.id.startsWith('bible'))))if(!labelItems.some(l=>l.name===r.name))labelItems.push({id:r.id,name:r.name,position:r.position,major:r.major,local:!r.major,style:r.id.startsWith('bible')?'heritage':r.major?'':'place'});
  for(const l of enrichment.landmarks){if(!labelItems.some(p=>Math.hypot(p.position[0]-l.position[0],p.position[2]-l.position[2])<45))labelItems.push(l);}
  for(const f of data.features){const t=f.properties;if(f.geometry.type!=='Point')continue;
    if(['hamlet','village'].includes(t.place)||['townhall','school','community_centre'].includes(t.amenity)){const p=project(f.geometry.coordinates);const name=t.name||(t.amenity==='townhall'?'Mairie':t.amenity==='school'?'École':'Salle communale');if(!labelItems.some(l=>l.name===name))labelItems.push({name,position:[p[0],14,p[1]],major:!!t.place});}
  }
  // Major road and railway names are copied from the local source tags.
  for(const ref of ['D 619','D 116']){const f=data.features.find(f=>f.properties.ref===ref&&f.geometry.type==='LineString'&&f.geometry.coordinates.length>3);if(f){const p=project(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)]);labelItems.push({id:f.id,name:ref,position:[p[0],3,p[1]]});}}
  const labels=labelItems.map(item=>{const el=document.createElement('button');el.type='button';el.className=`map-label${item.major?' major':''}${item.style?' '+item.style:''}`;el.textContent=item.name;selection.bindLabel(el,item);document.querySelector('#labels-layer').appendChild(el);return {...item,el,vector:new THREE.Vector3(...item.position)};});
  const sortedLabels=[...labels].sort((a,b)=>Number(!!b.major)-Number(!!a.major));
  const labelLayer=document.querySelector('#labels-layer');let namesVisible=true;
  document.querySelector('#labels').addEventListener('click',event=>{namesVisible=!namesVisible;event.currentTarget.setAttribute('aria-pressed',String(namesVisible));labelLayer.hidden=!namesVisible;invalidate();});
  const homeTarget=new THREE.Vector3(200,0,150);
  function reset(){controls.enableDamping=false;controls.update();controls.target.copy(homeTarget);const portrait=innerWidth/innerHeight<1;camera.position.copy(homeTarget).add(new THREE.Vector3(240,portrait?3100:1900,portrait?3000:2350));controls.update();controls.enableDamping=true;invalidate();}
  document.querySelector('#reset').addEventListener('click',reset);
  renderer.domElement.addEventListener('keydown',event=>{const step=camera.position.distanceTo(controls.target)*.05,delta=new THREE.Vector3();if(event.key==='r'||event.key==='R'){reset();event.preventDefault();return;}if(event.key==='+'||event.key==='=')camera.position.lerp(controls.target,.15);else if(event.key==='-')camera.position.add(camera.position.clone().sub(controls.target).multiplyScalar(.15));else if(event.key==='ArrowUp')delta.z=-step;else if(event.key==='ArrowDown')delta.z=step;else if(event.key==='ArrowLeft')delta.x=-step;else if(event.key==='ArrowRight')delta.x=step;else return;controls.target.add(delta);camera.position.add(delta);event.preventDefault();invalidate();});
  let queued=false,benchmarking=false;
  function invalidate(){if(!queued&&!benchmarking){queued=true;requestAnimationFrame(draw);}}
  const screen=new THREE.Vector3();
  // Static shadows re-fitted to the viewed area only when the view changes noticeably:
  // crisp near the ground, the whole commune from far away, no per-frame shadow pass.
  let shadowKey='';
  function fitShadow(){const d=camera.position.distanceTo(controls.target),half=THREE.MathUtils.clamp(d*1.7,260,3000),step=half*.3,c=controls.target;
   const key=[Math.round(c.x/step),Math.round(c.z/step),Math.round(Math.log2(half)*2.5)].join();if(key===shadowKey)return;shadowKey=key;
   const h=Math.pow(2,Math.round(Math.log2(half)*2.5)/2.5);sun.target.position.set(Math.round(c.x/step)*step,0,Math.round(c.z/step)*step);sun.position.copy(sun.target.position).add(new THREE.Vector3(-1300,2200,-900));sun.target.updateMatrixWorld();
   Object.assign(sun.shadow.camera,{left:-h*1.15,right:h*1.15,top:h*1.15,bottom:-h*1.15});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=Math.max(.15,h*2.3/quality.shadowSize);renderer.shadowMap.needsUpdate=true;}
  function draw(){queued=false;controls.update();fitShadow();
    const previous=controls.target.clone();controls.target.x=THREE.MathUtils.clamp(controls.target.x,extent.minX,extent.maxX);controls.target.z=THREE.MathUtils.clamp(controls.target.z,extent.minZ,extent.maxZ);controls.target.y=0;camera.position.add(controls.target.clone().sub(previous));
    const renderStart=performance.now();renderer.render(scene,camera);renderer.domElement.dataset.render=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:quality.mode,pixelRatio:renderer.getPixelRatio(),shadowSize:quality.shadowSize,submissionMs:Math.round((performance.now()-renderStart)*100)/100,camera:camera.position.toArray(),target:controls.target.toArray()});
    const placed=[];
    if(namesVisible)for(const l of sortedLabels){screen.copy(l.vector).project(camera);const x=(screen.x*.5+.5)*innerWidth,y=(-screen.y*.5+.5)*innerHeight;const w=l.name.length*7+20;const visible=(!l.local||camera.position.distanceTo(controls.target)<2200)&&screen.z>-1&&screen.z<1&&x>20&&x<innerWidth-20&&y>135&&y<innerHeight-80&&!placed.some(r=>Math.abs(x-r.x)<(w+r.w)/2&&Math.abs(y-r.y)<30);l.el.style.display=visible?'block':'none';if(visible){l.el.style.left=`${x}px`;l.el.style.top=`${y}px`;placed.push({x,y,w});}}
    document.querySelector('#north').style.transform=`rotate(${controls.getAzimuthalAngle()}rad)`;
  }
  const qualityButton=document.querySelector('#quality');
  function applyQuality(mode){quality=qualitySettings(mode,device);renderer.setPixelRatio(quality.pixelRatio);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.type=mode==='high'?THREE.PCFSoftShadowMap:THREE.BasicShadowMap;scene.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;qualityButton.textContent=`Qualité : ${mode==='high'?'Élevée':'Fluide'}`;qualityButton.setAttribute('aria-pressed',String(mode==='high'));invalidate();}
  qualityButton.addEventListener('click',()=>applyQuality(quality.mode==='fluid'?'high':'fluid'));
  controls.addEventListener('change',invalidate);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);invalidate();});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();loading.hidden=false;loading.style.display='flex';loading.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Affichage 3D interrompu. Rechargez la page.'}));});
  renderer.domElement.dataset.stats=JSON.stringify({...terrain.stats,buildings:buildings.count,enrichment:buildings.stats,clickable:catalogue.stats,loadMs:Math.round(performance.now()-t0)});reset();draw();renderer.shadowMap.autoUpdate=false;loading.remove();
  const snapshot=data.metadata.osmTimestamp?.slice(0,10)||data.metadata.retrievedAt.slice(0,10);document.querySelector('#data-date').textContent=`Relevé OSM · ${new Date(snapshot).toLocaleDateString('fr-FR')}`;
  // Read-only diagnostics for reproducible QA, without adding a performance dashboard.
  window.__MAIZIERES__={stats:{...terrain.stats,buildings:buildings.count,features:data.features.length,buildingReference:{...reference.stats,rendered:buildings.count,rejected:buildings.rejected},loadMs:Math.round(performance.now()-t0),origin:data.metadata.origin,extent},inspect:()=>({camera:camera.position.toArray(),target:controls.target.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,namesVisible}),breakdown:()=>{const out=[];scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,tri=(g.index?g.index.count:g.getAttribute('position').count)/3;out.push({type:o.isInstancedMesh?'instanced':'mesh',instances:o.isInstancedMesh?o.count:1,triangles:tri*(o.isInstancedMesh?o.count:1),shadow:o.castShadow});});return out;},screen:(x,y,z)=>{const v=new THREE.Vector3(x,y,z).project(camera);return [(v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight];},view:(position,target)=>{controls.enableDamping=false;controls.target.set(...target);camera.position.set(...position);controls.update();controls.enableDamping=true;draw();}};
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  renderer.domElement.dataset.graphics=JSON.stringify({renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),antialias:gl.getContextAttributes().antialias,device,version:'1.4.0'});
  if(new URLSearchParams(location.search).get('quality')==='high')applyQuality('high');
  if(new URLSearchParams(location.search).has('benchmark')){benchmarking=true;await benchmark({camera,controls,draw,canvas:renderer.domElement,reset});benchmarking=false;invalidate();}
}
start().catch(error=>{console.error(error);loading.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'La maquette ne peut pas être affichée.'}),Object.assign(document.createElement('span'),{textContent:`${error.message} Vérifiez que WebGL est activé puis rechargez la page.`}));});



