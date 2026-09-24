// V1.6 building validation. Adds a `validation` block to every feature of public/data/buildings.geojson
// (geometry never modified) and writes data-sources/building-validation.json.
// Control sources, best first:
//   1. cadastre Etalab (data-sources/cadastre/…) and RNB (data-sources/rnb/…) when downloaded;
//   2. otherwise the local proxies: DGFiP cadastre footprints imported in OSM (tags "Mise à jour : 2013/2017/2018")
//      and the cadastre fields carried by BD TOPO (origine_du_batiment, appariement_fichiers_fonciers, date_d_apparition).
// Nothing is deleted without a documented proof; unresolved cases stay "litigieux".
import fs from 'node:fs';
import {projection,polygons,bounds,insidePoly} from '../src/geo.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const exists=p=>fs.existsSync(p);
const REF='public/data/buildings.geojson',CAD='data-sources/cadastre/cadastre-10220-batiments.geojson',RNB='data-sources/rnb/rnb-10220.json';
const ref=read(REF),osm=read('public/data/maizieres.geojson'),ign=read('data-sources/ign/batiment.geojson'),commune=read('public/data/commune.geojson');
const project=projection(osm.metadata.origin),border=polygons(commune,project),bb=bounds(border.flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const centreOf=poly=>{const b=bounds(poly[0]);return [(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2];};
const inCommune=c=>border.some(p=>insidePoly(c,p)),inExtent=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
const shape=(f,extra={})=>{const polys=polygons(f,project),s=prepareShape(polys);let perimeter=0;for(const r of polys[0])for(let i=1;i<r.length;i++)perimeter+=Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]);return {...s,f,c:centreOf(polys[0]),perimeter,...extra};};
function index(list,size=80){const g=new Map();for(const o of list)for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push(o);}
 return o=>{const out=new Set();for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++)for(const c of g.get(x+','+z)||[])if(intersects(o.b,c.b))out.add(c);return [...out];};}
// Links every shape of A to overlapping shapes of B with exact intersection areas.
function link(A,B){const near=index(B);for(const a of A){a.links=[];for(const b of near(a)){const x=intersectionArea(a,b);if(x>.01)a.links.push({o:b,a:x});}a.coverage=a.links.reduce((s,l)=>s+l.a,0)/a.area;}}
const iou=(a,l)=>l.a/(a.area+l.o.area-l.a);
const osmYear=f=>{const s=String(f.properties.source||'');const y=s.match(/Mise à jour : (\d{4})/)?.[1];return y?+y:/ORTHO Express IGN (\d{4})/.test(s)?+s.match(/ORTHO Express IGN (\d{4})/)[1]:null;};
const osmOrigin=f=>{const s=String(f.properties.source||'');return /cadastre/i.test(s)?'cadastre DGFiP (import OSM)':/ORTHO/i.test(s)?'orthophoto IGN':s?'autre':'non renseignée';};

const refS=ref.features.map(f=>shape(f,{id:f.properties.id,p:f.properties}));
const osmS=osm.features.filter(f=>f.properties.building).map(f=>shape(f,{id:f.id})).filter(o=>inExtent(o.c));
const ignById=new Map(ign.features.map(f=>[f.properties.cleabs,f.properties]));
const refIgn=refS.filter(r=>r.p.source==='IGN BD TOPO');

// ---- 1. Cadastre comparison (real cadastre if available, else OSM-imported cadastre proxy) ----
const realCadastre=exists(CAD);
const cadastre=realCadastre?read(CAD):null;
const cadS=realCadastre?cadastre.features.map((f,k)=>shape(f,{id:f.id||f.properties?.id||'cad-'+k})).filter(c=>inExtent(c.c)):osmS.filter(o=>/cadastre/i.test(String(o.f.properties.source||''))||o.f.properties.source==null);
link(cadS,refS);link(refS,cadS);
const cadClass=c=>c.coverage>=.5?'présent':c.coverage>=.1?'partiel':'absent';
const cadastreOnly=cadS.filter(c=>c.coverage<.1);
// With the real cadastre, footprints absent from the reference are added (source "Cadastre Etalab"); the proxy adds nothing new.
const added=[];
if(realCadastre)for(const c of cadastreOnly){const id='cadastre:'+c.id;if(ref.features.some(f=>f.id===id))continue;
 added.push({type:'Feature',id,geometry:c.f.geometry,properties:{id,source:'Cadastre Etalab (DGFiP)',provenance:'cadastre',inCommune:inCommune(c.c),areaM2:+c.area.toFixed(2),parts:1,holes:0,rnb:null,ign:null,osm:null,derived:null,cadastre:c.f.properties||{}}});}

// ---- 2. OSM footprints only partly covered by IGN (10–50 %): individual diagnosis ----
link(osmS,refIgn);
const partial=osmS.filter(o=>o.coverage>=.1&&o.coverage<.5).map(o=>{
 const unc=(1-o.coverage)*o.area,thickness=unc/Math.max(1,o.perimeter),year=osmYear(o.f),tags=o.f.properties;
 const igns=o.links.map(l=>({id:l.o.id,insideOsm:+(l.a/l.o.area).toFixed(2),iou:+iou(o,l).toFixed(2),igNModified:ignById.get(l.o.id)?.date_modification?.slice(0,10),ignOrigin:ignById.get(l.o.id)?.origine_du_batiment,ignApparition:ignById.get(l.o.id)?.date_d_apparition?.slice(0,4)||null}));
 const ignInside=igns.filter(i=>i.insideOsm>=.8).length;
 let cause,decision;
 if(unc<5||thickness<.5){cause='artefact : décalage de contour entre numérisations';decision='aucune action';}
 else if(unc<25&&!(year&&year>=2025)){cause='écart de contour modéré'+(tags.wall==='no'?' (construction légère)':'');decision='aucune action (écart < 25 m²)';}
 else if(year&&year>=2025){cause='géométrie OSM plus récente que la BD TOPO (tracé sur orthophoto '+year+')';decision='litigieux : extension probable à confirmer au cadastre';}
 else if(tags.wall==='no'){cause='construction légère du cadastre en partie absente de la BD TOPO';decision='litigieux : abri léger possiblement démoli ou non saisi';}
 else if(ignInside>=1&&unc>=25){cause='découpage différent : la BD TOPO ne reprend qu’une partie du bâtiment cadastral, le reste n’a pas d’équivalent';decision='litigieux : extension, annexe démolie ou omission IGN';}
 else if(unc>=25){cause='emprise cadastrale plus large que l’empreinte IGN (contour divergent)';decision='litigieux : différence de contour à arbitrer';}
 else{cause='écart de contour modéré';decision='aucune action (écart < 25 m²)';}
 return {id:o.id,inCommune:inCommune(o.c),areaM2:+o.area.toFixed(1),uncoveredM2:+unc.toFixed(1),coverage:+o.coverage.toFixed(2),meanUncoveredWidthM:+thickness.toFixed(2),osm:{building:tags.building,wall:tags.wall||null,name:tags.name||null,origin:osmOrigin(o.f),cadastreYear:year},ign:igns,cause,decision,position:o.c.map(v=>+v.toFixed(1))};
}).sort((a,b)=>b.uncoveredM2-a.uncoveredM2);

// ---- 3. OSM-only buildings (absent from BD TOPO) ----
const osmOnly=refS.filter(r=>r.p.provenance==='osm').map(r=>{const f=osm.features.find(o=>o.id===r.id),t=f.properties,year=osmYear(f);
 const nearestIgn=Math.min(...refIgn.filter(i=>Math.abs(i.c[0]-r.c[0])<200&&Math.abs(i.c[1]-r.c[1])<200).map(i=>Math.hypot(i.c[0]-r.c[0],i.c[1]-r.c[1])),Infinity);
 let status;
 if(t.wall==='no')status='construction légère au cadastre '+(year||'?')+', absente de la BD TOPO : démolie ou non saisie (litigieux)';
 else if(r.area<20)status='petite annexe au cadastre, sous le seuil de saisie habituel de la BD TOPO (plausible)';
 else if(year&&year>=2025)status='tracée sur orthophoto '+year+' : construction récente probable';
 else status='bâtiment du cadastre '+(year||'?')+' absent de la BD TOPO (litigieux)';
 return {id:r.id,inCommune:r.p.inCommune,areaM2:+r.area.toFixed(1),building:t.building,wall:t.wall||null,origin:osmOrigin(f),cadastreYear:year,nearestIgnM:Number.isFinite(nearestIgn)?Math.round(nearestIgn):null,status,position:r.c.map(v=>+v.toFixed(1))};}).sort((a,b)=>b.areaM2-a.areaM2);

// ---- 4. RNB ----
const rnbData=exists(RNB)?read(RNB):null,rnbIndex=rnbData?new Map(rnbData.buildings.map(b=>[b.rnb_id,b])):null;
const rnbOf=p=>p.rnb?String(p.rnb).split(/[\/,;|]/).map(s=>s.trim()).filter(Boolean):[];

// ---- 5. Per-building validation block and confidence ----
const partialByIgn=new Map();for(const x of partial)if(x.decision.startsWith('litigieux'))for(const i of x.ign)if(i.insideOsm>=.1||i.iou>=.1){if(!partialByIgn.has(i.id))partialByIgn.set(i.id,[]);partialByIgn.get(i.id).push(x.id);}
const osmOnlyById=new Map(osmOnly.map(o=>[o.id,o]));
const counts={A:0,B:0,C:0};const statuses={};
for(const r of refS){const p=r.p,ignP=p.ign,evidence=[];
 const best=r.links.sort((a,b)=>b.a-a.a)[0],cadIoU=best?+iou(r,best).toFixed(2):0;
 const cad=r.coverage>=.5?'présent':r.coverage>=.1?'partiel':'absent';
 evidence.push(`${realCadastre?'Cadastre Etalab':'Cadastre DGFiP importé dans OSM (2013–2018)'} : ${cad}${best?` (IoU ${cadIoU})`:''}`);
 if(ignP){evidence.push(`IGN : origine ${ignP.origin||'?'}, saisie ${String(ignP.created||'').slice(0,4)}, modifiée ${String(ignP.modified||'').slice(0,4)}`);const src=ignById.get(p.id);if(src?.appariement_fichiers_fonciers)evidence.push('Appariement fichiers fonciers '+src.appariement_fichiers_fonciers);}
 const rnbIds=rnbOf(p),rnbStatus=rnbIndex?rnbIds.map(id=>rnbIndex.get(id)?.status||'absent du RNB'):null;
 let confidence,status;
 if(p.source==='IGN BD TOPO'&&cad==='présent'){confidence='A';status='validé (IGN + cadastre)';}
 else if(p.source==='IGN BD TOPO'){confidence='B';status=cad==='partiel'?'source unique (contour cadastral partiel)':'source unique IGN (absent du cadastre de référence)';}
 else if(p.source==='OpenStreetMap'){confidence='C';status=osmOnlyById.get(p.id)?.status||'OSM seul';}
 else{confidence='B';status='ajouté depuis le cadastre';}
 if(partialByIgn.has(p.id)){status+=' ; contour divergent avec le cadastre ('+partialByIgn.get(p.id).join(', ')+')';if(confidence==='A')confidence='B';}
 const src=ignP?ignById.get(p.id):null,apparition=src?.date_d_apparition?+src.date_d_apparition.slice(0,4):null;
 p.validation={confidence,status,cadastre:{reference:realCadastre?'cadastre Etalab':'proxy OSM (cadastre DGFiP 2013–2018)',match:cad,iou:cadIoU,coverage:+r.coverage.toFixed(2)},rnb:{ids:rnbIds,status:rnbStatus},apparitionYear:apparition,recent:apparition!=null&&apparition>=2015||(ignP&&cad==='absent'&&+String(ignP.created).slice(0,4)>=2019),evidence};
 counts[confidence]++;statuses[status.split(' ;')[0]]=(statuses[status.split(' ;')[0]]||0)+1;
}
for(const f of added){f.properties.validation={confidence:'B',status:'ajouté depuis le cadastre',cadastre:{reference:'cadastre Etalab',match:'source'},rnb:{ids:[],status:null},evidence:['Absent de la BD TOPO et d’OSM']};}
ref.features.push(...added);
const C=ref.features.filter(f=>f.properties.inCommune),P=f=>f.properties;
const report={generatedAt:new Date().toISOString(),controlSources:{cadastre:realCadastre?cadastre.metadata:{status:'non téléchargé : accès réseau refusé (cadastre.data.gouv.fr)',proxy:'empreintes du cadastre DGFiP importées dans OSM (source « Mise à jour : 2013 / 2017 / 2018 ») + champs cadastraux de la BD TOPO'},rnb:rnbData?rnbData.metadata:{status:'API non consultée : accès réseau refusé (rnb-api.beta.gouv.fr)',proxy:'identifiants RNB fournis par la BD TOPO (identifiants_rnb)'}},
 indicators:{
  ign:{inExtent:refIgn.length,inCommune:refIgn.filter(r=>r.p.inCommune).length},osm:{inExtent:osmS.length,inCommune:osmS.filter(o=>inCommune(o.c)).length},
  cadastre:{reference:realCadastre?'cadastre Etalab':'proxy OSM',inExtent:cadS.length,inCommune:cadS.filter(c=>inCommune(c.c)).length,presentInReference:cadS.filter(c=>cadClass(c)==='présent').length,partial:cadS.filter(c=>cadClass(c)==='partiel').length,absentFromReference:cadastreOnly.length},
  rnb:{withId:ref.features.filter(f=>rnbOf(P(f)).length).length,withIdInCommune:C.filter(f=>rnbOf(P(f)).length).length,multipleIds:ref.features.filter(f=>rnbOf(P(f)).length>1).length,verifiedAgainstApi:!!rnbData},
  final:{total:ref.features.length,inCommune:C.length,byConfidence:counts,inCommuneByConfidence:C.reduce((m,f)=>(m[P(f).validation.confidence]=(m[P(f).validation.confidence]||0)+1,m),{})},
  addedFromCadastre:added.length,removedWithProof:0,corrected:0,
  disputed:{osmOnly:osmOnly.filter(o=>/litigieux/.test(o.status)).length,osmOnlyInCommune:osmOnly.filter(o=>/litigieux/.test(o.status)&&o.inCommune).length,partialOver25:partial.filter(x=>x.decision.startsWith('litigieux')).length,ignWithDivergentContour:partialByIgn.size},
  withoutMatch:{ignWithoutCadastre:refIgn.filter(r=>r.coverage<.1).length,ignWithoutCadastreInCommune:refIgn.filter(r=>r.coverage<.1&&r.p.inCommune).length,osmOnly:osmOnly.length},
  unresolvedGeometry:{partialOsm:partial.length,partialOver25m2:partial.filter(x=>x.uncoveredM2>25).length,uncoveredM2:Math.round(partial.reduce((s,x)=>s+x.uncoveredM2,0))},
  recent:{apparitionSince2015:refIgn.filter(r=>r.p.validation.apparitionYear>=2015).length,ignOnlyCreatedSince2019:refIgn.filter(r=>r.p.provenance==='ign'&&+String(r.p.ign.created).slice(0,4)>=2019).length},
  statuses},
 partialOsm:partial,osmOnly,ignWithoutCadastre:refIgn.filter(r=>r.coverage<.1).map(r=>({id:r.id,areaM2:+r.area.toFixed(1),inCommune:r.p.inCommune,ignOrigin:r.p.ign.origin,created:String(r.p.ign.created).slice(0,10),apparition:r.p.validation.apparitionYear,usage:r.p.ign.usage1,light:r.p.ign.lightConstruction,rnb:r.p.rnb,position:r.c.map(v=>+v.toFixed(1))})).sort((a,b)=>b.areaM2-a.areaM2),
 cadastreOnly:cadastreOnly.map(c=>({id:c.id,areaM2:+c.area.toFixed(1),position:c.c.map(v=>+v.toFixed(1))}))};
ref.metadata.validation={generatedBy:'scripts/validate-buildings.mjs',cadastre:realCadastre?'cadastre Etalab':'proxy : cadastre DGFiP importé dans OSM + champs cadastraux BD TOPO',rnb:rnbData?'API RNB':'identifiants RNB de la BD TOPO (non vérifiés contre l’API)',confidence:{A:'Géométrie IGN confirmée par le cadastre (couverture ≥ 50 %)',B:'Une seule source officielle, ou contour divergent',C:'Empreinte OSM/cadastre ancien absente de la BD TOPO'}};
ref.metadata.fields.validation='Bloc de validation V1.6 : confiance A/B/C, statut, correspondance cadastrale (IoU, couverture), RNB, année d’apparition fichiers fonciers, preuves';
fs.writeFileSync(REF,JSON.stringify(ref));
fs.writeFileSync('data-sources/building-validation.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify(report.indicators,null,1));
