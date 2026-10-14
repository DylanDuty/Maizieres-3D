// V3.4.2 check:building-address-links — the building ↔ address registry: complete, reproducible, honest, and checked against
// references that did not produce it. The rules are also run on two naive engines (nearest building to the BAN point; every
// building of the address's parcel): they must fail them, which shows the rules test something real.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {gunzipSync} from 'node:zlib';
import {projection,insidePoly} from '../../src/geo.js';
const ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8')),G=f=>JSON.parse(gunzipSync(fs.readFileSync(f)).toString('utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const REG=read('docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json').buildings,byId=new Map(REG.map(r=>[r.buildingId,r]));
// 1. reproducible
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'addr-v342-'));execFileSync(process.execPath,['scripts/addresses-v342/build-addresses.mjs','--out',tmp],{stdio:'ignore'});
const outs=['public/data/building-addresses-v3.4.2.json','docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json','docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv','data-sources/addresses-v342/build-report.json'];
for(const f of outs)assert.equal(sha(path.join(tmp,f)),sha(f),'reconstruction différente : '+f);fs.rmSync(tmp,{recursive:true,force:true});
ok(`1. reconstruction depuis les sources : ${outs.length} sorties identiques octet pour octet`);
// 2. complete and coherent: every frozen building has exactly one entry and one defined status
const ids=[];for(const f of ['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'])for(const ft of read(f).features)ids.push(ft.properties.id);
assert.equal(ids.length,2596);assert.deepEqual([...byId.keys()].sort(),[...ids].sort());
const ST=['VERIFIED','MULTIPLE','REVIEW','UNKNOWN','NOT_APPLICABLE'];const count=Object.fromEntries(ST.map(s=>[s,REG.filter(r=>r.status===s).length]));
for(const r of REG){assert.ok(ST.includes(r.status));if(r.status==='VERIFIED')assert.equal(r.addresses.length,1);else if(r.status==='MULTIPLE')assert.ok(r.addresses.length>=2);else assert.equal(r.addresses.length,0,'adresse publiée sans statut sûr : '+r.buildingId);
 for(const a of r.addresses){assert.match(a.number,/^\d+$/);assert.equal(a.full,`${a.number}${a.suffix?' '+a.suffix:''} ${a.street}`);}}
const runtime=read('public/data/building-addresses-v3.4.2.json');assert.equal(Object.keys(runtime.b).length,2596);
for(const r of REG){const e=runtime.b[r.buildingId];assert.equal(e[0],{VERIFIED:'v',MULTIPLE:'m',REVIEW:'r',UNKNOWN:'u',NOT_APPLICABLE:'n'}[r.status]);assert.equal((e[1]||[]).length,r.addresses.length,'index public ≠ registre : '+r.buildingId);}
ok(`2. 2 596 bâtiments, un statut chacun : ${ST.map(s=>`${s} ${count[s]}`).join(', ')} ; numéros publiés seulement pour VERIFIED / MULTIPLE ; index public = registre`);

// ---- the rules, applicable to any registry ----
const M=read('data-sources/addresses-v342/source-manifest.json'),ban=new Map();for(const k of ['banExtent','banCommune'])for(const p of M.sources[k].pages)for(const f of G(p.file).features)ban.set(f.properties.id,f.properties);
const places=read('docs/freeze/MLGU_PLACES_CANONICAL_V1.json').places.filter(p=>p.address?.ban_id&&p.building_ids?.length);
const banPlus=M.sources.banPlus.pages.flatMap(p=>G(p.file).features.map(f=>f.properties)),rnb=M.sources.rnb.pages.flatMap(p=>G(p.file).results);
const rnbOf=new Map();for(const r of rnb)for(const e of r.ext_ids||[])if(e.source==='bdtopo'&&byId.has(e.id))rnbOf.set(e.id,r);
// addresses that two sources tie to the same single building (IGN link to that building alone + RNB on that building alone)
const firm=new Map();{const L=new Map();for(const l of banPlus)if(l.nb_bat===1&&byId.has(l.id_bat))L.set(l.id_adr,l.id_bat);const R=new Map();for(const [b,r] of rnbOf)for(const a of r.addresses||[]){if(!R.has(a.id))R.set(a.id,new Set());R.get(a.id).add(b);}
 for(const [a,b] of L)if(R.get(a)?.size===1&&R.get(a).has(b)&&ban.has(a)){if(!firm.has(b))firm.set(b,new Set());firm.get(b).add(a);}}
const refused=new Set(fs.readFileSync('docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv','utf8').split('\n').slice(1).filter(l=>/REVIEW/.test(l)).map(l=>l.split(';')[1]));
const linksOf=reg=>{const m=new Map();for(const r of reg)for(const a of r.addressIds||[]){if(!m.has(a))m.set(a,[]);m.get(a).push(r.buildingId);}return m;};
function rules(reg){const fails=[],links=linksOf(reg),regById=new Map(reg.map(r=>[r.buildingId,r]));
 for(const p of places){const b=links.get(p.address.ban_id)||[];for(const x of b)if(!p.building_ids.includes(x))fails.push(`lieu protégé : ${p.canonical_name} (${p.address.full}) sur ${x}`);}
 for(const [a,bs] of links)if(bs.length>1)fails.push(`adresse sur plusieurs bâtiments : ${a} → ${bs.length}`);
 for(const r of reg)for(const e of r.evidence||[{addressId:null,channels:r.method==='segment-nearest'?['S']:[]}]){if(!e.addressId&&r.method!=='segment-nearest')continue;const ch=e.channels;if(!(ch.length>=2||ch.includes('P0')))fails.push(`lien sur une seule preuve : ${r.buildingId} ${e.addressId||''} (${ch.join('+')||r.method})`);}
 // a missing one is acceptable only when its refusal is written in the anomalies (protected place, conflict between sources)
 for(const [b,as] of firm){const r=regById.get(b);if(!r)continue;const got=new Set(r.addressIds||[]);for(const a of as)if(!got.has(a)&&r.status!=='REVIEW'&&!refused.has(a))fails.push(`adresse sûre perdue : ${b} ${a}`);}
 return fails;}
// naive engines
const project=projection(read('public/data/v2-scene.json').metadata.origin),fp=new Map();
for(const f of ['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'])for(const ft of read(f).features){const g=ft.geometry;fp.set(ft.properties.id,(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(c=>project(c)))));}
const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const near=xy=>{let best=null,bd=40;for(const [id,polys] of fp){const r0=polys[0][0][0];if(Math.abs(r0[0]-xy[0])>140||Math.abs(r0[1]-xy[1])>140)continue;for(const poly of polys){if(insidePoly(xy,poly))return id;for(const r of poly)for(let i=1;i<r.length;i++){const d=segD(xy,r[i-1],r[i]);if(d<bd){bd=d;best=id;}}}}return best;};
const naiveNearest=()=>{const m=new Map();for(const a of ban.values()){if(a.code_insee!=='10220')continue;const b=near(project([a.lon,a.lat]));if(!b)continue;if(!m.has(b))m.set(b,[]);m.get(b).push(a.id);}return [...m].map(([b,as])=>({buildingId:b,addressIds:as.slice(0,1),method:'segment-nearest'}));};
const naiveParcel=()=>{const byParcel=new Map();for(const p of read('docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json').parcels)byParcel.set(p.parcel_id,p.main_building_ids);const m=new Map();
 for(const l of banPlus)for(const b of byParcel.get(l.idu)||[]){if(!m.has(b))m.set(b,new Set());m.get(b).add(l.id_adr);}return [...m].map(([b,as])=>({buildingId:b,addressIds:[...as],evidence:[...as].map(a=>({addressId:a,channels:['L','R']}))}));};
// 3. the registry passes the rules
const mine=rules(REG);assert.deepEqual(mine,[],mine.slice(0,5).join(' | '));
ok(`3. règles respectées : aucune adresse d’un lieu protégé V2.9.2 sur un autre bâtiment, aucune adresse sur deux bâtiments, aucun lien sur une seule preuve (jamais un point BAN « segment »), ${[...firm.values()].reduce((n,s)=>n+s.size,0)} adresses sûres (IGN + RNB sur un seul bâtiment) conservées, plusieurs par bâtiment comprises, sauf refus écrit dans les anomalies (${[...firm.values()].flatMap(s=>[...s]).filter(a=>refused.has(a)).length} : lieu protégé, sources en désaccord)`);
// 4. negative tests: the naive engines fail the same rules
const n1=rules(naiveNearest()),n2=rules(naiveParcel());
const has=(f,re)=>f.some(x=>re.test(x));
assert.ok(has(n1,/^lien sur une seule preuve/),'le moteur « plus proche » devrait échouer (segment)');assert.ok(has(n1,/^adresse sûre perdue/),'le moteur « plus proche » devrait réduire des adresses multiples à une');
assert.ok(has(n1,/^lieu protégé/),'le moteur « plus proche » devrait mal placer un lieu protégé');assert.ok(has(n2,/^adresse sur plusieurs bâtiments/),'le moteur « parcelle » devrait distribuer une adresse à plusieurs bâtiments');
const prot=n1.filter(x=>/^lieu protégé/.test(x));
ok(`4. tests négatifs : le moteur « bâtiment le plus proche du point BAN » échoue (${n1.filter(x=>/une seule preuve/.test(x)).length} liens sur un point segment, ${n1.filter(x=>/perdue/.test(x)).length} adresses multiples réduites, ${prot.length} lieu(x) protégé(s) mal placé(s), ex. ${prot[0].replace(/^lieu protégé : /,'')}) ; le moteur « toute la parcelle » échoue (${n2.filter(x=>/plusieurs bâtiments/.test(x)).length} adresses données à plusieurs bâtiments)`);
// targeted mutations of the real registry (brief cases 1, 2, 3, 5): each must be caught
const mutate=f=>{const reg=REG.map(r=>({...r,addressIds:[...r.addressIds],evidence:r.evidence.map(e=>({...e}))}));f(new Map(reg.map(r=>[r.buildingId,r])));return rules(reg);};
const MAIRIE='BATIMENT0000000301149547',ECOLE='BATIMENT0000000301149527',mairieAddr='10220_0170_00006',across=REG.find(r=>r.status==='VERIFIED'&&r.addresses[0].street==='Rue des Écoles'&&r.buildingId!==MAIRIE);
const house=REG.find(r=>r.status==='VERIFIED'&&r.buildingClass.startsWith('RES_')),houseNext=REG.find(r=>r!==house&&r.buildingClass.startsWith('RES_')&&r.status!=='VERIFIED');
const multi=REG.find(r=>r.status==='MULTIPLE'&&[...(firm.get(r.buildingId)||[])].length>=2);
const cases=[['la mairie (6 rue des Écoles) reliée au bâtiment d’en face, '+across.addresses[0].full,m=>{const r=m.get(across.buildingId);r.addressIds.push(mairieAddr);r.evidence.push({addressId:mairieAddr,channels:['L','R']});},/^lieu protégé : Mairie/],
 ['l’école captant l’adresse de la mairie',m=>{const r=m.get(ECOLE);r.addressIds.push(mairieAddr);r.evidence.push({addressId:mairieAddr,channels:['L','R']});},/^lieu protégé : Mairie/],
 ['une maison recevant aussi l’adresse de sa voisine',m=>{const r=m.get(houseNext.buildingId);r.addressIds.push(house.addressIds[0]);r.evidence.push({addressId:house.addressIds[0],channels:['L','R']});},/^adresse sur plusieurs bâtiments/],
 ['plusieurs adresses sûres réduites à la première',m=>{const r=m.get(multi.buildingId);r.addressIds=r.addressIds.slice(0,1);r.status='VERIFIED';},/^adresse sûre perdue/]];
for(const [label,f,re] of cases)assert.ok(mutate(f).some(x=>re.test(x)),'mutation non détectée : '+label);
ok(`4 bis. mutations ciblées du registre, toutes rejetées : ${cases.map(c=>c[0]).join(' ; ')}`);
// 5. references that did not produce the registry
const links=linksOf(REG);let pAgree=0,pElse=0;for(const p of places){const b=links.get(p.address.ban_id);if(!b)continue;if(b.every(x=>p.building_ids.includes(x)))pAgree++;else pElse++;}
let cT=0,cOk=0;const parcelsOf=new Map();for(const p of read('docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json').parcels)for(const x of p.building_ids){if(!parcelsOf.has(x.id))parcelsOf.set(x.id,new Set());parcelsOf.get(x.id).add(p.parcel_id);}
for(const [a,bs] of links){const ad=ban.get(a);if(!ad?.cad_parcelles)continue;cT++;if(ad.cad_parcelles.split('|').some(q=>parcelsOf.get(bs[0])?.has(q)))cOk++;}
let eT=0,eOk=0;const cls=new Map(REG.map(r=>[r.buildingId,r.buildingClass]));
for(const r of REG)for(const e of r.evidence){const ad=ban.get(e.addressId);if(!['entrée','bâtiment'].includes(ad.type_position)||e.channels.some(c=>c.startsWith('P')))continue;eT++;const xy=project([ad.lon,ad.lat]);
 let best=null,bd=Infinity;for(const [id,polys] of fp){if(!cls.get(id)?.startsWith('RES_'))continue;const r0=polys[0][0][0];if(Math.abs(r0[0]-xy[0])>160||Math.abs(r0[1]-xy[1])>160)continue;let d=Infinity;for(const poly of polys){if(insidePoly(xy,poly)){d=0;break;}for(const q of poly)for(let i=1;i<q.length;i++)d=Math.min(d,segD(xy,q[i-1],q[i]));}if(d<bd){bd=d;best=id;}}if(best===r.buildingId)eOk++;}
assert.equal(pElse,0);assert.ok(cOk/cT>=.9,`parcelle BAN : ${cOk}/${cT}`);assert.ok(eOk/eT>=.9,`entrée BAN : ${eOk}/${eT}`);
ok(`5. références indépendantes : registre des lieux V2.9.2 ${pAgree} concordants, 0 ailleurs ; parcelle déclarée par la BAN ${cOk}/${cT} ; point « entrée » / « bâtiment » de la BAN (non utilisé comme preuve) : logement le plus proche = bâtiment retenu ${eOk}/${eT}`);
