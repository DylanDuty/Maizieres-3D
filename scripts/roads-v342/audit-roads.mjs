// V3.4.2 — spatial audit of every road of the roads register V2.9.2 (111 roads: the commune's named streets and the
// neighbouring ones the map draws). Read-only; nothing is moved or renamed here.
// For each road, the name the map shows is confronted with references that did not produce it:
//  IGN  BD TOPO voie_nommee: the IGN assignment of the BAN street (same FANTOIR code) to its road sections — overlap of
//       section sets, by length;
//  OSM  OpenStreetMap ways carrying the same name: share of the road within 15 m of them (independent geometry);
//  BAN  addresses of the street (FANTOIR code): distance to the road, and whether another named road is clearly nearer
//       (an address « projected » on a parallel street).
// Then what the visitor uses, rebuilt in Node from the code the map runs (scripts/runtime-catalogue.mjs): the clickable
// record and its sections, clicks at 25 / 50 / 75 % of each section, the search result, the anchor of the quick label.
// Output: docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv and data-sources/addresses-v342/roads-audit-report.json (`--out DIR`).
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {loadRuntimeCatalogue} from '../runtime-catalogue.mjs';
import {buildSearchIndex,searchIndex,norm} from '../../src/search-index.js';
const OUT=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'.';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),G=f=>JSON.parse(gunzipSync(fs.readFileSync(f)).toString('utf8'));
export const CORRIDOR_M=15,ADDRESS_FAR_M=40;
const {catalogue,project}=loadRuntimeCatalogue();
const REG=read('docs/freeze/MLGU_ROADS_CANONICAL_V1.json'),roads=REG.roads;
const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const lineDist=(p,lines)=>{let d=Infinity;for(const l of lines)for(let i=1;i<l.length;i++)d=Math.min(d,segD(p,l[i-1],l[i]));return d;};
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
const sample=(l,step=5)=>{const out=[];for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=0;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}out.push(l.at(-1));return out;};
const at=(l,f)=>{const L=len(l)*f;let s=0;for(let i=1;i<l.length;i++){const d=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);if(s+d>=L){const t=d?(L-s)/d:0;return [l[i-1][0]+(l[i][0]-l[i-1][0])*t,l[i-1][1]+(l[i][1]-l[i-1][1])*t];}s+=d;}return l.at(-1);};
// geometry of the BD TOPO sections (local frame)
const T=new Map(read('data-sources/roads/bdtopo-troncon-de-route.geojson').features.map(f=>[f.properties.cleabs,(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(l=>l.map(c=>project(c)))]));
const geomOf=segs=>segs.flatMap(s=>T.get(s)||[]);
// IGN named streets: FANTOIR → supporting sections
const VOIES=read('data-sources/roads/bdtopo-voie-nommee.geojson').features.map(f=>f.properties),ignByFantoir=new Map();
for(const v of VOIES){if(!v.identifiant_voie_ban)continue;const s=(v.liens_vers_supports||'').split('/').flatMap(x=>x.split(/[|,]/)).map(x=>x.trim()).filter(x=>x.startsWith('TRONROUT'));if(!ignByFantoir.has(v.identifiant_voie_ban))ignByFantoir.set(v.identifiant_voie_ban,{names:new Set(),segs:new Set()});const e=ignByFantoir.get(v.identifiant_voie_ban);e.names.add(v.nom_voie_ban);for(const x of s)e.segs.add(x);}
// OSM ways by normalised name
// route numbers (« D 116 ») are matched on the OSM ref tag
const osm=read('public/data/maizieres.geojson').features.filter(f=>f.properties.highway&&(f.properties.name||f.properties.ref)),osmByName=new Map();
for(const f of osm)for(const k of [f.properties.name,...String(f.properties.ref||'').split(';')].filter(Boolean).map(norm)){if(!osmByName.has(k))osmByName.set(k,[]);osmByName.get(k).push(...(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[]).map(l=>l.map(c=>project(c))));}
// BAN addresses (commune and extent) by FANTOIR
const M=read('data-sources/addresses-v342/source-manifest.json'),ban=new Map();for(const p of M.sources.banExtent.pages)for(const f of G(p.file).features)ban.set(f.properties.id,f);for(const p of M.sources.banCommune.pages)for(const f of G(p.file).features)ban.set(f.properties.id,f);
const banByFantoir=new Map();for(const f of ban.values()){const k=f.properties.id_fantoir;if(!banByFantoir.has(k))banByFantoir.set(k,[]);banByFantoir.get(k).push(f);}
// runtime (what the map runs)
const lines=catalogue.records.filter(r=>r.type==='line'),index=buildSearchIndex(catalogue.records),recById=new Map(lines.map(r=>[r.id,r]));
const otherRoadsGeom=roads.map(r=>({id:r.road_id,name:r.canonical_name,g:geomOf(r.segments)}));
const rows=[];
for(const r of roads){const g=geomOf(r.segments),L=g.reduce((s,l)=>s+len(l),0),notes=[],issues={blocker:[],review:[],limit:[]};
 // IGN assignment
 const fant=r.official_ref?.ban_voie||[];let ign=null;
 if(fant.length){const segs=new Set(fant.flatMap(f=>[...(ignByFantoir.get(f)?.segs||[])]));if(segs.size){const own=new Set(r.segments),inter=[...own].filter(s=>segs.has(s)),union=new Set([...own,...segs]);
  const lenOf=ss=>[...ss].reduce((s,x)=>s+(T.get(x)||[]).reduce((a,l)=>a+len(l),0),0);ign={agree:lenOf(inter)/Math.max(1,lenOf(union)),ownCovered:lenOf(inter)/Math.max(1,lenOf(own)),ignOnly:[...segs].filter(s=>!own.has(s)&&T.has(s)).length,names:[...new Set(fant.flatMap(f=>[...(ignByFantoir.get(f)?.names||[])]))]};}}
 // OSM corroboration (canonical name or an alias)
 const og=[r.canonical_name,...(r.aliases||[])].flatMap(n=>osmByName.get(norm(n))||[]);let osmCov=null;
 if(og.length){const pts=g.flatMap(l=>sample(l));osmCov=pts.filter(p=>lineDist(p,og)<=CORRIDOR_M).length/Math.max(1,pts.length);}
 // BAN addresses of the street
 const addrs=fant.flatMap(f=>banByFantoir.get(f)||[]);let far=0,parallel=[],dmax=0;const ds=[];
 for(const f of addrs){const p=project(f.geometry.coordinates),d=lineDist(p,g);ds.push(d);dmax=Math.max(dmax,d);if(d>ADDRESS_FAR_M){far++;const o=otherRoadsGeom.filter(x=>x.id!==r.road_id&&x.g.length).map(x=>({name:x.name,d:lineDist(p,x.g)})).sort((a,b)=>a.d-b.d)[0];if(o&&o.d<d/2)parallel.push(`${f.properties.numero}${f.properties.rep?' '+f.properties.rep:''} (${Math.round(d)} m ; ${o.name} à ${Math.round(o.d)} m)`);}}
 ds.sort((a,b)=>a-b);const p90=ds.length?ds[Math.floor(.9*(ds.length-1))]:null;
 // continuity: pieces of the drawn road (ends within 2 m are joined)
 const ends=g.map(l=>[l[0],l.at(-1)]),parent=g.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
 for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++)if(ends[i].some(a=>ends[j].some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<2)))parent[find(i)]=find(j);
 const pieces=new Set(g.map((_,i)=>find(i))).size;
 // runtime: record, clicks, search, label anchor
 const rec=recById.get(r.road_id);let clicks=0,good=0,wrong=[];
 if(rec)for(const l of g)for(const f of [.25,.5,.75]){const p=at(l,f);let best=null,bd=Infinity;for(const o of lines){const d=lineDist(p,o.lines);if(d<bd-1e-6){bd=d;best=o;}}clicks++;if(best===rec||lineDist(p,rec.lines)<=bd+1)good++;else wrong.push(best.name);}
 const anchor=rec?lineDist([rec.position[0],rec.position[2]],rec.lines):null;
 // a place of the same name (V2.9.2: the place wins the search) is accepted when it lies on the road
 let search=null;if(r.searchable){const res=searchIndex(index,r.canonical_name),top=res[0]?.r;search=top?.id===r.road_id?'ok':top&&norm(top.name)===norm(r.canonical_name)&&top.position&&lineDist([top.position[0],top.position[2]],g)<=150?`lieu homonyme à ${Math.round(lineDist([top.position[0],top.position[2]],g))} m`:res.some(x=>x.r.id===r.road_id)?'listed':'absent';}
 const inCommune=r.insee==='10220';
 // verdict
 if(!rec)issues.blocker.push('aucune voie cliquable');
 if(rec&&clicks&&good/clicks<.9)issues.blocker.push(`clic : ${good}/${clicks} sur la voie (${[...new Set(wrong)].slice(0,2).join(', ')})`);
 if(search==='absent')issues.blocker.push('recherche : voie introuvable');else if(search==='listed')issues.limit.push('recherche : voie listée mais pas en tête');else if(search?.startsWith('lieu'))notes.push(`recherche : le lieu homonyme vient en tête (${search})`);
 if(anchor!==null&&anchor>3)issues.review.push(`ancre de l’étiquette à ${anchor.toFixed(1)} m du tracé`);
 if(ign&&ign.ownCovered<.5&&(osmCov===null||osmCov<.5))issues.review.push(`tracé peu corroboré (IGN ${Math.round(ign.ownCovered*100)} %, OSM ${osmCov===null?'—':Math.round(osmCov*100)+' %'})`);
 else if(ign&&ign.ownCovered<.8&&(osmCov===null||osmCov<.8))issues.limit.push(`tracé corroboré en partie (IGN ${Math.round(ign.ownCovered*100)} %, OSM ${osmCov===null?'—':Math.round(osmCov*100)+' %'})`);
 if(!ign&&osmCov===null)issues.limit.push('aucune référence indépendante (ni voie nommée IGN, ni OSM)');else if(!ign)issues.limit.push(`pas de voie nommée IGN ; OSM ${Math.round(osmCov*100)} %`);
 if(ign?.ignOnly)notes.push(`${ign.ignOnly} tronçon(s) que l’IGN rattache à cette voie et que la carte ne nomme pas ainsi`);
 if(parallel.length)(parallel.length>Math.max(2,addrs.length*.1)?issues.review:issues.limit).push(`${parallel.length} adresse(s) plus proches d’une autre voie : ${parallel.slice(0,3).join(' ; ')}`);
 if(pieces>1)issues.limit.push(`${pieces} morceaux (interruptions du tracé dessiné)`);
 if(ign&&ign.names.some(n=>norm(n)!==norm(r.canonical_name)&&!(r.aliases||[]).some(a=>norm(a)===norm(n))))notes.push(`nom IGN/BAN : ${ign.names.join(' / ')}`);
 if(r.display_status==='PASS_WITH_LIMITATION'&&r.notes)notes.push(r.notes);
 const status=issues.blocker.length?'BLOCKER':issues.review.length?'REVIEW':issues.limit.length?'PASS_WITH_LIMITATION':'PASS';
 rows.push({roadId:r.road_id,name:r.canonical_name,commune:inCommune?'10220':r.insee,sector:r.sector,segments:r.segments.length,lengthM:Math.round(L),pieces,
  ignOverlap:ign?+ign.ownCovered.toFixed(3):null,ignJaccard:ign?+ign.agree.toFixed(3):null,osmCorridor:osmCov===null?null:+osmCov.toFixed(3),
  addresses:addrs.length,addressP90M:p90===null?null:+p90.toFixed(1),addressMaxM:+dmax.toFixed(1),addressNearerOtherRoad:parallel.length,
  clicks,clicksOnRoad:good,search,labelAnchorM:anchor===null?null:+anchor.toFixed(2),
  sources:['registre V2.9.2',ign?'IGN voie nommée':null,osmCov!==null?'OSM':null,addrs.length?'BAN':null].filter(Boolean).join(' + '),
  status,issues:[...issues.blocker,...issues.review,...issues.limit].join(' ; '),notes:notes.join(' ; '),correction:'',todo:status==='PASS'?'':issues.review.length||issues.blocker.length?'vérification ciblée (orthophoto, BAL communale)':'aucune action requise ; limite documentée'});}
// the two route labels drawn permanently (D 619, D 116): they must sit on a road carrying that route
const labels=[];for(const ref of ['D 619','D 116']){const f=read('public/data/maizieres.geojson').features.find(f=>f.properties.ref===ref&&f.geometry.type==='LineString'&&f.geometry.coordinates.length>3);if(!f)continue;
 const p=project(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)]),carriers=roads.filter(r=>(r.official_ref?.route||[]).includes(ref));labels.push({ref,distanceM:+Math.min(...carriers.map(r=>lineDist(p,geomOf(r.segments)))).toFixed(1),carriers:carriers.map(r=>r.canonical_name)});}
const by=k=>Object.fromEntries(['PASS','PASS_WITH_LIMITATION','REVIEW','BLOCKER'].map(s=>[s,rows.filter(r=>k(r)&&r.status===s).length]));
const report={metadata:{generatedBy:'scripts/roads-v342/audit-roads.mjs',corridorM:CORRIDOR_M,addressFarM:ADDRESS_FAR_M},roads:rows.length,inCommune:rows.filter(r=>r.commune==='10220').length,
 statuses:by(()=>true),statusesInCommune:by(r=>r.commune==='10220'),clicks:rows.reduce((s,r)=>s+r.clicks,0),clicksOnRoad:rows.reduce((s,r)=>s+r.clicksOnRoad,0),routeLabels:labels,
 unnamedTroncons:REG.metadata?.counts?.unnamedTroncons??null,banStreetsCommune:new Set([...ban.values()].filter(f=>f.properties.code_insee==='10220').map(f=>f.properties.id_fantoir)).size};
const esc=v=>{const s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const cols=['roadId','name','commune','sector','segments','lengthM','pieces','ignOverlap','ignJaccard','osmCorridor','addresses','addressP90M','addressMaxM','addressNearerOtherRoad','clicks','clicksOnRoad','search','labelAnchorM','sources','status','issues','notes','correction','todo'];
const w=(f,s)=>{const p=path.join(OUT,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
w('docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv',cols.join(';')+'\n'+rows.map(r=>cols.map(c=>esc(r[c])).join(';')).join('\n')+'\n');
w('data-sources/addresses-v342/roads-audit-report.json',JSON.stringify({...report,rows},null,1)+'\n');
console.log(JSON.stringify(report));
