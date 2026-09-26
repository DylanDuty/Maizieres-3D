import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {projection,polygons,bounds,insidePoly} from './geo.js';
import {buildLandscape} from './landscape.js';
import {buildBuildings,PROVENANCE_COLORS,VALIDATION_COLORS,AUDIT_COLORS,diagnosticKey} from './buildings.js';
import {displayBase} from './building-elevation.js';
import {buildHydroAudit} from './hydro-audit-diagnostic.js';
import './style.css';
import {benchmark} from './benchmark.js';
import {qualitySettings,QUALITY_LABELS,QUALITY_ORDER} from './quality.js';
import {createCatalogue} from './cartography.js';
import {installSelection} from './selection.js';
import {buildingItems} from './building-source.js';
import {palette} from './art.js';
import {loadTerrain,buildTerrainDiagnostic} from './terrain.js';
import {buildRoadsDiagnostic,ROAD_COLORS} from './roads-diagnostic.js';
import {buildRailDiagnostic,RAIL_COLORS} from './rail-diagnostic.js';
import {buildLandcoverDiagnostic,LANDCOVER_COLORS} from './landcover-diagnostic.js';
import {buildPoiDiagnostic,POI_COLORS} from './poi-diagnostic.js';
import {buildV2Scene} from './v2-scene.js';
import {extendCatalogue,v2Labels,groundPicker,installSearch,installViews,installLegend,installPerfHud} from './v2-ui.js';
const loading=document.querySelector('#loading');
async function start(){
  const t0=performance.now();
  const responses=await Promise.all(['maizieres.geojson','commune.geojson','building-enrichment.json','ign-landscape.geojson','named-zones.geojson','bible-annotations.json','buildings.geojson'].map(name=>fetch(`${import.meta.env.BASE_URL}data/${name}`)));
  if(responses.some(r=>!r.ok))throw Error('Les données locales sont introuvables.');
  const [data,boundary,enrichment,ignLandscape,namedZones,bible,buildingReference]=await Promise.all(responses.map(r=>r.json()));
  const project=projection(data.metadata.origin),boundaryPolys=polygons(boundary,project),b=bounds(boundaryPolys.flat(2));
  const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(palette.horizon,5600,19000);
  const params=new URLSearchParams(location.search),requestedQuality=QUALITY_ORDER.includes(params.get('quality'))?params.get('quality'):'fluid';
  const device={dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory};let quality=qualitySettings(requestedQuality,device);
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.setPixelRatio(quality.pixelRatio);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.domElement.setAttribute('aria-label','Vue 3D navigable : flèches pour déplacer, + et − pour zoomer, R pour recentrer.');renderer.domElement.tabIndex=0;document.querySelector('#map').appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,1,20000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.13;controls.rotateSpeed=.75;controls.maxPolarAngle=Math.PI*.475;controls.minDistance=35;controls.maxDistance=10500;controls.screenSpacePanning=false;controls.zoomSpeed=.8;controls.target.set(200,0,150);
  const sun=new THREE.DirectionalLight(palette.sun,1.95);sun.position.set(-1300,2200,-900);sun.castShadow=true;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);Object.assign(sun.shadow.camera,{left:-2200,right:2200,top:2200,bottom:-2200,near:50,far:6000});sun.shadow.bias=-.00012;sun.shadow.normalBias=1.2;sun.shadow.intensity=.62;scene.add(sun.target);scene.add(sun,new THREE.HemisphereLight(palette.skyLight,palette.groundLight,.95));
  // Give the browser a frame to paint loading feedback before building static batches.
  await new Promise(resolve=>requestAnimationFrame(resolve));
  // V1.5: building footprints come from the unified reference (IGN BD TOPO first, OSM complement).
  // V2.0.1: the frozen reference (2 494) plus the buildings reintegrated by the visual audit, in the V2 view and ?diagnostic=buildings-audit.
  const auditMode=params.get('diagnostic')==='buildings-audit',withAdditions=!['provenance','validation','terrain','roads','rail','landcover','poi'].includes(params.get('diagnostic'));
  // V2.2: the separate layer of buildings surveyed by hand on the orthophoto (non official); ?manual=0 turns it off.
  const withManual=withAdditions&&params.get('manual')!=='0';
  const [additions,additionsElevation,auditPoints,manual,manualElevation]=withAdditions?await Promise.all(['buildings-additions-v2.0.1.geojson','buildings-additions-elevation-v2.0.1.json',withManual?'buildings-audit-v2.2.json':'buildings-audit-v2.0.1.json',...(withManual?['buildings-manual-v2.2.geojson','buildings-manual-elevation-v2.2.json']:[])].map(n=>fetch(`${import.meta.env.BASE_URL}data/${n}`).then(r=>r.json()))):[null,null,null,null,null];
  const expectedIds=[...buildingReference.features,...(additions?.features||[]),...(manual?.features||[])].map(f=>f.properties.id);if(additions)buildingReference.features.push(...additions.features);if(manual)buildingReference.features.push(...manual.features);
  const reference=buildingItems(buildingReference,project,extent),diagnostic=['provenance','validation','terrain','roads','rail','landcover','poi'].find(m=>m===params.get('diagnostic'))||null;
  // V2.0: without a V1 diagnostic the normal view is the assembled scene on the real relief; ?diagnostic=v2 or ?perf adds the technical layer (sources, HUD).
  const v2Mode=!diagnostic,hydroMode=params.get('diagnostic')==='hydro-audit',technical=params.get('diagnostic')==='v2'||auditMode||hydroMode||params.has('perf');
  // V1.7 ?diagnostic=terrain: real LiDAR HD relief; the flat stylised landscape is hidden, buildings sit on their base altitude.
  const relief=diagnostic==='terrain'||v2Mode?await loadTerrain(import.meta.env.BASE_URL,v2Mode?'v2-terrain':'terrain-threejs'):null,flatLayers=new Set(scene.children);
  if(relief&&additionsElevation)Object.assign(relief.elevation.buildings,additionsElevation.buildings);if(relief&&manualElevation)Object.assign(relief.elevation.buildings,manualElevation.buildings);
  const v2=v2Mode?await buildV2Scene(scene,{relief,base:import.meta.env.BASE_URL,quality}):null;
  // V2.0.1: display base of every building on the displayed relief (see building-elevation.js) and audit status.
  const display=new Map();if(v2)for(const item of reference.items){const d=displayBase(item.poly,relief.elevation.buildings[item.featureId].baseZ-relief.meta.yReference,v2.heightAt);display.set(item.id,d);item.auditStatus=item.audit?.status==='manuel'?'manuel-v2.2':item.audit?.status==='réintégré'?'reintegre':d.corrected?'rendu-corrige':'normal';}
  const terrain=v2?{buildings:reference.items,landmarks:[],stats:{}}:buildLandscape(scene,data,project,extent,ignLandscape,reference.items);
  let reliefMesh=null;if(relief&&!v2){for(const o of scene.children)if(!flatLayers.has(o)&&!o.isLight)o.visible=false;reliefMesh=buildTerrainDiagnostic(scene,relief);}
  for(const f of data.features)if(f.geometry.type==='Point'&&['school','townhall','community_centre'].includes(f.properties.amenity)){const p=project(f.geometry.coordinates);const building=terrain.buildings.find(b=>insidePoly(p,b.poly));if(building){building.t={...building.t,amenity:f.properties.amenity,name:f.properties.name};}}
  const roadsRef=diagnostic==='roads'?await buildRoadsDiagnostic(scene,project,import.meta.env.BASE_URL):null,railRef=diagnostic==='rail'?await buildRailDiagnostic(scene,project,import.meta.env.BASE_URL):null;
  const landcoverRef=diagnostic==='landcover'?await buildLandcoverDiagnostic(scene,project,import.meta.env.BASE_URL):null;
  const poiRef=diagnostic==='poi'?await buildPoiDiagnostic(scene,project,import.meta.env.BASE_URL):null;
  const buildings=buildBuildings(scene,terrain.buildings,enrichment,{diagnostic:auditMode?'buildings-audit':relief||roadsRef||railRef||landcoverRef||poiRef?null:diagnostic,elevation:v2?item=>display.get(item.id).base-.45:relief?item=>relief.elevation.buildings[item.featureId].baseZ-relief.meta.yReference:null});
  // V2.0.1 visibility audit: every expected id has walls or roof in the scene graph, stands in the terrain range and is not buried.
  const renderedIds=new Set();for(const m of buildings.pickMeshes.slice(0,2))for(const r of m.userData.featureRanges)if(r.end>r.start)renderedIds.add(r.id.split('#')[0]);
  const buildingAudit={expected:expectedIds.length,reference:expectedIds.length-(additions?.features.length||0)-(manual?.features.length||0),additions:additions?.features.length||0,manual:manual?.features.length||0,rendered:renderedIds.size,missingIds:expectedIds.filter(id=>!renderedIds.has(id)),
   buried:[...display].filter(([id,d])=>d.base+buildings.info.get(id).maxHeight<d.terrainMax+.5).map(([id])=>id),outOfRange:[...display].filter(([,d])=>d.base<d.terrainMin-.5||d.base>d.terrainMax+.5).map(([id])=>id),
   corrected:[...display.values()].filter(d=>d.corrected).length,raised:[...display.values()].filter(d=>d.delta>.25).length,lowered:[...display.values()].filter(d=>d.delta<-.25).length,
   withoutGeometry:auditPoints?.withoutGeometry.length||0,uncertain:auditPoints?.uncertain.length||0};
  if(reliefMesh){const legend=document.createElement('div');legend.id='diagnostic-legend';const s=reliefMesh.stats;
   legend.innerHTML=[`Terrain IGN LiDAR HD (MNT) · grille ${s.step} m · ${s.vertices.toLocaleString('fr')} sommets`,`Altitude ${s.min} à ${s.max} m NGF-IGN69 · échelle verticale 1:1`,`y = altitude − ${s.yReference} m · quadrillage 100 m · courbes 5 m`,`NoData : ${s.noData}${s.noData?' (magenta)':''} · ${buildings.count} bâtiments posés à leur socle`].map(v=>`<span>${v}</span>`).join('');document.body.appendChild(legend);}
  else if(poiRef){const legend=document.createElement('div');legend.id='diagnostic-legend';const s=poiRef.stats;
   legend.innerHTML=[['current',`Actuel, affiché sur la carte · ${s.current}`],['toConfirm',`Actuel à confirmer (non affiché) · ${s.toConfirm}`],['uncertain',`Incertain · ${s.uncertain}`],['historical',`Historique / ancien / disparu · ${s.historical}`],['landmark',`Landmark Unreal P1 ${s.landmarks[1]} · P2 ${s.landmarks[2]} · P3 ${s.landmarks[3]} (anneau)`],['official',`Limite officielle · zones ${s.areas}`],['approximate','Limite approximative (OSM)']].map(([k,v])=>`<span><i style="background:${POI_COLORS[k]}"></i>${v}</span>`).join('')+`<span>Hauteur = confiance : A ${s.A} (haut) · B ${s.B} · C ${s.C} (bas) · disque = lieu-dit / secteur (${s.lieux})</span>`;document.body.appendChild(legend);}
  else if(landcoverRef){const legend=document.createElement('div');legend.id='diagnostic-legend';const s=landcoverRef.stats;
   legend.innerHTML=[['terre_arable',`Terres arables, jachères, autres RPG 2024 · ${s.agriculture}`],['prairie',`Prairies RPG 2024 · ${s.prairie}`],['bois',`Bois et forêts · ${s.woodland}`],['peupleraie','Peupleraies'],['haie',`Haies DSB · ${s.hedge} · ${s.hedgeKm.toFixed(1)} km`],['haie_polygone',`Haies polygonales sans linéaire · ${s.hedgePolygon}`],['eau',`Surfaces en eau · ${s.water}`],['cours_eau',`Cours d’eau · ${s.waterLine} · ${s.waterKm.toFixed(1)} km`],['artificiel','Surfaces artificialisées'],['perimetre','Périmètres d’activité (contour)'],['incertain',`Incertain (confiance C) · ${s.uncertain}`]].map(([k,v])=>`<span><i style="background:${LANDCOVER_COLORS[k]}"></i>${v}</span>`).join('');document.body.appendChild(legend);}
  else if(railRef){const legend=document.createElement('div');legend.id='diagnostic-legend';const s=railRef.stats;
   legend.innerHTML=[['principal',`Voie principale · ${s.principal} · ${s.km.principal.toFixed(1)} km`],['service',`Voie de service · ${s.service} · ${s.km.service.toFixed(1)} km`],['unknown',`Statut incertain · ${s.unknown} · ${s.km.unknown.toFixed(1)} km`],['bridge',`Pont ferroviaire · ${railRef.bridges}`],['level',`Passage à niveau · ${railRef.levelCrossings}`],['historic',`Ancienne emprise (historique) · ${railRef.historic}`]].map(([k,v])=>`<span><i style="background:${RAIL_COLORS[k]}"></i>${v}</span>`).join('');document.body.appendChild(legend);}
  else if(roadsRef){const legend=document.createElement('div');legend.id='diagnostic-legend';const s=roadsRef.stats,labels=roadsRef.metadata.categories;
   legend.innerHTML=Object.entries(labels).map(([k,v])=>`<span><i style="background:${ROAD_COLORS[k]}"></i>${v} · ${(s.km[k]||0).toFixed(1)} km</span>`).join('')+`<span><i style="background:${ROAD_COLORS.pont}"></i>Pont · ${s.bridges}</span><span>${s.troncons} tronçons · largeur officielle ${s.official} (couleur pleine), estimée ${s.inferred} (couleur claire)</span>`;document.body.appendChild(legend);}
  else if(diagnostic){const legend=document.createElement('div');legend.id='diagnostic-legend';
   const entries=diagnostic==='validation'?{A:'A · IGN confirmé par le cadastre',B:'B · source officielle unique','B-contour':'B · contour différent du cadastre actuel',C:'C · OSM seul non confirmé',cadastre:'Ajouté depuis le cadastre actuel (B ou C)'}:{'ign+osm':'IGN et OSM','ign+osm-partiel':'IGN, OSM partiel','ign':'IGN seul','osm':'OSM seul','cadastre':'Cadastre'};
   const colors=diagnostic==='validation'?VALIDATION_COLORS:PROVENANCE_COLORS;
   legend.innerHTML=Object.entries(entries).map(([k,v])=>`<span><i style="background:${colors[k]}"></i>${v} · ${reference.items.filter(i=>diagnosticKey(i,diagnostic)===k).length}</span>`).join('');document.body.appendChild(legend);}
  const hydroAudit=hydroMode?buildHydroAudit(scene,v2,project,await fetch(`${import.meta.env.BASE_URL}data/hydro-audit-v2.1.json`).then(r=>r.json())):null;
  if(auditMode){// Markers: visible constructions without any public footprint (magenta), doubtful cases (orange); no geometry is invented.
   const pin=(list,color,h)=>{if(!list.length)return;const geo=new THREE.ConeGeometry(2.2,h,8),mesh=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color}),list.length),m=new THREE.Matrix4();list.forEach((q,i)=>{const [x,z]=project(q.lonlat);m.makeRotationX(Math.PI);m.setPosition(x,v2.heightAt(x,z)+h/2+1,z);mesh.setMatrixAt(i,m);});mesh.name='audit-'+color;scene.add(mesh);};
   pin(auditPoints.withoutGeometry,AUDIT_COLORS['sans-empreinte'],14);pin(auditPoints.uncertain,AUDIT_COLORS.incertain,8);
   const a=buildingAudit,legend=document.createElement('div');legend.id='diagnostic-legend';
   legend.innerHTML=[['normal',`Référentiel V1.6.2 · ${a.reference-a.corrected}`],['rendu-corrige',`Socle recalé sur le relief affiché · ${a.corrected}`],['reintegre',`Réintégré V2.0.1 · ${a.additions}`],['manuel-v2.2',`Relevé manuel orthophoto V2.2 (non officiel) · ${a.manual}`],['incertain',`Incertain (repère, rien n’est dessiné) · ${a.uncertain}`],['sans-empreinte',`Visible sans empreinte publique (repère) · ${a.withoutGeometry}`]].map(([k,v])=>`<span><i style="background:${AUDIT_COLORS[k]}"></i>${v}</span>`).join('')+`<span>${a.rendered} / ${a.expected} bâtiments présents dans la scène · manquants ${a.missingIds.length} · enfouis ${a.buried.length}</span>`;document.body.appendChild(legend);}
  // A fine administrative line distinguishes the real commune from the context rectangle.
  for(const poly of boundaryPolys){const pts=poly[0].map(([x,z])=>new THREE.Vector3(x,relief?(relief.sample(x,z)-relief.meta.yReference||0)+1:.4,z));const geo=new THREE.BufferGeometry().setFromPoints(pts);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:'#e0d9bb',dashSize:9,gapSize:7,transparent:true,opacity:.65}));line.computeLineDistances();scene.add(line);}
  const catalogue=createCatalogue(data,enrichment,project,extent,terrain.buildings,namedZones,bible);
  const v2Records=v2?extendCatalogue(catalogue,v2,project,buildings.info,{technical}):null;
  const poiBuildings=poiRef?poiRef.extend(catalogue,buildings.info):null;
  const selection=installSelection({scene,camera,canvas:renderer.domElement,catalogue,meshes:buildings.pickMeshes,buildingInfo:buildings.info,invalidate,target:()=>controls.target,...(v2?{heightAt:v2.heightAt,ground:groundPicker(v2.heightAt),technical}:{})});
  const labelItems=v2?v2Labels(v2,project):[];if(!v2){for(const l of [...buildings.landmarks,...terrain.landmarks])if(!labelItems.some(o=>o.name===l.name&&Math.hypot(o.position[0]-l.position[0],o.position[2]-l.position[2])<80))labelItems.push(l);
  for(const r of catalogue.records.filter(r=>r.type==='point'&&(r.kind==='Lieu-dit / secteur'||r.id.startsWith('bible'))))if(!labelItems.some(l=>l.name===r.name))labelItems.push({id:r.id,name:r.name,position:r.position,major:r.major,local:!r.major,style:r.id.startsWith('bible')?'heritage':r.major?'':'place'});
  for(const l of enrichment.landmarks){if(!labelItems.some(p=>Math.hypot(p.position[0]-l.position[0],p.position[2]-l.position[2])<45))labelItems.push(l);}
  for(const f of data.features){const t=f.properties;if(f.geometry.type!=='Point')continue;
    if(['hamlet','village'].includes(t.place)||['townhall','school','community_centre'].includes(t.amenity)){const p=project(f.geometry.coordinates);const name=t.name||(t.amenity==='townhall'?'Mairie':t.amenity==='school'?'École':'Salle communale');if(!labelItems.some(l=>l.name===name))labelItems.push({name,position:[p[0],14,p[1]],major:!!t.place});}
  }}
  // Major road and railway names are copied from the local source tags.
  for(const ref of ['D 619','D 116']){const f=data.features.find(f=>f.properties.ref===ref&&f.geometry.type==='LineString'&&f.geometry.coordinates.length>3);if(f){const p=project(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)]);labelItems.push({id:f.id,name:ref,position:[p[0],3+(v2?v2.heightAt(p[0],p[1]):0),p[1]]});}}
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
    const previous=controls.target.clone();controls.target.x=THREE.MathUtils.clamp(controls.target.x,extent.minX,extent.maxX);controls.target.z=THREE.MathUtils.clamp(controls.target.z,extent.minZ,extent.maxZ);controls.target.y=v2?v2.heightAt(controls.target.x,controls.target.z):0;camera.position.add(controls.target.clone().sub(previous));
    const renderStart=performance.now();renderer.render(scene,camera);renderer.domElement.dataset.render=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:quality.mode,pixelRatio:renderer.getPixelRatio(),shadowSize:quality.shadowSize,submissionMs:Math.round((performance.now()-renderStart)*100)/100,camera:camera.position.toArray(),target:controls.target.toArray()});
    const placed=[];
    if(namesVisible)for(const l of sortedLabels){screen.copy(l.vector).project(camera);const x=(screen.x*.5+.5)*innerWidth,y=(-screen.y*.5+.5)*innerHeight;const w=l.name.length*7+20;const visible=(!l.local||camera.position.distanceTo(controls.target)<2200)&&screen.z>-1&&screen.z<1&&x>20&&x<innerWidth-20&&y>135&&y<innerHeight-80&&!placed.some(r=>Math.abs(x-r.x)<(w+r.w)/2&&Math.abs(y-r.y)<30);l.el.style.display=visible?'block':'none';if(visible){l.el.style.left=`${x}px`;l.el.style.top=`${y}px`;placed.push({x,y,w});}}
    document.querySelector('#north').style.transform=`rotate(${controls.getAzimuthalAngle()}rad)`;
  }
  const qualityButton=document.querySelector('#quality');
  function applyQuality(mode){quality=qualitySettings(mode,device);renderer.setPixelRatio(quality.pixelRatio);renderer.setSize(innerWidth,innerHeight);const shadows=!v2||mode==='high';renderer.shadowMap.enabled=shadows;sun.castShadow=shadows;v2?.setQuality(mode);renderer.shadowMap.type=mode==='high'?THREE.PCFSoftShadowMap:THREE.BasicShadowMap;scene.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;qualityButton.textContent=`Qualité : ${QUALITY_LABELS[mode]}`;qualityButton.setAttribute('aria-pressed',String(mode==='high'));renderer.domElement.dataset.quality=mode;invalidate();}
  qualityButton.addEventListener('click',()=>applyQuality(v2?QUALITY_ORDER[(QUALITY_ORDER.indexOf(quality.mode)+1)%QUALITY_ORDER.length]:quality.mode==='fluid'?'high':'fluid'));
  controls.addEventListener('change',invalidate);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);invalidate();});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();loading.hidden=false;loading.style.display='flex';loading.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Affichage 3D interrompu. Rechargez la page.'}));});
  renderer.domElement.dataset.stats=JSON.stringify({...terrain.stats,relief:reliefMesh?.stats||null,roads:roadsRef?.stats||null,rail:railRef?.stats||null,landcover:landcoverRef?.stats||null,poi:poiRef?{...poiRef.stats,buildingsLinked:poiBuildings}:null,v2:v2?{...v2.stats,records:v2Records,texture:v2.texture}:null,buildings:buildings.count,enrichment:buildings.stats,clickable:catalogue.stats,loadMs:Math.round(performance.now()-t0)});reset();draw();renderer.shadowMap.autoUpdate=false;loading.remove();
  const snapshot=data.metadata.osmTimestamp?.slice(0,10)||data.metadata.retrievedAt.slice(0,10);document.querySelector('#data-date').textContent=`Relevé OSM · ${new Date(snapshot).toLocaleDateString('fr-FR')}`;
  // Read-only diagnostics for reproducible QA, without adding a performance dashboard.
  renderer.domElement.dataset.buildingAudit=JSON.stringify({...buildingAudit,missingIds:buildingAudit.missingIds.slice(0,20),buried:buildingAudit.buried.slice(0,20),outOfRange:buildingAudit.outOfRange.slice(0,20)});
  window.__MAIZIERES__={buildingAudit,renderedBuildingIds:()=>[...renderedIds],stats:{...terrain.stats,buildings:buildings.count,features:data.features.length,buildingReference:{...reference.stats,rendered:buildings.count,rejected:buildings.rejected},loadMs:Math.round(performance.now()-t0),origin:data.metadata.origin,extent},inspect:()=>({camera:camera.position.toArray(),target:controls.target.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,namesVisible}),breakdown:()=>{const out=[];scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,tri=(g.index?g.index.count:g.getAttribute('position').count)/3;out.push({type:o.isInstancedMesh?'instanced':'mesh',instances:o.isInstancedMesh?o.count:1,triangles:tri*(o.isInstancedMesh?o.count:1),shadow:o.castShadow});});return out;},screen:(x,y,z)=>{const v=new THREE.Vector3(x,y,z).project(camera);return [(v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight];},view:(position,target)=>{controls.enableDamping=false;controls.target.set(...target);camera.position.set(...position);controls.update();controls.enableDamping=true;draw();}};
  // V2.0 interface: search, quick views, legend and (technical mode) performance HUD.
  if(v2){
   const flyTo=(x,z,distance)=>{const dir=camera.position.clone().sub(controls.target);dir.y=Math.max(dir.y,dir.length()*.55);dir.setLength(distance);controls.enableDamping=false;controls.target.set(x,v2.heightAt(x,z),z);camera.position.copy(controls.target).add(dir);controls.update();controls.enableDamping=true;invalidate();};
   const focus=r=>{const p=r.position||[0,0,0],d=r.poi&&['secteur','zone_activite'].includes(r.poi.category)?1100:r.type==='line'?560:r.type==='zone'?800:380;flyTo(p[0],p[2],d);selection.select(r);};
   const search=installSearch(catalogue,focus);
   const at=id=>{const p=v2.poiById.get(id);return p?project(p.lonlat):null;},service=v2.data.rail.filter(t=>t.k==='service').flatMap(t=>{const o=[];for(let i=0;i<t.p.length;i+=3)o.push([t.p[i],t.p[i+1]]);return o;});
   const railCentre=service.length?[(Math.min(...service.map(p=>p[0]))+Math.max(...service.map(p=>p[0])))/2,(Math.min(...service.map(p=>p[1]))+Math.max(...service.map(p=>p[1])))/2]:null;
   const views=[{name:'Vue générale',reset:true},{name:'Centre-bourg',p:at('poi:eglise-saint-denis'),d:620},{name:'Poussey',p:at('poi:poussey'),d:900},{name:'Les Granges',p:at('poi:les-granges'),d:900},{name:'Ferroviaire',p:railCentre,d:1300},{name:'Parc de l’Aérodrome',p:at('poi:parc-aerodrome'),d:1000}].filter(v=>v.reset||v.p);
   installViews(views,v=>v.reset?reset():flyTo(v.p[0],v.p[1],v.d));installLegend();
   if(technical&&!auditMode&&!hydroMode)installPerfHud(renderer,`Bâtiments ${buildings.count} · routes ${v2.stats.roads.count} · voies ${v2.stats.rail.tracks}\nParcelles ${v2.stats.agriculture} · bois ${v2.stats.woodland} · haies ${v2.stats.hedges.count} · POI ${v2Records.pois}\nTexture ${v2.texture.width}×${v2.texture.height} (${v2.texture.metresPerPixel} m/px)`,draw);
   Object.assign(window.__MAIZIERES__,{v2:{stats:v2.stats,records:v2Records,views:views.map(v=>v.name),searchIndex:search.index,heightAt:v2.heightAt},search:q=>search.search(q),focus:name=>{const r=catalogue.records.find(r=>r.name===name&&r.poi)||catalogue.records.find(r=>r.name===name&&r.searchable!==false);if(r)focus(r);return !!r;},selectId:id=>{const r=catalogue.byId.get(id);selection.select(r);return !!r;},quick:name=>{const v=views.find(v=>v.name===name);if(v)v.reset?reset():flyTo(v.p[0],v.p[1],v.d);return !!v;}});
  }
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  renderer.domElement.dataset.graphics=JSON.stringify({renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),antialias:gl.getContextAttributes().antialias,device,version:'2.0.0'});
  applyQuality(quality.mode);
  if(new URLSearchParams(location.search).has('benchmark')){benchmarking=true;await benchmark({camera,controls,draw,canvas:renderer.domElement,reset});benchmarking=false;invalidate();}
}
start().catch(error=>{console.error(error);loading.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'La maquette ne peut pas être affichée.'}),Object.assign(document.createElement('span'),{textContent:`${error.message} Vérifiez que WebGL est activé puis rechargez la page.`}));});



