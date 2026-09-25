// V1.11: snapshots of the official layers used by the POI and toponymy reference, over the frozen V1.7 terrain extent
// (Géoplateforme WFS data.geopf.fr). Each layer is stored once in data-sources/poi/ with its request and date; an existing
// snapshot is never replaced. BAN addresses are public; no personal data is fetched.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G} from './terrain-frame.mjs';
const WFS='https://data.geopf.fr/wfs/ows',DIR='data-sources/poi',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LAYERS=[
 ['ban-adresses','BAN.DATA.GOUV:ban','id','Base Adresse Nationale (BAN), adresses'],
 ['banplus-lien-adresse-bati','BAN-PLUS:lien_adresse_bati','id_adr','BAN PLUS (IGN), liens adresse – bâtiment BD TOPO'],
 ['bdtopo-toponymie','BDTOPO_V3:toponymie','cleabs_de_l_objet','BD TOPO toponymie (tous thèmes)'],
 ['bdtopo-lieu-dit-non-habite','BDTOPO_V3:lieu_dit_non_habite','cleabs','BD TOPO lieu-dit non habité'],
 ['bdtopo-zone-d-habitation','BDTOPO_V3:zone_d_habitation','cleabs','BD TOPO zone d’habitation (lieux-dits habités)'],
 ['bdtopo-construction-ponctuelle','BDTOPO_V3:construction_ponctuelle','cleabs','BD TOPO construction ponctuelle'],
 ['sup-generateur-surfacique','wfs_sup:generateur_sup_s',null,'Servitudes d’utilité publique (Géoportail de l’urbanisme), générateurs surfaciques'],
 ['sup-generateur-ponctuel','wfs_sup:generateur_sup_p',null,'Servitudes d’utilité publique (Géoportail de l’urbanisme), générateurs ponctuels'],
 ['sup-assiette-surfacique','wfs_sup:assiette_sup_s',null,'Servitudes d’utilité publique (Géoportail de l’urbanisme), assiettes surfaciques']];
async function get(url){let last;for(let i=0;i<8;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,160)+' : '+last.message);}
fs.mkdirSync(DIR,{recursive:true});const bbox=[G.west,G.south,G.east,G.north];
for(const [name,type,sort,label] of LAYERS){const file=`${DIR}/${name}.geojson`;if(fs.existsSync(file)){console.log('conservé',file);continue;}
 const features=[];
 for(let start=0;;start+=1000){const j=await get(`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${type}&OUTPUTFORMAT=application/json&COUNT=1000&STARTINDEX=${start}${sort?'&SORTBY='+sort:''}&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::2154`);features.push(...j.features);if(j.features.length<1000)break;}
 const first=JSON.stringify(features.find(f=>f.geometry)?.geometry?.coordinates||[]).match(/-?\d+\.?\d*/)?.[0];const crs=first&&Math.abs(+first)>1000?'EPSG:2154 (Lambert-93, servi tel quel)':'CRS84';
 const body={type:'FeatureCollection',metadata:{source:label,typename:type,service:WFS,request:`GetFeature ${type} BBOX ${bbox.join(',')} EPSG:2154 (emprise du terrain V1.7)`,retrievedAt:new Date().toISOString(),license:'Licence Ouverte Etalab 2.0 — © IGN / BAN / Géoportail de l’urbanisme',crs},features};
 const text=JSON.stringify(body);fs.writeFileSync(file,text);console.log(name,features.length,createHash('sha256').update(text).digest('hex').slice(0,12));}
