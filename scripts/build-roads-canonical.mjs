// V2.9.2 — canonical register of roads (docs/freeze/MLGU_ROADS_CANONICAL_V1.json) and its runtime projection
// (src/content/roads-runtime-v292.json).
// Until V2.9.1 the clickable streets were OSM ways grouped by their OSM name (src/cartography.js), while the drawn roads are
// the BD TOPO tronçons of the V1.8 reference: the map did not name what it showed, kept OSM spellings that contradict the
// official odonyms and could not find official streets that OSM leaves unnamed. The register names every drawn tronçon:
//   1. BAN odonym of the tronçon (BD TOPO nom_voie_ban, or the voie nommée that lists the tronçon among its supports);
//   2. otherwise its OSM name, accepted when it matches a BAN voie of the same commune or is documented in the decisions;
//   3. otherwise its route number (D 619…); otherwise the tronçon stays unnamed (drawn, not clickable).
// BAN "voies" that are addressing lieux-dits (Zone Industrielle la Glaciere, Les Granges…) never name a road. Displayed
// spelling: decisions file, else the OSM spelling when it equals the BAN one up to accents, else word-level typography.
// Geometry is never touched: a road record is a list of drawn tronçon ids. Frozen files are read only.
import fs from 'node:fs';import crypto from 'node:crypto';
import {loadRoadSources,nearestTroncon,sample,norm} from './roads-screening.mjs';
import {lines as geoLines,insidePoly} from '../src/geo.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const DEC=read('docs/freeze/roads-decisions-v2.9.2.json');
const COMMUNES={'10220':'Maizières-la-Grande-Paroisse','10323':'Romilly-sur-Seine','10089':'Châtres','10280':'Pars-lès-Romilly','10271':'Origny-le-Sec','51155':'Clesles','51492':'Saint-Just-Sauvage'};
const S=loadRoadSources(),REF=read('public/data/roads.geojson').features,SCENE=read('public/data/v2-scene.json');
const rendered=new Set(SCENE.roads.map(r=>r.id.replace(/^spline:/,'')));
const trById=new Map(S.tr.map(t=>[t.id,t])),ADDR=new Set(DEC.addressingLocalities),NOT_ROAD=new Set(DEC.collaborativeNotRoadNames);
const voieBySupport=new Map();for(const v of S.voies)for(const id of (v.liens_vers_supports||'').split('/').filter(Boolean))voieBySupport.set(id,v);
const voieByName=new Map();for(const v of S.voies.filter(v=>v.nom_voie_ban))if(!voieByName.has(norm(v.nom_voie_ban))||v.insee_commune==='10220')voieByName.set(norm(v.nom_voie_ban),v);
const expand=s=>s.replace(/^R /,'Rue ').replace(/^RTE /,'Route ').replace(/^AV /,'Avenue ').replace(/^CHE /,'Chemin ').replace(/^PL /,'Place ');
// Displayed spelling of a BAN odonym.
const osmForms=new Map();for(const f of REF){const p=f.properties;for(const b of p.nameBan||[])if(p.nameOsm&&norm(p.nameOsm)===norm(b)){const m=osmForms.get(b)||new Map();m.set(p.nameOsm,(m.get(p.nameOsm)||0)+1);osmForms.set(b,m);}}
const typo=s=>{let o=s;for(const [a,b] of Object.entries(DEC.words))o=o.replace(new RegExp(`\\b${a}\\b`,'g'),b);for(const [a,b] of Object.entries(DEC.hyphens))o=o.replace(a,b);return o;};
const display=ban=>DEC.display[ban]||(osmForms.has(ban)?[...osmForms.get(ban)].sort((a,b)=>b[1]-a[1])[0][0]:typo(ban));
const ROUTE=n=>n.replace(/^D(\d)/,'D $1');
const roadType=n=>/^D \d/.test(n)?'route départementale':(n.match(/^(Grande Rue|Rue|Ruelle|Avenue|Boulevard|Place|Placette|Chemin rural|Chemin|Le Chemin|Impasse|Voie|La Voie|La Ruelle|Route|Résidence)\b/)?.[1]||'voie').toLowerCase().replace(/^(le|la) /,'');
const mid=l=>l[Math.floor(l.length/2)];
// 1. name every drawn tronçon
const resolved=new Map(),unnamed=[];
for(const f of REF){const p=f.properties;if(!rendered.has(p.id))continue;const t=trById.get(p.id);
 const lines=geoLines(f,S.project);const m=mid(lines.reduce((a,b)=>a.length>b.length?a:b));
 const inseeBD=t?.insee?.length?t.insee:null,inC=S.boundaryPolys.some(poly=>insidePoly(m,poly));
 const insee=inseeBD?(inseeBD.includes('10220')&&inC?'10220':inseeBD.find(c=>c!=='10220')||inseeBD[0]):(inC?'10220':null);
 let r=null;const banNames=[...new Set([...(p.nameBan||[]),...(voieBySupport.get(p.id)?.nom_voie_ban?[voieBySupport.get(p.id).nom_voie_ban]:[])])];
 const streets=banNames.filter(n=>!ADDR.has(n)),localities=banNames.filter(n=>ADDR.has(n));
 if(streets.length){const pick=streets.find(n=>voieByName.get(norm(n))?.insee_commune===insee)||streets[0];r={name:display(pick),method:DEC.wayNamedLocalities.includes(pick)?'BAN (lieu-dit d’adressage portant un nom de voie)':'BAN',ban:pick,voie:voieByName.get(norm(pick))?.identifiant_voie_ban||null,others:streets.filter(n=>n!==pick)};}
 else if(p.nameOsm){const d=DEC.osmNameDecisions[p.nameOsm],canon=d?d.canonical:p.nameOsm,v=voieByName.get(norm(canon));
  r={name:v?display(v.nom_voie_ban):canon,method:v?'OSM = voie BAN (tronçon non relié dans la BD TOPO)':'OSM seul (absent de la BAN)',ban:v?.nom_voie_ban||null,voie:v?.identifiant_voie_ban||null,osm:p.nameOsm};}
 else{const c=(p.nameCollaboratif||[]).find(n=>!NOT_ROAD.has(n)&&!/^RTE DEPARTEMENTALE/.test(n)),v=c&&voieByName.get(norm(expand(c)));
  if(v&&!ADDR.has(v.nom_voie_ban))r={name:display(v.nom_voie_ban),method:'BD TOPO nom collaboratif = voie BAN',ban:v.nom_voie_ban,voie:v.identifiant_voie_ban};}
 if(!r&&p.routeNumber)r={name:ROUTE(p.routeNumber),method:'numéro de route BD TOPO (tronçon sans odonyme)'};
 const meta={id:p.id,insee,inCommune:inC,route:p.routeNumber?ROUTE(p.routeNumber):null,osm:p.nameOsm||null,collab:p.nameCollaboratif||[],localities,lengthM:p.lengthM||0,sector:p.sector||null,category:p.category,bridge:!!p.bridge,w:p.width};
 if(r)resolved.set(p.id,{...meta,...r});else unnamed.push(meta);}
// tronçons without INSEE outside the commune join the neighbouring road of the same name when there is exactly one
for(const t of resolved.values())if(t.insee==null){const same=[...new Set([...resolved.values()].filter(o=>o.name===t.name&&o.insee&&o.insee!=='10220').map(o=>o.insee))];if(same.length===1)t.insee=same[0];}
// 2. group into roads (same name, same commune)
const slug=s=>norm(s).replace(/ /g,'-');
const roads=new Map();
for(const t of resolved.values()){const key=t.name+'|'+(t.insee==='10220'?'10220':t.insee||'?');let r=roads.get(key);
 if(!r){r={road_id:'road:'+slug(t.name)+(t.insee==='10220'?'':'@'+(t.insee||'hors')),canonical_name:t.name,road_type:roadType(t.name),insee:t.insee,commune:COMMUNES[t.insee]||'commune voisine',official_ref:{ban_voie:new Set(),route_numbers:new Map()},segments:[],aliases:new Set(),methods:new Map(),lengthM:0,sectors:new Map(),localities:new Set()};roads.set(key,r);}
 r.segments.push(t.id);r.lengthM+=t.lengthM;if(t.voie)r.official_ref.ban_voie.add(t.voie);if(t.route)r.official_ref.route_numbers.set(t.route,(r.official_ref.route_numbers.get(t.route)||0)+t.lengthM);
 if(t.ban&&t.ban!==t.name)r.aliases.add(t.ban);if(t.osm&&t.osm!==t.name)r.aliases.add(t.osm);for(const o of t.others||[])r.aliases.add(o);for(const l of t.localities)r.localities.add(l);
 r.methods.set(t.method,(r.methods.get(t.method)||0)+t.lengthM);const sec=t.insee!=='10220'?'hors commune':t.sector&&t.sector!=='hors commune'?t.sector:'reste de la commune';r.sectors.set(sec,(r.sectors.get(sec)||0)+t.lengthM);}
// 3. V2.9.1 clickable streets (OSM) measured against the register, way by way
const segIndex=(()=>{const cell=40,g=new Map();S.tr.forEach((t,ti)=>t.lines.forEach(l=>{for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i];for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)for(let z=Math.floor(Math.min(a[1],b[1])/cell);z<=Math.floor(Math.max(a[1],b[1])/cell);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push([ti,a,b]);}}}));return {cell,g};})();
const roadOfTroncon=id=>{const t=resolved.get(id);if(!t)return null;return roads.get(t.name+'|'+(t.insee==='10220'?'10220':t.insee||'?')).road_id;};
const osmIdsToRoad=new Map();for(const f of REF)for(const w of f.properties.osmIds||[]){const r=roadOfTroncon(f.properties.id);if(r){const m=osmIdsToRoad.get(w)||new Map();m.set(r,(m.get(r)||0)+(f.properties.lengthM||1));osmIdsToRoad.set(w,m);}}
const feats=new Map(S.data.features.map(f=>[f.id,f])),osmWays={},legacy=[];
for(const rec of S.catalogue.records.filter(r=>r.type==='line'&&r.id.startsWith('road:'))){const ways=[];
 for(const w of rec.sourceIds){const pts=sample(geoLines(feats.get(w),S.project)),cnt=new Map();let none=0;
  for(const p of pts){const n=nearestTroncon(segIndex,p);const r=n&&roadOfTroncon(S.tr[n.ti].id);if(r)cnt.set(r,(cnt.get(r)||0)+1);else none++;}
  if(!cnt.size&&osmIdsToRoad.has(w))for(const [r,v] of osmIdsToRoad.get(w))cnt.set(r,v);
  const sorted=[...cnt].sort((a,b)=>b[1]-a[1]);if(sorted.length)osmWays[w]=sorted[0][0];
  ways.push({way:w,lengthM:pts.length*8,roads:sorted.map(([r,v])=>[r,Math.round(v*8)]),unnamedM:none*8});}
 legacy.push({id:rec.id,name:rec.name,refs:rec.refs,ways});}
// 4. anomalies on what V2.9.1 displayed
const byRoadId=new Map([...roads.values()].map(r=>[r.road_id,r]));const anomalies=[];
const A=(id,name,anomaly,old,nw,source,severity,status,comment)=>anomalies.push({id,type:'voie',name,anomaly,old,new:nw,source,severity,status,comment});
for(const l of legacy){const tot=l.ways.reduce((s,w)=>s+w.lengthM,0),agg=new Map();for(const w of l.ways)for(const [r,m] of w.roads)agg.set(r,(agg.get(r)||0)+m);
 const named=[...agg].map(([r,m])=>[byRoadId.get(r),m]).sort((a,b)=>b[1]-a[1]);const main=named[0]?.[0];const dec=DEC.osmNameDecisions[l.name];
 if(/^D \d/.test(l.name)){const streets=named.filter(([r,m])=>!/^D \d/.test(r.canonical_name)&&r.insee==='10220'&&m>=40);
  if(streets.length)A(l.id,l.name,'portion nommée affichée comme numéro de route',`« ${l.name} » sur ${streets.map(([r,m])=>`${r.canonical_name} (${m} m)`).join(', ')}`,'odonyme BAN sur chaque portion ; numéro de route conservé hors agglomération','BAN / BD TOPO tronçons','MAJOR','CORRIGÉ','le clic sur ces portions donnait « '+l.name+' » au lieu du nom de la rue');continue;}
 if(!main){A(l.id,l.name,'voie sans correspondance BD TOPO',l.name,'—','criblage V2.9.2','MINOR','ACCEPTÉ','tracé OSM sans tronçon BD TOPO à moins de 12 m');continue;}
 if(dec&&dec.canonical!==l.name){A(l.id,l.name,'nom affiché ≠ odonyme officiel',l.name,dec.canonical,'BAN '+([...main.official_ref.ban_voie][0]||''),dec.severity,'CORRIGÉ',dec.comment);continue;}
 if(norm(main.canonical_name)!==norm(l.name)&&main.canonical_name!==l.name)A(l.id,l.name,'nom affiché ≠ odonyme officiel',l.name,main.canonical_name,'BAN '+([...main.official_ref.ban_voie][0]||''),'MAJOR','CORRIGÉ','tracé OSM superposé aux tronçons BD TOPO de « '+main.canonical_name+' »');
 else if(main.canonical_name!==l.name)A(l.id,l.name,'typographie',l.name,main.canonical_name,'BAN '+([...main.official_ref.ban_voie][0]||''),'INFO','CORRIGÉ','graphie harmonisée');
 const others=named.slice(1).filter(([r,m])=>m>=80&&!/^D \d/.test(r.canonical_name)&&r.canonical_name!==main.canonical_name);
 if(others.length)A(l.id,l.name,'transition de nom dans un même tracé OSM',`« ${l.name} » couvrait aussi ${others.map(([r,m])=>`${r.canonical_name} (${m} m)`).join(', ')}`,'chaque portion porte son odonyme BAN','BAN / BD TOPO tronçons','MAJOR','CORRIGÉ','début et fin du nom fixés par les tronçons officiels');
 if(main.insee!=='10220')A(l.id,l.name,'voie hors commune présentée sans sa commune',l.name,`${main.canonical_name} — ${main.commune}`,'BD TOPO insee_commune','MINOR','CORRIGÉ','cliquable avec sa commune ; retirée de la recherche (réservée à la commune)');}
const clickable=new Set(legacy.map(l=>norm(l.name)));
for(const r of roads.values())if(r.insee==='10220'&&!/^D \d/.test(r.canonical_name)&&!clickable.has(norm(r.canonical_name))&&![...r.aliases].some(a=>clickable.has(norm(a))))A(r.road_id,r.canonical_name,'voie officielle ni cliquable ni cherchable','—',r.canonical_name,'BAN '+([...r.official_ref.ban_voie][0]||'')+' / BD TOPO','MINOR','CORRIGÉ','aucun tracé OSM nommé : la voie était dessinée sans nom');
// 5. name transitions along each route number (chained through the V1.8 nodes)
const transitions={};
for(const num of [...new Set(REF.map(f=>f.properties.routeNumber).filter(Boolean))].sort()){const fs_=REF.filter(f=>f.properties.routeNumber===num&&rendered.has(f.properties.id));const adj=new Map();
 for(const f of fs_){const {nodeA:a,nodeB:b}=f.properties;for(const [x,y] of [[a,b],[b,a]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push([y,f]);}}
 const seen=new Set(),chains=[];
 for(const start of [...adj.keys()].sort((a,b)=>adj.get(a).length-adj.get(b).length)){if(adj.get(start).every(([,f])=>seen.has(f.properties.id)))continue;let node=start,chain=[];
  for(;;){const next=adj.get(node).find(([,f])=>!seen.has(f.properties.id));if(!next)break;seen.add(next[1].properties.id);chain.push(next[1]);node=next[0];}if(chain.length)chains.push(chain);}
 transitions[ROUTE(num)]=chains.sort((a,b)=>b.length-a.length).slice(0,3).map(ch=>{const seq=[];for(const f of ch){const t=resolved.get(f.properties.id),label=t?`${t.name}${t.insee!=='10220'?' ('+(COMMUNES[t.insee]||t.insee)+')':''}`:'(sans nom)';const L=f.properties.lengthM||0;if(seq.length&&seq.at(-1).name===label)seq.at(-1).lengthM+=L;else seq.push({name:label,lengthM:L});}return seq.map(s=>({...s,lengthM:Math.round(s.lengthM)}));});}
// 6. rail, level crossings, bridges
const rail={lines:[{rail_id:'rail:ligne-1000',canonical_name:'Ligne de Paris-Est à Mulhouse-Ville',aliases:['ligne 1000','1000'],official_ref:'SNCF Réseau, ligne 1000',osm_ways:S.catalogue.records.filter(r=>r.id==='rail:Ligne de Paris-Est à Mulhouse-Ville'||r.id==='rail:1000').flatMap(r=>r.sourceIds),audit_status:'PASS',notes:'la voie de liaison OSM ref 1000 (crossover) rejoint la ligne ; elle était cliquable et cherchable sous le nom « 1000 »'},
 {rail_id:'rail:voies-de-service',canonical_name:'Voie ferrée de service',aliases:['1','2','3','4'],official_ref:null,osm_ways:S.catalogue.records.filter(r=>/^rail:[1-4]$/.test(r.id)).flatMap(r=>r.sourceIds),audit_status:'PASS_WITH_LIMITATION',notes:'voies d’embranchement et de garage (OSM service=siding/spur, ref = numéro de voie) : elles étaient cliquables et cherchables sous les noms « 1 », « 2 », « 3 », « 4 » ; désormais « Voie ferrée de service », non cherchables'}],
 levelCrossings:SCENE.levelCrossings.map(pn=>({id:pn.id,number:pn.n,road_raw:pn.road,road:(pn.road||'').split(' / ').map(n=>ADDR.has(n)?n:display(n)).join(' / ')||null,position:[pn.p[0],pn.p[1]]}))};
for(const r of legacy.filter(l=>/^rail:[1-4]$|^rail:1000$/.test(l.id)))A(r.id,r.name,'voie ferrée nommée par un numéro',`« ${r.name} »`,r.id==='rail:1000'?'Ligne de Paris-Est à Mulhouse-Ville':'Voie ferrée de service (non cherchable)','OSM ref','MINOR','CORRIGÉ','le numéro OSM (ref) servait de nom');
// 6b. bridges, level crossings, hydronyms, sector labels (semantic audit; nothing is redrawn)
const PLACES=read('docs/freeze/MLGU_PLACES_CANONICAL_V1.json').places,placeById=new Map(PLACES.map(p=>[p.id,p]));
const local=ll=>S.project(ll),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const bridges=REF.filter(f=>f.properties.structure==='pont'||f.properties.bridge).map(f=>{const p=f.properties,b=p.bridge||{},L=geoLines(f,S.project).flat(),m=L[Math.floor(L.length/2)],t=resolved.get(p.id);
 const poi=PLACES.filter(e=>e.type==='pont'&&e.anchor.lonlat).map(e=>[dist(local(e.anchor.lonlat),m),e]).filter(([d])=>d<40).sort((a,b)=>a[0]-b[0])[0]?.[1]||null;
 return {troncon:p.id,road:t?t.name:null,ouvrage:b.ouvrageBdtopo||null,crosses:b.crosses||[],lengthM:b.lengthM?Math.round(b.lengthM):null,clearanceM:b.maxClearanceOverTerrainM??null,place:poi?{id:poi.id,name:poi.canonical_name,display_status:poi.display_status}:null,position:m.map(v=>Math.round(v))};}).filter(b=>b.ouvrage||b.crosses.length);
const bridgePlaces=PLACES.filter(e=>e.type==='pont').map(e=>({id:e.id,name:e.canonical_name,display_status:e.display_status,bridges:bridges.filter(b=>b.place?.id===e.id).map(b=>({troncon:b.troncon,road:b.road,crosses:b.crosses,ouvrage:b.ouvrage}))}));
const pnPlaces=PLACES.filter(e=>e.type==='passage_a_niveau');
rail.levelCrossings=rail.levelCrossings.map(pn=>{const near=pnPlaces.filter(e=>e.anchor.lonlat).map(e=>[dist(local(e.anchor.lonlat),pn.position),e]).sort((a,b)=>a[0]-b[0])[0];const inC=S.boundaryPolys.some(poly=>insidePoly(pn.position,poly));
 return {...pn,in_commune:inC,place:near&&near[0]<25?{id:near[1].id,name:near[1].canonical_name,display_status:near[1].display_status,distanceM:Math.round(near[0])}:null,interactive:!!(near&&near[0]<25&&['PASS','PASS_WITH_LIMITATION'].includes(near[1].display_status))};});
const hydro=(()=>{const m=new Map();for(const w of SCENE.waterLines){let L=0;for(let i=2;i<w.p.length;i+=2)L+=Math.hypot(w.p[i]-w.p[i-2],w.p[i+1]-w.p[i-1]);const k=w.n||'(sans nom)';m.set(k,(m.get(k)||0)+L);}
 return [...m].sort((a,b)=>b[1]-a[1]).map(([name,L])=>({name,lengthM:Math.round(L),source:name==='(sans nom)'?null:'BD TOPO tronçon hydrographique (v2-scene waterLines)',interactive:false,displayed_as_label:false}));})();
const labels=['poi:bourg','poi:poussey','poi:les-granges','poi:parc-aerodrome','poi:glaciere','poi:bdtopo:PAIHABIT0000000009338387'].map(id=>{const e=placeById.get(id);return {id,name:e.canonical_name,category:e.category,display_status:e.display_status,anchor:e.anchor,in_commune:e.in_commune,sources:e.source_priority};});
A('rail:Ligne de Paris-Est à Mulhouse-Ville','Ligne de Paris-Est à Mulhouse-Ville','type de voie affiché','fiche « Route 1000 » (le numéro de ligne OSM lu comme un numéro de route)','« Voie ferrée · ligne 1000 »','OSM ref / src/selection.js','MINOR','CORRIGÉ','la ligne ferroviaire était présentée comme une route');
const hydroNotes=[{name:'Ruisseau des Moulins de Poussey',note:'nom BD TOPO du cours d’eau principal de Poussey (Bible 01 §13.2, A)'},{name:'Bras des Moulins de Poussey',note:'nom BD TOPO d’un bras distinct'},{name:'Rivière du Moulin',note:'nom porté par l’ouvrage BD TOPO du pont de Clairvaux (champ « crosses ») et par OSM ; Bible 05 : « rivière du Moulin près du pont de Clairvaux »'},{name:'canal de Poussey',note:'employé par un bulletin municipal ; correspondance exacte non établie (Bible 01 §13.2) : n’est affiché nulle part, n’est pas un alias'}];
// 7. outputs
const out=[...roads.values()].map(r=>{const nums=[...r.official_ref.route_numbers].filter(([,m])=>m>=Math.min(80,r.lengthM*.2)).map(([n])=>n);const methods=[...r.methods].sort((a,b)=>b[1]-a[1]);
 const status=r.insee!=='10220'?'PASS_WITH_LIMITATION':methods[0][0]==='BAN'||methods[0][0].startsWith('OSM = voie BAN')||methods[0][0].startsWith('BD TOPO nom collaboratif')?'PASS':'PASS_WITH_LIMITATION';
 const sector=[...r.sectors].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
 return {road_id:r.road_id,canonical_name:r.canonical_name,aliases:[...r.aliases].sort(),road_type:r.road_type,official_ref:{ban_voie:[...r.official_ref.ban_voie],route:nums},commune:r.commune,insee:r.insee,sector,segments:r.segments,lengthM:Math.round(r.lengthM),naming:methods.map(([m,l])=>({method:m,lengthM:Math.round(l)})),addressing_localities:[...r.localities],valid_from:null,valid_to:null,
  sources:['IGN BD TOPO tronçons de route (data-sources/roads/bdtopo-troncon-de-route.geojson)','IGN BD TOPO voies nommées / BAN (data-sources/roads/bdtopo-voie-nommee.geojson)',...(methods.some(([m])=>m.startsWith('OSM'))?['OpenStreetMap (public/data/maizieres.geojson)']:[])],
  audit_status:status==='PASS'?'PASS':'PASS',display_status:status,searchable:r.insee==='10220',notes:status==='PASS'?null:methods[0][0].startsWith('OSM seul')?'nom OSM seul, absent de la BAN':methods[0][0].startsWith('numéro')?'tronçon sans odonyme : désigné par son numéro de route':r.insee!=='10220'?`voie de ${r.commune}`:null};}).sort((a,b)=>a.road_id.localeCompare(b.road_id));
const count=(k,v)=>out.filter(r=>r[k]===v).length;
const meta={version:'1.0',release:'V2.9.2',date:'2026-10-11',generatedBy:'scripts/build-roads-canonical.mjs',decisions:{file:'docs/freeze/roads-decisions-v2.9.2.json',sha256:sha('docs/freeze/roads-decisions-v2.9.2.json')},
 sources:{roads:{file:'public/data/roads.geojson',sha256:sha('public/data/roads.geojson')},scene:{file:'public/data/v2-scene.json',sha256:sha('public/data/v2-scene.json')},bdtopo:'data-sources/roads/bdtopo-troncon-de-route.geojson',voies:'data-sources/roads/bdtopo-voie-nommee.geojson',osm:'public/data/maizieres.geojson'},
 counts:{drawnTroncons:rendered.size,namedTroncons:resolved.size,unnamedTroncons:unnamed.length,roads:out.length,inCommune:count('insee','10220'),outsideCommune:out.length-count('insee','10220'),PASS:count('display_status','PASS'),PASS_WITH_LIMITATION:count('display_status','PASS_WITH_LIMITATION'),routeOnly:out.filter(r=>/^D \d/.test(r.canonical_name)).length,
  banVoies10220:S.voies.filter(v=>v.insee_commune==='10220'&&v.nom_voie_ban).length,banStreets10220Covered:new Set(out.filter(r=>r.insee==='10220').flatMap(r=>r.official_ref.ban_voie)).size,legacyClickable:legacy.length,anomalies:anomalies.length}};
fs.writeFileSync('docs/freeze/MLGU_ROADS_CANONICAL_V1.json',JSON.stringify({metadata:meta,roads:out,transitions,legacyClickableStreets:legacy,rail,bridges:{places:bridgePlaces,structures:bridges},hydronyms:{lines:hydro,notes:hydroNotes},sectorLabels:labels,unnamedTroncons:{count:unnamed.length,lengthM:Math.round(unnamed.reduce((s,t)=>s+t.lengthM,0)),byCategory:Object.fromEntries([...unnamed.reduce((m,t)=>m.set(t.category,(m.get(t.category)||0)+1),new Map())])}},null,1)+'\n');
const short=id=>id.replace(/^TRONROUT0+/,'T');
fs.writeFileSync('src/content/roads-runtime-v292.json',JSON.stringify({version:'V2.9.2',register:'docs/freeze/MLGU_ROADS_CANONICAL_V1.json',roads:out.map(r=>({id:r.road_id,name:r.canonical_name,type:r.road_type,ref:r.official_ref.route.map(ROUTE),commune:r.insee==='10220'?null:r.commune,searchable:r.searchable,aliases:r.aliases,s:r.segments.map(short)})),osmWays,rail:{'rail:Ligne de Paris-Est à Mulhouse-Ville':{name:'Ligne de Paris-Est à Mulhouse-Ville'},'rail:1000':{merge:'rail:Ligne de Paris-Est à Mulhouse-Ville'},'rail:1':{service:true},'rail:2':{service:true},'rail:3':{service:true},'rail:4':{service:true}}})+'\n');
fs.writeFileSync('docs/audit/v2.9.2-roads-anomalies.json',JSON.stringify(anomalies,null,1)+'\n');
console.log(JSON.stringify(meta.counts));
