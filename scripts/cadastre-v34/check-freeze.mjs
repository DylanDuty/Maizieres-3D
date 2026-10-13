// V3.4 check:cadastre-freeze — the cadastral freeze V1 is intact and reproducible, and the historic freezes are untouched.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const ok=m=>console.log('PASS '+m),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const M=read('docs/freeze/MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json'),bad=o=>Object.entries(o).filter(([f,h])=>!fs.existsSync(f)||sha(f)!==h).map(([f])=>f);
// 1
let b=bad(M.files);assert.equal(b.length,0,'fichier du gel cadastral modifié (nouveau gel requis) : '+b.join(', '));b=bad(M.code);assert.equal(b.length,0,'code du pipeline modifié : '+b.join(', '));
ok(`1. ${Object.keys(M.files).length} fichiers du gel cadastral V1 et ${Object.keys(M.code).length} fichiers du pipeline intacts (${M.source.layer}, édition ${M.source.edition})`);
// 2
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cadastre-v34-'));execFileSync(process.execPath,['scripts/cadastre-v34/build-cadastre.mjs','--out',tmp],{stdio:'ignore'});
const outs=['public/data/cadastre-parcels-v3.4.json','docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json','docs/audit/V3.4_CADASTRAL_ANOMALIES.csv','data-sources/cadastre-parcelles-v34/build-report.json'];
for(const f of outs)assert.equal(sha(path.join(tmp,f)),sha(f),'reconstruction différente : '+f);fs.rmSync(tmp,{recursive:true,force:true});
ok(`2. reconstruction depuis la source : ${outs.length} sorties identiques octet pour octet (pipeline déterministe)`);
// 3
const geo=read('data-sources/architecture/frozen-geography-v2.2-sha256.json').files;assert.equal(Object.keys(geo).length,42);b=bad(geo);assert.equal(b.length,0,'fichier géographique gelé modifié : '+b.join(', '));
const U=read('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json').files,uf=Array.isArray(U)?Object.fromEntries(U.map(x=>[x.file||x.path,x.sha256])):U;assert.equal(Object.keys(uf).length,52);b=bad(uf);assert.equal(b.length,0,'Freeze V1 modifié : '+b.join(', '));
const sem=read('docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json');b=bad(sem.files);assert.equal(b.length,0,'gel sémantique modifié : '+b.join(', '));
for(const f of Object.keys(M.files))assert.ok(!(f in geo)&&!(f in uf),'fichier cadastral ajouté à un ancien gel : '+f);
ok('3. couche ajoutée à part : 42 fichiers géographiques (V2.2), 52 fichiers du Freeze V1 et gel sémantique V2.9.2 inchangés ; aucun fichier cadastral dans les anciens manifestes');
