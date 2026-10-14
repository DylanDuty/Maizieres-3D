// V3.4.2 check:building-address-ui — what the visitor reads on a click: the address first on an ordinary building, an honest
// fallback otherwise, several addresses as a list, places keeping their own card. The card code is executed in Node on the
// registry (no browser); the wiring of the selection is read in the source. The click itself is covered by the Chromium QA.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createAddressIndex,addressCard,ADDRESS_TEXT,LIST_MAX} from '../../src/addresses-v342.js';
import {describe} from '../../src/selection.js';
const ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const REG=read('docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json').buildings,idx=createAddressIndex(read('public/data/building-addresses-v3.4.2.json'));
const sel=fs.readFileSync('src/selection.js','utf8'),main=fs.readFileSync('src/main.js','utf8');
// 1. every building has a defined card; the primary text is the address for VERIFIED, a list for MULTIPLE, a fallback otherwise
const seen={};
for(const r of REG){const c=addressCard(idx.get(r.buildingId),'Maison');assert.ok(c&&c.title&&c.eyebrow,'carte indéfinie : '+r.buildingId);seen[c.status]=(seen[c.status]||0)+1;
 if(r.status==='VERIFIED'){assert.equal(c.title,r.addresses[0].full);assert.equal(c.eyebrow,ADDRESS_TEXT.eyebrow);assert.equal(c.sub,r.addresses[0].commune);}
 else if(r.status==='MULTIPLE'){assert.equal(c.title,ADDRESS_TEXT.many);assert.equal(c.list.length,Math.min(r.addresses.length,LIST_MAX));if(r.addresses.length<=LIST_MAX)assert.deepEqual(c.list,r.addresses.map(a=>a.full));}
 else{assert.equal(c.title,{REVIEW:ADDRESS_TEXT.review,UNKNOWN:ADDRESS_TEXT.unknown,NOT_APPLICABLE:ADDRESS_TEXT.none}[r.status]);assert.ok(!/\d/.test(c.title+(c.sub||'')+c.list.join('')),'numéro affiché sans adresse sûre : '+r.buildingId);}}
ok(`1. 2 596 bâtiments, une carte définie chacun : adresse en titre (${seen.VERIFIED}), « Plusieurs adresses » et liste (${seen.MULTIPLE}), « Adresse à confirmer » (${seen.REVIEW}), « Adresse non renseignée » (${seen.UNKNOWN}), « Sans adresse propre » (${seen.NOT_APPLICABLE}) ; aucun numéro sans adresse sûre`);
// 2. the card text of an ordinary building (describe, the function the selection renders)
const v=REG.find(r=>r.status==='VERIFIED'),m=REG.find(r=>r.status==='MULTIPLE'),q=REG.find(r=>r.status==='REVIEW');
const generic=(r,kind='Maison')=>({id:r.buildingId,type:'building',generic:true,name:kind,kind:'Bâtiment sans nom connu',info:{usage:'Résidentiel',knownUsage:true,floors:1,wallHeight:5,heightSource:'IGN BD TOPO'},address:addressCard(idx.get(r.buildingId),kind)});
let d=describe(generic(v));assert.equal(d.title,v.addresses[0].full);assert.equal(d.eyebrow,'Adresse');assert.equal(d.address,v.addresses[0].commune);assert.ok(!d.keep.some(t=>/BATIMENT|m²|Hauteur/.test(t)),'métadonnées techniques en tête');
d=describe(generic(m));assert.equal(d.title,'Plusieurs adresses');assert.deepEqual(d.list,m.addresses.slice(0,LIST_MAX).map(a=>a.full));
d=describe(generic(q));assert.equal(d.title,'Adresse à confirmer');assert.equal(d.eyebrow,'Maison');
ok('2. carte d’une maison : « Adresse » puis numéro et voie, commune en dessous ; plusieurs adresses en liste ; « Adresse à confirmer » sous le type de bâtiment ; aucune métadonnée technique en tête');
// 3. places keep their own card; an address is never taken from the building of a former use
const placeRec=(status,address)=>({id:'poi:test',name:'Au Franca Bar',type:'building',kind:'Lieu',poi:{name:'Au Franca Bar',type:'bar',category:'commerce_entreprise',status,address},memberIds:[v.buildingId],bible:{}});
d=describe(placeRec('historique',null));assert.equal(d.title,'Au Franca Bar');assert.equal(d.address,null,'un lieu historique ne prend pas l’adresse actuelle');
d=describe({...placeRec('actuel','12 rue X'),buildingAddress:'99 rue Y'});assert.equal(d.title,'Au Franca Bar');assert.equal(d.address,'12 rue X','l’adresse propre du lieu prime');
assert.match(sel,/function withBuildingAddress\(r\)\{if\(!r\|\|r\.type!=='building'\|\|!addresses\|\|!r\.poi\|\|r\.poi\.address\|\|r\.poi\.status!=='actuel'\)return r;/,'adresse ajoutée à un lieu : seulement lieu actuel sans adresse propre');
ok('3. lieux : nom et fiche conservés ; leur propre adresse prime ; un lieu historique ou ancien ne reçoit jamais l’adresse actuelle de son bâtiment ; adresse vérifiée ajoutée seulement à un lieu actuel sans adresse');
// 4. wiring: by id, documented places first, no empty « Détails », text only, one local index, restoration by id
assert.match(sel,/if\(hitId&&catalogue\.byId\.get\(hitId\)\)return done\(catalogue\.byId\.get\(hitId\),hitAt\);/,'un lieu documenté reste prioritaire sur sa maison');
assert.match(sel,/if\(hitId&&buildingInfo\.has\(hitId\)\)return done\(genericRecord\(hitId\),hitAt\);/);assert.match(sel,/addresses\.get\(id\)/);
assert.match(sel,/const get=id=>|addresses\?addressCard/);assert.match(fs.readFileSync('src/addresses-v342.js','utf8'),/String\(id\)\.split\('#'\)\[0\]/,'partie de bâtiment → bâtiment racine');
assert.match(sel,/detailsButton\.hidden=!!\(r\.generic&&r\.address&&!technical\);/,'pas de fiche Détails vide pour une maison');
assert.match(sel,/quickList\.replaceChildren\(\.\.\.d\.list\.map\(t=>Object\.assign\(document\.createElement\('li'\),\{textContent:t\}\)\)\)/,'liste en textContent');
assert.ok(!/innerHTML\s*=\s*[^'"`]/.test(sel),'aucun innerHTML calculé dans la sélection');
assert.equal((main.match(/building-addresses-v3\.4\.2\.json/g)||[]).length,1,'index chargé une fois');assert.ok(!/fetch\([^)]*adresse|api-adresse/.test(sel),'aucun appel réseau au clic');
assert.match(main,/if\(handed\?\.sel&&selection\.selectBuilding\(handed\.sel\)&&handed\.det\)selection\.openDetails\(\);/,'sélection et adresse rétablies après un changement de qualité');
ok('4. câblage : un lieu documenté garde le clic de son bâtiment ; une maison est résolue par son identifiant (partie → bâtiment racine) ; pas de fiche « Détails » vide ; textes en textContent ; index local chargé une fois, aucun appel réseau au clic ; sélection rétablie après un changement de qualité');
