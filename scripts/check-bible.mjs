// Verifies that Bible sources are untouched and that every annotation quote exists verbatim in its Bible.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const ann=JSON.parse(fs.readFileSync('public/data/bible-annotations.json','utf8'));
const readme=fs.readFileSync('docs/bibles/README.md','utf8'),hashes=[...readme.matchAll(/\[`([^`]+)`\][^|]*\| `([0-9a-f]{64})`/g)];
assert.equal(hashes.length,6,'Tableau SHA-256 des six Bibles introuvable');
for(const [,file,hash] of hashes)assert.equal(createHash('sha256').update(fs.readFileSync('docs/bibles/'+file)).digest('hex'),hash,'Bible modifiée : '+file);
const text=Object.fromEntries(Object.entries(ann.metadata.sources).map(([k,s])=>[k,fs.readFileSync(s.path,'utf8')]));
let quotes=0;
function visit(o){if(Array.isArray(o))return o.forEach(visit);if(o&&typeof o==='object'){if(o.quote){assert(text[o.bible].includes(o.quote),`Citation absente de la Bible ${o.bible} : ${o.quote}`);quotes++;}Object.values(o).forEach(visit);}}
visit({streets:ann.streets,places:ann.places,named:ann.named,landmarks:ann.landmarks});
const data=JSON.parse(fs.readFileSync('public/data/maizieres.geojson','utf8')),names=new Set(data.features.map(f=>f.properties.name).filter(Boolean));
for(const n of Object.keys(ann.streets))assert(names.has(n),'Rue annotée absente d’OSM : '+n);
for(const n of Object.keys(ann.places))assert(names.has(n),'Lieu annoté absent d’OSM : '+n);
for(const l of ann.landmarks)for(const w of l.junction)assert(names.has(w),'Voie de jonction absente : '+w);
console.log(JSON.stringify({result:'OK',biblesUnchanged:6,quotesVerified:quotes,streets:Object.keys(ann.streets).length,places:Object.keys(ann.places).length,named:Object.keys(ann.named).length,landmarks:ann.landmarks.length},null,2));
