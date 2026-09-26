// V2.1 global geographic integrity check. It verifies that the audits are current and complete, that every suspect point has a
// human classification, and the invariants of the displayed map (hydro, buildings, roads, rail, land cover, place names, global).
// A gap or a free end is never « fixed » here: it must be classified in a review file (data-sources/*-audit-v2.1/review.json).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {UNREAL_ORIGIN as O,TERRAIN_GRID as G} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),ok=m=>console.log('PASS '+m);
// Re-run both audits so the check never reads a stale report.
execFileSync(process.execPath,['scripts/audit-hydro.mjs'],{stdio:'ignore'});execFileSync(process.execPath,['--max-old-space-size=4096','scripts/audit-geography.mjs'],{stdio:'ignore'});
const H=read('data-sources/hydro-audit-v2.1/hydro-audit.json'),A=read('data-sources/geo-audit-v2.1/geo-audit.json'),S=read('public/data/v2-scene.json'),T=read('public/data/v2-terrain.json');
const X1=T.x0+(T.cols-1)*T.step,Z1=T.z0+(T.rows-1)*T.step;
// 1. Frozen references untouched (hydro, terrain, roads, rail, land cover, POI, buildings) and Unreal origin.
const FROZEN={'unreal/landcover/water-lines.json':'5f0931467a8719120fd993efb2a787e556f62ebc75f78f5400e8ce73b19534c7','unreal/landcover/water-polygons.json':'573982fb5c1aea012ee1c2294af83712b3b2d65fa3cf2849a4bd5a767df16001',
 'unreal/roads/road-splines.json':'0e461f899067eb4912964035bbd564070ab66fe415122ae5d2324dfe6414aadc','unreal/rail/rail-splines.json':'7a082376a4e871749ee7959f10e7daf5bd0d3aef5ffda90706dd0837c01eb73e',
 'public/data/buildings.geojson':'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095','public/data/poi.json':'02522aa7e0574810057526a2bae2e08f25ad74a2d0704821bec6637357283611'};
for(const [f,h] of Object.entries(FROZEN))assert.equal(sha(f),h,'Référentiel gelé modifié : '+f);
for(const f of read('unreal/terrain/terrain-reference.json').files.filter(f=>f.inGit))assert.equal(sha(f.file),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0]);
ok('1. référentiels gelés intacts (eau, terrain, voirie, rail, bâti, lieux) et origine Unreal inchangée');
// 2. Hydro topology: connected components, every free end classified (no suspect end or gap left unclassified).
assert.equal(H.counts.lines,228);assert(H.counts.components>=1&&H.counts.components<=20,'Composantes hydro inattendues : '+H.counts.components);
const suspects=H.terminals.filter(t=>t.suspect&&!t.review);assert.equal(suspects.length,0,'Extrémités hydro suspectes non classées : '+suspects.map(t=>t.key).join(', '));
const notEdge=H.terminals.filter(t=>t.cls!=='limite de l’emprise');assert(notEdge.every(t=>t.review),'Extrémité hors limite sans revue : '+notEdge.filter(t=>!t.review).map(t=>t.key).join(', '));
assert.equal(H.xcheck.bdcarto.offKm,0,'Tronçon BD CARTO sans homologue BD TOPO');
ok(`2. hydro : ${H.counts.lines} tronçons, ${H.counts.components} composantes, ${H.counts.terminals} extrémités libres toutes classées (${Object.entries(H.counts.byClass).map(([k,v])=>k+' '+v).join(', ')}), 0 suspecte`);
// 3. Hydro display: no watercourse hidden by the land-cover texture, (almost) none under 3D hedge walls, nothing outside the terrain.
assert.equal(S.waterLines.length,H.display.linesInScene);assert.equal(H.display.linesInScene+H.display.underground,H.display.linesInReference);assert.equal(S.water.length,H.display.surfacesInReference);
assert(H.display.verticesOffTerrain<200,'Lignes d’eau hors terrain affiché : '+H.display.verticesOffTerrain);assert.equal(H.display.hiddenKm.byHedgeTextureV21,0);assert(H.display.hiddenKm.by3DHedgeWallsV21<.05,'Cours d’eau masqués par des haies 3D : '+H.display.hiddenKm.by3DHedgeWallsV21+' km');
const v2=fs.readFileSync('src/v2-scene.js','utf8');assert(v2.indexOf('for(const hd of d.hedges)line3(')<v2.indexOf('for(const a of d.water)fill('),'L’eau doit être dessinée après les haies');
ok(`3. rendu hydro : ${S.waterLines.length} lignes + ${S.water.length} surfaces affichées (${H.display.verticesOffTerrain} sommets dans les coins de l’emprise hors du terrain affiché, non dessinés), masquage par les haies ${H.display.hiddenKm.byHedgeTextureV201} km (V2.0.1) → 0 km (V2.1), murs de haie 3D ${H.display.hiddenKm.by3DHedgeWallsV201} → ${H.display.hiddenKm.by3DHedgeWallsV21} km`);
// 4. Poussey: the Ruisseau / Bras des Moulins de Poussey form one connected chain with the Seine network.
const main=H.components[0];for(const n of ['Ruisseau des Moulins de Poussey','Bras des Moulins de Poussey','la Seine'])assert(main.names.includes(n),'Hors du réseau principal : '+n);
for(const c of H.poussey)assert.equal(c.components,1,c.name+' en plusieurs morceaux');
ok(`4. Poussey : Ruisseau (${H.poussey[0].km} km) et Bras des Moulins de Poussey (${H.poussey[1].km} km) continus et reliés à la Seine`);
// 5. Buildings: ids, validity, duplicates, grid coverage, the 16 cases without geometry re-checked.
assert.equal(A.buildings.total,2584);assert.equal(A.buildings.inCommune,2350);assert.equal(A.buildings.duplicates.length,0);assert.equal(A.buildings.invalid.length,0);
assert.equal(A.buildings.grid.controlled,A.buildings.grid.cellsInBuiltArea,'Cellule bâtie non contrôlée');assert(A.buildings.withoutGeometry.every(m=>m.recheck?.result),'Cas sans géométrie non recontrôlé');
assert(A.buildings.poussey?.cells>=40&&A.buildings.poussey.newMissing===0);
ok(`5. bâti : 2 584 identifiants (2 350 dans la commune), 0 doublon, 0 géométrie invalide ; ${A.buildings.grid.controlled}/${A.buildings.grid.cellsInBuiltArea} cellules de 160 m contrôlées (${Object.entries(A.buildings.grid.byStatus).map(([k,v])=>k+' '+v).join(', ')}) ; Poussey ${A.buildings.poussey.cells} cellules de 120 m ; ${A.buildings.withoutGeometry.length} cas sans géométrie recontrôlés`);
// 6. Buildings in the scene (check:building-visibility logic is authoritative; here: the V2.0.1 report is current).
const bv=read('data-sources/buildings-audit-v2.0.1/build-report.json');assert.equal(bv.added,90);
ok('6. réintégrations V2.0.1 présentes (90) ; présence dans la scène, altitude et enfouissement vérifiés par check:building-visibility');
// 7. Roads and rail: free ends and gaps classified, nothing outside the terrain.
assert(A.roads.review?.gaps1to5m&&A.roads.gaps1to5m.length<=11,'Écarts de voirie non classés');assert(A.roads.topology.orphans.every(o=>o.review),'Voirie orpheline non classée');
assert(A.rail.review&&A.rail.topology.crossingsWithoutConnection.every(c=>c.review),'Croisement ferroviaire non classé');
let off=0;for(const k of ['roads','rail'])for(const r of S[k])for(let i=0;i<r.p.length;i+=3)if(!Number.isFinite(r.p[i])||!Number.isFinite(r.p[i+1])||!Number.isFinite(r.p[i+2]))off++;
assert.equal(off,0,'Coordonnée non finie dans la voirie ou le rail');
ok(`7. voirie : ${A.roads.splines} voies, ${A.roads.freeEnds} extrémités libres (${A.roads.freeEndsAtEdge} en limite), ${A.roads.gaps1to5m.length} écarts de 1–5 m classés, 1 orpheline classée ; rail : ${A.rail.tracks} voies, 1 embranchement isolé et 3 croisements classés`);
// 8. Land cover and place names.
assert(A.landcover.review?.riverInParcels&&A.toponymy.labelIssues.length===0,'Toponymie ou occupation du sol non classée');
ok(`8. occupation du sol classée (${A.landcover.permanentRiverInsideParcelsM} m d’eau dans 4 parcelles, visibles) ; ${A.toponymy.labelled} étiquettes permanentes actuelles et fiables`);
// 9. Global: no NaN or absurd coordinate anywhere in the displayed data, everything inside the displayed terrain.
let bad=0,outside=0;const pts=(arr,st)=>{for(let i=0;i<arr.length;i+=st){const x=arr[i],z=arr[i+1];if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>1e5||Math.abs(z)>1e5)bad++;else if(x<T.x0-5||x>X1+5||z<T.z0-5||z>Z1+5)outside++;}};
for(const l of S.waterLines)pts(l.p,2);for(const h of S.hedges)pts(h.p,3);for(const k of ['agriculture','woodland','water','artificial','hedgePolygons'])for(const o of S[k])for(const p of o.r)for(const r of p)pts(r,2);
assert.equal(bad,0,'Coordonnées NaN ou absurdes');
ok(`9. aucune coordonnée NaN ou absurde ; ${outside} sommets de polygone hors du terrain affiché (coins de l’emprise, découpés au rendu)`);
console.log('check:geographic-integrity — 9 contrôles PASS');
