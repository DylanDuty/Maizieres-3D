// V3.4.2 — acquisition of the public addresses used to name the buildings of Maizières-la-Grande-Paroisse (INSEE 10220).
// Run with NODE_USE_ENV_PROXY=1 (npm run fetch:addresses-v342). Existing snapshots are never overwritten.
//  1. Base Adresse Nationale, national export (adresse.data.gouv.fr): tried first, the failure is recorded.
//  2. The same BAN published by IGN on the Géoplateforme: WFS BAN.DATA.GOUV:ban, commune 10220, and the terrain extent
//     (peripheral houses of the neighbouring communes, kept apart).
//  3. BAN PLUS (IGN), WFS BAN-PLUS:lien_adresse_bati: links between BAN addresses and BD TOPO buildings, terrain extent.
//  4. Référentiel national des bâtiments (RNB), API alpha, insee_code=10220: BD TOPO identifiers and addresses.
// Every response body is stored byte for byte (gzip) with its SHA-256. No personal data is requested or kept.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const DIR='data-sources/addresses-v342',now=new Date().toISOString(),BBOX='755390,6819514,761486,6826372,EPSG:2154';
const sha=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
async function get(url,tries=8){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('HTTP '+r.status);return {status:r.status,url:r.url,body:Buffer.from(await r.arrayBuffer())};}
 catch(e){last=e;await new Promise(s=>setTimeout(s,3000*(i+1)));}}throw last;}
if(await exists(`${DIR}/source-manifest.json`)){console.log('Adresses déjà présentes : supprimer le dossier pour rafraîchir.');process.exit(0);}
await fs.mkdir(DIR,{recursive:true});
const manifest={commune:{insee:'10220',name:'Maizières-la-Grande-Paroisse'},retrievedAt:now,personalData:'aucune (adresses publiques, identifiants de bâtiments)',attempts:[],sources:{}};
const save=async(name,body)=>{const file=`${DIR}/${name}.json.gz`;await fs.writeFile(file,gzipSync(body,{level:9}));return {file,sha256:sha(body),bytes:body.length};};

// 1. National BAN export
for(const url of ['https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-10.csv.gz','https://api-adresse.data.gouv.fr/search/?q=mairie&citycode=10220&limit=1']){
 try{await get(url,2);manifest.attempts.push({source:'BAN (adresse.data.gouv.fr)',url,result:'accessible'});}
 catch(e){manifest.attempts.push({source:'BAN (adresse.data.gouv.fr)',url,result:'échec',error:e.cause?.message||e.message,note:'hôte refusé (403 au tunnel) par la politique réseau de l’environnement d’exécution ; non contourné'});}}

// 2-3. Géoplateforme WFS, paged
async function wfs(key,typeName,filter){const pages=[];let expected=Infinity,count=0;
 while(count<expected){const params=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:typeName,outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',count:'1000',startIndex:String(count),...filter});
  const url='https://data.geopf.fr/wfs/ows?'+params,r=await get(url),j=JSON.parse(r.body.toString('utf8'));if(!j.features?.length)break;
  pages.push({url,...await save(`${key}-page-${String(pages.length).padStart(2,'0')}`,r.body),features:j.features.length,numberMatched:j.numberMatched??null});
  count+=j.features.length;expected=Number(j.numberMatched)||count;if(count>50000)throw Error('Emprise inattendue');console.log(key,count,'/',expected);}
 if(count!==expected)throw Error(`${typeName} : pagination incomplète (${count}/${expected})`);return {typeName,pages,features:count};}
manifest.sources.banCommune={...await wfs('ban-10220','BAN.DATA.GOUV:ban',{cql_filter:"code_insee='10220'",sortBy:'id'}),filter:"code_insee='10220'"};
manifest.sources.banExtent={...await wfs('ban-emprise','BAN.DATA.GOUV:ban',{bbox:BBOX,sortBy:'id'}),filter:'BBOX '+BBOX+' (emprise du terrain V1.7)'};
manifest.sources.banPlus={...await wfs('banplus-lien-adresse-bati','BAN-PLUS:lien_adresse_bati',{bbox:BBOX,sortBy:'id_adr'}),filter:'BBOX '+BBOX};
const cap=await get('https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities',4).catch(e=>({error:e.message}));
for(const [k,t] of [['banCommune','BAN.DATA.GOUV:ban'],['banPlus','BAN-PLUS:lien_adresse_bati']]){
 if(!cap.body){manifest.sources[k].capabilities={error:cap.error};continue;}const s=cap.body.toString('utf8'),i=s.indexOf(`<Name>${t}</Name>`);if(i<0){manifest.sources[k].capabilities={error:'couche absente des capacités'};continue;}
 const block=s.slice(s.lastIndexOf('<FeatureType',i),s.indexOf('</FeatureType>',i)+14),file=`${DIR}/wfs-capabilities-${t.replace(/[:.]/g,'-')}.xml`;await fs.writeFile(file,block);
 manifest.sources[k].capabilities={file,sha256:sha(Buffer.from(block)),title:block.match(/<Title>([^<]*)<\/Title>/)?.[1]||null,abstract:(block.match(/<Abstract>([\s\S]*?)<\/Abstract>/)?.[1]||'').slice(0,400)};}
manifest.sources.banExtent.capabilities=manifest.sources.banCommune.capabilities;

// 4. RNB, cursor pagination
{const pages=[];let url='https://rnb-api.beta.gouv.fr/api/alpha/buildings/?insee_code=10220&limit=100',count=0;
 while(url){const r=await get(url),j=JSON.parse(r.body.toString('utf8'));pages.push({url,...await save(`rnb-10220-page-${String(pages.length).padStart(2,'0')}`,r.body),features:j.results.length});count+=j.results.length;url=j.next;console.log('rnb',count);if(pages.length>200)throw Error('RNB : trop de pages');}
 manifest.sources.rnb={api:'https://rnb-api.beta.gouv.fr/api/alpha/buildings/',query:'insee_code=10220',pages,features:count};}

Object.assign(manifest,{license:'Licence Ouverte / Open Licence 2.0 (Etalab)',attribution:{ban:'Base Adresse Nationale — diffusion IGN Géoplateforme (BAN.DATA.GOUV:ban)',banPlus:'IGN — BAN PLUS, liens adresse – bâtiment BD TOPO',rnb:'Référentiel national des bâtiments (RNB)'}});
await fs.writeFile(`${DIR}/source-manifest.json`,JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify({ban:manifest.sources.banCommune.features,extent:manifest.sources.banExtent.features,banPlus:manifest.sources.banPlus.features,rnb:manifest.sources.rnb.features,attempts:manifest.attempts.map(a=>a.result)}));
