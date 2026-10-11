// V2.9.2 check:semantic-freeze — the semantic freeze V1 is intact and the geographic freeze is untouched.
// 1. registers, decisions, runtime projections, anomalies and Unreal migration match the hashes of
//    docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json (any change needs a new semantic freeze);
// 2. the inputs they were built from (POI layers, OSM, roads, scene, BD TOPO, BAN) and the code that applies them are those
//    of the freeze;
// 3. the register counts quoted by the manifest are those of the registers;
// 4. the 42 frozen geographic files (V2.2) and the 52 files of the Unreal Freeze V1 keep their hashes: V2.9.2 changes the
//    semantics only.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ok=m=>console.log('PASS '+m);
const M=read('docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json');
const bad=o=>Object.entries(o).filter(([f,h])=>!fs.existsSync(f)||sha(f)!==h).map(([f])=>f);
// 1
let b=bad(M.files);assert.equal(b.length,0,'fichier du gel sémantique modifié (nouveau gel requis) : '+b.join(', '));
ok(`1. ${Object.keys(M.files).length} fichiers du gel sémantique V1 intacts (registres, décisions, projections, anomalies, migration Unreal)`);
// 2
b=bad(M.inputs);assert.equal(b.length,0,'donnée d’entrée modifiée depuis le gel : '+b.join(', '));b=bad(M.code);assert.equal(b.length,0,'code du gel modifié (régénérer les registres et le manifeste) : '+b.join(', '));
ok(`2. ${Object.keys(M.inputs).length} données d’entrée et ${Object.keys(M.code).length} fichiers de code identiques au gel`);
// 3
const P=read(M.registers.places.file),R=read(M.registers.roads.file);assert.equal(sha(M.registers.places.file),M.registers.places.sha256);assert.equal(sha(M.registers.roads.file),M.registers.roads.sha256);
assert.deepEqual(P.metadata.counts,M.registers.places.counts);assert.deepEqual(R.metadata.counts,M.registers.roads.counts);assert.equal(P.places.length,M.certifiedCounts.placesInRegister);assert.equal(R.roads.length,M.certifiedCounts.roads);
const rows=fs.readFileSync('docs/audit/V2.9.2_SEMANTIC_ANOMALIES.csv','utf8').trim().split('\n').length-1;assert.equal(rows,M.anomalies.total,'CSV ≠ manifeste');
ok(`3. comptes du manifeste = registres : ${P.places.length} lieux, ${R.roads.length} voies, ${M.anomalies.total} anomalies (BLOCKER ${M.anomalies.BLOCKER}, MAJOR ${M.anomalies.MAJOR}, MINOR ${M.anomalies.MINOR}, INFO ${M.anomalies.INFO})`);
// 4
const geo=read('data-sources/architecture/frozen-geography-v2.2-sha256.json').files;b=bad(geo);assert.equal(Object.keys(geo).length,42);assert.equal(b.length,0,'fichier géographique gelé modifié : '+b.join(', '));
const U=read('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json').files,uf=Array.isArray(U)?Object.fromEntries(U.map(x=>[x.file||x.path,x.sha256])):U;assert.equal(Object.keys(uf).length,52);b=bad(uf);assert.equal(b.length,0,'fichier du Freeze V1 modifié : '+b.join(', '));
ok('4. 42 fichiers géographiques gelés (V2.2) et 52 fichiers du Freeze V1 : hachages inchangés');
