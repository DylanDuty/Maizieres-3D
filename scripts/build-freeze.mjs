// V2.3.1 Unreal Freeze V1: machine-readable exceptions (4 UNKNOWN, 75 masked, 12 manual V2.2) and the freeze manifest
// (SHA-256 of every canonical file Unreal imports). Reads only; never touches geography or architecture data.
// Usage: node scripts/build-freeze.mjs [--final <commit>] [--ready]
//   --final <commit>  commit that contains every hashed file (a file cannot hold the hash of its own commit)
//   --ready           READY_FOR_UNREAL_FREEZE, set only once checks, build and Chromium have passed on that commit
import fs from 'node:fs';
import crypto from 'node:crypto';
import {UNREAL_ORIGIN} from './terrain-frame.mjs';

const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const arg=k=>{const i=process.argv.indexOf(k);return i<0?null:process.argv[i+1]??true;};
const GEO_COMMIT='309e65ed52cfc0947bb8cd66117b7ff84ceb028a',ARCH_COMMIT='4c609ee17fdbc682883baafc87cbfaeade0cd22c';
const A=read('public/data/building-architecture-v2.3.json'),frozen=read('data-sources/architecture/frozen-geography-v2.2-sha256.json');
const prov=new Map(read('unreal/buildings/buildings-provenance-v2.2.json').buildings.map(b=>[b.id,b]));
const manualProps=new Map(read('public/data/buildings-manual-v2.2.geojson').features.map(f=>[f.properties.id,f.properties]));
const B=A.buildings;

// ---------- exceptions annex ----------
const UNKNOWN_REASON={
 'manual-v2.2:vis-A':'usage non établi : aucune source d’usage (ni BD TOPO, ni OSM, ni cadastre) ; seul un toit-terrasse brun-rose est observé, et le LiDAR 2025 ne mesure aucune élévation',
 'manual-v2.2:vis-F':'usage non établi : « grange ou hangar probable » selon l’observation, sans source d’usage ; toiture plate bleu-gris mesurée par le LiDAR',
 'manual-v2.2:vis-H1':'usage non établi : aucune source d’usage ; toit plat blanc observé, aucune élévation LiDAR 2025',
 'manual-v2.2:vis-H2':'usage non établi : aucune source d’usage ; grande toiture grise observée, aucune élévation LiDAR 2025, type de toit non mesurable'};
const unknownClass=B.filter(e=>e.buildingClass==='UNKNOWN').map(e=>{const p=manualProps.get(e.buildingId)||{};
 if(!UNKNOWN_REASON[e.buildingId])throw Error('classe UNKNOWN non documentée : '+e.buildingId);
 return {id:e.buildingId,layer:e.layer,sector:p.sector||null,geometrySource:p.provenance?`${p.provenance} (${p.geometryMethod||'relevé manuel'})`:e.footprint.file,
  reason:UNKNOWN_REASON[e.buildingId],keepUnknown:'conservé en UNKNOWN : attribuer une classe reviendrait à inventer un usage qu’aucune source ne donne',
  roof:e.roof.type,lidar:e.lidar.status+(e.lidar.reason?` (${e.lidar.reason})`:'')};});
const masked=B.filter(e=>e.lidar.status==='zone masquée');
const observedStatuses=['measured','orthophoto'];
const maskedList=masked.map(e=>({id:e.buildingId,layer:e.layer,buildingClass:e.buildingClass,classSource:e.trace.class,
 wallHeight:e.wallHeightStatus,totalHeight:e.totalHeightStatus,levels:e.levelsStatus,roofType:e.roof.type,color:e.roof.colorFamily,material:e.roof.material,
 confidenceOverall:e.confidenceOverall,observedAttributes:[['wallHeight',e.wallHeightStatus],['totalHeight',e.totalHeightStatus],['levels',e.levelsStatus],['roofType',e.roof.typeStatus],['ridge',e.roof.ridgeOrientationStatus],['slope',e.roof.slopeStatus],['material',e.roof.materialStatus],['color',e.roof.colorStatus]].filter(([,s])=>observedStatuses.includes(s)).map(([k])=>k)}));
const manual=B.filter(e=>e.layer==='manual_orthophoto_v2_2').map(e=>{const p=manualProps.get(e.buildingId);return {id:e.buildingId,provenance:p.provenance,sector:p.sector,category:p.category,
 geometrySha256:e.footprint.geometrySha256,buildingClass:e.buildingClass,classSource:e.trace.class,roofType:e.roof.type,roofConfidence:e.roof.confidence,roofStatus:e.roof.typeStatus,
 color:e.roof.colorFamily,colorConfidence:e.roof.colorConfidence,wallHeight:e.wallHeightStatus,totalHeight:e.totalHeightStatus,official:false};});
const exceptions={freezeVersion:'1.0',architectureVersion:A.metadata.version,generatedBy:'scripts/build-freeze.mjs',
 unknownClass:{count:unknownClass.length,buildings:unknownClass},
 maskedZone:{count:masked.length,note:A.metadata.maskedZone.note,boundsL93:A.metadata.maskedZone.boundsL93,areaHa:A.metadata.maskedZone.areaHa,
  rule:'aucun attribut observé (mesuré ou orthophoto) : type de toit, couleur, matériau, faîtage et hauteurs mesurées restent unknown ; la classe vient de la BD TOPO ou de la typologie ; confiance globale unknown',buildings:maskedList},
 manualV22:{count:manual.length,rule:'relevés manuels sur orthophoto, couche séparée et désactivable, jamais présentés comme géométrie officielle',buildings:manual}};
fs.mkdirSync('unreal/freeze-v1',{recursive:true});
fs.writeFileSync('unreal/freeze-v1/architecture-exceptions.json',JSON.stringify(exceptions,null,1)+'\n');

// ---------- manifest ----------
const ROLE=f=>f.includes('/terrain')&&!f.endsWith('.json')?'terrain':f.includes('terrain')?'terrain':/buildings-manual/.test(f)?'buildings-manual-v2.2':/buildings-additions/.test(f)?'buildings-additions-v2.0.1':
 f.endsWith('buildings.geojson')?'buildings-official':/building|provenance/.test(f)?'buildings-attributes':/road/.test(f)?'roads':/rail/.test(f)?'rail':/landcover|water|woodland|hedge|agricultural|artificial|hydro|ign-landscape/.test(f)?'landcover-hydro':
 /poi|landmarks|areas|named-zones|bible/.test(f)?'poi':/commune|maizieres\.geojson/.test(f)?'commune':/v2-scene/.test(f)?'scene-threejs':'other';
const files=[];
for(const [f,h] of Object.entries(frozen.files)){const now=sha(f);if(now!==h)throw Error(`dérive du gel géographique V2.2 : ${f}`);files.push({path:f,sha256:h,role:ROLE(f),frozenSince:'V2.2',frozenGeography:true});}
const ARCH=[['public/data/building-architecture-v2.3.json','architecture-profiles','profil complet par bâtiment (V2.3.1), traçabilité et sources'],
 ['unreal/architecture/building-architecture.json','architecture-unreal','profil compact par bâtiment pour Unreal'],
 ['unreal/architecture/building-archetypes.json','archetypes','règles par archétype'],
 ['unreal/architecture/landmark-architecture.json','landmarks','bâtiments remarquables'],
 ['unreal/freeze-v1/architecture-exceptions.json','exceptions','4 UNKNOWN, 75 masqués, 12 relevés V2.2'],
 ['unreal/freeze-v1/README.md','import-guide','package d’import : ordre, repère, conventions'],
 ['docs/unreal/ARCHITECTURE_IMPORT_GUIDE.md','import-guide','algorithme de construction des bâtiments'],
 ['data-sources/architecture/roof-measurements-v2.3.json','architecture-measurements','mesures LiDAR HD / BD ORTHO par bâtiment'],
 ['data-sources/architecture/frozen-geography-v2.2-sha256.json','geography-freeze-reference','empreintes SHA-256 des 42 fichiers gelés, relevées au commit V2.2'],
 ['scripts/terrain-frame.mjs','origin','origine Unreal et conversions Lambert-93 ↔ Unreal (code)']];
for(const [f,role,note] of ARCH)files.push({path:f,sha256:sha(f),role,note,frozenSince:'V2.3.1',frozenGeography:false});
const r16='unreal/terrain/maizieres-heightmap-6097x6859.r16';
const s=A.metadata.stats,inCommune=[...prov.values()].filter(b=>b.inCommune).length;
const previous=fs.existsSync('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json')?read('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json'):{};
const final=arg('--final')||null;
const manifest={freezeVersion:'1.0',name:'Maizières-la-Grande-Paroisse — Unreal Freeze V1 (géographie V2.2 + architecture V2.3.1)',
 geographicBaseCommit:GEO_COMMIT,architecturalBaseCommit:ARCH_COMMIT,
 finalFreezeCommit:final,finalFreezeCommitNote:'commit qui contient tous les fichiers hachés ci-dessous (un fichier ne peut pas contenir le hash de son propre commit) ; les commits suivants de la branche ne touchent que docs/freeze/ et docs/audit/V2.3.1_ARCHITECTURE_FREEZE_QA.md',
 buildings:B.length,buildingsInCommune:inCommune,officialBuildingsV162:[...prov.values()].filter(b=>b.class==='official_v1.6.2').length,reintegratedV201:[...prov.values()].filter(b=>b.class==='reintegrated_v2.0.1').length,
 manualBuildingsV22:manual.length,architectureProfiles:B.length,architectureVersion:A.metadata.version,geographicFilesFrozen:Object.keys(frozen.files).length,
 unknownClassBuildings:unknownClass.map(u=>u.id),maskedZoneBuildings:masked.length,landmarks:read('unreal/architecture/landmark-architecture.json').landmarks.length,
 uniqueModelLandmarks:read('unreal/architecture/landmark-architecture.json').landmarks.filter(l=>l.modelingLevel==='unique_model').map(l=>l.id),
 unrealOrigin:{...UNREAL_ORIGIN,units:'cm',axes:'X est, Y sud, Z haut',realToUnreal:'X = (E − E0) × 100 ; Y = −(N − N0) × 100 ; Z = H × 100'},
 stats:{byClass:s.byClass,roofConfidence:s.byRoofConfidence,roofType:s.byRoofType,ridge:s.ridge,heightBest:s.heightBest,wallHeight:s.wallHeight,totalHeight:s.totalHeight,levels:s.levelsSummary,
  material:{known:s.materialKnown,unknown:B.length-s.materialKnown,byStatus:s.materialStatus},color:{known:s.colorKnown,unknown:B.length-s.colorKnown},overall:s.overall},
 readyForUnreal:arg('--ready')===true?true:false,
 readyForUnrealNote:arg('--ready')===true?'tous les contrôles, le build et Chromium ont passé sur finalFreezeCommit':'en attente : contrôles, build et Chromium sur le commit de gel',
 files,
 notVersioned:[{path:r16,note:'heightmap RAW 16 bits dérivée du PNG (même grille) ; hors Git (.gitignore), régénérée par npm run data:terrain',sha256Local:fs.existsSync(r16)?sha(r16):null}]};
fs.mkdirSync('docs/freeze',{recursive:true});
fs.writeFileSync('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json',JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify({unknownClass:unknownClass.length,masked:masked.length,maskedObserved:maskedList.filter(m=>m.observedAttributes.length).length,manual:manual.length,files:files.length,inCommune,final,ready:manifest.readyForUnreal,manifestSha256:sha('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json'),previousFinal:previous.finalFreezeCommit??null}));
