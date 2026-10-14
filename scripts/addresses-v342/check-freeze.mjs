// V3.4.2 check:building-address-freeze — the address freeze V1 is intact, and every earlier freeze is untouched.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const ok=m=>console.log('PASS '+m),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const M=read('docs/freeze/MLGU_BUILDING_ADDRESS_FREEZE_MANIFEST_V1.json'),bad=o=>Object.entries(o).filter(([f,h])=>!fs.existsSync(f)||sha(f)!==h).map(([f])=>f);
let b=bad(M.files);assert.equal(b.length,0,'fichier du gel d’adresses modifié (nouveau gel requis) : '+b.join(', '));b=bad(M.code);assert.equal(b.length,0,'code du registre modifié : '+b.join(', '));
const listed=fs.readdirSync('data-sources/addresses-v342').map(f=>'data-sources/addresses-v342/'+f);assert.deepEqual(listed.filter(f=>!(f in M.files)),[],'fichier source hors manifeste');
ok(`1. ${Object.keys(M.files).length} fichiers du gel d’adresses V1 et ${Object.keys(M.code).length} fichiers de code intacts (BAN édition ${M.sources.ban.edition}, BAN PLUS édition ${M.sources.banPlus.edition}, RNB)`);
const geo=read('data-sources/architecture/frozen-geography-v2.2-sha256.json').files;assert.equal(Object.keys(geo).length,42);b=bad(geo);assert.equal(b.length,0,'fichier géographique gelé modifié : '+b.join(', '));
const U=read('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json').files,uf=Array.isArray(U)?Object.fromEntries(U.map(x=>[x.file||x.path,x.sha256])):U;assert.equal(Object.keys(uf).length,52);b=bad(uf);assert.equal(b.length,0,'Freeze V1 modifié : '+b.join(', '));
const sem=read('docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json');b=bad(sem.files);assert.equal(b.length,0,'gel sémantique modifié : '+b.join(', '));
const cad=read('docs/freeze/MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json');b=bad({...cad.files,...cad.code});assert.equal(b.length,0,'gel cadastral modifié : '+b.join(', '));
for(const f of Object.keys(M.files))assert.ok(!(f in geo)&&!(f in uf)&&!(f in sem.files)&&!(f in cad.files),'fichier d’adresses ajouté à un ancien gel : '+f);
ok(`2. gels antérieurs intacts : 42 fichiers géographiques (V2.2), 52 du Freeze V1, ${Object.keys(sem.files).length} du gel sémantique V2.9.2, ${Object.keys(cad.files).length} du gel cadastral V1 ; aucun fichier d’adresses dans un ancien manifeste`);
