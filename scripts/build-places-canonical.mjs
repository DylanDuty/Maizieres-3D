// V2.9.2 — builds the canonical register of places (docs/freeze/MLGU_PLACES_CANONICAL_V1.json) from the frozen POI
// layer, the screening measures (scripts/places-screening.mjs) and the audited decisions
// (docs/freeze/places-decisions-v2.9.2.json). Every record of the commune gets an audit status; every interactive record
// gets a display status (PASS, PASS_WITH_LIMITATION, HIDDEN_PENDING_REVIEW, HIDDEN_OUT_OF_COMMUNE). The map does not read
// the register: it reads its runtime projection (src/content/places-runtime-v292.json), generated here, which only holds
// the fields that differ from the frozen layer (building ids, anchor, hidden). Frozen files are read, never written.
import fs from 'node:fs';import crypto from 'node:crypto';
import {loadSources,screen,footprintDistance,ringsOf,interactive} from './places-screening.mjs';
import {loadBaseCatalogue} from './base-catalogue.mjs';
import {insidePoly} from '../src/geo.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const S=loadSources(),scr=screen(S),DEC=read('docs/freeze/places-decisions-v2.9.2.json');
const M=111320*Math.cos(48.5097657*Math.PI/180);
// Representative point inside a footprint: the centroid if inside, else the grid point farthest from the edges.
function insidePoint(f){const r=ringsOf(f.geometry).sort((a,b)=>b.length-a.length)[0];let cx=0,cy=0;for(const q of r){cx+=q[0];cy+=q[1];}cx/=r.length;cy/=r.length;
 const inside=([x,y])=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[i],[x2,y2]=r[j];if((y1>y)!==(y2>y)&&x<(x2-x1)*(y-y1)/(y2-y1)+x1)c=!c;}return c;};
 const edge=p=>{let b=Infinity;for(let i=0,j=r.length-1;i<r.length;j=i++){const ax=(r[j][0]-p[0])*M,ay=(r[j][1]-p[1])*110540,bx=(r[i][0]-p[0])*M,by=(r[i][1]-p[1])*110540,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));b=Math.min(b,Math.hypot(ax+t*dx,ay+t*dy));}return b;};
 if(inside([cx,cy])&&edge([cx,cy])>2)return [+cx.toFixed(7),+cy.toFixed(7)];
 const xs=r.map(q=>q[0]),ys=r.map(q=>q[1]);let best=null,bd=-1;for(let i=1;i<20;i++)for(let j=1;j<20;j++){const p=[Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/20,Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*j/20];if(!inside(p))continue;const e=edge(p);if(e>bd){bd=e;best=p;}}
 return best?[+best[0].toFixed(7),+best[1].toFixed(7)]:[+cx.toFixed(7),+cy.toFixed(7)];}
const webById=new Map(S.web.pois.map(p=>[p.id,p]));
const entries=[],anomalies=[],runtime={};
for(const s of scr){const d=DEC[s.id]||{},w=webById.get(s.id);
 const frozen={building_ids:w?.building_ids||s.building_ids||[],lonlat:w?.lonlat||null};
 let building_ids=d.building_ids?[...new Set(d.building_ids)]:[...new Set(frozen.building_ids)];
 let lonlat=d.lonlat||frozen.lonlat,anchorMethod=s.positionSource||'aucune';
 if(d.anchor==='building'&&building_ids.length){const fs_=building_ids.map(id=>S.fp.get(id)).filter(Boolean).sort((a,b)=>(b.properties.areaM2||0)-(a.properties.areaM2||0));lonlat=insidePoint(fs_[0]);anchorMethod=`point intérieur du bâtiment ${fs_[0].properties.id} (V2.9.2)`;}
 else if(d.lonlat)anchorMethod='point source documenté (V2.9.2, voir sources)';
 const hiddenOut=s.interactive&&s.inCommune===false;
 let display=s.interactive?(hiddenOut?'HIDDEN_OUT_OF_COMMUNE':d.status||null):'NOT_DISPLAYED';
 const limitation=d.limitation||null;let auto=null;
 if(s.interactive&&!display){
  if(s.category==='lieu_dit'){display='PASS_WITH_LIMITATION';auto=s.positionSource?.startsWith('OSM')?'toponyme ponctuel de source OSM seule ; l’étendue du lieu-dit n’est pas dessinée':'point de toponyme BD TOPO (± 30 m) ; l’étendue du lieu-dit n’est pas dessinée';}
  else if(s.flags.some(f=>['BAN_SEGMENT_BUILDING','SHARED_BUILDING','MANY_BUILDINGS','ACROSS_ROAD','NO_POSITION'].includes(f.k))){display='HIDDEN_PENDING_REVIEW';auto='anomalie non résolue';}
  else if(['secteur','zone_activite'].includes(s.category)||/BD TOPO|OSM|nœud V1\.8|tronçon V1\.8|repère|référentiel|centre de l’empreinte/.test(s.positionSource||'')){display=/tronçon|nœud|repère|fictive/.test(s.positionSource||'')?'PASS_WITH_LIMITATION':'PASS';if(display==='PASS_WITH_LIMITATION')auto='position déduite (repère, tronçon ou point de toponyme), précise au lieu, pas au mètre';}
  else {display='PASS_WITH_LIMITATION';auto='position d’adresse ; aucune anomalie détectée';}}
 const hidden=display==='HIDDEN_PENDING_REVIEW'||display==='HIDDEN_OUT_OF_COMMUNE';
 const audit=s.level===1?(hidden&&display==='HIDDEN_PENDING_REVIEW'?'REVIEW':'PASS'):(s.lonlat?(s.flags.length?'REVIEW':'PASS'):'REVIEW');
 const e={id:s.id,canonical_name:s.name,aliases:(S.full.find(u=>u.id===s.id)?.variants||[]).filter(v=>v!==s.name),category:s.category,type:s.type,current_or_historic:s.coh,valid_from:null,valid_to:null,
  in_commune:s.inCommune,audit_level:s.level,
  address:{full:d.address||s.address||null,source:s.address||d.address?(d.address&&d.address!==s.address?'décision V2.9.2':(s.banPosition?`BAN (position ${s.banPosition})`:'référentiel V1.11')):null,ban_id:s.banId,ban_position:s.banPosition},
  anchor:{lonlat,method:anchorMethod,confidence:display==='PASS'?'élevée':display==='PASS_WITH_LIMITATION'?'limitée':'—'},
  building_ids,road_ids:w?.road_id?[w.road_id]:[],
  source_priority:d.sources?d.sources.map(x=>x.organism):[s.positionSource||'—'],sources:d.sources||[],
  validation_method:d.status?'décision auditée V2.9.2 (sources croisées, orthophoto)':s.level===1?'criblage automatique V2.9.2 sans anomalie':'criblage automatique V2.9.2 (non affiché)',
  audit_status:audit,display_status:display,limitation:limitation||auto,flags:s.flags.map(f=>f.k),notes:null};
 entries.push(e);
 // runtime projection: only what differs from the frozen layer
 if(w){const o={};if(JSON.stringify(building_ids)!==JSON.stringify(frozen.building_ids))o.building_ids=building_ids;if(lonlat&&JSON.stringify(lonlat)!==JSON.stringify(frozen.lonlat))o.lonlat=lonlat;if(d.address&&d.address!==w.address)o.address=d.address;if(hidden)o.hidden=display;if(Object.keys(o).length)runtime[s.id]=o;}
 for(const [sev,kind,from,to,comment] of d.anomalies||[])anomalies.push({id:s.id,type:'lieu',name:s.name,anomaly:kind,old:from,new:to,source:(d.sources||[]).map(x=>x.organism+' '+x.ref).slice(0,3).join(' ; '),severity:sev,status:'CORRIGÉ',comment});
 if(!d.anomalies&&s.level===1){for(const f of s.flags){const sev=f.k==='OUTSIDE_DISPLAYED'?'MINOR':f.sev;anomalies.push({id:s.id,type:'lieu',name:s.name,anomaly:f.k,old:f.msg,new:hidden?display:display==='PASS_WITH_LIMITATION'?'conservé avec limitation':'conservé',source:'criblage V2.9.2',severity:sev,status:hidden?'MASQUÉ':'ACCEPTÉ',comment:limitation||auto||''});}}
}
// Governance of the named records the map builds from its own sources at load time (src/cartography.js: OSM points and
// polygons, BD TOPO named zones, enrichment landmarks, named buildings, Bible junctions). Until V2.9.1 they were clickable
// and searchable beside the register, unaudited: a second « Salle polyvalente » on the Maison des associations building, a
// « Mairie » on a 31 m² annex, a closed pharmacy shown as current, shops and lieux-dits of neighbouring communes. Each one
// is now an alias of a certified place, hidden (outside the commune, historic, not displayed), or stripped of its name.
const BASE=loadBaseCatalogue(),fullById=new Map(S.full.map(p=>[p.id,p])),entryById=new Map(entries.map(e=>[e.id,e]));
const refIndex=new Map();for(const p of S.full)for(const src of p.sources||[])if(src.ref){const k=String(src.ref);if(!refIndex.has(k))refIndex.set(k,[]);refIndex.get(k).push(p.id);}
const shown=id=>['PASS','PASS_WITH_LIMITATION'].includes(entryById.get(id)?.display_status);
const nrm=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const CAT=read('docs/freeze/catalogue-decisions-v2.9.2.json').records;
const catalogueRecords=[],catalogueRuntime={},searchAliases={};
for(const r of BASE.catalogue.records.filter(r=>r.type!=='line')){const item=BASE.itemById.get(r.id),refs=[r.id,...(item?.t['@osm']||[]),item?.extra?.landmark?.source].filter(Boolean);
 const pos=[r.position[0],r.position[2]],inC=BASE.boundaryPolys.some(poly=>insidePoly(pos,poly));
 let cands=[...new Set(refs.flatMap(k=>refIndex.get(k)||[]))],method='référence de source identique';
 if(CAT[r.id]){cands=[CAT[r.id].poi];method='décision manuelle (docs/freeze/catalogue-decisions-v2.9.2.json)';}
 if(!cands.length){const near=entries.filter(e=>e.anchor.lonlat).map(e=>{const [x,z]=BASE.project(e.anchor.lonlat);return [Math.hypot(x-pos[0],z-pos[1]),e];}).filter(([d,e])=>d<150&&[e.canonical_name,...e.aliases].some(n=>{const a=nrm(n),b=nrm(r.name);return a===b||(a.includes(b)||b.includes(a))&&Math.min(a.length,b.length)/Math.max(a.length,b.length)>=.6;})).sort((a,b)=>a[0]-b[0]);
  cands=near.map(([,e])=>e.id);method='même nom à moins de 150 m';}
 const poi=cands.find(shown)||cands[0]||null,e=poi&&entryById.get(poi);let action,reason;
 if(poi&&shown(poi)){if(r.type==='building'&&!e.building_ids.includes(r.id)){action='unname';reason=`nom hérité (${r.source}) ; ce bâtiment n’est pas celui du lieu certifié « ${e.canonical_name} »`;}
  else {action='alias';reason=`même lieu que « ${e.canonical_name} » (${method})`;}}
 else if(!inC||e?.display_status==='HIDDEN_OUT_OF_COMMUNE'){action='hide';reason='hors de la commune';}
 else if(poi){action='hide';reason=e.current_or_historic&&e.current_or_historic!=='current'&&e.current_or_historic!=='actuel'?`lieu ancien ou incertain (registre : « ${e.canonical_name} », ${e.current_or_historic})`:`non affiché par le registre (« ${e.canonical_name} » : ${e.display_status})`;}
 else {action='review';reason='aucun lieu du registre ne lui correspond';}
 if(CAT[r.id])anomalies.push({id:r.id,type:'lieu',name:r.name,anomaly:'doublon hérité',old:r.name+' ('+r.source+')',new:'alias de '+CAT[r.id].poi,source:'décision V2.9.2',severity:CAT[r.id].severity,status:'CORRIGÉ',comment:CAT[r.id].comment});
 catalogueRecords.push({record_id:r.id,name:r.name,record_type:r.type,origin:r.source,in_commune:inC,refs,matched_place:poi,match_method:poi?method:null,action,reason});
 catalogueRuntime[r.id]={a:action,...(poi&&action==='alias'?{poi}:{})};
 if(action==='alias'&&nrm(r.name)!==nrm(e.canonical_name)&&!nrm(e.canonical_name).startsWith(nrm(r.name)))(searchAliases[poi]||=new Set()).add(r.name);}
// Search keys from the register's own variants, for displayed places (a variant never becomes a separate record): each
// « A / B » part, without parentheses; never an elided quote, never the name of another displayed place.
const shownNames=new Set([...entries.filter(e=>shown(e.id)).map(e=>e.canonical_name),...read('docs/freeze/MLGU_ROADS_CANONICAL_V1.json').roads.map(r=>r.canonical_name)].map(nrm));
for(const e of entries)if(shown(e.id))for(const v of e.aliases)for(const part of v.split(/\s+\/\s+/)){const t=part.replace(/\s*\([^)]*\)\s*/g,' ').trim();
 if(t.length<4||t.length>60||/…|\bex\./.test(t))continue;const k=nrm(t);if(k===nrm(e.canonical_name)||nrm(e.canonical_name).startsWith(k)||shownNames.has(k))continue;(searchAliases[e.id]||=new Set()).add(t);}
// documented abbreviations (decisions: search_aliases), e.g. CPI for « centre de première intervention »
for(const [id,d] of Object.entries(DEC))for(const v of d.search_aliases||[])(searchAliases[id]||=new Set()).add(v);
for(const e of entries)e.catalogue_aliases=catalogueRecords.filter(c=>c.matched_place===e.id&&c.action==='alias').map(c=>c.record_id);
// Post-check: no building claimed by two visible places.
const owner=new Map(),clash=[];for(const e of entries)if(['PASS','PASS_WITH_LIMITATION'].includes(e.display_status))for(const id of e.building_ids){if(owner.has(id))clash.push(`${id}: ${owner.get(id)} / ${e.id}`);owner.set(id,e.id);}
const count=k=>entries.filter(e=>e.display_status===k).length;
const meta={version:'1.0',release:'V2.9.2',generatedBy:'scripts/build-places-canonical.mjs',date:'2026-10-11',sourceLayer:{file:'public/data/poi.json',sha256:sha(fs.readFileSync('public/data/poi.json')),full:'unreal/poi/poi.json'},decisions:{file:'docs/freeze/places-decisions-v2.9.2.json',sha256:sha(fs.readFileSync('docs/freeze/places-decisions-v2.9.2.json')),count:Object.keys(DEC).length},
 counts:{total:entries.length,inCommune:entries.filter(e=>e.in_commune===true).length,outsideCommune:entries.filter(e=>e.in_commune===false).length,communeUnknown:entries.filter(e=>e.in_commune==null).length,webLayer:S.web.pois.length,interactive:scr.filter(s=>s.interactive).length,displayFlag:scr.filter(s=>s.displayFlag).length,PASS:count('PASS'),PASS_WITH_LIMITATION:count('PASS_WITH_LIMITATION'),HIDDEN_PENDING_REVIEW:count('HIDDEN_PENDING_REVIEW'),HIDDEN_OUT_OF_COMMUNE:count('HIDDEN_OUT_OF_COMMUNE'),NOT_DISPLAYED:count('NOT_DISPLAYED')},sharedBuildingConflicts:clash};
meta.counts.catalogueRecords=catalogueRecords.length;for(const k of ['alias','hide','unname','review'])meta.counts['catalogue_'+k]=catalogueRecords.filter(c=>c.action===k).length;
fs.writeFileSync('docs/freeze/MLGU_PLACES_CANONICAL_V1.json',JSON.stringify({metadata:meta,places:entries,catalogueRecords},null,1)+'\n');
fs.writeFileSync('src/content/places-runtime-v292.json',JSON.stringify({version:'V2.9.2',register:'docs/freeze/MLGU_PLACES_CANONICAL_V1.json',places:runtime,catalogue:catalogueRuntime,aliases:Object.fromEntries(Object.entries(searchAliases).map(([k,v])=>[k,[...v].sort()]))},null,1)+'\n');
fs.writeFileSync('docs/audit/v2.9.2-places-anomalies.json',JSON.stringify(anomalies,null,1)+'\n');
console.log(JSON.stringify({...meta.counts,runtimeOverrides:Object.keys(runtime).length,anomalies:anomalies.length,clash}));
