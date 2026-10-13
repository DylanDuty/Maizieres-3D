// V3.4 — writes docs/freeze/MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json: the new cadastral layer, frozen apart from the
// historic freezes (42 geographic files V2.2, 52 Unreal Freeze V1 files, semantic freeze V2.9.2), which it does not touch.
import fs from 'node:fs';import crypto from 'node:crypto';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),DIR='data-sources/cadastre-parcelles-v34';
const M=JSON.parse(fs.readFileSync(`${DIR}/source-manifest.json`,'utf8')),S=JSON.parse(fs.readFileSync(`${DIR}/build-report.json`,'utf8'));
const list=fs.readdirSync(DIR).sort().map(f=>`${DIR}/${f}`);
const files=Object.fromEntries([...list,'public/data/cadastre-parcels-v3.4.json','docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json','docs/audit/V3.4_CADASTRAL_ANOMALIES.csv'].map(f=>[f,sha(f)]));
const code=Object.fromEntries(['scripts/cadastre-v34/fetch-parcels.mjs','scripts/cadastre-v34/fetch-l93-control.mjs','scripts/cadastre-v34/build-cadastre.mjs','src/geo.js','scripts/terrain-frame.mjs'].map(f=>[f,sha(f)]));
const out={name:'MLGU_CADASTRAL_FREEZE_V1',version:'1.0',createdFor:'V3.4 — cadastre réel',doctrine:'Nouvelle couche géographique officielle ajoutée ; les 42 fichiers géographiques gelés (V2.2), les 52 fichiers du Freeze V1 et le gel sémantique V2.9.2 restent inchangés.',
 source:{name:M.canonical.source,layer:M.canonical.layerTitle,edition:M.canonical.edition,service:M.canonical.service,filter:M.canonical.filter,retrievedAt:M.retrievedAt,license:M.canonical.license,attribution:M.canonical.attribution,etalab:M.attempts},
 counts:{parcels:S.parcels.imported,holes:S.parcels.holes,sections:S.parcels.sections,edges:S.topology.edges,vertices:S.topology.vertices,buildings:{unique:S.buildings.unique,multiple:S.buildings.multiple,none:S.buildings.none},anomalies:S.anomalies},
 coverage:{ofCommuneContour:S.coverage.coverageOfContour,notCadastredInsideHa:S.coverage.notCadastredInsideHa},files,code,
 rebuild:'npm run build:cadastre-v34 (déterministe ; check:cadastre-freeze le vérifie dans un dossier temporaire)'};
fs.writeFileSync('docs/freeze/MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json',JSON.stringify(out,null,1)+'\n');console.log(Object.keys(files).length,'fichiers,',Object.keys(code).length,'fichiers de code');
