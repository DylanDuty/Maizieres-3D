// Downloads the official control sources for INSEE 10220 (run when the network policy allows these hosts):
//  - cadastre Etalab (DGFiP), layer "batiments": cadastre.data.gouv.fr
//  - Référentiel national des bâtiments (RNB) API: rnb-api.beta.gouv.fr
// Existing snapshots are never overwritten; delete a file explicitly to refresh it.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
const now=new Date().toISOString();

const cadastreFile='data-sources/cadastre/cadastre-10220-batiments.geojson';
if(await exists(cadastreFile))console.log('Cadastre déjà présent');
else{
 const url='https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/10/10220/cadastre-10220-batiments.json.gz';
 const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Cadastre : HTTP '+r.status);
 const data=JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8'));
 if(!data.features?.length)throw Error('Cadastre : aucun bâtiment');
 await fs.mkdir('data-sources/cadastre',{recursive:true});
 await fs.writeFile(cadastreFile,JSON.stringify({...data,metadata:{source:'Cadastre Etalab (DGFiP), couche bâtiments',url,resolvedUrl:r.url,retrievedAt:now,license:'Licence Ouverte 2.0'}}));
 console.log('Cadastre :',data.features.length,'bâtiments');
}

const rnbFile='data-sources/rnb/rnb-10220.json';
if(await exists(rnbFile))console.log('RNB déjà présent');
else{
 const buildings=[],requests=[];let url='https://rnb-api.beta.gouv.fr/api/alpha/buildings/?insee_code=10220&limit=100';
 while(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('RNB : HTTP '+r.status);const page=await r.json();requests.push(url);
  buildings.push(...(page.results||[]));url=page.next||null;if(buildings.length>20000)throw Error('RNB : volume inattendu');}
 await fs.mkdir('data-sources/rnb',{recursive:true});
 await fs.writeFile(rnbFile,JSON.stringify({metadata:{source:'Référentiel national des bâtiments (RNB), API alpha',query:'insee_code=10220',retrievedAt:now,requests:requests.length,license:'Licence Ouverte 2.0'},buildings}));
 console.log('RNB :',buildings.length,'bâtiments');
}
