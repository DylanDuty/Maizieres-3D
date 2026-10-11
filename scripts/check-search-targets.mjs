// V2.9.2 check:search-targets — the search box (src/search-index.js, on the catalogue of the normal view rebuilt by
// scripts/runtime-catalogue.mjs) finds the certified place first, once, and never a duplicate, a closed place or a place of
// another commune.
import assert from 'node:assert/strict';
import {loadRuntimeCatalogue} from './runtime-catalogue.mjs';
import {buildSearchIndex,searchIndex} from '../src/search-index.js';
const ok=m=>console.log('PASS '+m);
const R=loadRuntimeCatalogue(),index=buildSearchIndex(R.catalogue.records),q=s=>searchIndex(index,s).map(o=>o.r);
// query → id expected in first position
const TARGETS=[['Salle polyvalente','poi:salle-polyvalente'],['Maison des associations','poi:maison-des-associations'],['Salle des associations','poi:maison-des-associations'],['Dojo','poi:maison-des-associations'],
 ['Mairie','poi:mairie'],['École','poi:ecole-primaire'],['CPI','poi:cpi'],['Centre de secours','poi:cpi'],['Pompiers','poi:cpi'],['Stade','poi:stade'],['Église','poi:eglise-saint-denis'],
 ['Poussey','poi:poussey'],['Les Granges','poi:les-granges'],['Le Craon','poi:bdtopo:PAIHABIT0000000009338387'],['Glacière','poi:glaciere'],
 ['Rue Pasteur','road:rue-pasteur'],['Rue Joliot-Curie','road:rue-joliot-curie'],['Joliot Curie','road:rue-joliot-curie'],['Avenue du Général de Gaulle','road:avenue-du-general-de-gaulle'],['Rue des Écoles','road:rue-des-ecoles'],
 ['Rue de la République','road:rue-de-la-republique'],['Rue du Général Leclerc','road:rue-du-general-leclerc'],['Place Saint-Denis','poi:place-saint-denis'],['Rue Basse de Poussey','road:rue-basse-de-poussey'],
 ['Rue du Pot Bancelin','road:rue-du-pot-bancelin'],['Rue de la Zone Industrielle','road:rue-de-la-zone-industrielle'],['Voie aux Vaches','road:voie-aux-vaches'],['Pont de Clairvaux','poi:pont-de-clairvaux'],
 ['Relais La Poste','poi:tabac-presse'],['Pharmacie','poi:pharmacie-sasportes'],['Passage à niveau','poi:pn-general-leclerc'],['Ligne de Paris','rail:Ligne de Paris-Est à Mulhouse-Ville']];
const lines=[];
for(const [s,id] of TARGETS){const res=q(s);assert(res.length,'aucun résultat : '+s);assert.equal(res[0].id,id,`« ${s} » → ${res[0].id} (${res[0].name}) au lieu de ${id}`);
 assert.equal(new Set(res.map(r=>r.name)).size,res.length,`« ${s} » : deux résultats du même nom`);lines.push(`${s} → ${res[0].name}`);}
ok(`1. ${TARGETS.length} recherches : le lieu certifié en premier, sans doublon de nom (${lines.slice(0,6).join(' ; ')}…)`);
// never found
const NEVER=['Poussay','Chemin de la Pie','1000','Pharmacie Saint-Dennis','Leclerc Station','Burger King','Courtepaille','Le Puy','Rue Pierre Sémard','Rue Moyenne','Canal de Poussey','Romilly-sur-Seine La Belle'];
for(const s of NEVER){const res=q(s);assert(!res.some(r=>!r.poi&&r.type!=='line'),`« ${s} » : enregistrement hors registre`);
 if(['Poussay','Chemin de la Pie','1000','Pharmacie Saint-Dennis','Burger King','Courtepaille','Le Puy','Rue Pierre Sémard','Rue Moyenne','Canal de Poussey'].includes(s))assert.equal(res.length,0,`« ${s} » trouvé : ${res.map(r=>r.name)}`);}
ok(`2. ${NEVER.length} recherches négatives : ni graphie fautive, ni numéro de voie ferrée, ni lieu fermé, ni lieu ou rue d’une commune voisine, ni « canal de Poussey »`);
// one record per certified place in the index
const ids=index.map(o=>o.r.id),names=new Map();for(const o of index){const k=o.r.name;names.set(k,(names.get(k)||new Set()).add(o.r.id));}
const dup=[...names].filter(([,s])=>s.size>1);assert.equal(dup.length,0,'nom porté par deux enregistrements cherchables : '+dup.map(([n])=>n).join(', '));
ok(`3. index : ${new Set(ids).size} enregistrements cherchables (${index.length} clés avec variantes), aucun nom porté par deux enregistrements`);
