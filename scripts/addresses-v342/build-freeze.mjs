// V3.4.2 — writes docs/freeze/MLGU_BUILDING_ADDRESS_FREEZE_MANIFEST_V1.json: the building address registry and the road
// spatial audit, frozen apart from the historic freezes (42 geographic files V2.2, 52 Freeze V1 files, semantic freeze V2.9.2,
// cadastral freeze V1), which it does not touch.
import fs from 'node:fs';import crypto from 'node:crypto';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),DIR='data-sources/addresses-v342',read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const M=read(`${DIR}/source-manifest.json`),S=read(`${DIR}/build-report.json`),A=read(`${DIR}/roads-audit-report.json`),runtime=read('public/data/building-addresses-v3.4.2.json');
const files=Object.fromEntries([...fs.readdirSync(DIR).sort().map(f=>`${DIR}/${f}`),'public/data/building-addresses-v3.4.2.json','docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json','docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv','docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv'].map(f=>[f,sha(f)]));
const code=Object.fromEntries(['scripts/addresses-v342/fetch-addresses.mjs','scripts/addresses-v342/build-addresses.mjs','scripts/roads-v342/audit-roads.mjs','src/addresses-v342.js','src/geo.js'].map(f=>[f,sha(f)]));
const out={name:'MLGU_BUILDING_ADDRESS_FREEZE_V1',version:'1.0',createdFor:'V3.4.2 — adresses des bâtiments et contrôle spatial des rues',
 doctrine:'Registre d’adresses et audit routier ajoutés à part ; aucune géométrie (bâtiments, routes, parcelles) n’est modifiée ; les gels géographique (42 fichiers V2.2), Freeze V1 (52), sémantique V2.9.2 et cadastral V1 restent inchangés.',
 sources:{ban:{service:'Géoplateforme WFS BAN.DATA.GOUV:ban',edition:runtime.metadata.ban.edition,features:{commune:M.sources.banCommune.features,extent:M.sources.banExtent.features}},banPlus:{service:'Géoplateforme WFS BAN-PLUS:lien_adresse_bati',edition:runtime.metadata.banPlus.edition,features:M.sources.banPlus.features},
  rnb:{api:M.sources.rnb.api,query:M.sources.rnb.query,features:M.sources.rnb.features},retrievedAt:M.retrievedAt,license:M.license,attempts:M.attempts},
 counts:{buildings:S.buildings,statuses:S.statuses,statusesInCommune:S.statusesInCommune,addresses:S.addresses,rejected:S.rejected,anomalies:S.anomalies,roads:{audited:A.roads,inCommune:A.inCommune,statuses:A.statuses,statusesInCommune:A.statusesInCommune,clicks:A.clicks}},
 files,code,rebuild:'npm run build:addresses-v342 (déterministe ; check:building-address-links et check:roads-spatial-v342 le vérifient dans un dossier temporaire)'};
fs.writeFileSync('docs/freeze/MLGU_BUILDING_ADDRESS_FREEZE_MANIFEST_V1.json',JSON.stringify(out,null,1)+'\n');console.log(Object.keys(files).length,'fichiers,',Object.keys(code).length,'fichiers de code');
