// V3.4.2 check:notre-village-handoff — the map is ready to be embedded from a public, versioned URL: relative base path,
// every data file loaded through the base URL, the handoff guide present and honest (no private artifact as production
// URL, no claim of a tested integration).
import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';
const ok=m=>console.log('PASS '+m);
const vite=fs.readFileSync('vite.config.js','utf8');assert.match(vite,/base:process\.env\.BASE_PATH\|\|'\.\/'/,'chemin de base relatif');
const files=[];const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(/\.js$/.test(f))files.push(p);}};walk('src');
const bad=[];for(const f of files){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/fetch\(\s*([`'"])(\/?data\/[^`'"]*)/g))bad.push(f+' : '+m[2]);for(const m of s.matchAll(/fetch\(\s*`([^`]*)`/g))if(/data\//.test(m[1])&&!/BASE_URL|\$\{base\}|\$\{B\}/.test(m[1]))bad.push(f+' : '+m[1]);}
assert.deepEqual(bad,[],'chargement hors chemin de base');
ok(`1. carte relocalisable : base Vite relative (BASE_PATH pour GitHub Pages), ${files.length} modules, toutes les données chargées par le chemin de base`);
const doc=fs.readFileSync('docs/integration/MAIZING_NOTRE_VILLAGE_CARTE_3D_V3.4.2.md','utf8');
for(const s of ['Notre Village → Carte du village','Album souvenirs','Carnet d’histoire','Lieux & patrimoine','La vie du village','frame-ancestors','postMessage','Retour à Notre Village','représentation non contractuelle','Check-list de recette','Travaux restant côté MAIZ’ING'])assert.ok(doc.includes(s),'section manquante : '+s);
assert.match(doc,/Aucune intégration n’a été faite ni testée/);assert.match(doc,/Ne jamais utiliser un artefact Claude comme URL de production/);assert.ok(!/- \[x\]/i.test(doc),'aucune case de recette ne peut être cochée avant l’intégration');
ok('2. guide de raccordement : menu canonique et quatre sections voisines, distribution par URL publique (jamais un artefact privé), iframe et sécurité (frame-ancestors, postMessage à origine contrôlée), bureau / téléphone, retour au jeu, mentions, recette non cochée, travaux restants ; aucune intégration revendiquée');
