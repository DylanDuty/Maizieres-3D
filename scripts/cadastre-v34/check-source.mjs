// V3.4 check:cadastre-source — the parcel layer is an authentic official snapshot: source, edition, licence, SHA-256 of
// every response body as received, complete pagination, commune 10220 only, no personal data.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {gunzipSync} from 'node:zlib';
const DIR='data-sources/cadastre-parcelles-v34',ok=m=>console.log('PASS '+m),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const M=JSON.parse(fs.readFileSync(`${DIR}/source-manifest.json`,'utf8')),C=M.canonical;
// 1
assert.match(C.source,/Parcellaire Express|Etalab/);assert.match(C.edition||'',/^\d{4}-\d{2}-\d{2}$/,'édition (millésime) absente');assert.match(C.license,/Licence Ouverte/);assert.ok(C.attribution);
assert.equal(M.commune.insee,'10220');if(C.pages)assert.equal(C.filter,"code_insee='10220'");
ok(`1. source : ${C.source} — ${C.layerTitle||''}, édition ${C.edition}, ${C.license}`);
// 2
let n=0;const ids=new Set(),keys=new Set();for(const pg of C.pages){const b=gunzipSync(fs.readFileSync(pg.file));assert.equal(sha(b),pg.sha256,'octets modifiés : '+pg.file);const j=JSON.parse(b.toString('utf8'));
 assert.equal(j.features.length,pg.features);assert.equal(j.numberMatched,C.features);n+=j.features.length;for(const f of j.features){assert.equal(f.properties.code_insee,'10220');ids.add(f.properties.idu);Object.keys(f.properties).forEach(k=>keys.add(k));}}
assert.equal(n,C.features);assert.equal(ids.size,n,'identifiant parcellaire en double');
ok(`2. ${C.pages.length} réponses WFS intactes (SHA-256 des octets reçus), ${n} parcelles = numberMatched, toutes INSEE 10220, identifiants uniques`);
// 3
const cap=fs.readFileSync(C.capabilities.file);assert.equal(sha(cap),C.capabilities.sha256);assert.ok(cap.toString().includes(`Édition ${C.edition}`),'édition absente des capacités du service');
const ctl=fs.readFileSync(M.l93Control.file);assert.equal(sha(gunzipSync(ctl)),M.l93Control.sha256);
ok(`3. capacités du service (« ${C.layerTitle} ; Édition ${C.edition} ») et échantillon Lambert-93 de contrôle (${M.l93Control.features} parcelles) intacts`);
// 4
assert.ok(M.attempts.length&&fs.existsSync(`${DIR}/etalab-attempt.log`),'tentative Etalab non documentée');
ok(`4. tentative Etalab documentée (${M.attempts.map(a=>a.source+' : '+a.result).join(' ; ')}) ; journal de redirection conservé`);
// 5
const allowed=new Set(['gid','numero','feuille','section','code_dep','nom_com','code_com','com_abs','code_arr','idu','contenance','code_insee']);
assert.deepEqual([...keys].filter(k=>!allowed.has(k)),[],'attribut inattendu (données personnelles ?)');
ok(`5. attributs limités à la référence cadastrale (${[...keys].join(', ')}) : aucun propriétaire, aucune donnée personnelle`);
