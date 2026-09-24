// Downloads the official control sources for INSEE 10220. Run with NODE_USE_ENV_PROXY=1 (npm script does it).
//  - current cadastre: Etalab export (cadastre.data.gouv.fr → object storage); if that file cannot be reached,
//    the official DGFiP cadastre published by IGN as Parcellaire Express (PCI), WFS layer
//    CADASTRALPARCELS.PARCELLAIRE_EXPRESS:batiment on data.geopf.fr, over the same box as the BD TOPO snapshot;
//  - Référentiel national des bâtiments (RNB) API: every building of the commune, then an individual lookup of
//    each RNB identifier of the reference that is not in that list (neighbouring communes, retired ids).
// Existing snapshots are never overwritten; delete a file explicitly to refresh it.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
const now=new Date().toISOString(),BBOX=[3.75,48.476,3.83,48.533];
async function get(url,type='json',tries=4){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(r.status===404)return {status:404};if(!r.ok)throw Error('HTTP '+r.status);return {status:r.status,url:r.url,body:type==='json'?await r.json():Buffer.from(await r.arrayBuffer())};}catch(e){last=e;await new Promise(s=>setTimeout(s,2000*(i+1)));}}throw last;}
await fs.mkdir('data-sources/cadastre',{recursive:true});await fs.mkdir('data-sources/rnb',{recursive:true});

const etalab='data-sources/cadastre/cadastre-10220-batiments.geojson',pci='data-sources/cadastre/pci-express-batiment.geojson';
if(await exists(etalab)||await exists(pci))console.log('Cadastre déjà présent');
else{
 const url='https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/10/10220/cadastre-10220-batiments.json.gz';
 try{const r=await get(url,'binary',2);const data=JSON.parse(gunzipSync(r.body).toString('utf8'));
  await fs.writeFile(etalab,JSON.stringify({...data,metadata:{source:'Cadastre Etalab (DGFiP), couche bâtiments',url,resolvedUrl:r.url,retrievedAt:now,license:'Licence Ouverte 2.0'}}));console.log('Cadastre Etalab :',data.features.length);}
 catch(e){
  console.log('Cadastre Etalab inaccessible ('+e.message+') : Parcellaire Express IGN (PCI DGFiP)');
  const features=[],requests=[];let expected=Infinity;
  while(features.length<expected){const params=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:batiment',outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',bbox:[...BBOX,'urn:ogc:def:crs:OGC:1.3:CRS84'].join(','),count:'5000',startIndex:String(features.length)});
   const u='https://data.geopf.fr/wfs/ows?'+params,r=await get(u);if(!r.body.features?.length)break;features.push(...r.body.features);requests.push(u);expected=Number(r.body.numberMatched)||features.length;if(features.length>20000)throw Error('Emprise inattendue');}
  if(features.length!==expected)throw Error('PCI : pagination incomplète');
  await fs.writeFile(pci,JSON.stringify({type:'FeatureCollection',metadata:{source:'Parcellaire Express (PCI) — plan cadastral DGFiP diffusé par l’IGN, couche batiment',service:'Géoplateforme WFS CADASTRALPARCELS.PARCELLAIRE_EXPRESS:batiment',bbox:BBOX,retrievedAt:now,requests,etalabAttempt:{url,error:e.message},license:'Licence Ouverte 2.0'},features}));
  console.log('PCI Express :',features.length,'bâtiments');
 }
}

const rnbFile='data-sources/rnb/rnb-10220.json';
if(await exists(rnbFile))console.log('RNB déjà présent');
else{
 const buildings=[];let url='https://rnb-api.beta.gouv.fr/api/alpha/buildings/?insee_code=10220&limit=100',pages=0;
 while(url){const r=await get(url);pages++;buildings.push(...(r.body.results||[]));url=r.body.next||null;if(buildings.length>20000)throw Error('RNB : volume inattendu');}
 // Individual lookups for reference ids outside the commune list (neighbours, retired or unknown ids).
 const ref=JSON.parse(await fs.readFile('public/data/buildings.geojson','utf8')),known=new Set(buildings.map(b=>b.rnb_id)),lookups={};
 const ids=[...new Set(ref.features.flatMap(f=>String(f.properties.rnb||'').split(/[\/,;|]/).map(s=>s.trim()).filter(Boolean)))].filter(id=>!known.has(id));
 for(const id of ids){const r=await get(`https://rnb-api.beta.gouv.fr/api/alpha/buildings/${id}/`);lookups[id]=r.status===404?{notFound:true}:r.body;}
 await fs.writeFile(rnbFile,JSON.stringify({metadata:{source:'Référentiel national des bâtiments (RNB), API alpha',query:'insee_code=10220',pages,individualLookups:ids.length,retrievedAt:now,license:'Licence Ouverte 2.0'},buildings,lookups}));
 console.log('RNB :',buildings.length,'bâtiments de la commune,',ids.length,'identifiants vérifiés individuellement');
}
