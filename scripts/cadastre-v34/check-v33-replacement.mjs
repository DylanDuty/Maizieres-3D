// V3.4 check:cadastre-v33-replacement — in premium-v34 nothing of the V3.3 plot generator is drawn: no rectangle / power
// diagram plot, no limit, hedge, wall or fence derived from it, no plot tree, no drive or court toward the nearest road.
// Static guards on the code paths (Chromium confirms at run time: stats.parcelsV33 absent, no `v33-limits` mesh).
import fs from 'node:fs';import assert from 'node:assert/strict';
const ok=m=>console.log('PASS '+m),src=f=>fs.readFileSync(f,'utf8');
const v34=src('src/v34/cadastre-v34.js'),vis=src('src/v27/visual-v27.js'),ground=src('src/v30/ground-v30.js'),main=src('src/main.js');
// 1
for(const t of ['parcels-v33','buildParcelsV33','buildLimitMeshV33','paintParcelsV33','paintParcelLimitsV33','paintParcelFieldV33','lotTrees'])assert.ok(!v34.includes(t),'le module V3.4 utilise '+t);
assert.ok(!/hedge|haie|wall|muret|fence|clôture/i.test(v34.replace(/\/\/.*$/gm,'').replace(/'[^']*'/g,'')),'le module V3.4 construit une séparation matérielle');
ok('1. src/v34/cadastre-v34.js n’importe rien du générateur V3.3 et ne construit ni haie, ni muret, ni clôture');
// 2
assert.ok(/const v34=style==='v34',v33=style==='v33'/.test(vis));assert.ok(vis.includes("const parcels=v33?buildParcelsV33("),'les terrains V3.3 ne sont plus réservés au mode v33');
assert.ok(/let limits=null;if\(parcels&&/.test(vis),'maillage des limites V3.3 non conditionné');
assert.ok(vis.includes("const v33Overlay=cadastre&&diagnostic?.cadastre&&diagnostic.v33?buildParcelsV33("),'surcouche V3.3 hors diagnostic');
assert.ok(vis.includes("diag:cadastre&&diagnostic?.cadastre?{items,v33:v33Overlay}:null"),'la surcouche V3.3 n’est passée qu’au diagnostic');
assert.ok(vis.includes("...(cadastre?{skipGarden:cadastre.outside}:parcels?"),'arbres de lots V3.3 en V3.4');
ok('2. visual-v27 : terrains, limites en volume et arbres V3.3 réservés à premium-v33 ; en V3.4 le générateur ne tourne que pour la surcouche cyan du diagnostic (&v33=1)');
// 3
for(const f of ['paintParcelsV33','paintParcelLimitsV33','paintParcelFieldV33']){const calls=[...ground.matchAll(new RegExp(`(if\\(parcels\\))?${f}\\(`,'g'))].filter(m=>!ground.slice(m.index-20,m.index).includes('import'));
 assert.ok(calls.length&&calls.every(m=>m[1]),f+' appelé sans garde parcels');}
assert.ok(ground.includes("if(cadastre)paintActivityV33(ctx,{P,X,Z,sx,over,detail:m<.8,fence:false})"),'clôture implicite V3.3 active en V3.4');
ok('3. ground-v30 : peinture des terrains, limites et carte de tonte V3.3 gardée par `parcels` ; en V3.4 seules les places de parking des données sont tracées, sans clôture implicite');
// 4
const R=JSON.parse(src('public/data/cadastre-parcels-v3.4.json'));assert.deepEqual(Object.keys(R).sort(),['bl','e','metadata','p','v']);
assert.ok(main.includes("interpretation:visualStyle==='v34'?'Les contours de parcelles de la commune proviennent de données cadastrales publiques."),'mention V3.3 « ne reproduisent pas le cadastre » encore active en V3.4');
ok('4. données V3.4 sans lot V3.3 ; panneau Informations V3.4 : parcelles cadastrales publiques, rendu stylisé, pas de bornage');
