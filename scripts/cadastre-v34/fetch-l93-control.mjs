// V3.4 — projection control: the first 300 parcels (by gid) of INSEE 10220 requested from the same WFS directly in
// Lambert-93 (EPSG:2154), stored as received. check:cadastre-geometry compares them with the project's own
// conversion of the CRS84 coordinates (proj4, scripts/terrain-frame.mjs).
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const DIR='data-sources/cadastre-parcelles-v34',out=`${DIR}/pci-express-parcelle-10220-l93-control.json.gz`;
try{await fs.access(out);console.log('Contrôle Lambert-93 déjà présent');process.exit(0);}catch{}
const params=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle',outputFormat:'application/json',srsName:'urn:ogc:def:crs:EPSG::2154',cql_filter:"code_insee='10220'",sortBy:'gid',count:'300',startIndex:'0'});
const url='https://data.geopf.fr/wfs/ows?'+params;let body,last;
for(let i=0;i<8&&!body;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('HTTP '+r.status);body=Buffer.from(await r.arrayBuffer());}catch(e){last=e;await new Promise(s=>setTimeout(s,3000*(i+1)));}}
if(!body)throw last;await fs.writeFile(out,gzipSync(body,{level:9}));
const m=JSON.parse(await fs.readFile(`${DIR}/source-manifest.json`,'utf8'));m.l93Control={url,file:out,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length,features:JSON.parse(body.toString()).features.length,crs:'urn:ogc:def:crs:EPSG::2154'};
await fs.writeFile(`${DIR}/source-manifest.json`,JSON.stringify(m,null,1)+'\n');console.log('contrôle L93',m.l93Control.features);
