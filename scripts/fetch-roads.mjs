// V1.8: snapshots of the official IGN BD TOPO road layers over the frozen V1.7 terrain extent (Géoplateforme WFS).
// Each layer is stored once in data-sources/roads/ with its request, date and SHA-256; an existing snapshot is never replaced.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G} from './terrain-frame.mjs';
const WFS='https://data.geopf.fr/wfs/ows',DIR='data-sources/roads',sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Roads, crossings without connection, network points, railway (only to locate level crossings / rail bridges), linear structures.
const LAYERS=['troncon_de_route','non_communication','point_du_reseau','troncon_de_voie_ferree','construction_lineaire','voie_nommee'];
async function get(url){let last;for(let i=0;i<6;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,140)+' : '+last.message);}
fs.mkdirSync(DIR,{recursive:true});const bbox=[G.west,G.south,G.east,G.north];
for(const layer of LAYERS){const file=`${DIR}/bdtopo-${layer.replaceAll('_','-')}.geojson`;if(fs.existsSync(file)){console.log('conservé',file);continue;}
 const features=[];for(let start=0;;start+=1000){const j=await get(`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:${layer}&OUTPUTFORMAT=application/json&COUNT=1000&STARTINDEX=${start}&SORTBY=cleabs&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::2154`);features.push(...j.features);if(j.features.length<1000)break;}
 const body={type:'FeatureCollection',metadata:{source:'IGN BD TOPO V3 — BDTOPO_V3:'+layer,service:WFS,request:`GetFeature BDTOPO_V3:${layer} BBOX ${bbox.join(',')} EPSG:2154 (emprise du terrain V1.7)`,retrievedAt:new Date().toISOString(),license:'Licence Ouverte Etalab 2.0 — © IGN',crs:'CRS84 (longitude, latitude, altitude BD TOPO)'},features};
 const text=JSON.stringify(body);fs.writeFileSync(file,text);console.log(layer,features.length,createHash('sha256').update(text).digest('hex').slice(0,12));}
