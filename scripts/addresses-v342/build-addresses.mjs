// V3.4.2 — building ↔ address registry for the 2 596 frozen buildings. Offline, deterministic, read-only on every source.
// Input : data-sources/addresses-v342 (BAN and BAN PLUS from the Géoplateforme WFS, RNB API pages, as received) + frozen
// layers (footprints, cadastral registry V1, places and roads registers V2.9.2).
// Output: public/data/building-addresses-v3.4.2.json (runtime index), docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json (registry),
// docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv, data-sources/addresses-v342/build-report.json. `--out DIR` writes them under DIR.
//
// A candidate engine, not a reverse geocoder. Three independent channels can name the building of an address:
//  L  BAN PLUS (IGN): an address – building link. It names one building when IGN links the address to a single building
//     (nb_bat = 1), or when, among the buildings IGN links it to, exactly one is a dwelling (« L* »: the address of a home
//     is not handed to its garage or shed; with two dwellings or none, nothing is named).
//  R  RNB: the RNB building whose BD TOPO identifier is ours carries the BAN identifier; same rule (one of ours, or the only
//     dwelling among them: « R* »).
//  P  BAN position typed « bâtiment » or « entrée » inside the footprint (or within 3 m of it, nearest building).
// A link is VERIFIED when two channels agree on the same building and none points elsewhere, or when the BAN position is a
// « bâtiment » / « entrée » point inside the footprint and nothing contradicts it. A BAN « segment » point (interpolated on
// the road axis) is never evidence: it only feeds anomaly detection. A parcel never hands its addresses to all its buildings.
// The address's own road (FANTOIR code → roads register → BD TOPO sections) must pass near the building; otherwise REVIEW.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {projection,insidePoly} from '../../src/geo.js';
const OUT=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'.';
const J=async f=>JSON.parse(await fs.readFile(f,'utf8')),G=async f=>JSON.parse(gunzipSync(await fs.readFile(f)).toString('utf8'));
const DIR='data-sources/addresses-v342',M=await J(`${DIR}/source-manifest.json`);
const pages=async k=>(await Promise.all(M.sources[k].pages.map(p=>G(p.file)))).flatMap(j=>j.features||j.results);
const project=projection((await J('public/data/v2-scene.json')).metadata.origin);
export const DWELLING=c=>c.startsWith('RES_');
export const ROAD_NEAR_M=60,POSITION_NEAR_M=3,MINOR=new Set(['SHED','ANNEX','GARAGE','GREENHOUSE','SILO_TANK','WATER_TOWER','OTHER']);

// ---------- buildings (frozen footprints, local frame) ----------
const B=new Map(),arch=new Map((await J('public/data/building-architecture-v2.3.json')).buildings.map(a=>[a.buildingId,a.buildingClass]));
for(const f of ['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'])for(const ft of (await J(f)).features){
 const g=ft.geometry,polys=(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(c=>project(c))));const pts=polys.flatMap(p=>p[0]);
 B.set(ft.properties.id,{id:ft.properties.id,layer:f.includes('manual')?'manuel V2.2':f.includes('additions')?'ajout V2.0.1':'référentiel V1.6.2',inCommune:ft.properties.inCommune!==false,rnb:ft.properties.rnb||null,cls:arch.get(ft.properties.id)||'UNKNOWN',polys,
  bb:[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]});}
const CELL=50,grid=new Map();for(const b of B.values())for(let x=Math.floor(b.bb[0]/CELL);x<=Math.floor(b.bb[2]/CELL);x++)for(let z=Math.floor(b.bb[1]/CELL);z<=Math.floor(b.bb[3]/CELL);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}
const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const footDist=(p,b)=>{let d=Infinity;for(const poly of b.polys){if(insidePoly(p,poly))return 0;for(const r of poly)for(let i=1;i<r.length;i++)d=Math.min(d,segD(p,r[i-1],r[i]));}return d;};
function nearBuildings(p,r){const out=[];const seen=new Set();for(let x=Math.floor((p[0]-r)/CELL);x<=Math.floor((p[0]+r)/CELL);x++)for(let z=Math.floor((p[1]-r)/CELL);z<=Math.floor((p[1]+r)/CELL);z++)for(const b of grid.get(x+','+z)||[]){if(seen.has(b.id))continue;seen.add(b.id);const d=footDist(p,b);if(d<=r)out.push({b,d});}return out.sort((a,c)=>a.d-c.d||(a.b.id<c.b.id?-1:1));}

// ---------- sources ----------
const banAll=(await pages('banExtent')),banIds=new Set(banAll.map(f=>f.properties.id));
for(const f of await pages('banCommune'))if(!banIds.has(f.properties.id)){banAll.push(f);banIds.add(f.properties.id);}
{const seen=new Set();for(let i=banAll.length-1;i>=0;i--){const id=banAll[i].properties.id;if(seen.has(id))banAll.splice(i,1);else seen.add(id);}}// the WFS pages overlap by a few records
banAll.sort((a,b)=>a.properties.id<b.properties.id?-1:1);
const A=banAll.map(f=>{const p=f.properties;return {id:p.id,fantoir:p.id_fantoir,number:p.numero,suffix:p.rep||null,street:p.nom_voie,postalCode:p.code_postal,commune:p.nom_commune,insee:p.code_insee,
 positionType:p.type_position,positionSource:p.source_position||null,parcels:(p.cad_parcelles||'').split('|').filter(Boolean),lieuDit:p.nom_ld||null,certified:p.certification_commune==='1',xy:project(f.geometry.coordinates)};});
// Display name of the street: the canonical name of the roads register V2.9.2 when the FANTOIR code names exactly one road
// there (accents and full words, e.g. « Avenue du Général de Gaulle »); otherwise the BAN name as published. Raw BAN name kept.
const canonicalStreet=fantoir=>{const rs=roadByFantoir.get(fantoir);return rs?.length===1?rs[0].canonical_name:null;};
const full=a=>`${a.number}${a.suffix?' '+a.suffix:''} ${a.street}`;
const banPlus=(await pages('banPlus')).map(f=>f.properties),rnb=(await Promise.all(M.sources.rnb.pages.map(p=>G(p.file)))).flatMap(j=>j.results);
const L=new Map();for(const l of banPlus){if(!B.has(l.id_bat))continue;if(!L.has(l.id_adr))L.set(l.id_adr,[]);L.get(l.id_adr).push(l);}
// RNB ↔ our buildings: the BD TOPO identifier of the RNB record, or the RNB identifier frozen on our footprint
const rnbOf=new Map();for(const r of rnb)for(const e of r.ext_ids||[])if(e.source==='bdtopo'&&B.has(e.id))rnbOf.set(e.id,r);
const byRnbId=new Map(rnb.map(r=>[r.rnb_id,r]));for(const b of B.values())if(b.rnb&&!rnbOf.has(b.id)&&byRnbId.has(b.rnb))rnbOf.set(b.id,byRnbId.get(b.rnb));
const R=new Map();for(const [bid,r] of rnbOf)for(const a of r.addresses||[])if(banIds.has(a.id)){if(!R.has(a.id))R.set(a.id,new Set());R.get(a.id).add(bid);}
// roads register: FANTOIR → BD TOPO sections (local frame)
const roads=(await J('docs/freeze/MLGU_ROADS_CANONICAL_V1.json')).roads,tr=new Map((await J('data-sources/roads/bdtopo-troncon-de-route.geojson')).features.map(f=>[f.properties.cleabs,(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(l=>l.map(c=>project(c)))]));
const roadByFantoir=new Map();for(const r of roads)for(const v of r.official_ref?.ban_voie||[]){if(!roadByFantoir.has(v))roadByFantoir.set(v,[]);roadByFantoir.get(v).push(r);}
for(const a of A){a.streetBan=a.street;a.street=canonicalStreet(a.fantoir)||a.street;a.streetSource=a.street===a.streetBan?'BAN':'registre des voies V2.9.2 (même code FANTOIR)';}
const roadDist=(fantoir,b)=>{const rs=roadByFantoir.get(fantoir);if(!rs)return null;let d=Infinity;const pts=b.polys.flatMap(p=>p[0]);for(const r of rs)for(const s of r.segments)for(const l of tr.get(s)||[])for(let i=1;i<l.length;i++)for(const p of pts)d=Math.min(d,segD(p,l[i-1],l[i]));return d;};
// protected places (V2.9.2): their address may only sit on their own buildings
const places=(await J('docs/freeze/MLGU_PLACES_CANONICAL_V1.json')).places,protectedAddr=new Map();
for(const p of places)if(p.address?.ban_id&&p.building_ids?.length)protectedAddr.set(p.address.ban_id,{place:p.id,name:p.canonical_name,buildings:new Set(p.building_ids)});
// cadastre registry V1 (V3.4): main parcel of each building, for the parcel cross-check only
const cad=await J('docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json'),mainParcel=new Map();for(const p of cad.parcels)for(const id of p.main_building_ids)mainParcel.set(id,p.parcel_id);

// ---------- address → building ----------
const anomalies=[],links=new Map(),candidates=new Map(),stats={rejectedSegmentNearest:0,rejectedParcelFanout:0,conflicts:0,roadFar:0,protectedRejected:0,singleChannel:0,positionContradiction:0};
const push=(m,k,v)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(v);};
const anomaly=(type,a,b,detail,decision)=>anomalies.push({type,address_id:a?.id||'',address:a?full(a):'',building_id:b||'',detail,decision});
for(const a of A){
 const votes=new Map(),weak=new Set(),vote=(id,ch)=>{if(!votes.has(id))votes.set(id,new Set());votes.get(id).add(ch);};
 // one building named by a source: the single linked building, or the only dwelling among the linked ones
 const named=ids=>{if(ids.length===1)return [ids[0],''];const d=ids.filter(id=>DWELLING(B.get(id).cls));return d.length===1?[d[0],'*']:[null,''];};
 const ls=[...new Set((L.get(a.id)||[]).map(l=>l.id_bat))].sort(),one=(L.get(a.id)||[]).find(l=>l.nb_bat===1);
 {const [id,star]=one?[one.id_bat,'']:named(ls);if(id)vote(id,'L'+star);for(const x of ls)if(x!==id)weak.add(x);}
 const rs=[...(R.get(a.id)||[])].sort();if(rs.length){const [id,star]=named(rs);if(id)vote(id,'R'+star);for(const x of rs)if(x!==id)weak.add(x);}
 const near=nearBuildings(a.xy,POSITION_NEAR_M);
 if(['bâtiment','entrée'].includes(a.positionType)&&near.length&&(near.length===1||near[0].d<near[1].d))vote(near[0].b.id,near[0].d===0?'P0':'P');
 else if(a.positionType==='parcelle'&&near.length)weak.add(near[0].b.id);
 // anomaly detectors: what a naive nearest-building geocoder would have done
 const naive=nearBuildings(a.xy,40)[0]?.b.id||null;
 const ids=[...votes.keys()].sort();let decision=null;
 if(ids.length>1){stats.conflicts++;for(const id of ids)push(candidates,id,{a,channels:[...votes.get(id)].sort(),reason:'sources en désaccord sur le bâtiment'});anomaly('conflit',a,ids.join(' | '),ids.map(id=>id+' : '+[...votes.get(id)].join('+')).join(' ; '),'REVIEW : aucune adresse affichée comme sûre');continue;}
 if(ids.length===1){const id=ids[0],ch=[...votes.get(id)].sort(),strong=ch.length>=2||ch.includes('P0');/* two channels, or a BAN building / entrance point inside the footprint */const b=B.get(id);
  const prot=protectedAddr.get(a.id);if(prot&&!prot.buildings.has(id)){stats.protectedRejected++;push(candidates,id,{a,channels:ch,reason:`adresse de ${prot.name} (registre V2.9.2), portée par un autre bâtiment`});anomaly('lieu protégé',a,id,`${prot.name} : bâtiments ${[...prot.buildings].join(', ')}`,'REVIEW : le lien est refusé');continue;}
  const rd=roadDist(a.fantoir,b);if(rd!==null&&rd>ROAD_NEAR_M){stats.roadFar++;push(candidates,id,{a,channels:ch,reason:`la voie de l’adresse passe à ${Math.round(rd)} m du bâtiment`});anomaly('voie éloignée',a,id,`${Math.round(rd)} m de ${a.street}`,'REVIEW');continue;}
  // an independent BAN entrance / building point that clearly designates another dwelling is an unexplained contradiction
  if(['bâtiment','entrée'].includes(a.positionType)&&!ch.some(c=>c.startsWith('P'))){const dw=nearBuildings(a.xy,60).filter(x=>DWELLING(x.b.cls)),own=footDist(a.xy,b);
   if(dw[0]&&dw[0].b.id!==id&&dw[0].d<own/2){stats.positionContradiction++;push(candidates,id,{a,channels:ch,reason:`le point BAN « ${a.positionType} » désigne un logement plus proche (${dw[0].d.toFixed(0)} m contre ${own.toFixed(0)} m)`});anomaly('position BAN contradictoire',a,id,`point « ${a.positionType} » à ${own.toFixed(1)} m ; logement ${dw[0].b.id} à ${dw[0].d.toFixed(1)} m`,'REVIEW');continue;}}
  if(!strong){stats.singleChannel++;push(candidates,id,{a,channels:ch,reason:'une seule source'});continue;}
  push(links,id,{a,channels:ch,roadM:rd===null?null:Math.round(rd)});decision=id;
  if(a.positionType==='segment'&&naive&&naive!==id){stats.rejectedSegmentNearest++;anomaly('segment trompeur',a,id,`le bâtiment le plus proche du point BAN « segment » est ${naive}, pas ${id}`,'lien retenu sur les sources concordantes, pas sur la proximité');}
  if(a.parcels.length&&mainParcel.get(id)&&!a.parcels.includes(mainParcel.get(id)))anomaly('parcelle BAN différente',a,id,`BAN : ${a.parcels.join(', ')} ; bâtiment sur ${mainParcel.get(id)}`,'lien conservé (deux sources concordantes), écart signalé');}
 for(const id of [...weak].sort())if(id!==decision&&!votes.has(id)){push(candidates,id,{a,channels:['faible'],reason:'lien de parcelle ou partagé entre plusieurs bâtiments'});stats.rejectedParcelFanout++;}
}

// ---------- building → status ----------
const out=[];const S={VERIFIED:0,MULTIPLE:0,REVIEW:0,UNKNOWN:0,NOT_APPLICABLE:0};
const addrOut=a=>({id:a.id,number:a.number,suffix:a.suffix,street:a.street,streetBan:a.streetBan,postalCode:a.postalCode,commune:a.commune,insee:a.insee,full:full(a),positionType:a.positionType});
const has=(ch,k)=>ch.some(c=>c.startsWith(k)),method=ch=>(has(ch,'L')&&has(ch,'R')?'official-link+rnb':has(ch,'L')?'official-link+position':has(ch,'R')?'rnb+position':'ban-position')+(ch.some(c=>c.endsWith('*'))?' (seul logement des bâtiments liés)':'');
for(const b of [...B.values()].sort((x,y)=>x.id<y.id?-1:1)){
 const ls=(links.get(b.id)||[]).sort((x,y)=>x.a.id<y.a.id?-1:1),cs=(candidates.get(b.id)||[]).filter(c=>!ls.some(l=>l.a.id===c.a.id));
 let status,notes=[];
 if(ls.length===1)status='VERIFIED';else if(ls.length>1)status='MULTIPLE';
 else{const real=cs.filter(c=>c.channels[0]!=='faible');
  if(real.length)status='REVIEW';
  else if(MINOR.has(b.cls)){status='NOT_APPLICABLE';notes.push('dépendance ou petite construction : pas d’adresse postale propre établie'+(cs.length?' (adresses de la parcelle non attribuées)':''));}
  else if(cs.length){status='REVIEW';}else status='UNKNOWN';}
 if(!b.inCommune)notes.push('bâtiment hors de la commune 10220 (périphérie visible)');
 S[status]++;
 const rec={buildingId:b.id,layer:b.layer,inCommune:b.inCommune,buildingClass:b.cls,status,method:ls.length?[...new Set(ls.map(l=>method(l.channels)))].join('|'):'none',
  addressIds:ls.map(l=>l.a.id),addresses:ls.map(l=>addrOut(l.a)),
  evidence:ls.map(l=>({addressId:l.a.id,channels:l.channels,roadDistanceM:l.roadM})),
  candidates:status==='VERIFIED'||status==='MULTIPLE'?[]:cs.slice(0,4).map(c=>({...addrOut(c.a),channels:c.channels,reason:c.reason})),
  sourceRefs:[...new Set(ls.flatMap(l=>l.channels.map(c=>({L:'BAN PLUS',R:'RNB',P:'BAN position'}[c[0]]))))].sort(),notes:notes.join(' ; ')||null};
 out.push(rec);}

// ---------- outputs ----------
const streets=[...new Set(out.flatMap(r=>[...r.addresses,...r.candidates].map(a=>a.street)))].sort(),si=new Map(streets.map((s,i)=>[s,i]));
const communes=[...new Set(out.flatMap(r=>[...r.addresses,...r.candidates].map(a=>a.commune)))].sort(),ci=new Map(communes.map((c,i)=>[c,i]));
const code={VERIFIED:'v',MULTIPLE:'m',REVIEW:'r',UNKNOWN:'u',NOT_APPLICABLE:'n'};
const edition=k=>((M.sources[k].capabilities?.title||'')+' '+(M.sources[k].capabilities?.abstract||'')).match(/[ée]dition\s*:?\s*(\d{4}-\d{2}-\d{2})/i)?.[1]||null;
const runtime={metadata:{version:'3.4.2',schema:'building-addresses/1',generatedBy:'scripts/addresses-v342/build-addresses.mjs',ban:{edition:edition('banCommune')},banPlus:{edition:edition('banPlus')},retrievedAt:M.retrievedAt,
  license:'Licence Ouverte 2.0 — BAN (IGN Géoplateforme), BAN PLUS (IGN), RNB',statuses:{v:'VERIFIED',m:'MULTIPLE',r:'REVIEW',u:'UNKNOWN',n:'NOT_APPLICABLE'},
  note:'a = [numéro, indice, rue (index dans streets), commune (index dans communes)] ; seules les adresses VERIFIED / MULTIPLE sont publiées, les REVIEW ne portent aucun numéro'},
 streets,communes,b:Object.fromEntries(out.map(r=>[r.buildingId,r.addresses.length?[code[r.status],r.addresses.map(a=>[a.number,a.suffix||'',si.get(a.street),ci.get(a.commune)])]:[code[r.status]]]))};
const report={metadata:{generatedBy:'scripts/addresses-v342/build-addresses.mjs',thresholds:{roadNearM:ROAD_NEAR_M,positionNearM:POSITION_NEAR_M},minorClasses:[...MINOR]},
 sources:{banAddresses:A.length,banCommune:A.filter(a=>a.insee==='10220').length,banByPositionType:Object.fromEntries(['bâtiment','entrée','parcelle','segment'].map(t=>[t,A.filter(a=>a.insee==='10220'&&a.positionType===t).length])),banPlusLinks:banPlus.length,banPlusLinksToOurBuildings:[...L.values()].flat().length,rnbBuildings:rnb.length,rnbLinkedToOurBuildings:rnbOf.size},
 buildings:{total:B.size,inCommune:[...B.values()].filter(b=>b.inCommune).length,outside:[...B.values()].filter(b=>!b.inCommune).length,byLayer:Object.fromEntries(['référentiel V1.6.2','ajout V2.0.1','manuel V2.2'].map(l=>[l,[...B.values()].filter(b=>b.layer===l).length]))},
 statuses:S,statusesInCommune:Object.fromEntries(Object.keys(S).map(k=>[k,out.filter(r=>r.inCommune&&r.status===k).length])),
 addresses:{verifiedLinks:[...links.values()].flat().length,distinctVerifiedAddresses:new Set([...links.values()].flat().map(l=>l.a.id)).size,commune10220Linked:new Set([...links.values()].flat().filter(l=>l.a.insee==='10220').map(l=>l.a.id)).size,byMethod:Object.fromEntries([...new Set(out.map(r=>r.method))].sort().map(m=>[m,out.filter(r=>r.method===m).length]))},
 rejected:stats,anomalies:anomalies.length};
const w=async(f,s)=>{const p=path.join(OUT,f);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,s);};
await w('public/data/building-addresses-v3.4.2.json',JSON.stringify(runtime)+'\n');
await w('docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json',`{"metadata":${JSON.stringify({...runtime.metadata,note:undefined,schema:'building-address-registry/1',sources:Object.fromEntries(Object.entries(M.sources).map(([k,v])=>[k,{features:v.features,edition:v.capabilities?edition(k):null}]))},null,1)},\n"stats":${JSON.stringify({statuses:S,buildings:report.buildings},null,1)},\n"buildings":[\n${out.map(r=>JSON.stringify(r)).join(',\n')}\n]}\n`);
const esc=v=>{const s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
await w('docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv','type;address_id;address;building_id;detail;decision\n'+anomalies.sort((x,y)=>(x.type+x.address_id)<(y.type+y.address_id)?-1:1).map(r=>[r.type,r.address_id,r.address,r.building_id,r.detail,r.decision].map(esc).join(';')).join('\n')+'\n');
await w(`${DIR}/build-report.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({statuses:S,inCommune:report.statusesInCommune,addresses:report.addresses,rejected:stats,anomalies:anomalies.length}));
