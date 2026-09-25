// V1.11.1: current official sources around the few current places left without a building by V1.11 (targeted audit only,
// not a new building audit). Small boxes (± 150 m) around each place: BD TOPO bâtiment, Parcellaire Express bâtiment
// (DGFiP / IGN) and RNB (API, bounding box). Snapshots are stored once in data-sources/buildings-audit-v1.11.1/ and never replaced.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromL93} from './terrain-frame.mjs';
const DIR='data-sources/buildings-audit-v1.11.1',WFS='https://data.geopf.fr/wfs/ows',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CASES=JSON.parse(fs.readFileSync(`${DIR}/cases.json`,'utf8')).zones;
async function get(url){let last;for(let i=0;i<8;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,160)+' : '+last.message);}
const save=(name,body)=>{const file=`${DIR}/${name}.json`;if(fs.existsSync(file)){console.log('conservé',file);return;}const text=JSON.stringify(body);fs.writeFileSync(file,text);console.log(name,createHash('sha256').update(text).digest('hex').slice(0,12));};
for(const z of CASES){const [E,N]=z.L93,b=[E-150,N-150,E+150,N+150];
 for(const [name,type] of [['bdtopo-batiment','BDTOPO_V3:batiment'],['pci-batiment','CADASTRALPARCELS.PARCELLAIRE_EXPRESS:batiment']]){if(fs.existsSync(`${DIR}/${name}-${z.id}.json`))continue;
  const url=`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${type}&OUTPUTFORMAT=application/json&COUNT=1000&BBOX=${b.join(',')},urn:ogc:def:crs:EPSG::2154`;
  const j=await get(url);save(`${name}-${z.id}`,{type:'FeatureCollection',metadata:{source:type,request:url,retrievedAt:new Date().toISOString(),license:'Licence Ouverte Etalab 2.0 — © IGN / DGFiP'},features:j.features});}
 if(!fs.existsSync(`${DIR}/rnb-${z.id}.json`)){const [w,s]=fromL93([b[0],b[1]]),[e,n]=fromL93([b[2],b[3]]);const results=[];let url=`https://rnb-api.beta.gouv.fr/api/alpha/buildings/?bb=${n},${w},${s},${e}&limit=100`;const first=url;
  while(url){const j=await get(url);results.push(...j.results);url=j.next;}
  save(`rnb-${z.id}`,{metadata:{source:'Référentiel national des bâtiments (RNB), API alpha, bb=nw_lat,nw_lng,se_lat,se_lng',request:first,retrievedAt:new Date().toISOString(),license:'Licence Ouverte 2.0'},buildings:results});}}
