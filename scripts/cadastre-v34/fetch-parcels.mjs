// V3.4 — acquisition of the real cadastral parcels of Maizières-la-Grande-Paroisse (INSEE 10220).
// Run with NODE_USE_ENV_PROXY=1 (npm run fetch:cadastre-v34). Existing snapshots are never overwritten.
//  1. Etalab export of the DGFiP cadastre (cadastre.data.gouv.fr), latest edition listed, layer `parcelles`.
//  2. If that archive cannot be obtained: the same DGFiP plan published by IGN as Parcellaire Express (PCI), WFS layer
//     CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle on the Géoplateforme, filtered on code_insee = 10220.
// Every response body is stored byte for byte (gzip) with its SHA-256; nothing is reprojected or simplified here.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const DIR='data-sources/cadastre-parcelles-v34',now=new Date().toISOString();
const sha=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
async function get(url,tries=8){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('HTTP '+r.status);return {status:r.status,url:r.url,body:Buffer.from(await r.arrayBuffer())};}
 catch(e){last=e;await new Promise(s=>setTimeout(s,3000*(i+1)));}}throw last;}
if(await exists(`${DIR}/source-manifest.json`)){console.log('Parcelles déjà présentes : supprimer le dossier pour rafraîchir.');process.exit(0);}
await fs.mkdir(DIR,{recursive:true});
const manifest={commune:{insee:'10220',name:'Maizières-la-Grande-Paroisse'},retrievedAt:now,attempts:[]};

// 1. Etalab (latest edition listed on the index)
let etalab=null;
try{const idx=await get('https://cadastre.data.gouv.fr/data/etalab-cadastre/',3);const eds=[...idx.body.toString().matchAll(/etalab-cadastre\/(\d{4}-\d{2}-\d{2})\//g)].map(m=>m[1]).sort();const ed=eds.at(-1);
 const url=`https://cadastre.data.gouv.fr/data/etalab-cadastre/${ed}/geojson/communes/10/10220/cadastre-10220-parcelles.json.gz`;
 let location=null;for(let i=0;i<6&&!location;i++){try{const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60000)});location=r.headers.get('location')||(r.ok?url:null);}catch{await new Promise(s=>setTimeout(s,3000*(i+1)));}}
 try{const r=await get(url,4);etalab={edition:ed,url,resolvedUrl:r.url,body:r.body};}
 catch(e){manifest.attempts.push({source:'Etalab',edition:ed,url,redirectsTo:location,result:'échec',error:e.cause?.message||e.message,
  note:location?`le fichier redirige vers ${new URL(location).host}, hôte refusé (403) par la politique réseau de l’environnement d’exécution`:'archive inaccessible depuis l’environnement d’exécution'});}}
catch(e){manifest.attempts.push({source:'Etalab',url:'https://cadastre.data.gouv.fr/data/etalab-cadastre/',result:'échec (index)',error:e.cause?.message||e.message});}

if(etalab){const file=`${DIR}/cadastre-10220-parcelles-${etalab.edition}.json.gz`;await fs.writeFile(file,etalab.body);
 const n=JSON.parse(gunzipSync(etalab.body).toString('utf8')).features.length;
 Object.assign(manifest,{canonical:{source:'Cadastre Etalab (DGFiP)',edition:etalab.edition,url:etalab.url,resolvedUrl:etalab.resolvedUrl,file,sha256:sha(etalab.body),bytes:etalab.body.length,features:n,license:'Licence Ouverte / Open Licence 2.0'}});}
else{
 // 2. IGN Parcellaire Express (PCI), WFS, paged; every page stored as received
 const typeName='CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle',pages=[];let expected=Infinity,count=0;
 while(count<expected){const params=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:typeName,outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',
   cql_filter:"code_insee='10220'",sortBy:'gid',count:'1000',startIndex:String(count)});
  const url='https://data.geopf.fr/wfs/ows?'+params,r=await get(url),j=JSON.parse(r.body.toString('utf8'));if(!j.features?.length)break;
  const file=`${DIR}/pci-express-parcelle-10220-page-${String(pages.length).padStart(2,'0')}.json.gz`;await fs.writeFile(file,gzipSync(r.body,{level:9}));
  pages.push({url,file,sha256:sha(r.body),bytes:r.body.length,features:j.features.length,numberMatched:j.numberMatched??null,numberReturned:j.numberReturned??null});
  count+=j.features.length;expected=Number(j.numberMatched)||count;if(count>20000)throw Error('Emprise inattendue');console.log('page',pages.length,count,'/',expected);}
 if(count!==expected)throw Error(`PCI : pagination incomplète (${count}/${expected})`);
 const cap=await get('https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities',4).catch(e=>({error:e.message}));let layer=null;
 if(cap.body){const t=cap.body.toString('utf8'),i=t.indexOf(`<Name>${typeName}</Name>`);if(i>=0){const e=t.indexOf('</FeatureType>',i);layer=t.slice(t.lastIndexOf('<FeatureType',i),e+14);await fs.writeFile(`${DIR}/wfs-capabilities-parcelle.xml`,layer);}}
 const edition=layer?.match(/Édition (\d{4}-\d{2}-\d{2})/)?.[1]||null,title=layer?.match(/<Title>([^<]*)<\/Title>/)?.[1]||null;
 Object.assign(manifest,{canonical:{source:'Parcellaire Express (PCI) — plan cadastral DGFiP diffusé par l’IGN',service:`Géoplateforme WFS ${typeName}`,layerTitle:title,edition,filter:"code_insee='10220'",crs:'urn:ogc:def:crs:OGC:1.3:CRS84 (longitude, latitude, WGS84)',
  pages,features:count,license:'Licence Ouverte / Open Licence 2.0 (Etalab)',attribution:'IGN — Parcellaire Express (PCI), d’après le plan cadastral DGFiP',
  capabilities:layer?{file:`${DIR}/wfs-capabilities-parcelle.xml`,sha256:sha(Buffer.from(layer))}:{error:cap.error||'couche absente des capacités'}}});}
await fs.writeFile(`${DIR}/source-manifest.json`,JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify({canonical:manifest.canonical.source,edition:manifest.canonical.edition,features:manifest.canonical.features,attempts:manifest.attempts}));
