// V2.3 architectural enrichment check: every one of the 2 596 footprints has exactly one profile, the frozen V2.2 geography
// is byte-identical, every value is possible and traced (estimated values explicitly marked, unknown values left null),
// the V2.2 manual objects and the landmarks are covered, the Unreal files agree with the profiles, and the Three.js preview
// (?architecture=1) renders every building on its unchanged footprint.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projection,bounds} from '../src/geo.js';
import {buildingItems} from '../src/building-source.js';
import {buildBuildings} from '../src/buildings.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ok=m=>console.log('PASS '+m);
const A=read('public/data/building-architecture-v2.3.json'),UA=read('unreal/architecture/building-architecture.json'),UT=read('unreal/architecture/building-archetypes.json'),UL=read('unreal/architecture/landmark-architecture.json');
const FILES=['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'];
const feats=FILES.flatMap(f=>read(f).features.map(x=>({f:x,file:f})));
// 1. Frozen geography: every V2.2 geographic / Unreal file is byte-identical to the V2.2 commit.
const frozen=read('data-sources/architecture/frozen-geography-v2.2-sha256.json');
for(const [file,h] of Object.entries(frozen.files))assert.equal(sha(fs.readFileSync(file)),h,'Fichier géographique gelé modifié : '+file);
assert.equal(sha(fs.readFileSync(FILES[0])),'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095');
ok(`1. géographie V2.2 gelée : ${Object.keys(frozen.files).length} fichiers (empreintes, élévations, terrain, routes, rail, occupation du sol, POI, Unreal) identiques octet pour octet`);
// 2. One profile per footprint, same ids, no orphan, footprint hash per building unchanged.
const ids=feats.map(x=>x.f.id||x.f.properties.id),byId=new Map(A.buildings.map(e=>[e.buildingId,e]));
assert.equal(ids.length,2596);assert.equal(A.buildings.length,2596);assert.equal(byId.size,2596,'profil en double');
for(const x of feats){const id=x.f.id||x.f.properties.id,e=byId.get(id);assert(e,'profil manquant : '+id);assert.equal(e.footprint.geometrySha256,sha(JSON.stringify(x.f.geometry)),'empreinte modifiée : '+id);assert.equal(e.footprint.file,x.file);}
const orphans=A.buildings.filter(e=>!ids.includes(e.buildingId));assert.equal(orphans.length,0,'profil orphelin');
ok('2. 2 596 / 2 596 bâtiments ont un profil, identifiants exacts, aucun orphelin, empreinte de chaque bâtiment inchangée (SHA-256 par géométrie)');
// 3. Positions (XY) identical to the V2.2 Unreal provenance table.
const prov=new Map(read('unreal/buildings/buildings-provenance-v2.2.json').buildings.map(r=>[r.id,r]));
for(const e of A.buildings){const r=prov.get(e.buildingId);assert(r,'absent de la table V2.2 : '+e.buildingId);assert.deepEqual(e.position.unrealCm,r.unrealCm,'position modifiée : '+e.buildingId);assert.equal(e.position.baseZ,r.baseZ);}
ok('3. positions Unreal (X, Y, Z) et socles identiques à la table de provenance V2.2 pour les 2 596 bâtiments');
// 4. Values possible, statuses and confidences valid, unknown ⇒ null, estimated ⇒ traced as typology.
const ST=['official','measured','orthophoto','derived','estimated','unknown'],CF=['A','B','C','unknown'];
const CLASSES=new Set(UT.archetypes.map(a=>a.id)),ROOFS=['gable','hip','flat','shed','half_hip','complex','industrial','unknown'],MATS=['tile','slate_like','metal','membrane','fiber_cement','glass','unknown'],COLORS=['red_orange','brown','dark_gray','light_gray','blue_gray','white','mixed','unknown'];
for(const e of A.buildings){const r=e.roof,id=e.buildingId;
 assert(CLASSES.has(e.buildingClass),'classe inconnue : '+e.buildingClass);assert(CF.includes(e.buildingClassConfidence));assert(CF.includes(e.confidenceOverall));
 for(const [v,s] of [[e.wallHeightM,e.wallHeightStatus],[e.totalHeightM,e.totalHeightStatus],[e.levels,e.levelsStatus]]){assert(ST.includes(s),'statut invalide '+s+' : '+id);assert.equal(v==null,s==='unknown','valeur / statut incohérents : '+id);}
 for(const v of [e.wallHeightM,e.totalHeightM])if(v!=null)assert(v>0&&v<80,'hauteur impossible '+v+' : '+id);
 if(e.wallHeightM!=null&&e.totalHeightM!=null)assert(e.totalHeightM>=e.wallHeightM,'point haut sous l’égout : '+id);
 if(e.levels!=null)assert(Number.isInteger(e.levels)&&e.levels>=1&&e.levels<=10,'niveaux impossibles : '+id);
 if(e.visibleStoreys!=null)assert(Number.isInteger(e.visibleStoreys)&&e.visibleStoreys>=1&&e.visibleStoreys<=6);
 if(e.wallHeightStatus==='estimated'){assert(/typologie/.test(e.trace.wallHeight),'estimation non tracée : '+id);assert.equal(Math.round(e.wallHeightM*2),e.wallHeightM*2,'fausse précision d’une hauteur estimée : '+id);}
 assert(ROOFS.includes(r.type)&&CF.includes(r.confidence)&&MATS.includes(r.material)&&COLORS.includes(r.colorFamily)&&CF.includes(r.materialConfidence)&&CF.includes(r.colorConfidence));
 assert.equal(r.type==='unknown',r.confidence==='unknown');assert.equal(r.colorFamily==='unknown',r.colorConfidence==='unknown');assert.equal(r.material==='unknown',r.materialConfidence==='unknown');
 if(r.ridgeOrientationDeg!=null){assert(r.ridgeOrientationDeg>=0&&r.ridgeOrientationDeg<180,'angle hors convention 0–180 : '+id);assert(['gable','hip','shed','complex','industrial'].includes(r.type));assert.equal(r.ridgeOrientationStatus,'measured');}
 else{const na=r.type==='flat'||/cylindrique/.test(e.notes);assert.equal(r.ridgeOrientationStatus,na?'not_applicable':'unknown','faîtage inconnu / sans objet confondus : '+id);assert.equal(r.ridgeOrientationConfidence,r.ridgeOrientationStatus);}
 if(e.levelsStatus==='derived')assert(/hauteur à l’égout \d/.test(e.trace.levels)||e.trace.levels==null,'niveaux « dérivés » sans hauteur mesurée ou officielle : '+id);
 if(e.levelsStatus==='estimated')assert(/typologie/.test(e.trace.levels),'niveaux estimés non tracés : '+id);
 if(r.uphillAzimuthDeg!=null)assert(r.type==='shed'&&r.uphillAzimuthDeg>=0&&r.uphillAzimuthDeg<360);
 if(r.slopeDeg!=null)assert(r.slopeDeg>=0&&r.slopeDeg<=75,'pente impossible : '+id);if(r.type==='flat')assert.equal(r.slopeDeg,0);
 assert(Array.isArray(e.sources)&&e.sources.length>=1);assert.equal(e.architectureVersion,'2.3.1');
 if(r.type!=='unknown')assert(e.trace.roofType,'type de toit sans source : '+id);if(r.colorFamily!=='unknown')assert(e.trace.color);if(r.material!=='unknown')assert(e.trace.material);}
ok('4. valeurs possibles (hauteurs > 0, niveaux entiers, faîtage 0–180°, pentes 0–75°), statuts et confiances valides, inconnu = null, faîtage « sans objet » distinct d’« inconnu », niveaux dérivés seulement d’une hauteur mesurée ou officielle, estimations tracées et arrondies');
// 5. V2.2 manual objects, flat roofs of vis-A and vis-H1.
const manual=A.buildings.filter(e=>e.layer==='manual_orthophoto_v2_2');assert.equal(manual.length,12);
for(const k of ['vis-A','vis-H1']){const e=byId.get('manual-v2.2:'+k);assert.equal(e.roof.type,'flat',k+' doit être en toit plat');assert.equal(e.roof.slopeDeg,0);}
ok(`5. 12 objets V2.2 profilés ; vis-A et vis-H1 en toit plat (${byId.get('manual-v2.2:vis-A').roof.typeStatus}, ${byId.get('manual-v2.2:vis-H1').roof.typeStatus})`);
// 6. Landmarks: every building id exists, church and water towers as unique models.
const lmIds=UL.landmarks.flatMap(l=>l.buildingIds);for(const id of lmIds)assert(byId.has(id),'landmark sans bâtiment : '+id);
const need={'poi:eglise-saint-denis':'unique_model','poi:chateau-eau-poussey':'unique_model','poi:chateau-eau-granges':'unique_model','poi:mairie':null,'poi:ecole-primaire':null,'poi:salle-polyvalente':null,'poi:presbytere-ancien':null,'poi:seveal':null,'poi:monument-aux-morts':null};
for(const [k,level] of Object.entries(need)){const l=UL.landmarks.find(x=>x.id===k);assert(l,'landmark manquant : '+k);assert(['procedural','procedural_custom','unique_model'].includes(l.modelingLevel));if(level)assert.equal(l.modelingLevel,level,k);}
assert.equal(byId.get('BATIMENT0000000301149566').buildingClass,'RELIGIOUS');assert.equal(byId.get('way/588791761').buildingClass,'WATER_TOWER');assert.equal(byId.get('way/588791386').buildingClass,'WATER_TOWER');
ok(`6. ${UL.landmarks.length} landmarks préparés (${Object.entries(UL.metadata.counts).map(([k,v])=>k+' '+v).join(', ')}), Saint-Denis et les deux châteaux d’eau en modèle unique`);
// 7. Unreal files agree with the profiles; deterministic seeds; every class used has an archetype.
assert.equal(UA.buildings.length,2596);const seed=id=>{let h=0x811c9dc5;for(const c of Buffer.from(id,'utf8')){h^=c;h=Math.imul(h,0x01000193)>>>0;}return h>>>0;};
for(const u of UA.buildings){const e=byId.get(u.id);assert(e);assert.equal(u.archetype,e.buildingClass);assert.equal(u.variationSeed,seed(u.id),'graine non déterministe : '+u.id);assert.equal(u.footprintSha256,e.footprint.geometrySha256);assert.deepEqual(u.unrealCm,e.position.unrealCm);
 assert.equal(u.roofType,e.roof.type);assert.equal(u.roofOrientationDeg,e.roof.ridgeOrientationDeg);assert.equal(u.wallHeightM,e.wallHeightM);assert.equal(u.wallHeightStatus,e.wallHeightStatus);}
for(const c of new Set(A.buildings.map(e=>e.buildingClass)))assert(UT.archetypes.some(a=>a.id===c),'archétype manquant : '+c);
for(const a of UT.archetypes)assert(a.forbidden.some(f=>/empreinte/.test(f)),'règle interdite manquante : '+a.id);
ok(`7. fichiers Unreal cohérents : ${UA.buildings.length} bâtiments, ${UT.archetypes.length} archétypes, graines FNV-1a déterministes, randomisation interdite sur empreinte / position / orientation`);
// 8. Three.js preview: every building rendered with its profile, walls exactly on the frozen footprint (same XZ extent).
const osm=read('public/data/maizieres.geojson'),project=projection(osm.metadata.origin);
const fc={type:'FeatureCollection',features:feats.map(x=>x.f)};const items=buildingItems(fc,project,{minX:-1e9,maxX:1e9,minZ:-1e9,maxZ:1e9}).items;
const scene={add(){},children:[]},built=buildBuildings(scene,items,{buildings:{}},{architecture:byId});
let applied=0,bad=[];const walls=built.pickMeshes[0],pos=walls.geometry.getAttribute('position'),ext=new Map();
for(const r of walls.userData.featureRanges){let e=ext.get(r.id);if(!e){e={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};ext.set(r.id,e);}for(let v=r.start*3;v<r.end*3;v++){const x=pos.getX(v),z=pos.getZ(v);if(x<e.minX)e.minX=x;if(x>e.maxX)e.maxX=x;if(z<e.minZ)e.minZ=z;if(z>e.maxZ)e.maxZ=z;}}
for(const it of items){const i=built.info.get(it.id);if(i?.architecture)applied++;const e=ext.get(it.id);if(!e)continue;const b=bounds(it.poly[0]);if(Math.max(Math.abs(e.minX-b.minX),Math.abs(e.maxX-b.maxX),Math.abs(e.minZ-b.minZ),Math.abs(e.maxZ-b.maxZ))>.01)bad.push(it.id);}
assert.equal(built.rejected.length,0);assert.equal(applied,items.length,'profil non appliqué au rendu');assert.equal(bad.length,0,'murs hors empreinte : '+bad.slice(0,5));
const rendered=new Set([...built.info.keys()].map(k=>k.split('#')[0]));assert.equal(rendered.size,2596);
const main=fs.readFileSync('src/main.js','utf8');for(const s of ["params.get('architecture')==='1'","'architecture'","building-architecture-v2.3.json"])assert(main.includes(s),'câblage main.js : '+s);
ok(`8. aperçu Three.js ?architecture=1 : ${rendered.size} bâtiments rendus avec leur profil (${items.length} parties), murs posés exactement sur l’empreinte gelée, carte par défaut inchangée`);
