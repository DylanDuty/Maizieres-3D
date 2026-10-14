// V3.4.2 check:roads-spatial-v342 — every named road of the commune has passed the individual spatial screening, against
// references that did not produce the register (IGN named streets by FANTOIR code, OSM geometry, BAN addresses), and what
// the visitor uses agrees with it (click on several portions, search, label anchor, the D 619 / D 116 labels). The rules
// are also run on altered copies (« Poussay », reversed D20 transition, a section of rue Achille Flaubert given to « Chemin
// de la Pie », a road renamed in the register but not on the map): each alteration must be caught.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {loadRuntimeCatalogue} from '../runtime-catalogue.mjs';
import {buildSearchIndex,searchIndex,norm} from '../../src/search-index.js';
const ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
// 1. reproducible audit
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'roads-v342-'));execFileSync(process.execPath,['scripts/roads-v342/audit-roads.mjs','--out',tmp],{stdio:'ignore'});
for(const f of ['docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv','data-sources/addresses-v342/roads-audit-report.json'])assert.equal(sha(path.join(tmp,f)),sha(f),'audit différent : '+f);fs.rmSync(tmp,{recursive:true,force:true});
const A=read('data-sources/addresses-v342/roads-audit-report.json'),REG=read('docs/freeze/MLGU_ROADS_CANONICAL_V1.json');
ok(`1. audit reproductible : ${A.roads} voies (${A.inCommune} de la commune), CSV et rapport identiques octet pour octet`);
// 2. every road audited individually, statuses and screening
assert.equal(A.rows.length,REG.roads.length);assert.deepEqual(A.rows.map(r=>r.roadId),REG.roads.map(r=>r.road_id));
const com=A.rows.filter(r=>r.commune==='10220');assert.equal(com.length,72);
for(const r of A.rows){assert.ok(['PASS','PASS_WITH_LIMITATION','REVIEW','BLOCKER'].includes(r.status));assert.ok(r.status==='PASS'||r.issues,'statut sans motif : '+r.name);}
assert.equal(A.rows.filter(r=>r.status==='BLOCKER').length,0,'voie bloquante : '+A.rows.filter(r=>r.status==='BLOCKER').map(r=>r.name+' — '+r.issues).join(' | '));
assert.equal(A.clicks,A.clicksOnRoad,'clic sur une voie voisine');for(const r of com)assert.ok(r.clicks>0&&r.labelAnchorM!==null&&r.labelAnchorM<=3,'voie non cliquable ou étiquette hors tracé : '+r.name);
for(const l of A.routeLabels)assert.ok(l.distanceM<=5,`étiquette ${l.ref} à ${l.distanceM} m`);
const s=A.statusesInCommune;
ok(`2. ${com.length} voies de la commune contrôlées une à une : PASS ${s.PASS}, PASS_WITH_LIMITATION ${s.PASS_WITH_LIMITATION}, REVIEW ${s.REVIEW}, BLOCKER ${s.BLOCKER} ; ${A.clicks} clics (25, 50, 75 % de chaque tronçon) tous sur la bonne voie ; ancre des fiches sur le tracé ; étiquettes D 619 et D 116 à ${A.routeLabels.map(l=>l.distanceM+' m').join(' et ')} de leur route`);
// ---- the rules, applicable to an altered register / catalogue ----
function rules(roads,records,transitions){const fails=[],lines=records.filter(r=>r.type==='line'),byId=new Map(lines.map(r=>[r.id,r]));
 for(const r of lines)if(/poussay/i.test(r.name))fails.push('nom contredisant la BAN : '+r.name);
 for(const r of roads){const rec=byId.get(r.road_id);if(!rec){fails.push('voie absente de la carte : '+r.canonical_name);continue;}if(rec.name!==r.canonical_name)fails.push(`nom affiché ≠ registre : ${rec.name} / ${r.canonical_name}`);
  if(/chemin de la pie/i.test(r.canonical_name))fails.push('« Chemin de la Pie » nommé à la place de la rue Achille Flaubert');}
 // the IGN assignment of a BAN street (a typed voie, as in check:road-names: a voie without type, a zone or an addressing
 // lieu-dit such as « Les Granges » or « Zone Industrielle la Glacière » is not a street odonym)
 const ADDR=new Set(read('docs/freeze/roads-decisions-v2.9.2.json').addressingLocalities),ign=new Map();
 for(const v of read('data-sources/roads/bdtopo-voie-nommee.geojson').features.map(f=>f.properties))if(v.identifiant_voie_ban&&v.type_voie&&v.type_voie!=='zone'&&!ADDR.has(v.nom_voie_ban))for(const t of (v.liens_vers_supports||'').split('/'))ign.set(t.trim(),v.identifiant_voie_ban);
 for(const r of roads)for(const t of r.segments){const f=ign.get(t);if(f&&r.insee==='10220'&&!(r.official_ref?.ban_voie||[]).includes(f))fails.push(`tronçon ${t} de la voie BAN ${f} nommé ${r.canonical_name}`);}
 const d20=(transitions['D 20']?.[0]||[]).map(x=>x.name).filter(n=>!/^D 20$/.test(n));if(d20.join(' → ')!=='Rue Joliot-Curie → Rue Pasteur → Place Saint-Denis')fails.push('transition D20 : '+d20.join(' → '));
 const d619=(transitions['D 619']||[]).flat().map(x=>x.name);if(!d619.includes('Avenue du Général de Gaulle')||!d619.some(n=>/Pierre Sémard \(Romilly/.test(n)))fails.push('transition D619');
 const idx=buildSearchIndex(records);for(const r of roads.filter(r=>r.searchable)){const top=searchIndex(idx,r.canonical_name)[0]?.r;if(!top||norm(top.name)!==norm(r.canonical_name))fails.push('recherche : '+r.canonical_name);}
 return fails;}
const {catalogue}=loadRuntimeCatalogue();const clone=x=>JSON.parse(JSON.stringify(x));
const base=rules(REG.roads,catalogue.records,REG.transitions);assert.deepEqual(base,[],base.slice(0,4).join(' | '));
ok('3. règles : aucun « Poussay » ; nom affiché = registre pour les 111 voies ; « Chemin de la Pie » n’est le nom d’aucune voie ; aucun tronçon nommé contre l’attribution IGN d’une rue de la commune (lieux-dits d’adressage exclus, comme en V2.9.2) ; D20 : D 20 → Rue Joliot-Curie → Rue Pasteur → Place Saint-Denis ; D619 : Avenue du Général de Gaulle dans la commune, Rue Pierre Sémard à Romilly-sur-Seine ; recherche de chaque voie cherchable');
// 4. altered copies must be caught
const flaubert=REG.roads.find(r=>r.canonical_name==='Rue Achille Flaubert'),recFlaubert=catalogue.records.find(r=>r.id===flaubert.road_id);
const muts=[['« Poussay » réintroduit',()=>{const recs=catalogue.records.map(r=>r.id==='road:rue-basse-de-poussey'||/Poussey/.test(r.name)&&r.type==='line'?{...r,name:r.name.replace('Poussey','Poussay')}:r);return rules(REG.roads,recs,REG.transitions);},/Poussay|nom affiché/],
 ['transition D20 inversée',()=>{const t=clone(REG.transitions);t['D 20'][0].reverse();return rules(REG.roads,catalogue.records,t);},/transition D20/],
 ['tronçon de la rue Achille Flaubert donné au « Chemin de la Pie »',()=>{const roads=clone(REG.roads);const f=roads.find(r=>r.road_id===flaubert.road_id);const seg=f.segments.pop();roads.push({...f,road_id:'road:chemin-de-la-pie',canonical_name:'Chemin de la Pie',official_ref:{ban_voie:[],route:[]},segments:[seg]});
   return rules(roads,[...catalogue.records,{...recFlaubert,id:'road:chemin-de-la-pie',name:'Chemin de la Pie'}],REG.transitions);},/Chemin de la Pie|tronçon/],
 ['voie renommée dans le registre, pas sur la carte ni dans la recherche',()=>{const roads=clone(REG.roads);roads.find(r=>r.road_id===flaubert.road_id).canonical_name='Rue Gustave Flaubert';return rules(roads,catalogue.records,REG.transitions);},/nom affiché|recherche/]];
for(const [label,f,re] of muts){const r=f();assert.ok(r.some(x=>re.test(x)),'altération non détectée : '+label);}
ok(`4. altérations détectées : ${muts.map(m=>m[0]).join(' ; ')}`);
// 5. the review and the limitations are written, not silent
const rev=A.rows.filter(r=>r.status==='REVIEW');for(const r of rev)assert.ok(r.issues&&r.todo,'REVIEW sans motif ni suite : '+r.name);
assert.ok(rev.some(r=>r.name==='Rue Robert Galley'),'Rue Robert Galley (FANTOIR de Romilly-sur-Seine sur un tronçon de la commune) doit rester en REVIEW');
ok(`5. réserves écrites : ${rev.map(r=>`${r.name} (${r.issues.split(' ; ')[0].slice(0,70)}…)`).join(' ; ')} ; ${A.rows.filter(r=>r.status==='PASS_WITH_LIMITATION').length} limites documentées dans le CSV`);
