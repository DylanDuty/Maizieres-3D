// V2.9.2 — semantic freeze V1: anomalies CSV (docs/audit/V2.9.2_SEMANTIC_ANOMALIES.csv), Unreal migration file
// (docs/freeze/unreal-semantic-migration-v2.9.2.json, unreal/ itself is frozen and untouched) and the manifest
// (docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json) whose hashes check:semantic-freeze verifies.
// Run after scripts/build-places-canonical.mjs and scripts/build-roads-canonical.mjs.
import fs from 'node:fs';import crypto from 'node:crypto';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const PLACES=read('docs/freeze/MLGU_PLACES_CANONICAL_V1.json'),ROADS=read('docs/freeze/MLGU_ROADS_CANONICAL_V1.json'),PRT=read('src/content/places-runtime-v292.json'),RRT=read('src/content/roads-runtime-v292.json');
// 1. anomalies CSV (places, inherited records, roads, rail)
const anomalies=[...read('docs/audit/v2.9.2-places-anomalies.json'),...read('docs/audit/v2.9.2-roads-anomalies.json')];
for(const c of PLACES.catalogueRecords.filter(c=>c.action!=='alias'))anomalies.push({id:c.record_id,type:'enregistrement hérité',name:c.name,anomaly:c.action==='hide'?(c.reason==='hors de la commune'?'lieu hors commune cliquable et cherchable':'lieu ancien ou non certifié présenté comme actuel'):'bâtiment nommé d’après un lieu qu’il n’abrite pas',
 old:`${c.name} (${c.origin}, ${c.record_type})`,new:c.action==='hide'?'masqué en vue normale':'bâtiment sans nom',source:c.refs.join(' ; '),severity:c.action==='unname'&&/Salle polyvalente|Mairie/.test(c.name)?'MAJOR':c.reason==='hors de la commune'?'MINOR':'MAJOR',status:c.action==='hide'?'MASQUÉ':'CORRIGÉ',comment:c.reason});
const ORDER={BLOCKER:0,MAJOR:1,MINOR:2,INFO:3};anomalies.sort((a,b)=>ORDER[a.severity]-ORDER[b.severity]||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
const q=v=>{const s=String(v??'');return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const csv=['id,type,nom,anomalie,ancienne valeur,nouvelle valeur,source,sévérité,statut,commentaire',...anomalies.map(a=>[a.id,a.type,a.name,a.anomaly,a.old,a.new,a.source,a.severity,a.status,a.comment].map(q).join(','))].join('\n')+'\n';
fs.writeFileSync('docs/audit/V2.9.2_SEMANTIC_ANOMALIES.csv','﻿'+csv);
// 2. Unreal migration (Lambert-93 from WGS84, Unreal X/Y/Z in cm from the frozen origin)
const L93=([lon,lat])=>{const n=0.7256077650532670,C=11754255.426096,Xs=700000,Ys=12655612.049876,e=0.0818191910428158,phi=lat*Math.PI/180,s=Math.sin(phi);
 const L=0.5*Math.log((1+s)/(1-s))-e/2*Math.log((1+e*s)/(1-e*s)),R=C*Math.exp(-n*L),g=n*(lon-3)*Math.PI/180;return [+(Xs+R*Math.sin(g)).toFixed(2),+(Ys-R*Math.cos(g)).toFixed(2)];};
const ELEV=read('public/data/building-terrain-elevation.json').buildings,ARCH=new Map(read('unreal/architecture/building-architecture.json').buildings.map(b=>[b.id,b]));
const UPOI=new Map(read('unreal/poi/poi.json').pois.map(p=>[p.id,p])),ULM=read('unreal/poi/landmarks.json').landmarks,ULA=read('unreal/architecture/landmark-architecture.json').landmarks,USPL=read('unreal/roads/road-splines.json').splines;
const entry=new Map(PLACES.places.map(e=>[e.id,e]));
const unrealPos=(ll,ids)=>{const [E,N]=L93(ll),z=ids?.map(id=>ELEV[id]?.baseZ).find(v=>v!=null);return {L93:[E,N,z??null],unreal_position:[Math.round((E-758278)*100),Math.round(-(N-6823571)*100),z!=null?Math.round(z*100):null]};};
const poiChanges=[];
for(const e of PLACES.places){const u=UPOI.get(e.id);if(!u)continue;const set={},from={};
 if(JSON.stringify(u.building_ids||[])!==JSON.stringify(e.building_ids)){set.building_ids=e.building_ids;from.building_ids=u.building_ids||[];}
 const ll=e.anchor.lonlat;if(ll&&set.building_ids||PRT.places[e.id]?.lonlat){Object.assign(set,unrealPos(ll,e.building_ids));from.L93=u.L93;from.unreal_position=u.unreal_position;}
 if(e.display_status&&e.display_status!=='NOT_DISPLAYED')set.display_status_v292=e.display_status;
 if(Object.keys(set).filter(k=>k!=='display_status_v292').length||e.display_status?.startsWith('HIDDEN'))poiChanges.push({id:e.id,name:e.canonical_name,set,from,reason:PRT.places[e.id]?'registre canonique V2.9.2 (docs/freeze/MLGU_PLACES_CANONICAL_V1.json)':'statut d’affichage'});}
const lmChanges=ULM.filter(l=>entry.get(l.poiId)&&JSON.stringify(l.building_ids)!==JSON.stringify(entry.get(l.poiId).building_ids)).map(l=>{const e=entry.get(l.poiId);return {poiId:l.poiId,name:l.name,from:{building_ids:l.building_ids,unreal_position:l.unreal_position},set:{building_ids:e.building_ids,...unrealPos(e.anchor.lonlat,e.building_ids)}};});
const laChanges=ULA.filter(l=>entry.get(l.id)&&JSON.stringify(l.buildingIds)!==JSON.stringify(entry.get(l.id).building_ids)).map(l=>{const e=entry.get(l.id),main=e.building_ids.map(id=>ARCH.get(id)).filter(Boolean).sort((a,b)=>(b.footprint?.areaM2||b.areaM2||0)-(a.footprint?.areaM2||a.areaM2||0))[0];
 return {id:l.id,name:l.name,from:{buildingIds:l.buildingIds,unrealPosition:l.unrealPosition,mainFootprint:l.dimensions?.mainFootprint||null},set:{buildingIds:e.building_ids,unrealPosition:unrealPos(e.anchor.lonlat,e.building_ids).unreal_position,mainFootprintProfile:main?{id:main.id,source:'unreal/architecture/building-architecture.json (profil V2.3.1 gelé)'}:null},note:'dimensions, hauteurs et silhouette à relire sur le profil V2.3.1 du nouveau bâtiment ; aucune géométrie ne change'};});
const roadOfSpline=new Map();for(const r of ROADS.roads)for(const s of r.segments)roadOfSpline.set('spline:'+s,r);
const splineChanges=USPL.map(s=>{const r=roadOfSpline.get(s.id);const name=r?.canonical_name||null;return name!==s.name?{id:s.id,from:s.name,to:name,road_id:r?.road_id||null,commune:r?.commune||null}:null;}).filter(Boolean);
const migration={metadata:{version:'V2.9.2',date:'2026-10-11',generatedBy:'scripts/build-semantic-freeze.mjs',rule:'Les exports Unreal (unreal/) sont gelés et ne sont pas modifiés par la V2.9.2. Ce fichier liste, champ par champ, les valeurs sémantiques à appliquer lors de la prochaine régénération : associations lieu ↔ bâtiment, ancres, statuts d’affichage, noms de voies. Aucune géométrie (empreinte, spline, terrain) ne change.',
 origin:{crs:'EPSG:2154',E:758278,N:6823571,units:'Unreal cm : X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude × 100 (base du bâtiment d’ancrage, public/data/building-terrain-elevation.json)'},
 counts:{poi:poiChanges.length,landmarks:lmChanges.length,landmarkArchitecture:laChanges.length,roadSplineNames:splineChanges.length}},
 'unreal/poi/poi.json':poiChanges,'unreal/poi/landmarks.json':lmChanges,'unreal/architecture/landmark-architecture.json':laChanges,'unreal/roads/road-splines.json':{note:'champ name de chaque spline : nom canonique du registre des voies (null = tronçon sans nom)',changes:splineChanges},
 'unreal/rail/rail-splines.json':{note:'aucun nom de spline à changer : la ligne 1000 et les voies de service sont déjà décrites par leurs attributs (line, kind)',changes:[]}};
fs.writeFileSync('docs/freeze/unreal-semantic-migration-v2.9.2.json',JSON.stringify(migration,null,1)+'\n');
// 3. manifest
const files=['docs/freeze/MLGU_PLACES_CANONICAL_V1.json','docs/freeze/MLGU_ROADS_CANONICAL_V1.json','docs/freeze/places-decisions-v2.9.2.json','docs/freeze/roads-decisions-v2.9.2.json','docs/freeze/catalogue-decisions-v2.9.2.json',
 'src/content/places-runtime-v292.json','src/content/roads-runtime-v292.json','src/content/landmark-audit-v291.json','docs/audit/V2.9.2_SEMANTIC_ANOMALIES.csv','docs/freeze/unreal-semantic-migration-v2.9.2.json'];
const inputs=['public/data/poi.json','unreal/poi/poi.json','public/data/maizieres.geojson','public/data/roads.geojson','public/data/v2-scene.json','public/data/named-zones.geojson','public/data/building-enrichment.json','public/data/bible-annotations.json','public/data/commune.geojson','data-sources/roads/bdtopo-troncon-de-route.geojson','data-sources/roads/bdtopo-voie-nommee.geojson','data-sources/poi/ban-adresses.geojson'];
const code=['src/places-canonical.js','src/search-index.js','src/cartography.js','scripts/places-screening.mjs','scripts/base-catalogue.mjs','scripts/roads-screening.mjs','scripts/runtime-catalogue.mjs','scripts/build-places-canonical.mjs','scripts/build-roads-canonical.mjs','scripts/build-semantic-freeze.mjs'];
const bySev=s=>anomalies.filter(a=>a.severity===s).length,byStatus=s=>anomalies.filter(a=>a.status===s).length;
const manifest={name:'MLGU semantic freeze',version:'V1',release:'V2.9.2',date:'2026-10-11',baseCommit:'9ab6d20',branch:'opus/v2.9.2-geographic-semantic-audit',note:'Le commit de livraison est celui qui contient ce fichier. Toute modification d’un registre, d’une décision ou d’une projection passe par un nouveau gel sémantique (V2) : régénérer avec scripts/build-places-canonical.mjs, scripts/build-roads-canonical.mjs et scripts/build-semantic-freeze.mjs, puis npm run check:semantic-freeze.',
 registers:{places:{file:files[0],sha256:sha(files[0]),counts:PLACES.metadata.counts},roads:{file:files[1],sha256:sha(files[1]),counts:ROADS.metadata.counts}},
 files:Object.fromEntries(files.map(f=>[f,sha(f)])),inputs:Object.fromEntries(inputs.map(f=>[f,sha(f)])),code:Object.fromEntries(code.map(f=>[f,sha(f)])),
 certifiedCounts:{placesInRegister:PLACES.places.length,displayedPASS:PLACES.metadata.counts.PASS,displayedPASS_WITH_LIMITATION:PLACES.metadata.counts.PASS_WITH_LIMITATION,hiddenPendingReview:PLACES.metadata.counts.HIDDEN_PENDING_REVIEW,hiddenOutOfCommune:PLACES.metadata.counts.HIDDEN_OUT_OF_COMMUNE,inheritedRecordsGoverned:PLACES.catalogueRecords.length,roads:ROADS.roads.length,roadsInCommune:ROADS.metadata.counts.inCommune,banTypedStreetsCovered:'62/62',levelCrossings:ROADS.rail.levelCrossings.length,bridgesWithPlace:ROADS.bridges.places.length},
 anomalies:{total:anomalies.length,BLOCKER:bySev('BLOCKER'),MAJOR:bySev('MAJOR'),MINOR:bySev('MINOR'),INFO:bySev('INFO'),CORRIGÉ:byStatus('CORRIGÉ'),MASQUÉ:byStatus('MASQUÉ'),ACCEPTÉ:byStatus('ACCEPTÉ')},
 acceptedAnomalies:anomalies.filter(a=>a.status==='ACCEPTÉ').map(a=>({id:a.id,name:a.name,anomaly:a.anomaly,severity:a.severity,comment:a.comment})),
 hidden:{places:PLACES.places.filter(e=>e.display_status?.startsWith('HIDDEN')).map(e=>({id:e.id,name:e.canonical_name,status:e.display_status})),inheritedRecords:PLACES.catalogueRecords.filter(c=>c.action!=='alias').map(c=>({id:c.record_id,name:c.name,action:c.action,reason:c.reason}))},
 checks:['check:places-canonical','check:road-names','check:poi-building-links','check:search-targets','check:semantic-freeze','check:landmark-positioning']};
fs.writeFileSync('docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json',JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify({anomalies:manifest.anomalies,migration:migration.metadata.counts}));
