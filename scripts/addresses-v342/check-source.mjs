// V3.4.2 check:building-address-source — the address sources are the public datasets declared, intact, complete, dated,
// and carry no personal data.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
const ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8')),G=f=>gunzipSync(fs.readFileSync(f));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const M=read('data-sources/addresses-v342/source-manifest.json'),S=M.sources;
// 1. provenance and integrity
for(const [k,s] of Object.entries(S))for(const p of s.pages){const body=G(p.file);assert.equal(sha(body),p.sha256,`${k} : réponse modifiée ${p.file}`);assert.equal(body.length,p.bytes);}
const ed=k=>(S[k].capabilities.title+' '+S[k].capabilities.abstract).match(/[ée]dition\s*:?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];assert.ok(ed('banCommune'),'édition BAN');assert.ok(ed('banPlus'),'édition BAN PLUS');
for(const k of ['banCommune','banPlus'])assert.equal(sha(fs.readFileSync(S[k].capabilities.file)),S[k].capabilities.sha256,'capacités modifiées');
assert.equal(M.license,'Licence Ouverte / Open Licence 2.0 (Etalab)');assert.ok(M.attempts.some(a=>/adresse\.data\.gouv\.fr/.test(a.url)&&a.result==='échec'),'tentative BAN nationale documentée');
ok(`1. ${Object.values(S).reduce((n,s)=>n+s.pages.length,0)} réponses intactes (SHA-256 des octets reçus) : BAN édition ${ed('banCommune')} ; BAN PLUS édition ${ed('banPlus')} ; RNB API ; Licence Ouverte 2.0 ; export BAN national tenté, refus réseau documenté`);
// 2. completeness and perimeter
const feats=k=>S[k].pages.flatMap(p=>{const j=JSON.parse(G(p.file).toString('utf8'));return j.features||j.results;});
const ban=feats('banCommune'),ext=feats('banExtent'),bp=feats('banPlus'),rnb=feats('rnb');
assert.equal(ban.length,S.banCommune.pages[0].numberMatched,'pagination BAN');assert.ok(ban.every(f=>f.properties.code_insee==='10220'),'BAN : commune 10220 seule');
assert.equal(ext.length,S.banExtent.pages[0].numberMatched);assert.equal(bp.length,S.banPlus.pages[0].numberMatched);assert.equal(rnb.length,S.rnb.features);
assert.ok(ban.every(f=>/^10220_[0-9a-z]+_\d{5}(_[a-z0-9]+)?$/i.test(f.properties.id)),'identifiants BAN');
ok(`2. complet : ${ban.length} adresses BAN de la commune (= numberMatched), ${ext.length} dans l’emprise, ${bp.length} liens BAN PLUS, ${rnb.length} bâtiments RNB`);
// 3. no personal data: closed lists of attributes
const BAN_KEYS=['id','id_fantoir','numero','rep','nom_voie','code_postal','code_insee','nom_commune','code_insee_ancienne_commune','nom_ancienne_commune','x','y','lon','lat','type_position','alias','nom_ld','libelle_acheminement','nom_afnor','source_position','source_nom_voie','certification_commune','cad_parcelles'];
const BP_KEYS=['id_adr','id_bat','idu','type_lien','nb_adr','nb_bat'],RNB_ADDR=['id','ban_id','source','street_number','street_rep','street','city_name','city_zipcode','city_insee_code'];
for(const f of [...ban,...ext])for(const k of Object.keys(f.properties))assert.ok(BAN_KEYS.includes(k),'attribut BAN inattendu : '+k);
for(const f of bp)for(const k of Object.keys(f.properties))assert.ok(BP_KEYS.includes(k),'attribut BAN PLUS inattendu : '+k);
for(const r of rnb)for(const a of r.addresses||[])for(const k of Object.keys(a))assert.ok(RNB_ADDR.includes(k),'attribut RNB inattendu : '+k);
const runtime=read('public/data/building-addresses-v3.4.2.json');assert.deepEqual(Object.keys(runtime).sort(),['b','communes','metadata','streets']);
const reg=read('docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json'),ADDR=['id','number','suffix','street','streetBan','postalCode','commune','insee','full','positionType'];
for(const r of reg.buildings)for(const a of [...r.addresses,...r.candidates])for(const k of Object.keys(a))assert.ok([...ADDR,'channels','reason'].includes(k),'champ inattendu dans le registre : '+k);
assert.ok(!/propri[ée]taire|nom_?personne|telephone|t[ée]l[ée]phone|@[a-z]+\./i.test(JSON.stringify(runtime)+fs.readFileSync('docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json','utf8')),'donnée personnelle');
ok('3. aucune donnée personnelle : listes fermées d’attributs (BAN, BAN PLUS, adresses RNB, registre, index public) ; ni propriétaire, ni nom d’habitant, ni téléphone');
