// V1.6.1 official building validation. Input: public/data/buildings.geojson as produced by build-buildings.mjs.
// Control sources (official, downloaded by fetch-validation-sources.mjs):
//   - current cadastre: Etalab export, or Parcellaire Express (PCI DGFiP via IGN) — data-sources/cadastre/;
//   - RNB API snapshot — data-sources/rnb/rnb-10220.json.
// Without both files the script stops: no historical substitute is used any more.
// Geometry is never modified. Removals require absence from BD TOPO, the current cadastre and the RNB;
// every removal is logged with its geometry in data-sources/building-removed.json.
// V1.6.2 (freeze before Unreal): the individual review of data-sources/building-review-v1.6.2.json (BD ORTHO IGN 2025
// photo-interpretation of every doubtful case) is applied here, so `npm run data:buildings` stays reproducible.
import fs from 'node:fs';
import polygonClipping from 'polygon-clipping';
import {projection,polygons,bounds,insidePoly} from '../src/geo.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const exists=p=>fs.existsSync(p);
const REF='public/data/buildings.geojson',ETALAB='data-sources/cadastre/cadastre-10220-batiments.geojson',PCI='data-sources/cadastre/pci-express-batiment.geojson',RNB='data-sources/rnb/rnb-10220.json',REVIEW='data-sources/building-review-v1.6.2.json';
const REV=exists(REVIEW)?read(REVIEW):{rnbOrphans:{},extensions:{},cadastralAdditions:{},osmOnly:{}};
const CAD=exists(ETALAB)?ETALAB:exists(PCI)?PCI:null;
if(!CAD||!exists(RNB)){console.error('Sources officielles absentes (cadastre actuel et/ou RNB) : lancer npm run data:validation-sources. Aucun substitut historique n’est utilisé.');process.exit(1);}
const ref=read(REF),osm=read('public/data/maizieres.geojson'),ign=read('data-sources/ign/batiment.geojson'),commune=read('public/data/commune.geojson'),cadastre=read(CAD),rnb=read(RNB);
const cadName=CAD===ETALAB?'Cadastre Etalab (DGFiP)':'Parcellaire Express (PCI DGFiP, IGN)';
const project=projection(osm.metadata.origin),border=polygons(commune,project),bb=bounds(border.flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const centreOf=poly=>{const b=bounds(poly[0]);return [(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2];};
const inCommune=c=>border.some(p=>insidePoly(c,p)),inExtent=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
const shape=(f,extra={})=>{const polys=polygons(f,project),s=prepareShape(polys);return {...s,f,polys,c:centreOf(polys[0]),...extra};};
function index(list,size=80){const g=new Map();for(const o of list)for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push(o);}
 return o=>{const out=new Set();for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++)for(const c of g.get(x+','+z)||[])if(intersects(o.b,c.b))out.add(c);return [...out];};}
// Exact overlaps of every shape of A with shapes of B (key = property name for the link list).
function link(A,B,key){const near=index(B);for(const a of A){a[key]=[];for(const b of near(a)){const x=intersectionArea(a,b);if(x>.01)a[key].push({o:b,a:x});}a[key+'Cov']=a[key].reduce((s,l)=>s+l.a,0)/a.area;}}
const iou=(a,l)=>l.a/(a.area+l.o.area-l.a);
const cls=v=>v>=.5?'présent':v>=.1?'partiel':'absent';
const osmYear=f=>{const s=String(f.properties.source||'');return +(s.match(/Mise à jour : (\d{4})/)?.[1]||s.match(/ORTHO Express IGN (\d{4})/)?.[1]||0)||null;};

const refS=ref.features.map(f=>shape(f,{id:f.properties.id,p:f.properties}));
const cadS=cadastre.features.map((f,k)=>shape(f,{id:'cadastre:'+(f.properties?.gid??f.id??k),type:f.properties?.type||null,insee:f.properties?.code_insee||null})).filter(c=>inExtent(c.c));
const osmS=osm.features.filter(f=>f.properties.building).map(f=>shape(f,{id:f.id})).filter(o=>inExtent(o.c));
const ignById=new Map(ign.features.map(f=>[f.properties.cleabs,f.properties]));
link(refS,cadS,'cad');link(cadS,refS,'ref');link(osmS,cadS,'cad');link(osmS,refS.filter(r=>r.p.source==='IGN BD TOPO'),'ign');

// ---- RNB ----
const rnbAll=new Map();for(const b of rnb.buildings)rnbAll.set(b.rnb_id,b);for(const [id,b] of Object.entries(rnb.lookups||{}))if(!b.notFound)rnbAll.set(id,b);
const notFound=new Set(Object.entries(rnb.lookups||{}).filter(([,b])=>b.notFound).map(([id])=>id));
const activeByCleabs=new Map();for(const b of rnbAll.values())if(b.is_active&&b.status==='constructed')for(const e of b.ext_ids||[])if(e.source==='bdtopo'){if(!activeByCleabs.has(e.id))activeByCleabs.set(e.id,new Set());activeByCleabs.get(e.id).add(b.rnb_id);}
const rnbPoint=b=>b.point?project(b.point.coordinates):null;
const rnbShape=b=>b.shape&&['Polygon','MultiPolygon'].includes(b.shape.type)?prepareShape(polygons({geometry:b.shape},project)):null;
const splitIds=v=>String(v||'').split(/[\/,;|]/).map(s=>s.trim()).filter(Boolean);
// Spatial coherence of one RNB building with one reference footprint.
function coherence(b,r){const p=rnbPoint(b);const inside=p?r.polys.some(poly=>insidePoly(p,poly)):false;let overlap=0;const s=rnbShape(b);if(s&&intersects(s.b,r.b))overlap=intersectionArea(s,r)/Math.min(s.area,r.area);return {pointInside:inside,overlap:+overlap.toFixed(2),coherent:inside||overlap>=.5};}
function checkRnb(r){
 const original=r.p.source==='IGN BD TOPO'?splitIds(ignById.get(r.id)?.identifiants_rnb):splitIds(r.p.rnb),checks=[];
 for(const id of original){const b=rnbAll.get(id);
  if(!b){checks.push({id,verdict:notFound.has(id)?'inconnu du RNB':'non vérifié'});continue;}
  const c=coherence(b,r);
  const verdict=!b.is_active?'inactif (identifiant retiré)':b.status!=='constructed'?'statut '+b.status:c.coherent?'valide':'incohérent spatialement';
  checks.push({id,verdict,status:b.status,active:b.is_active,...c,bdtopoLink:(b.ext_ids||[]).some(e=>e.source==='bdtopo'&&e.id===r.id)});}
 // Exact replacement: active RNB buildings that list this BD TOPO object in their own ext_ids.
 const exact=r.p.source==='IGN BD TOPO'?[...(activeByCleabs.get(r.id)||[])]:[];
 const valid=checks.filter(c=>c.verdict==='valide').map(c=>c.id),added=exact.filter(id=>!valid.includes(id)&&coherence(rnbAll.get(id),r).coherent);
 const final=[...new Set([...valid,...added])];
 return {original,checks,final,added,corrected:original.length>0&&(original.some(id=>!final.includes(id))||added.length>0),demolished:checks.some(c=>c.status==='demolished')};
}

// ---- Cadastre-only footprints (absent from the reference) ----
// A cadastral footprint with no overlap may still be the same object digitised a few metres away:
// a reference building of similar area nearby, which has no cadastral counterpart of its own, is its likely twin.
const cadAbsent=cadS.filter(c=>c.refCov<.1),twins=[];
const cadOnly=cadAbsent.filter(c=>{const reach=Math.max(6,1.5*Math.sqrt(c.area));const t=refS.find(r=>r.cadCov<.5&&Math.hypot(r.c[0]-c.c[0],r.c[1]-c.c[1])<=reach&&r.area/c.area>=.6&&r.area/c.area<=1.67);
 if(t){twins.push({cadastre:c.id,areaM2:+c.area.toFixed(1),type:c.type,twin:t.id,twinAreaM2:+t.area.toFixed(1),distanceM:+Math.hypot(t.c[0]-c.c[0],t.c[1]-c.c[1]).toFixed(1),inCommune:inCommune(c.c)});return false;}return true;});
const rnbActive=[...rnbAll.values()].filter(b=>b.is_active&&b.status==='constructed');
function rnbInside(s){return rnbActive.filter(b=>{const p=rnbPoint(b);return p&&p[0]>=s.b.minX&&p[0]<=s.b.maxX&&p[1]>=s.b.minZ&&p[1]<=s.b.maxZ&&s.polys.some(poly=>insidePoly(p,poly));});}
// V1.6.2: each cadastral addition was checked on the BD ORTHO 2025; non-built footprints (parking bays, vanished tanks,
// slabs, lawns) and slivers under 1 m wide are withdrawn with their evidence, visible ones gain the orthophoto as proof.
const withdrawn=[];
const added=cadOnly.map(c=>{const r=rnbInside(c),id=c.id,rev=REV.cadastralAdditions[id];
 const evidence=[`${cadName} : type « ${c.type||'?'} »`,'BD TOPO : absent (< 10 % de couverture)',r.length?`RNB : ${r.length} bâtiment(s) actif(s) dont le point est dans l’empreinte`:'RNB : aucun point actif dans l’empreinte'];
 if(rev)evidence.push(`${REV.orthophoto.name} : ${rev.observation}`);
 const visible=rev?.verdict==='bâti visible',confidence=r.length||visible?'B':'C';
 const status=r.length?'ajouté : cadastre actuel + RNB actif, absent de la BD TOPO':visible?'ajouté : cadastre actuel, bâti visible sur l’orthophoto IGN 2025, absent de la BD TOPO':'ajouté : cadastre actuel seul, absent de la BD TOPO et du RNB';
 const f={type:'Feature',id,geometry:c.f.geometry,properties:{id,source:cadName,provenance:'cadastre',inCommune:inCommune(c.c),areaM2:+c.area.toFixed(2),parts:c.polys.length,holes:c.polys.reduce((n,p)=>n+p.length-1,0),rnb:r.map(b=>b.rnb_id).join('/')||null,ign:null,osm:null,derived:{wallHeight:null,roofHeight:null,floors:null,roofMaterials:[],roofMaterialCode:null,wallMaterialCode:null,usage:null,nature:null,lightConstruction:c.type==='Construction légère',heightAccuracy:null},cadastre:{type:c.type,codeInsee:c.insee},
  validation:{confidence,status,cadastre:{reference:cadName,match:'source'},rnb:{ids:r.map(b=>b.rnb_id),checks:r.map(b=>({id:b.rnb_id,verdict:'valide',status:b.status,active:b.is_active,pointInside:true})),corrected:false},review:rev?{verdict:rev.verdict,observation:rev.observation}:null,evidence}}};
 if(rev?.action==='retirer'){withdrawn.push({feature:f,reason:rev.verdict+' : '+rev.observation,evidence});return null;}
 return f;}).filter(Boolean);

// ---- Per-building decisions ----
const history=[],removed=[],counts={A:0,B:0,C:0};
const osmById=new Map(osmS.map(o=>[o.id,o]));
// V1.6 partial OSM cases: does the current cadastre cover the part that BD TOPO misses?
const partial=osmS.filter(o=>o.ignCov>=.1&&o.ignCov<.5).map(o=>{const unc=(1-o.ignCov)*o.area,extra=(o.cadCov-o.ignCov)*o.area;
 const verdict=unc<25?'écart mineur (< 25 m²)':extra>=25?'extension ou emprise confirmée par le cadastre actuel, absente de la BD TOPO':o.cadCov<.1?'emprise OSM absente du cadastre actuel : tracé OSM/cadastre ancien périmé':'cadastre actuel proche de l’empreinte IGN : partie OSM non confirmée';
 return {id:o.id,inCommune:inCommune(o.c),areaM2:+o.area.toFixed(1),uncoveredByIgnM2:+unc.toFixed(1),ignCoverage:+o.ignCov.toFixed(2),cadastreCoverage:+o.cadCov.toFixed(2),cadastreExtraM2:+extra.toFixed(1),osmYear:osmYear(o.f),wall:o.f.properties.wall||null,verdict,review:REV.extensions[o.id]||null,ign:o.ign.map(l=>l.o.id),position:o.c.map(v=>+v.toFixed(1))};}).sort((a,b)=>b.uncoveredByIgnM2-a.uncoveredByIgnM2);
// V1.6.2: only doubtful (or unreviewed) extensions remain a contradiction; offsets and non-built parts are not,
// and real extensions seen on the orthophoto are merged into the final footprint below.
const extensionByIgn=new Map(),extensionNotes=new Map(),integrate=new Map();
for(const x of partial)if(x.verdict.startsWith('extension'))for(const id of x.ign){const rv=x.review;
 if(rv?.action==='intégrer'&&rv.ign===id){integrate.set(id,{...rv,osm:x.id});continue;}
 if(rv&&rv.action!=='intégrer'&&rv.verdict!=='douteux'){if(!extensionNotes.has(id))extensionNotes.set(id,[]);extensionNotes.get(id).push(`Revue V1.6.2 (${x.id}) : ${rv.verdict} — ${rv.observation}`);continue;}
 if(!extensionByIgn.has(id))extensionByIgn.set(id,[]);extensionByIgn.get(id).push(x.id);}

const twinOf=new Map(twins.map(t=>[t.twin,t]));
// Provisional V1.6 classes (historic cadastral proxy), kept to document every class change.
const V16=exists('data-sources/building-validation-v1.6.json')?read('data-sources/building-validation-v1.6.json').buildings:{};
const previousStatus=new Map(refS.map(r=>[r.id,V16[r.id]?.status||null]));
for(const r of refS){const p=r.p,before=V16[r.id]?.confidence||null,twin=r.cadCov<.1?twinOf.get(r.id):null,cad=twin?'décalé':cls(r.cadCov),best=r.cad.sort((a,b)=>b.a-a.a)[0],cadIoU=best?+iou(r,best).toFixed(2):0,rn=checkRnb(r),evidence=[];
 evidence.push(`${cadName} : ${cad} (couverture ${(r.cadCov*100).toFixed(0)} %${best?`, IoU ${cadIoU}`:''})`);
 if(twin)evidence.push(`${cadName} : empreinte équivalente (${twin.areaM2} m², ${twin.type}) décalée de ${twin.distanceM} m, sans autre contrepartie`);
 if(rn.checks.length)evidence.push('RNB : '+rn.checks.map(c=>`${c.id} ${c.verdict}`).join(' ; '));
 if(rn.added.length)evidence.push('RNB : identifiant(s) actif(s) lié(s) à cet objet BD TOPO dans le RNB : '+rn.added.join(', '));
 let confidence,status;
 if(p.source==='IGN BD TOPO'){
  const ip=ignById.get(r.id);evidence.push(`IGN : origine ${ip.origine_du_batiment}, saisie ${String(ip.date_creation).slice(0,4)}, modifiée ${String(ip.date_modification).slice(0,4)}`);
  const contradictions=[];if(rn.demolished)contradictions.push('RNB : identifiant au statut démoli');if(extensionByIgn.has(r.id))contradictions.push('extension cadastrale absente de la BD TOPO ('+extensionByIgn.get(r.id).join(', ')+')');
  for(const n of extensionNotes.get(r.id)||[])evidence.push(n);
  if(integrate.has(r.id)){confidence='A';status='validé : BD TOPO enrichie de l’extension du cadastre actuel visible sur l’orthophoto IGN 2025';}
  else if(cad==='présent'&&!contradictions.length){confidence='A';status='validé : BD TOPO et cadastre actuel concordent';}
  else if(cad==='présent'){confidence='B';status='présent au cadastre actuel, mais '+contradictions.join(' ; ');}
  else if(cad==='partiel'){confidence='B';status='contour différent du cadastre actuel'+(contradictions.length?' ; '+contradictions.join(' ; '):'');}
  else if(cad==='décalé'){confidence='B';status='présent au cadastre actuel avec un décalage de '+twin.distanceM+' m';}
  else{confidence='B';status=rn.final.length?'absent du cadastre actuel ; confirmé par le RNB':'absent du cadastre actuel (BD TOPO seule)';}
 }else{// OpenStreetMap-only footprint
  const o=osmById.get(r.id),rin=rnbInside(r),rv=REV.osmOnly[r.id];evidence.push(`BD TOPO : absent ; OSM ${o?.f.properties.source?String(o.f.properties.source).slice(0,60):'sans source'}`);
  if(rin.length)evidence.push('RNB : point(s) actif(s) dans l’empreinte : '+rin.map(b=>b.rnb_id).join(', '));
  if(rv)evidence.push(`${REV.orthophoto.name} : ${rv.observation}`);
  // V1.6.2: an OSM-only footprint that the 2025 orthophoto shows as not built is withdrawn, whatever the stale cadastre says.
  if(rv?.action==='retirer'){removed.push({feature:ref.features.find(f=>f.properties.id===r.id),reason:rv.verdict+' : absent de la BD TOPO et non bâti sur l’orthophoto IGN 2025 (cadastre '+cad+')',evidence,version:'1.6.2'});continue;}
  if(cad==='présent'){confidence='B';status='confirmé par le cadastre actuel (absent de la BD TOPO)';}
  else if(cad==='partiel'){confidence='C';status='partiellement au cadastre actuel, absent de la BD TOPO';}
  else if(cad==='décalé'){confidence='C';status='absent de la BD TOPO ; cadastre actuel : empreinte équivalente décalée de '+twin.distanceM+' m';}
  else if(rin.length){confidence='C';status='absent du cadastre actuel et de la BD TOPO, mais point RNB actif';}
  else{removed.push({feature:ref.features.find(f=>f.properties.id===r.id),reason:'absent de la BD TOPO, du cadastre actuel ('+cadName+') et du RNB : construction disparue ou tracé erroné',evidence,version:'1.6.1'});continue;}
 }
 if(before&&before!==confidence)history.push({id:r.id,from:before,to:confidence,reason:status});
 p.rnbSource=p.rnb;p.rnb=rn.final.join('/')||null;
 p.validation={confidence,status,cadastre:{reference:cadName,match:cad,iou:cadIoU,coverage:+r.cadCov.toFixed(2)},rnb:{ids:rn.final,original:rn.original,checks:rn.checks,added:rn.added,corrected:rn.corrected},previousConfidence:before,evidence};
}
const removedIds=new Set(removed.map(x=>x.feature.properties.id));
ref.features=ref.features.filter(f=>!removedIds.has(f.properties.id)).concat(added);

// ---- V1.6.2 geometry enrichment: BD TOPO footprint ∪ cadastral polygon, only for extensions seen on the orthophoto ----
// The original BD TOPO geometry is kept in geometryEnrichment.ignGeometry; attributes (heights) stay those of the BD TOPO part.
const flat=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(c=>[c[0],c[1]])));
const cadByGid=new Map(cadastre.features.map(f=>['cadastre:'+(f.properties?.gid??f.id),f]));
const enriched=[];
for(const [id,rv] of integrate){const f=ref.features.find(x=>x.properties.id===id),cf=cadByGid.get(rv.cadastre);if(!f||!cf)throw new Error('Extension introuvable : '+id+' / '+rv.cadastre);
 const u=polygonClipping.union(flat(f.geometry),flat(cf.geometry)),ignArea=f.properties.areaM2;
 const ignGeometry=f.geometry;f.geometry=u.length===1?{type:'Polygon',coordinates:u[0]}:{type:'MultiPolygon',coordinates:u};
 const area=prepareShape(polygons(f,project)).area;f.properties.areaM2=+area.toFixed(2);f.properties.parts=u.length;f.properties.holes=u.reduce((n,p)=>n+p.length-1,0);
 f.properties.geometryEnrichment={source:cadName,cadastre:rv.cadastre,osm:rv.osm,ignAreaM2:ignArea,addedAreaM2:+(area-ignArea).toFixed(2),observation:rv.observation,heightNote:'hauteurs BD TOPO mesurées sur la seule partie BD TOPO',ignGeometry};
 f.properties.validation.evidence.push(`Revue V1.6.2 : extension ${rv.cadastre} (${(area-ignArea).toFixed(0)} m²) intégrée — ${REV.orthophoto.name} : ${rv.observation}`);
 enriched.push({id,cadastre:rv.cadastre,osm:rv.osm,ignAreaM2:ignArea,finalAreaM2:+area.toFixed(2),inCommune:f.properties.inCommune});}

// ---- V1.6.2 RNB associations decided by the individual review of the RNB buildings without footprint ----
const associated=[];
for(const [rid,rv] of Object.entries(REV.rnbOrphans))if(rv.action==='associer'){const f=ref.features.find(x=>x.properties.id===rv.target),b=rnbAll.get(rid);if(!f||!b)throw new Error('Association RNB impossible : '+rid);
 const v=f.properties.validation,c={id:rid,verdict:'valide (revue individuelle V1.6.2)',status:b.status,active:b.is_active,...coherence(b,shape(f)),bdtopoLink:(b.ext_ids||[]).some(e=>e.source==='bdtopo'&&e.id===f.properties.id),review:rv.evidence};
 v.rnb.checks=v.rnb.checks.filter(x=>x.id!==rid).concat(c);if(!v.rnb.ids.includes(rid))v.rnb.ids.push(rid);v.rnb.corrected=true;f.properties.rnb=v.rnb.ids.join('/');
 v.evidence.push(`RNB : ${rid} associé après revue individuelle V1.6.2 (${rv.category})`);associated.push({rnb:rid,target:rv.target,category:rv.category});}
for(const f of ref.features)counts[f.properties.validation.confidence]++;

// ---- RNB-only: active RNB buildings of the commune not inside any final footprint ----
const finalS=ref.features.map(f=>shape(f,{id:f.properties.id}));const nearFinal=index(finalS,60);
// Covered if its point is inside a final footprint, or if its own shape is at least half covered by final footprints.
const rnbOnly=rnb.buildings.filter(b=>b.is_active&&b.status==='constructed').filter(b=>{const p=rnbPoint(b);if(!p)return false;const probe={b:{minX:p[0]-.5,maxX:p[0]+.5,minZ:p[1]-.5,maxZ:p[1]+.5}};if(nearFinal(probe).some(s=>s.polys.some(poly=>insidePoly(p,poly))))return false;
 const sh=rnbShape(b);if(sh&&nearFinal(sh).reduce((a,s)=>a+intersectionArea(sh,s),0)/sh.area>=.5)return false;return true;})
 .filter(b=>!associated.some(a=>a.rnb===b.rnb_id))
 .map(b=>{const p=rnbPoint(b),s=rnbShape(b),rv=REV.rnbOrphans[b.rnb_id];return {rnb:b.rnb_id,areaM2:s?+s.area.toFixed(1):null,addresses:(b.addresses||[]).map(a=>[a.street_number,a.street].filter(Boolean).join(' ')),extIds:(b.ext_ids||[]).map(e=>e.source+':'+e.id),position:p.map(v=>+v.toFixed(1)),review:rv?{category:rv.category,resolved:rv.resolved,evidence:rv.evidence}:null};});

const F=ref.features.map(f=>f.properties),C=F.filter(p=>p.inCommune);
// Re-examination of the three V1.6 uncertain groups with the official sources.
const outcome=id=>{if(removedIds.has(id))return removed.find(x=>x.feature.properties.id===id).version==='1.6.2'?'supprimé (non bâti sur l’orthophoto 2025)':'supprimé (absent BD TOPO, cadastre actuel, RNB)';const f=ref.features.find(x=>x.properties.id===id);return f?f.properties.validation.confidence+' — '+f.properties.validation.status.split(' ;')[0]:'?';};
const tally=ids=>ids.reduce((m,id)=>{const k=outcome(id);m[k]=(m[k]||0)+1;return m;},{});
const v16OsmDisputed=[...previousStatus].filter(([id,st])=>st&&/litigieux/.test(st)&&refS.find(r=>r.id===id)?.p.source==='OpenStreetMap').map(([id])=>id);
const v16IgnNoCad=[...previousStatus].filter(([id,st])=>st&&/absent du cadastre de référence/.test(st)&&refS.find(r=>r.id===id)?.p.inCommune).map(([id])=>id);
const v16Review={osmOnlyDisputed:{count:v16OsmDisputed.length,outcome:tally(v16OsmDisputed)},ignAbsentFromCadastre2018InCommune:{count:v16IgnNoCad.length,outcome:tally(v16IgnNoCad)},partialOver25:{count:partial.filter(x=>x.uncoveredByIgnM2>=25).length,verdicts:partial.filter(x=>x.uncoveredByIgnM2>=25).reduce((m,x)=>(m[x.verdict]=(m[x.verdict]||0)+1,m),{})}};
const rnbChecks=F.flatMap(p=>p.validation.rnb?.checks||[]);
// V1.6.2 freeze summary: what the individual review changed, and what is left open.
const V161=exists('data-sources/building-validation-v1.6.1.json')?read('data-sources/building-validation-v1.6.1.json').buildings:{};
const changes161=ref.features.filter(f=>V161[f.properties.id]&&V161[f.properties.id].confidence!==f.properties.validation.confidence).map(f=>({id:f.properties.id,from:V161[f.properties.id].confidence,to:f.properties.validation.confidence,reason:f.properties.validation.status}));
const rnbReviewCats=Object.values(REV.rnbOrphans).reduce((m,r)=>(m[r.category]=(m[r.category]||0)+1,m),{});
const extReview=partial.filter(x=>x.review).reduce((m,x)=>(m[x.review.verdict]=(m[x.review.verdict]||0)+1,m),{});
const addReview=Object.values(REV.cadastralAdditions).reduce((m,r)=>(m[r.verdict]=(m[r.verdict]||0)+1,m),{});
const osmReview=Object.values(REV.osmOnly).reduce((m,r)=>(m[r.verdict]=(m[r.verdict]||0)+1,m),{});
const removed162=removed.filter(x=>x.version==='1.6.2');
const v162={version:'1.6.2',orthophoto:REV.orthophoto,etalab:REV.etalab,
 rnbOrphans:{reviewed:Object.keys(REV.rnbOrphans).length,categories:rnbReviewCats,associated,newBuildings:Object.values(REV.rnbOrphans).filter(r=>r.action==='ajouter').length,unresolved:Object.entries(REV.rnbOrphans).filter(([,r])=>!r.resolved).map(([id,r])=>({rnb:id,category:r.category,evidence:r.evidence})),stillWithoutFootprint:rnbOnly.length,unreviewedWithoutFootprint:rnbOnly.filter(x=>!x.review).map(x=>x.rnb)},
 extensions:{reviewed:partial.filter(x=>x.review).length,verdicts:extReview,integrated:enriched},
 cadastralAdditions:{reviewed:Object.keys(REV.cadastralAdditions).length,verdicts:addReview,withdrawn:withdrawn.length,withdrawnInCommune:withdrawn.filter(x=>x.feature.properties.inCommune).length,kept:added.length,keptInCommune:added.filter(f=>f.properties.inCommune).length},
 osmOnly:{reviewed:Object.keys(REV.osmOnly).length,verdicts:osmReview,withdrawn:removed162.length,withdrawnInCommune:removed162.filter(x=>x.feature.properties.inCommune).length},
 confidenceChangesSinceV161:{total:changes161.length,byChange:changes161.reduce((m,h)=>{const k=h.from+'→'+h.to;m[k]=(m[k]||0)+1;return m;},{}),list:changes161},
 unresolved:{rnbWithoutFootprint:Object.values(REV.rnbOrphans).filter(r=>!r.resolved).length,doubtfulExtensions:partial.filter(x=>x.review?.verdict==='douteux').length,unverifiableAdditions:added.filter(f=>f.properties.validation.confidence==='C').length,unverifiableOsmOnly:Object.values(REV.osmOnly).filter(r=>r.verdict==='non vérifiable').length}};
const report={generatedAt:new Date().toISOString(),controlSources:{cadastre:{...cadastre.metadata,file:CAD},rnb:{...rnb.metadata,file:RNB},orthophoto:REV.orthophoto,review:REVIEW},
 indicators:{
  previous:{total:2491,inCommune:2259,byConfidence:{A:1992,B:337,C:162},note:'V1.6 provisoire (substitut cadastral OSM 2013–2018)'},
  v161:{total:2543,inCommune:2299,byConfidence:{A:1984,B:466,C:93},inCommuneByConfidence:{A:1849,B:384,C:66},note:'V1.6.1 (cadastre actuel et RNB, avant revue orthophoto)'},
  sources:{ign:{inExtent:refS.filter(r=>r.p.source==='IGN BD TOPO').length,inCommune:refS.filter(r=>r.p.source==='IGN BD TOPO'&&r.p.inCommune).length},osm:{inExtent:osmS.length,inCommune:osmS.filter(o=>inCommune(o.c)).length},
   cadastre:{name:cadName,inExtent:cadS.length,inCommune:cadS.filter(c=>c.insee==='10220'||(!c.insee&&inCommune(c.c))).length,byType:cadS.reduce((m,c)=>(m[c.type]=(m[c.type]||0)+1,m),{}),coveredByReference:cadS.filter(c=>c.refCov>=.5).length,partial:cadS.filter(c=>c.refCov>=.1&&c.refCov<.5).length,absentFromReference:cadAbsent.length,probableOffsetTwins:twins.length,addedAsMissing:cadOnly.length},
   rnb:{communeBuildings:rnb.buildings.length,individualLookups:Object.keys(rnb.lookups||{}).length}},
  final:{total:ref.features.length,inCommune:C.length,byConfidence:counts,inCommuneByConfidence:C.reduce((m,p)=>(m[p.validation.confidence]=(m[p.validation.confidence]||0)+1,m),{}),byProvenance:F.reduce((m,p)=>(m[p.provenance]=(m[p.provenance]||0)+1,m),{})},
  addedFromCadastre:{total:added.length,inCommune:added.filter(f=>f.properties.inCommune).length,withRnb:added.filter(f=>f.properties.rnb).length,visibleOnOrthophoto:added.filter(f=>f.properties.validation.review?.verdict==='bâti visible').length,withdrawnAfterReview:withdrawn.length},
  removed:{total:removed.length,inCommune:removed.filter(x=>x.feature.properties.inCommune).length,v161:removed.length-removed162.length,v162OsmOnly:removed162.length,v162CadastralAdditionsWithdrawn:withdrawn.length},
  corrected:{rnbIdentifiers:F.filter(p=>p.validation.rnb?.corrected).length,confidenceChanges:history.length,geometriesEnriched:enriched.length},
  rnb:{withVerifiedId:F.filter(p=>p.validation.rnb?.ids?.length).length,withVerifiedIdInCommune:C.filter(p=>p.validation.rnb?.ids?.length).length,
   checks:rnbChecks.reduce((m,c)=>(m[c.verdict]=(m[c.verdict]||0)+1,m),{}),multipleIdsBefore:F.filter(p=>(p.validation.rnb?.original||[]).length>1).length,multipleIdsAfter:F.filter(p=>(p.validation.rnb?.ids||[]).length>1).length,
   idsAddedFromExactBdtopoLink:F.reduce((n,p)=>n+(p.validation.rnb?.added?.length||0),0),rnbOnlyActiveInCommune:rnbOnly.length},
  uncertain:{C:counts.C,B:counts.B,partialOsm:partial.length,partialExtensionsConfirmed:partial.filter(x=>x.verdict.startsWith('extension')).length,contourDifferent:F.filter(p=>p.validation.confidence==='B'&&/contour différent|extension cadastrale/.test(p.validation.status)).length},
  appearedSinceHistoricCadastre:refS.filter(r=>r.p.source==='IGN BD TOPO'&&cls(r.cadCov)==='présent'&&!osmS.some(o=>o.ign.some(l=>l.o===r)&&osmYear(o.f)&&osmYear(o.f)<=2018)).length,
  confidenceChanges:history.reduce((m,h)=>{const k=h.from+'→'+h.to;m[k]=(m[k]||0)+1;return m;},{})},
 v162,v16Review,confidenceHistory:history,cadastreOffsetTwins:twins,partialOsm:partial,removed:removed.map(x=>({id:x.feature.properties.id,version:x.version,areaM2:x.feature.properties.areaM2,inCommune:x.feature.properties.inCommune,reason:x.reason,evidence:x.evidence})),
 withdrawnCadastralAdditions:withdrawn.map(x=>({id:x.feature.id,areaM2:x.feature.properties.areaM2,inCommune:x.feature.properties.inCommune,type:x.feature.properties.cadastre.type,reason:x.reason})),
 addedFromCadastre:added.map(f=>({id:f.id,areaM2:f.properties.areaM2,inCommune:f.properties.inCommune,type:f.properties.cadastre.type,confidence:f.properties.validation.confidence,rnb:f.properties.rnb,review:f.properties.validation.review?.verdict||null})),rnbOnly};
ref.metadata.validation={generatedBy:'scripts/validate-buildings.mjs',version:'1.6.2',frozen:'Référentiel gelé pour Unreal Engine (V1.6.2)',cadastre:cadName+' — '+CAD,rnb:'API RNB — '+RNB,orthophoto:REV.orthophoto.name+' ('+REV.orthophoto.dateVol+')',review:REVIEW,confidence:{A:'BD TOPO et cadastre actuel concordent (couverture ≥ 50 %), sans contradiction RNB ni extension cadastrale manquante (ou extension intégrée après revue)',B:'Une seule source officielle, contour différent, contradiction, ou ajout cadastre confirmé par le RNB ou l’orthophoto IGN 2025',C:'Empreinte OSM ou cadastrale sans confirmation par une seconde source officielle'},removedLog:'data-sources/building-removed.json'};
ref.metadata.fields.geometryEnrichment='V1.6.2 : empreinte BD TOPO réunie à l’extension du cadastre actuel visible sur l’orthophoto ; géométrie BD TOPO d’origine dans ignGeometry';
ref.metadata.fields.validation='Bloc de validation V1.6.2 : confiance A/B/C, statut, correspondance au cadastre actuel, contrôle RNB par identifiant (existence, statut, cohérence spatiale), confiance précédente, preuves';
ref.metadata.fields.rnbSource='Identifiant(s) RNB d’origine (BD TOPO) ; `rnb` contient les identifiants vérifiés par l’API';
fs.writeFileSync(REF,JSON.stringify(ref));
fs.writeFileSync('data-sources/building-removed.json',JSON.stringify({note:'Bâtiments retirés du référentiel (V1.6.1 : OSM absents de toutes les sources ; V1.6.2 : OSM non bâtis sur l’orthophoto IGN 2025), et ajouts cadastraux V1.6.1 écartés en V1.6.2, avec géométrie et preuves.',features:removed.map(x=>({...x.feature,properties:{...x.feature.properties,removal:{version:x.version,reason:x.reason,evidence:x.evidence}}})).concat(withdrawn.map(x=>({...x.feature,properties:{...x.feature.properties,removal:{version:'1.6.2',reason:x.reason,evidence:x.evidence}}})))},null,1)+'\n');
fs.writeFileSync('data-sources/building-validation.json',JSON.stringify(report,null,1)+'\n');
// The reference report carries the official validation summary next to the construction statistics.
const refReport=read('data-sources/building-reference-report.json');refReport.officialValidation={version:'1.6.2',detail:'data-sources/building-validation.json',...report.indicators,v162,v16Review};fs.writeFileSync('data-sources/building-reference-report.json',JSON.stringify(refReport,null,1)+'\n');
console.log(JSON.stringify(report.indicators,null,1));
