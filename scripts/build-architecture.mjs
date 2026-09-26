// V2.3: one architectural profile per footprint (2 596), for a stylised but recognisable Unreal rebuild.
// Reads the frozen footprints (never writes them), the IGN attributes already in the reference, the LiDAR HD / BD ORTHO
// measurements (data-sources/architecture/roof-measurements-v2.3.json, scripts/measure-architecture.py) and the landmarks.
// Every attribute carries a status (official / measured / orthophoto / derived / estimated / unknown), a confidence
// (A / B / C / unknown) and a trace of its source. An unknown value stays unknown: Unreal then uses a neutral archetype.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {toL93,toUnreal,UNREAL_ORIGIN} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const FILES={official_v1_6_2:'public/data/buildings.geojson',reintegrated_v2_0_1:'public/data/buildings-additions-v2.0.1.geojson',manual_orthophoto_v2_2:'public/data/buildings-manual-v2.2.geojson'};
const MEAS='data-sources/architecture/roof-measurements-v2.3.json',OUT='public/data/building-architecture-v2.3.json',U='unreal/architecture';
const meas=read(MEAS),M=new Map(meas.buildings.map(b=>[b.id,b])),manifest=read('data-sources/architecture/sources-manifest.json');
const prov=new Map(read('unreal/buildings/buildings-provenance-v2.2.json').buildings.map(r=>[r.id,r]));
const landmarks=read('unreal/poi/landmarks.json').landmarks,LM=new Map();for(const l of landmarks)for(const id of l.building_ids||[])LM.set(id,l);
const decisions=read('data-sources/buildings-manual-v2.2/decisions.json');
// Official heights of the two water towers (BD TOPO RESERVOIR, attached to the landmarks in the V1.11 curation).
const reservoirs=new Map(read('data-sources/landcover/bdtopo-reservoir.geojson').features.map(f=>[f.properties.cleabs,f]));
const curation=read('data-sources/poi/poi-curation-v1.11.json').canonical,towerHeight=new Map();
for(const l of landmarks)if(l.type==='chateau_eau'){const c=curation.find(x=>`poi:${x.key}`===l.poiId),key=(c?.officialKeys||[]).find(k=>k.startsWith('bdtopo:RESERVOI'))?.slice(7),r=reservoirs.get(key);
 if(r?.properties.hauteur)for(const id of l.building_ids)towerHeight.set(id,{height:r.properties.hauteur,cleabs:key,tank:r});}
const r1=v=>v==null?null:Math.round(v*10)/10;
// Deterministic 32-bit FNV-1a seed from the building ID: the same building keeps the same variation forever.
const seedOf=id=>{let h=0x811c9dc5;for(const c of Buffer.from(id,'utf8')){h^=c;h=Math.imul(h,0x01000193)>>>0;}return h>>>0;};
const lidarSource=`IGN LiDAR HD MNH 0,5 m (missions ${[...new Set(manifest.tiles.map(t=>t.lidarMission))].join(', ')}, vols 2025)`;
const S={bdtopo:'IGN BD TOPO (référentiel V1.6.2)',ff:'IGN BD TOPO, matériaux déclarés (fichiers fonciers DGFiP)',lidar:lidarSource,ortho:'IGN BD ORTHO avril 2025 (couleur de toiture, 0,5 m)',osm:'OpenStreetMap',landmark:'unreal/poi/landmarks.json (V1.11) + Bibles',manual:'relevé manuel V2.2 sur orthophoto (observation)',typo:'typologie (estimation)',footprint:'empreinte gelée (géométrie dérivée)'};

// ---------- footprints (read only) ----------
const items=[];
for(const [layer,file] of Object.entries(FILES))for(const f of read(file).features){const p=f.properties,id=f.id||p.id;
 const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
 items.push({id,layer,p,geometrySha256:sha(JSON.stringify(f.geometry)),l93:polys.map(poly=>poly[0].map(q=>toL93(q))),file});}
// Touching footprints (≤ 0,3 m): used for attached garages / annexes. Bounding boxes first.
const bb=items.map(it=>{const xs=it.l93.flat().map(q=>q[0]),ys=it.l93.flat().map(q=>q[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];});
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const ringDist=(A,B)=>{let d=Infinity;for(const ra of A)for(const rb of B){for(const p of ra)for(let i=1;i<rb.length;i++)d=Math.min(d,segDist(p,rb[i-1],rb[i]));for(const p of rb)for(let i=1;i<ra.length;i++)d=Math.min(d,segDist(p,ra[i-1],ra[i]));}return d;};
const touching=items.map(()=>[]);
for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=bb[i],b=bb[j];if(a[0]>b[2]+.3||b[0]>a[2]+.3||a[1]>b[3]+.3||b[1]>a[3]+.3)continue;if(ringDist(items[i].l93,items[j].l93)<=.3){touching[i].push(j);touching[j].push(i);}}

// ---------- roof from LiDAR ----------
function roofFromLidar(m){const L=m.lidar||{},s=m.shape;
 if(L.status!=='mesuré'||(L.roofPixels||0)<8)return null;
 const n=L.roofPixels,ff=L.flatFraction??0,pf=L.pitchedFraction??0,sp=L.heightSpreadM??9,R1=L.aspectR1??0,R2=L.aspectR2??0,R4=L.aspectR4??0,ef=L.endFaceFraction??0,fb=L.faceBalance??0,sl=L.slopeDeg;
 let type;
 if(ff>=.6||(ff>=.45&&sp<.8))type='flat';
 else if(L.lowSample)return {type:'unknown',confidence:'unknown',why:'toit trop petit pour distinguer les pans (pixels de bord)'};
 else if(pf<.5)type='complex';
 else if(R1>=.75)type='shed';
 else if(R2>=.55&&ef<.12&&fb>=.2)type='gable';
 else if(ef>=.12&&fb>=.2&&R4>=.35)type=['L','T','U','complex'].includes(s.family)?'complex':'hip';
 else type='complex';
 // Several ridges on an L / T / U outline: cross gables read as « complex », unless one ridge clearly dominates.
 if(type==='gable'&&['T','U','complex'].includes(s.family)&&R2<.7)type='complex';
 if(['gable','shed','complex'].includes(type)&&s.areaM2>=400&&sl!=null&&sl<12)type='industrial';
 let confidence;
 if(type==='flat')confidence=n>=40&&ff>=.8?'A':n>=15?'B':'C';
 else if(type==='gable')confidence=n>=40&&R2>=.7?'A':n>=15?'B':'C';
 else if(type==='hip')confidence=n>=60&&ef>=.18&&R4>=.5?'A':n>=20?'B':'C';
 else if(type==='shed')confidence=n>=40&&R1>=.85?'A':n>=15?'B':'C';
 else confidence=n>=40?'B':'C';
 if((L.vegetationFraction||0)>.3&&confidence==='A')confidence='B';
 const ridge=type==='flat'||L.ridgeDeg==null?null:Math.round(L.ridgeDeg)%180;
 const ridgeConf=ridge==null?'unknown':type==='complex'||type==='industrial'?'C':confidence;
 return {type,confidence,ridge,ridgeConf,uphill:type==='shed'&&L.uphillAzimuthDeg!=null?Math.round(L.uphillAzimuthDeg)%360:null,slope:type==='flat'||sl==null?null:Math.round(sl),metrics:{roofPixels:n,flatFraction:ff,aspectR1:R1,aspectR2:R2,aspectR4:R4,endFaceFraction:ef}};}

// ---------- colour / material ----------
function colourOf(m){const c=m.color;if(!c?.families||c.pixels<6)return {family:'unknown',confidence:'unknown'};
 const fam=Object.entries(c.families).filter(([k])=>!['unknown','shadow','vegetation'].includes(k)).sort((a,b)=>b[1]-a[1]);if(!fam.length)return {family:'unknown',confidence:'unknown'};
 const [top,f]=fam[0],second=fam[1]?.[1]||0;
 if(f<.45&&second>=.3)return {family:'mixed',confidence:'C',shares:Object.fromEntries(fam.slice(0,3)),medianRGB:c.medianRGB};
 return {family:top,confidence:f>=.6&&c.pixels>=40?'A':f>=.45?'B':'C',shares:Object.fromEntries(fam.slice(0,3)),medianRGB:c.medianRGB};}
const FF={'1':'tile','2':'slate_like','3':'metal','4':'membrane'};
function materialOf(p,roof,colour,cls,roofSource){const code=p.derived?.roofMaterialCode||p.ign?.roofMaterials||null;
 const mats=[...new Set(String(code||'').split('').filter(c=>'1234'.includes(c)))];
 if(mats.length===1){let conf='B',note='déclaration fiscale (fichiers fonciers) ; peut dater';
  const m=FF[mats[0]];if(m==='tile'&&['light_gray','white','blue_gray'].includes(colour.family)&&colour.confidence!=='C'){conf='C';note+=' ; couleur observée peu compatible avec une tuile';}
  if(m==='membrane')note='toit-terrasse béton déclaré (fichiers fonciers)';
  return {material:m,confidence:conf,status:'official',source:S.ff,note};}
 if(mats.length>1)return {material:'unknown',confidence:'unknown',status:'unknown',source:S.ff,note:`matériaux mixtes déclarés (code ${code}) : dominant inconnu`};
 if(cls==='GREENHOUSE')return {material:'glass',confidence:'B',status:'derived',source:S.bdtopo,note:'serre'};
 const t=roof?.type,pitched=['gable','hip','shed','half_hip','complex'].includes(t);
 if(pitched&&colour.family==='red_orange'&&colour.confidence!=='C')return {material:'tile',confidence:'B',status:'derived',source:S.ortho,note:'teinte terre cuite sur l’orthophoto'};
 if(t==='industrial'||(['HANGAR','INDUSTRIAL','FARM'].includes(cls)&&['light_gray','blue_gray','white'].includes(colour.family)))return {material:'metal',confidence:'C',status:'estimated',source:S.ortho,note:'bac acier probable (grand volume, teinte claire)'};
 if(t==='flat')return {material:'membrane',confidence:'C',status:'estimated',source:roofSource||S.typo,note:'toit plat : étanchéité probable'};
 if(pitched&&colour.family==='brown'&&cls.startsWith('RES'))return {material:'tile',confidence:'C',status:'estimated',source:S.ortho,note:'teinte brune, maison : tuile probable'};
 return {material:'unknown',confidence:'unknown',status:'unknown',source:null,note:''};}

// ---------- class ----------
const RES=new Set(['RES_PLAIN_PIED_GABLE','RES_PLAIN_PIED_HIP','RES_R1_GABLE','RES_R1_HIP','RES_R2_PLUS','RES_FLAT','RES_COMPLEX']);
function resClass(storeys,roofType){if(storeys>=3)return 'RES_R2_PLUS';if(roofType==='flat')return 'RES_FLAT';
 if(['complex','shed','industrial'].includes(roofType))return 'RES_COMPLEX';
 const r=storeys>=2?'RES_R1':'RES_PLAIN_PIED';return roofType==='hip'?r+'_HIP':r+'_GABLE';}
function baseClass(it,m,lm,roof,top){const p=it.p,ign=p.ign||{},t=p.osm?.tags||{},area=m.shape.areaM2,light=p.derived?.lightConstruction===true||t.wall==='no';
 if(lm){const k={eglise:['RELIGIOUS','A'],chateau_eau:['WATER_TOWER','A'],presbytere:['HERITAGE','A'],mairie:['PUBLIC','A'],ecole:['PUBLIC','A'],salle:['PUBLIC','A'],secours:['PUBLIC','A'],stade:['PUBLIC','A']}[lm.type];if(k)return {cls:k[0],conf:k[1],why:`landmark ${lm.poiId}`};
  if(lm.type==='site_industriel')return ign.nature==='Silo'||t.man_made==='storage_tank'?{cls:'SILO_TANK',conf:'A',why:`landmark ${lm.poiId} (cuve)`}:{cls:'INDUSTRIAL',conf:'A',why:`landmark ${lm.poiId}`};}
 if(ign.nature==='Eglise'||ign.usage1==='Religieux'||t.building==='church')return {cls:'RELIGIOUS',conf:'A',why:'BD TOPO / OSM : édifice religieux'};
 if(ign.nature==='Silo'||t.man_made==='storage_tank')return {cls:'SILO_TANK',conf:'A',why:'BD TOPO nature « Silo » / OSM cuve'};
 if(ign.nature==='Serre'||t.building==='greenhouse')return {cls:'GREENHOUSE',conf:'A',why:'BD TOPO nature « Serre »'};
 if(ign.nature==='Tribune')return {cls:'OTHER',conf:'A',why:'BD TOPO nature « Tribune »'};
 if(['roof','carport'].includes(t.building)||t.amenity==='fuel')return {cls:'OTHER',conf:'A',why:'OSM auvent / abri ouvert'};
 if(t.building==='retail'||t.shop||t.amenity==='fast_food')return {cls:'COMMERCIAL',conf:'A',why:'OSM commerce'};
 if(p.manualGeometry){const c={habitation:['RES',null],garage:['GARAGE','B'],abri:['SHED','B'],hangar:['HANGAR','B'],serre:['GREENHOUSE','B'],annexe:['ANNEX','B'],usage_non_etabli:['UNKNOWN','unknown']}[p.category]||['UNKNOWN','unknown'];return {cls:c[0],conf:c[1]||'B',why:`relevé V2.2 : ${p.categoryLabel||p.category}`};}
 switch(ign.usage1){
  case 'Résidentiel':return {cls:'RES',conf:'A',why:'BD TOPO usage résidentiel'};
  case 'Annexe':if(light&&area<60)return {cls:'SHED',conf:'B',why:'BD TOPO annexe, construction légère'};
   return area>=12&&area<=45&&['rectangle','elongated'].includes(m.shape.family)&&(top==null||top<4.5)?{cls:'GARAGE',conf:'B',why:'BD TOPO annexe, gabarit de garage (12–45 m², bas)'}:{cls:'ANNEX',conf:'A',why:'BD TOPO usage annexe'};
  case 'Agricole':return light||area>=600?{cls:'HANGAR',conf:'B',why:'BD TOPO agricole, grand volume ou construction légère'}:{cls:'FARM',conf:'A',why:'BD TOPO usage agricole'};
  case 'Industriel':return light?{cls:'HANGAR',conf:'B',why:'BD TOPO industriel, construction légère'}:{cls:'INDUSTRIAL',conf:'A',why:'BD TOPO usage industriel'};
  case 'Commercial et services':return {cls:'COMMERCIAL',conf:'A',why:'BD TOPO usage commercial et services'};
  case 'Sportif':return {cls:'PUBLIC',conf:'B',why:'BD TOPO usage sportif'};}
 // Undifferentiated (BD TOPO « Indifférencié », cadastre, OSM): typology from size, height and roof — confidence C.
 if(light)return area<60?{cls:'SHED',conf:'C',why:'construction légère < 60 m²'}:{cls:'HANGAR',conf:'C',why:'construction légère ≥ 60 m²'};
 if(ign.nature==='Industriel, agricole ou commercial')return area<45?{cls:'ANNEX',conf:'C',why:'BD TOPO nature activité, petit volume'}:{cls:'INDUSTRIAL',conf:'C',why:'BD TOPO nature « industriel, agricole ou commercial »'};
 if(area<12)return {cls:'SHED',conf:'C',why:'< 12 m²'};
 if(area<45){const garage=area>=14&&area<=40&&['rectangle','elongated'].includes(m.shape.family)&&(top==null||top<4.5);return {cls:garage?'GARAGE':'ANNEX',conf:'C',why:garage?'12–45 m², gabarit de garage':'12–45 m²'};}
 const slope=roof?.slope,rt=roof?.type;
 if(area>350)return (slope!=null&&slope<15)||rt==='industrial'?{cls:'HANGAR',conf:'C',why:'> 350 m², pente faible'}:{cls:'FARM',conf:'C',why:'> 350 m², non résidentiel probable'};
 if(top!=null&&top<3.2&&rt!=='flat')return {cls:'ANNEX',conf:'C',why:'volume bas (< 3,2 m)'};
 if(rt==='industrial'||(slope!=null&&slope<15&&rt!=='flat'&&area>120))return {cls:'FARM',conf:'C',why:'pente faible, volume utilitaire probable'};
 return {cls:'RES',conf:'C',why:'45–350 m², silhouette de maison (typologie)'};}

// ---------- per building ----------
const TYPO_WALL={RES:3.0,GARAGE:2.5,ANNEX:2.5,SHED:2.0,GREENHOUSE:2.5,FARM:4.5,HANGAR:5.0,INDUSTRIAL:6.0,COMMERCIAL:5.0,PUBLIC:5.0,OTHER:3.0,UNKNOWN:3.0,SILO_TANK:8.0,RELIGIOUS:8.0,HERITAGE:5.5,WATER_TOWER:20.0};
const manualFlat=new Map(decisions.cases.concat(decisions.newFindings).filter(c=>c.decision==='ajout_manuel').map(c=>[`manual-v2.2:${c.id}`,/toit[- ]terrasse|toit plat/i.test(c.observation)]));
const out=[],exceptions=[];
for(const [i,it] of items.entries()){
 const m=M.get(it.id);if(!m)throw Error('mesure absente : '+it.id);
 const p=it.p,ign=p.ign||{},der=p.derived||{},t=p.osm?.tags||{},L=m.lidar||{},lm=LM.get(it.id)||null,sources=new Set([S.footprint]);
 const measured=L.status==='mesuré',masked=L.status==='zone masquée';
 const notes=[];if(masked)notes.push('site masqué dans les données IGN (orthophoto en mosaïque, LiDAR interpolé) : aucune mesure possible');
 if(L.status==='non détecté')notes.push(`LiDAR 2025 : ${L.reason}`);
 // Roof type
 let roof=roofFromLidar(m),roofType,roofConf,roofStatus,roofSource;
 if(roof&&roof.type!=='unknown'){roofType=roof.type;roofConf=roof.confidence;roofStatus='measured';roofSource=S.lidar;sources.add(S.lidar);}
 else if(p.manualGeometry&&manualFlat.get(it.id)){roofType='flat';roofConf='B';roofStatus='orthophoto';roofSource=S.manual;sources.add(S.manual);notes.push('toit plat observé sur l’orthophoto (relevé V2.2)');}
 else {roofType='unknown';roofConf='unknown';roofStatus='unknown';roofSource=null;if(roof?.why)notes.push(roof.why);}
 if(t['roof:shape']){notes.push(`OSM roof:shape=${t['roof:shape']}`);}
 const top=measured?L.topM:null;
 // Class
 let {cls,conf:clsConf,why}=baseClass(it,m,lm,roof&&roof.type!=='unknown'?roof:{type:roofType},top);
 // Heights
 let wall=null,wallStatus='unknown',wallSrc=null,wallConf='unknown';
 if(der.wallHeight>0){wall=r1(der.wallHeight);wallStatus='official';wallSrc=S.bdtopo+' (hauteur à la gouttière)';wallConf='A';sources.add(S.bdtopo);}
 else if(measured&&(L.roofPixels||0)>=4){wall=r1(roofType==='flat'?L.medianM:(L.eaveM??L.p10M));wallStatus='measured';wallSrc=S.lidar+' (bas de toiture, 5e centile)';wallConf='B';}
 let total=null,totalStatus='unknown',totalSrc=null;
 const tower=towerHeight.get(it.id);
 if(tower){total=r1(tower.height);totalStatus='official';totalSrc=`IGN BD TOPO réservoir ${tower.cleabs} (hauteur)`;sources.add(S.bdtopo);
  if(measured&&Math.abs(L.topM-tower.height)>2)notes.push(`LiDAR 2025 : ${r1(L.topM)} m mesurés sur l’empreinte (retours incomplets sur la cuve) ; hauteur officielle ${tower.height} m retenue`);}
 else if(measured){total=r1(L.topM);totalStatus='measured';totalSrc=S.lidar+' (98e centile)';}
 else if(ign.roofMax!=null&&ign.groundMin!=null){total=r1(ign.roofMax-ign.groundMin);totalStatus='official';totalSrc=S.bdtopo+' (altitude max. toit − sol, statistique)';}
 if(wall!=null&&wallStatus==='official'&&measured&&L.eaveM!=null&&Math.abs(wall-L.eaveM)>3)notes.push(`écart BD TOPO / LiDAR à l’égout : ${wall} m contre ${r1(L.eaveM)} m`);
 // Visible storeys (silhouette) vs declared levels
 const clsKey=cls==='RES'?'RES':cls;
 let levels=null,levelsStatus='unknown',levelsSrc=null,levelsConf='unknown';
 const declared=ign.floors||(Number.parseInt(t['building:levels'])||null);
 if(declared){levels=declared;levelsStatus='official';levelsSrc=ign.floors?S.bdtopo+' (nombre d’étages déclaré, combles aménagés inclus)':S.osm;levelsConf='A';}
 const eave=wall;let storeys=null,storeysStatus='unknown';
 const singleVolume=['FARM','HANGAR','INDUSTRIAL','COMMERCIAL','SILO_TANK','WATER_TOWER','RELIGIOUS','GREENHOUSE','OTHER'].includes(clsKey);
 if(['GARAGE','ANNEX','SHED','GREENHOUSE'].includes(clsKey)){storeys=1;storeysStatus='derived';}
 else if(!singleVolume&&eave!=null){storeys=eave<=4.2?1:eave<=7.2?2:eave<=10?3:Math.round(eave/3);storeysStatus='derived';}
 if(levels==null&&storeys!=null&&!singleVolume){levels=storeys;levelsStatus='derived';levelsSrc=`hauteur à l’égout ${eave} m (${wallStatus==='official'?'BD TOPO':'LiDAR'})`+(['GARAGE','ANNEX','SHED'].includes(clsKey)?' ; annexe':'');levelsConf='B';}
 // Water towers: the « wall » of a tower is meaningless (shaft + tank) — only the official total height is kept.
 if(cls==='WATER_TOWER'){wall=null;wallStatus='unknown';wallSrc=null;wallConf='unknown';}
 // Estimated heights only when nothing better exists, as round typological values — never against a LiDAR
 // measurement that found nothing standing (the object may be a ground-level surface).
 const noElevation=L.status==='non détecté'&&L.reason==='aucune élévation mesurée';
 if(noElevation)notes.push('aucune hauteur estimée : le LiDAR 2025 ne mesure rien de dressé dans l’empreinte');
 if(wall==null&&!masked&&!noElevation&&cls!=='WATER_TOWER'){wall=TYPO_WALL[clsKey]??3.0;if(clsKey==='RES'&&levels>=2)wall=5.5;wallStatus='estimated';wallSrc=S.typo;wallConf='C';}
 if(total==null&&wall!=null&&!masked&&!noElevation&&wallStatus==='estimated'){total=roofType==='flat'?wall:r1(wall+({RES:3,GARAGE:1,ANNEX:1,SHED:1}[clsKey]??2));totalStatus='estimated';totalSrc=S.typo;}
 if(cls==='RES'){const st=storeys??(levels>=2?2:1);cls=resClass(st,roofType);if(roofType==='unknown'){notes.push('archétype résidentiel par défaut : toiture non mesurée');if(clsConf==='A')clsConf='B';}if(storeys==null){if(clsConf!=='C')clsConf='C';notes.push('niveaux visibles non établis (plain-pied par défaut)');}}
 if(clsConf==='C'&&cls==='UNKNOWN')clsConf='unknown';
 // Cylindrical silos and tanks: a cone or dome, never a ridge. Keep « flat » when measured flat.
 if(['SILO_TANK','WATER_TOWER'].includes(cls)&&m.shape.compactness>=.8&&roofType!=='flat'&&roofType!=='unknown'){roofType='complex';if(roof){roof.ridge=null;}notes.push('couverture de cuve / silo cylindrique (cône ou dôme) : pas de faîtage');}
 if(total!=null&&wall!=null&&total<wall)total=wall;
 // Colour & material
 const colour=masked?{family:'unknown',confidence:'unknown'}:colourOf(m);if(colour.family!=='unknown')sources.add(S.ortho);
 const mat=masked?{material:'unknown',confidence:'unknown',status:'unknown',source:null,note:''}:materialOf(p,roof&&roof.type!=='unknown'?roof:{type:roofType},colour,cls,roofSource);if(mat.source)sources.add(mat.source);
 // Ridge
 let ridge=null,ridgeStatus='unknown',ridgeConf='unknown';
 if(roof&&roof.ridge!=null&&['gable','hip','shed','complex','industrial'].includes(roofType)){ridge=roof.ridge;ridgeStatus='measured';ridgeConf=roof.ridgeConf;}
 let slope=null,slopeStatus='unknown';if(roof&&roof.slope!=null&&roofType!=='flat'){slope=roof.slope;slopeStatus='measured';}
 if(roofType==='flat'){slope=0;slopeStatus=roofStatus==='measured'?'measured':'derived';}
 // Shape and attachments
 const neigh=touching[i].map(j=>({it:items[j],m:M.get(items[j].id)}));
 const smallNeigh=neigh.filter(n=>n.m.shape.areaM2<45&&n.m.shape.areaM2<m.shape.areaM2/1.5);
 const annex=smallNeigh.length?'yes':(measured&&(L.lowVolumeFraction||0)>=.2)?'possible':measured?'no':'unknown';
 const garageLike=smallNeigh.some(n=>n.m.shape.areaM2>=12&&['rectangle','elongated'].includes(n.m.shape.family));
 const attachedGarage=RES.has(cls)||cls==='RES'?(garageLike?'possible':measured?'no':'unknown'):'no';
 if(p.osm)sources.add(S.osm);if(lm)sources.add(S.landmark);if(p.manualGeometry)sources.add(S.manual);
 // Overall confidence
 const heightGood=['official','measured'].includes(wallStatus)||totalStatus==='measured';
 // Overall = confidence of the silhouette (roof + height) first, then of the usage class.
 let overall=roofConf==='A'&&heightGood&&['A','B'].includes(clsConf)?'A':
  ['A','B'].includes(roofConf)&&heightGood?'B':
  roofConf!=='unknown'||heightGood?'C':clsConf!=='unknown'&&wallStatus==='estimated'?'C':'unknown';
 if(masked)overall='unknown';
 const pr=prov.get(it.id);
 const entry={buildingId:it.id,architectureVersion:'2.3',layer:it.layer,
  buildingClass:cls,buildingClassConfidence:clsConf,
  levels,levelsStatus,visibleStoreys:storeys,visibleStoreysStatus:storeysStatus,
  wallHeightM:wall,wallHeightStatus:wallStatus,totalHeightM:total,totalHeightStatus:totalStatus,
  roof:{type:roofType,confidence:roofConf,typeStatus:roofStatus,ridgeOrientationDeg:ridge,uphillAzimuthDeg:roofType==='shed'?roof?.uphill??null:null,ridgeOrientationStatus:ridgeStatus,ridgeOrientationConfidence:ridgeConf,slopeDeg:slope,slopeStatus,
   material:mat.material,materialConfidence:mat.confidence,materialStatus:mat.status,colorFamily:colour.family,colorConfidence:colour.confidence,colorStatus:colour.family==='unknown'?'unknown':'orthophoto'},
  shape:{footprintFamily:m.shape.family,areaM2:m.shape.areaM2,lengthM:m.shape.lengthM,widthM:m.shape.widthM,ratio:m.shape.ratio,mainBearingDeg:m.shape.bearingDeg,rectangularity:m.shape.rectangularity,compactness:m.shape.compactness,attachedGarage,annex,touchingFootprints:touching[i].length},
  unreal:{archetype:cls,variationSeed:seedOf(it.id),allowProceduralVariation:!(lm&&['eglise','chateau_eau','monument'].includes(lm.type))},
  trace:{class:why,levels:levelsSrc,wallHeight:wallSrc,totalHeight:totalSrc,roofType:roofSource,ridge:ridgeStatus==='measured'?S.lidar+' (axe des pentes dominantes)':null,slope:slopeStatus==='measured'?S.lidar+' (pente médiane des pans)':null,material:mat.source?`${mat.source}${mat.note?' — '+mat.note:''}`:null,color:colour.family!=='unknown'?S.ortho+(colour.shares?' — parts '+Object.entries(colour.shares).map(([k,v])=>`${k} ${Math.round(v*100)} %`).join(', '):''):null},
  lidar:{status:L.status,reason:L.reason||null,topM:measured?L.topM:null,roofPixels:L.roofPixels??null},
  sources:[...sources],confidenceOverall:overall,notes:notes.join(' ; '),
  footprint:{file:it.file,geometrySha256:it.geometrySha256},position:pr?{baseZ:pr.baseZ,unrealCm:pr.unrealCm}:null,landmark:lm?{poiId:lm.poiId,name:lm.name,type:lm.type}:null};
 out.push(entry);
 if(L.status==='non détecté'&&L.reason==='aucune élévation mesurée')exceptions.push({id:it.id,layer:it.layer,areaM2:m.shape.areaM2,kind:'aucune élévation LiDAR 2025 dans l’empreinte',detail:`élévation > 1,2 m sur ${Math.round((L.elevatedFraction||0)*100)} % de l’empreinte ; végétation ${Math.round((L.vegetationFraction||0)*100)} %`,colour:colour.family,position:pr?.unrealCm||null});
}
// ---------- statistics ----------
const n=out.length,pct=v=>Math.round(v/n*1000)/10,count=f=>out.filter(f).length,dist=f=>Object.fromEntries(Object.entries(out.reduce((a,e)=>{const k=f(e);a[k]=(a[k]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]));
const stats={buildings:n,byClass:dist(e=>e.buildingClass),byRoofType:dist(e=>e.roof.type),byRoofConfidence:dist(e=>e.roof.confidence),
 roofTypeAB:count(e=>['A','B'].includes(e.roof.confidence)),roofTypeABPercent:pct(count(e=>['A','B'].includes(e.roof.confidence))),
 ridgeAB:count(e=>['A','B'].includes(e.roof.ridgeOrientationConfidence)),ridgeABPercent:pct(count(e=>['A','B'].includes(e.roof.ridgeOrientationConfidence))),
 wallHeight:dist(e=>e.wallHeightStatus),totalHeight:dist(e=>e.totalHeightStatus),levels:dist(e=>e.levelsStatus),
 heightOfficialOrMeasured:count(e=>['official','measured'].includes(e.wallHeightStatus)||e.totalHeightStatus==='measured'),
 heightOfficialOrMeasuredPercent:pct(count(e=>['official','measured'].includes(e.wallHeightStatus)||e.totalHeightStatus==='measured')),
 heightEstimated:count(e=>e.wallHeightStatus==='estimated'),heightEstimatedPercent:pct(count(e=>e.wallHeightStatus==='estimated')),
 heightUnknown:count(e=>e.wallHeightStatus==='unknown'&&e.totalHeightStatus==='unknown'),
 classKnown:count(e=>e.buildingClass!=='UNKNOWN'),classKnownPercent:pct(count(e=>e.buildingClass!=='UNKNOWN')),byClassConfidence:dist(e=>e.buildingClassConfidence),
 materialKnown:count(e=>e.roof.material!=='unknown'),materialKnownPercent:pct(count(e=>e.roof.material!=='unknown')),byMaterial:dist(e=>e.roof.material),
 colorKnown:count(e=>!['unknown'].includes(e.roof.colorFamily)),colorKnownPercent:pct(count(e=>e.roof.colorFamily!=='unknown')),byColor:dist(e=>e.roof.colorFamily),
 totallyUnknown:count(e=>e.buildingClass==='UNKNOWN'&&e.roof.type==='unknown'&&!['official','measured'].includes(e.wallHeightStatus)&&e.totalHeightStatus!=='measured'&&e.roof.colorFamily==='unknown'),
 overall:dist(e=>e.confidenceOverall),lidar:dist(e=>e.lidar.status),footprintFamily:dist(e=>e.shape.footprintFamily),
 importantUnknowns:{roofType:count(e=>e.roof.type==='unknown'),ridge:count(e=>e.roof.ridgeOrientationDeg==null&&e.roof.type!=='flat'),height:count(e=>!['official','measured'].includes(e.wallHeightStatus)&&e.totalHeightStatus!=='measured'),material:count(e=>e.roof.material==='unknown'),color:count(e=>e.roof.colorFamily==='unknown'),class:count(e=>e.buildingClass==='UNKNOWN')}};
stats.totallyUnknownPercent=pct(stats.totallyUnknown);
const footprintSha=Object.fromEntries(Object.entries(FILES).map(([k,f])=>[f,sha(fs.readFileSync(f))]));
const meta={version:'2.3',generatedBy:'scripts/build-architecture.mjs (npm run data:architecture)',measurements:MEAS,measurementsSha256:sha(fs.readFileSync(MEAS)),footprintFilesSha256:footprintSha,
 conventions:{ridgeOrientationDeg:'axe du faîtage, degrés 0–180 dans le sens horaire depuis le nord du quadrillage Lambert-93 (non orienté)',mainBearingDeg:'axe du grand côté du rectangle minimal de l’empreinte, même convention',heights:'mètres au-dessus du sol (sol nu LiDAR / BD TOPO)',levels:'niveaux déclarés (BD TOPO : combles aménagés inclus) ; visibleStoreys = niveaux lisibles en façade, dérivés de la hauteur à l’égout',
  statuses:{official:'attribut IGN BD TOPO ou OSM',measured:'mesure LiDAR HD 2025',orthophoto:'observation sur l’orthophoto 2025',derived:'déduit d’autres valeurs mesurées/officielles',estimated:'valeur typologique ronde, jamais présentée comme mesure',unknown:'aucune base suffisante'},
  confidence:{A:'source officielle ou observation très claire',B:'déduction solide / plusieurs indices',C:'estimation typologique',unknown:'aucune base'}},
 sources:Object.values(S),maskedZone:meas.metadata.maskedZone,stats};
fs.writeFileSync(OUT,JSON.stringify({metadata:meta,buildings:out})+'\n');
// ---------- Unreal ----------
fs.mkdirSync(U,{recursive:true});
fs.writeFileSync(`${U}/building-architecture.json`,JSON.stringify({metadata:{version:'2.3',generatedBy:meta.generatedBy,unrealOrigin:UNREAL_ORIGIN,units:'unrealCm = [X, Y, Z] (cm) de la table V2.2 ; hauteurs en mètres ; angles en degrés (convention ci-dessous)',conventions:meta.conventions,
 rule:'Ne jamais modifier empreinte, position ni orientation : ces données ne décrivent que l’élévation. Les empreintes restent celles des GeoJSON gelés (SHA-256 par bâtiment).',footprintFilesSha256:footprintSha,count:out.length},
 buildings:out.map(e=>({id:e.buildingId,layer:e.layer,footprintSha256:e.footprint.geometrySha256,unrealCm:e.position?.unrealCm||null,baseZ:e.position?.baseZ??null,archetype:e.unreal.archetype,classConfidence:e.buildingClassConfidence,
  wallHeightM:e.wallHeightM,wallHeightStatus:e.wallHeightStatus,totalHeightM:e.totalHeightM,totalHeightStatus:e.totalHeightStatus,levels:e.levels,levelsStatus:e.levelsStatus,visibleStoreys:e.visibleStoreys,
  roofType:e.roof.type,roofConfidence:e.roof.confidence,roofOrientationDeg:e.roof.ridgeOrientationDeg,roofOrientationStatus:e.roof.ridgeOrientationStatus,roofSlopeDeg:e.roof.slopeDeg,roofSlopeStatus:e.roof.slopeStatus,
  roofMaterialFamily:e.roof.material,roofColorFamily:e.roof.colorFamily,footprintFamily:e.shape.footprintFamily,mainBearingDeg:e.shape.mainBearingDeg,confidence:e.confidenceOverall,variationSeed:e.unreal.variationSeed,allowProceduralVariation:e.unreal.allowProceduralVariation}))})+'\n');
console.log(JSON.stringify(stats,null,1));
fs.writeFileSync('data-sources/architecture/geographic-freeze-exceptions-v2.3.json',JSON.stringify({version:'2.3',note:'Constats seulement : aucune empreinte n’a été modifiée.',maskedZone:meas.metadata.maskedZone,noElevation:exceptions},null,1)+'\n');

// ---------- landmarks (individually recognisable structures) ----------
const byId=new Map(out.map(e=>[e.buildingId,e]));
const LEVEL={eglise:'unique_model',chateau_eau:'unique_model',monument:'unique_model',mairie:'procedural_custom',ecole:'procedural_custom',salle:'procedural_custom',presbytere:'procedural_custom',site_industriel:'procedural_custom',secours:'procedural',stade:'procedural'};
const FEATURES={
 'poi:eglise-saint-denis':['nef romane (fin XIe–début XIIe s.) plus haute que les bas-côtés','double transept du XVIe s. : trois pignons au nord, deux au sud','chœur à trois vaisseaux, chevet à pans coupés, abside à cinq pans','tourelle ronde d’escalier, grands contreforts','clocher (BD TOPO construction ponctuelle « Clocher »), chantier de restauration 2024–2026'],
 'poi:mairie':['façade brique et pierre, composition verticale','baies cintrées au rez-de-chaussée, balcon central','bâtiment scolaire plus bas accolé (vues anciennes) ; agrandie et rénovée depuis 2003'],
 'poi:monument-aux-morts':['obélisque sur socle, calcaire','éléments en bronze : Croix de Guerre, palme, frise de laurier','médaillon « Tête de Poilu » (René Bertrand-Boutée)','ne jamais générer de nom gravé'],
 'poi:presbytere-ancien':['maison ancienne du 15 rue Pasteur, vendue par le diocèse avant 2017 : à traiter comme maison ancienne'],
 'poi:salle-polyvalente':['ancienne salle de gymnastique et de patronage de L’Étoile'],
 'poi:ecole-primaire':['ensemble de 12 volumes d’âges différents (école, préaux, annexes)','fresques de la cour (Francis Bavoil) : non modélisables en vue aérienne'],
 'poi:chateau-eau-granges':['château d’eau sur fût : cuve circulaire large au sommet (ombre portée longue sur l’orthophoto 2025)'],
 'poi:chateau-eau-poussey':['château d’eau de Poussey : cuve circulaire au sommet, repère de la Croix des Ormes'],
 'poi:seveal':['dépôt d’hydrocarbures : bacs cylindriques et bâtiments de service','landmark industriel visible depuis la RD619'],
 'poi:cpi':['centre de première intervention (sapeurs-pompiers volontaires)'],'poi:stade':['vestiaires du stade']};
const agg=ids=>{const es=ids.map(id=>byId.get(id)).filter(Boolean);if(!es.length)return null;const main=es.slice().sort((a,b)=>b.shape.areaM2-a.shape.areaM2)[0];
 return {buildings:es.length,totalFootprintM2:Math.round(es.reduce((s,e)=>s+e.shape.areaM2,0)),main:{id:main.buildingId,lengthM:main.shape.lengthM,widthM:main.shape.widthM,bearingDeg:main.shape.mainBearingDeg,footprintFamily:main.shape.footprintFamily},
  wallHeightM:main.wallHeightM,wallHeightStatus:main.wallHeightStatus,totalHeightM:Math.max(...es.map(e=>e.totalHeightM??0))||null,totalHeightStatus:main.totalHeightStatus,
  roof:{type:main.roof.type,confidence:main.roof.confidence,ridgeOrientationDeg:main.roof.ridgeOrientationDeg,slopeDeg:main.roof.slopeDeg,colorFamily:main.roof.colorFamily,material:main.roof.material},
  confidence:main.confidenceOverall,sources:[...new Set(es.flatMap(e=>e.sources))]};};
const lmOut=[];
for(const l of landmarks){const level=LEVEL[l.type];if(!level)continue;const a=agg(l.building_ids||[]);
 if(!a&&l.type!=='monument')continue;
 const tank=l.type==='chateau_eau'?[...towerHeight.values()].find(t=>(l.building_ids||[]).some(id=>towerHeight.get(id)===t)):null;
 let tankDiameterM=null;if(tank){const ring=(tank.tank.geometry.type==='MultiPolygon'?tank.tank.geometry.coordinates[0]:tank.tank.geometry.coordinates)[0].map(q=>toL93(q));const xs=ring.map(q=>q[0]),ys=ring.map(q=>q[1]);tankDiameterM=Math.round(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*10)/10;}
 lmOut.push({id:l.poiId,name:l.name,type:l.type,status:l.status,buildingIds:l.building_ids||[],unrealPosition:l.unreal_position,L93:l.L93,
  silhouette:{eglise:'église composite : nef, double transept, chœur et abside à pans, clocher',chateau_eau:'fût vertical + cuve circulaire au sommet',monument:'obélisque sur socle',mairie:'bâtiment public à façade brique et pierre',ecole:'groupe scolaire de plusieurs volumes',salle:'salle communale à deux pans',presbytere:'maison ancienne',site_industriel:'bacs cylindriques et bâtiments techniques',secours:'bâtiment de service',stade:'vestiaires'}[l.type],
  dimensions:a?{buildings:a.buildings,totalFootprintM2:a.totalFootprintM2,mainFootprint:a.main,tankDiameterM}:{note:'pas d’empreinte bâtie : position ponctuelle V1.11 (BD TOPO / Bible)'},
  heights:a?{wallHeightM:a.wallHeightM,wallHeightStatus:a.wallHeightStatus,totalHeightM:tank?tank.height:a.totalHeightM,totalHeightStatus:tank?'official':a.totalHeightStatus}:{totalHeightM:null,totalHeightStatus:'unknown'},
  roof:a?.roof||null,particularities:FEATURES[l.poiId]||[],
  sources:[...(a?.sources||[]),'unreal/poi/landmarks.json (V1.11)',...(l.poiId==='poi:eglise-saint-denis'||l.poiId==='poi:mairie'||l.poiId==='poi:monument-aux-morts'?['BIBLE_03 Patrimoine']:[])],
  confidence:l.type==='monument'?'B':a?.confidence||'unknown',modelingLevel:level});}
// Very visible structures not in the V1.11 landmark list: the grain-silo complex and the largest commercial / industrial halls.
const silos=out.filter(e=>e.buildingClass==='SILO_TANK'&&e.totalHeightM>=30&&e.lidar.status==='mesuré'&&!e.landmark);
if(silos.length){const a=agg(silos.map(e=>e.buildingId));lmOut.push({id:'auto:silos-cerealiers',name:'Complexe de silos (nature BD TOPO « Silo »)',type:'silos',status:'actuel',buildingIds:silos.map(e=>e.buildingId),unrealPosition:null,L93:null,silhouette:'batterie de cellules cylindriques de 40 à 55 m et tours de manutention',
 dimensions:{buildings:a.buildings,totalFootprintM2:a.totalFootprintM2,mainFootprint:a.main},heights:{totalHeightM:a.totalHeightM,totalHeightStatus:'measured',range:[Math.min(...silos.map(e=>e.totalHeightM)),Math.max(...silos.map(e=>e.totalHeightM))]},roof:null,particularities:['plus haut ensemble bâti de la commune, visible de très loin (LiDAR 2025)'],sources:a.sources,confidence:'A',modelingLevel:'procedural_custom'});}
for(const e of out.filter(e=>['COMMERCIAL','INDUSTRIAL'].includes(e.buildingClass)&&e.shape.areaM2>=6000&&e.lidar.status==='mesuré')){const a=agg([e.buildingId]);
 lmOut.push({id:'auto:'+e.buildingId,name:`${e.buildingClass==='COMMERCIAL'?'Grand bâtiment commercial':'Grand bâtiment industriel'} (${Math.round(e.shape.areaM2)} m²)`,type:e.buildingClass.toLowerCase(),status:'actuel',buildingIds:[e.buildingId],unrealPosition:e.position?.unrealCm||null,L93:null,silhouette:'grand volume à toiture '+e.roof.type,
  dimensions:{buildings:1,totalFootprintM2:a.totalFootprintM2,mainFootprint:a.main},heights:{wallHeightM:a.wallHeightM,wallHeightStatus:a.wallHeightStatus,totalHeightM:a.totalHeightM,totalHeightStatus:a.totalHeightStatus},roof:a.roof,particularities:['volume très visible en vue aérienne'],sources:a.sources,confidence:a.confidence,modelingLevel:'procedural_custom'});}
fs.writeFileSync(`${U}/landmark-architecture.json`,JSON.stringify({metadata:{version:'2.3',generatedBy:meta.generatedBy,levels:{unique_model:'modèle unique dédié',procedural_custom:'génération procédurale avec paramètres propres au bâtiment',procedural:'archétype procédural standard'},
 counts:Object.fromEntries(['unique_model','procedural_custom','procedural'].map(k=>[k,lmOut.filter(x=>x.modelingLevel===k).length])),notBuildings:'ponts, cimetière, croix, gué et passage à niveau relèvent des couches routes / rail / POI (V1.11), pas de l’architecture'},landmarks:lmOut},null,1)+'\n');

// ---------- archetypes ----------
const A=(id,usage,o)=>({id,usage,...o,forbidden:['modifier l’empreinte, la position ou l’orientation géographique','remplacer une hauteur officielle ou mesurée par une valeur aléatoire','changer un type de toit connu (confiance A/B)',...(o.forbidden||[])]});
const archetypes=[
 A('RES_PLAIN_PIED_GABLE','maison individuelle de plain-pied',{roofTypes:['gable'],levels:[1],wallHeightRangeM:[2.4,4.2],roofSlopeRangeDeg:[25,50],allowedRoofColors:['red_orange','brown','dark_gray'],materials:['tile','slate_like'],allowDormers:false,allowGarageVariation:true,variations:['lucarnes absentes','cheminée','couleur d’enduit clair','volets'],randomisation:['détails de façade','cheminée','menuiseries']}),
 A('RES_PLAIN_PIED_HIP','maison de plain-pied à quatre pans',{roofTypes:['hip'],levels:[1],wallHeightRangeM:[2.4,4.2],roofSlopeRangeDeg:[20,45],allowedRoofColors:['red_orange','brown','dark_gray'],materials:['tile'],allowDormers:false,allowGarageVariation:true,variations:['cheminée','couleur d’enduit'],randomisation:['détails de façade','menuiseries']}),
 A('RES_R1_GABLE','maison à étage (R+1) à deux pans',{roofTypes:['gable'],levels:[2],wallHeightRangeM:[4.2,7.2],roofSlopeRangeDeg:[25,50],allowedRoofColors:['red_orange','brown','dark_gray'],materials:['tile','slate_like'],allowDormers:true,allowGarageVariation:true,variations:['lucarnes','cheminée','maison ancienne de bourg'],randomisation:['détails de façade','menuiseries','lucarnes si non documentées']}),
 A('RES_R1_HIP','maison à étage à quatre pans',{roofTypes:['hip'],levels:[2],wallHeightRangeM:[4.2,7.2],roofSlopeRangeDeg:[20,45],allowedRoofColors:['red_orange','brown','dark_gray'],materials:['tile'],allowDormers:false,allowGarageVariation:true,variations:['cheminée'],randomisation:['détails de façade']}),
 A('RES_R2_PLUS','habitation de trois niveaux visibles ou plus',{roofTypes:['gable','hip','complex','flat'],levels:[3,4],wallHeightRangeM:[7.2,13],roofSlopeRangeDeg:[0,50],allowedRoofColors:['red_orange','brown','dark_gray','light_gray'],materials:['tile','slate_like','membrane'],allowDormers:true,allowGarageVariation:false,variations:['immeuble de bourg','corps de ferme à étage'],randomisation:['détails de façade']}),
 A('RES_FLAT','maison à toit plat / toit-terrasse',{roofTypes:['flat'],levels:[1,2],wallHeightRangeM:[2.5,7],roofSlopeRangeDeg:[0,5],allowedRoofColors:['light_gray','dark_gray','white'],materials:['membrane'],allowDormers:false,allowGarageVariation:true,variations:['acrotère','terrasse'],randomisation:['acrotère','garde-corps']}),
 A('RES_COMPLEX','maison à plusieurs volumes / pignons croisés / mono-pente',{roofTypes:['complex','shed','industrial'],levels:[1,2],wallHeightRangeM:[2.4,7.2],roofSlopeRangeDeg:[10,50],allowedRoofColors:['red_orange','brown','dark_gray','mixed'],materials:['tile','slate_like'],allowDormers:true,allowGarageVariation:true,variations:['L','T','extensions'],randomisation:['répartition des pans si non mesurée'],forbidden:['réduire la maison à un seul pignon quand l’empreinte est en L/T/U']}),
 A('GARAGE','garage individuel',{roofTypes:['flat','shed','gable'],levels:[1],wallHeightRangeM:[2.2,3.2],roofSlopeRangeDeg:[0,35],allowedRoofColors:['red_orange','brown','dark_gray','light_gray'],materials:['tile','membrane','metal'],allowDormers:false,allowGarageVariation:false,variations:['porte basculante','accolé ou isolé'],randomisation:['porte','teinte']}),
 A('ANNEX','dépendance / annexe maçonnée',{roofTypes:['gable','shed','flat'],levels:[1],wallHeightRangeM:[2,3.5],roofSlopeRangeDeg:[0,45],allowedRoofColors:['red_orange','brown','dark_gray','light_gray'],materials:['tile','metal','membrane'],allowDormers:false,allowGarageVariation:false,variations:['appentis','remise'],randomisation:['ouvertures','teinte']}),
 A('SHED','abri de jardin / construction légère',{roofTypes:['shed','gable','flat','unknown'],levels:[1],wallHeightRangeM:[1.8,2.8],roofSlopeRangeDeg:[0,35],allowedRoofColors:['dark_gray','brown','light_gray','mixed'],materials:['metal','unknown'],allowDormers:false,allowGarageVariation:false,variations:['bois','tôle','bâche'],randomisation:['matériau léger','teinte'],forbidden:['en faire une maison']}),
 A('GREENHOUSE','serre',{roofTypes:['gable','unknown'],levels:[1],wallHeightRangeM:[2,3.5],roofSlopeRangeDeg:[15,35],allowedRoofColors:['white','light_gray'],materials:['glass'],allowDormers:false,allowGarageVariation:false,variations:['tunnel','serre vitrée'],randomisation:['armature']}),
 A('FARM','bâtiment agricole maçonné (grange, étable, corps de ferme)',{roofTypes:['gable','hip','complex','industrial'],levels:[],wallHeightRangeM:[3.5,8],roofSlopeRangeDeg:[10,45],allowedRoofColors:['red_orange','brown','light_gray','blue_gray'],materials:['tile','metal','fiber_cement'],allowDormers:false,allowGarageVariation:false,variations:['portes charretières','grange'],randomisation:['ouvertures','bardage']}),
 A('HANGAR','hangar / grand volume léger',{roofTypes:['gable','shed','industrial','flat'],levels:[],wallHeightRangeM:[3.5,10],roofSlopeRangeDeg:[3,20],allowedRoofColors:['light_gray','blue_gray','dark_gray'],materials:['metal','fiber_cement'],allowDormers:false,allowGarageVariation:false,variations:['ouvert','bardé'],randomisation:['bardage','ouvertures']}),
 A('INDUSTRIAL','bâtiment industriel / logistique',{roofTypes:['flat','industrial','gable','shed'],levels:[],wallHeightRangeM:[5,15],roofSlopeRangeDeg:[0,15],allowedRoofColors:['light_gray','dark_gray','white','blue_gray'],materials:['metal','membrane'],allowDormers:false,allowGarageVariation:false,variations:['quais','panneaux solaires','lanterneaux'],randomisation:['ouvertures','quais']}),
 A('COMMERCIAL','commerce / services',{roofTypes:['flat','gable','industrial','complex'],levels:[1,2],wallHeightRangeM:[3,10],roofSlopeRangeDeg:[0,40],allowedRoofColors:['white','light_gray','dark_gray','red_orange'],materials:['membrane','metal','tile'],allowDormers:false,allowGarageVariation:false,variations:['enseigne générique (aucune marque)','auvent'],randomisation:['devanture'],forbidden:['reproduire un logo ou une marque']}),
 A('PUBLIC','bâtiment public (école, salle, services)',{roofTypes:['gable','hip','complex','flat','shed'],levels:[1,2],wallHeightRangeM:[3,8],roofSlopeRangeDeg:[0,45],allowedRoofColors:['red_orange','brown','dark_gray','light_gray'],materials:['tile','metal','membrane'],allowDormers:false,allowGarageVariation:false,variations:['préau','cour'],randomisation:['menuiseries']}),
 A('HERITAGE','bâtiment ancien remarquable (presbytère)',{roofTypes:['gable','complex','hip'],levels:[1,2],wallHeightRangeM:[2.5,7.5],roofSlopeRangeDeg:[15,50],allowedRoofColors:['red_orange','brown','dark_gray'],materials:['tile','slate_like'],allowDormers:true,allowGarageVariation:false,variations:['maison de bourg ancienne'],randomisation:['aucune au-delà des menuiseries']}),
 A('RELIGIOUS','édifice religieux',{roofTypes:['complex'],levels:[],wallHeightRangeM:[6,12],roofSlopeRangeDeg:[35,60],allowedRoofColors:['dark_gray','blue_gray'],materials:['slate_like','tile'],allowDormers:false,allowGarageVariation:false,variations:[],randomisation:[],forbidden:['toute génération procédurale : modèle unique (Saint-Denis)']}),
 A('WATER_TOWER','château d’eau',{roofTypes:['complex','flat'],levels:[],wallHeightRangeM:[15,30],roofSlopeRangeDeg:[0,25],allowedRoofColors:['light_gray','white'],materials:['unknown'],allowDormers:false,allowGarageVariation:false,variations:[],randomisation:[],forbidden:['toute génération procédurale : modèle unique par ouvrage']}),
 A('SILO_TANK','silo / cuve cylindrique',{roofTypes:['flat','complex'],levels:[],wallHeightRangeM:[5,55],roofSlopeRangeDeg:[0,30],allowedRoofColors:['light_gray','white','dark_gray'],materials:['metal'],allowDormers:false,allowGarageVariation:false,variations:['batterie de cellules','bac d’hydrocarbures'],randomisation:['passerelles'],forbidden:['ajouter un faîtage à un cylindre']}),
 A('OTHER','structure particulière (tribune, auvent, abri ouvert)',{roofTypes:['flat','shed','gable','unknown'],levels:[],wallHeightRangeM:[2,8],roofSlopeRangeDeg:[0,30],allowedRoofColors:['light_gray','dark_gray','white'],materials:['metal','unknown'],allowDormers:false,allowGarageVariation:false,variations:['auvent sur poteaux','tribune'],randomisation:['poteaux']}),
 A('UNKNOWN','usage non établi',{roofTypes:['unknown','flat','gable'],levels:[],wallHeightRangeM:[2.5,6],roofSlopeRangeDeg:[0,45],allowedRoofColors:['light_gray','brown','dark_gray'],materials:['unknown'],allowDormers:false,allowGarageVariation:false,variations:['volume neutre'],randomisation:['aucune'],forbidden:['inventer un usage']})];
const counts=stats.byClass;
fs.writeFileSync(`${U}/building-archetypes.json`,JSON.stringify({metadata:{version:'2.3',generatedBy:meta.generatedBy,rule:'Un archétype ne fait pas la ressemblance : les attributs documentés (type de toit, faîtage, pente, hauteurs, couleur) priment toujours sur les plages ci-dessous, qui ne servent qu’à combler les inconnues.',seed:'variationSeed = FNV-1a 32 bits de l’identifiant du bâtiment (stable entre deux générations)'},
 archetypes:archetypes.map(a=>({...a,count:counts[a.id]||0}))},null,1)+'\n');

// ---------- geographic freeze exceptions (report only) ----------
const exRows=exceptions.map(x=>`| \`${x.id}\` | ${x.layer} | ${x.areaM2} | ${x.detail} | ${x.colour} |`).join('\n');
const mz=meas.metadata.maskedZone;
fs.writeFileSync('docs/audit/GEOGRAPHIC_FREEZE_EXCEPTIONS.md',`# V2.3 — Exceptions au gel géographique (constats, aucune correction)

> Généré par \`scripts/build-architecture.mjs\`. La V2.3 ne modifie **aucune** empreinte, position ni coordonnée :
> les cas ci-dessous sont seulement documentés pour une future passe géographique.

## 1. Site masqué dans les données IGN

- ${mz.buildings} empreintes du référentiel V1.6.2 (identifiants BD TOPO anciens \`BATIMENT00000000093586…\` / \`…93587…\`) se trouvent sur un site dont l’**orthophoto est servie en mosaïque** et dont le **LiDAR HD est interpolé** (bandes) : emprise approximative ${mz.areaHa} ha, Lambert-93 ${mz.boundsL93.join(' – ')} (entre la voie ferrée et la RD619, à l’est de la zone d’activités).
- Aucune mesure architecturale n’y est possible : type de toit, hauteurs et couleurs restent \`unknown\` (classe BD TOPO conservée).
- Les empreintes elles-mêmes datent de la BD TOPO (saisie ancienne) et **ne peuvent pas être vérifiées** sur les sources 2025 ; elles restent telles quelles.

## 2. Empreintes sans élévation sur le LiDAR HD 2025

${exceptions.length} empreintes (hors végétation dense et hors objets trop petits pour le LiDAR) ne portent **aucune élévation** mesurable sur le MNH LiDAR HD 2025 (vols de février et d’octobre 2025).
Causes possibles, **non tranchées** : bâtiment démoli, surface au sol (terrasse, cour, piscine), contour décalé, construction postérieure au vol.
Les relevés manuels V2.2 concernés (dont \`vis-A\`, \`vis-H1\`, \`vis-H2\`) sont signalés ici : leur toit plat observé sur l’orthophoto est conservé dans le profil, mais aucune hauteur n’est mesurée ; une vérification sur place est recommandée.

| Bâtiment | Couche | Surface (m²) | Constat LiDAR | Couleur ortho |
|---|---|---:|---|---|
${exRows}

## 3. Autres constats

- Château d’eau entre le bourg et Les Granges (\`way/588791386\`) : le LiDAR 2025 ne mesure que ≈ 12,6 m sur l’empreinte OSM (retours incomplets sur la cuve) ; la hauteur officielle BD TOPO de 27,6 m est retenue. L’empreinte OSM correspond au fût ; la cuve (plus large) est décrite dans \`landmark-architecture.json\`.
- Les écarts BD TOPO / LiDAR sur la hauteur à l’égout supérieurs à 3 m sont notés bâtiment par bâtiment dans \`public/data/building-architecture-v2.3.json\` (champ \`notes\`).
`);
console.log('landmarks',lmOut.length,JSON.stringify(Object.fromEntries(['unique_model','procedural_custom','procedural'].map(k=>[k,lmOut.filter(x=>x.modelingLevel===k).length]))),'exceptions',exceptions.length);
