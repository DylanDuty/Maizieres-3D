// V1.10: snapshots of the official layers used by the land-cover reference, over the frozen V1.7 terrain extent
// (Géoplateforme WFS data.geopf.fr). Each layer is stored once in data-sources/landcover/ with its request and date;
// an existing snapshot is never replaced. Personal data (e.g. the PACAGE farmer number of other RPG products) is not fetched:
// only the anonymous RPG "parcelles graphiques".
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G} from './terrain-frame.mjs';
const WFS='https://data.geopf.fr/wfs/ows',DIR='data-sources/landcover',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LAYERS=[
 ['rpg-2024-parcelles','RPG.2024:parcelles_graphiques','id_parcel','RPG 2024 (ASP / IGN), parcelles graphiques anonymes'],
 ['rpg-2023-parcelles','RPG.2023:parcelles_graphiques','id_parcel','RPG 2023 (ASP / IGN), historique'],
 ['rpg-2022-parcelles','RPG.2022:parcelles_graphiques','id_parcel','RPG 2022 (ASP / IGN), historique'],
 ['rpg-2024-codes-cultures','RPG.2024:codes_cultures',null,'RPG 2024, nomenclature des cultures'],
 ['bdtopo-zone-de-vegetation','BDTOPO_V3:zone_de_vegetation','cleabs','BD TOPO zone de végétation'],
 ['bdtopo-haie','BDTOPO_V3:haie','cleabs','BD TOPO haie (linéaire, Dispositif national de suivi des bocages)'],
 ['bdforet-v2-formation-vegetale','LANDCOVER.FORESTINVENTORY.V2:formation_vegetale','id','BD Forêt V2 (IGN), types de formation végétale'],
 ['bdtopo-surface-hydrographique','BDTOPO_V3:surface_hydrographique','cleabs','BD TOPO surface hydrographique'],
 ['bdtopo-plan-d-eau','BDTOPO_V3:plan_d_eau','cleabs','BD TOPO plan d’eau'],
 ['bdtopo-cours-d-eau','BDTOPO_V3:cours_d_eau','cleabs','BD TOPO cours d’eau (entité nommée)'],
 ['bdtopo-detail-hydrographique','BDTOPO_V3:detail_hydrographique','cleabs','BD TOPO détail hydrographique'],
 ['bcae-cours-eau','HYDROGRAPHY.BCAE.LATEST:bcae_cours_eau',null,'Cours d’eau BCAE (conditionnalité PAC), millésime le plus récent'],
 ['bdtopo-terrain-de-sport','BDTOPO_V3:terrain_de_sport','cleabs','BD TOPO terrain de sport'],
 ['bdtopo-cimetiere','BDTOPO_V3:cimetiere','cleabs','BD TOPO cimetière'],
 ['bdtopo-reservoir','BDTOPO_V3:reservoir','cleabs','BD TOPO réservoir'],
 ['bdtopo-zone-d-activite','BDTOPO_V3:zone_d_activite_ou_d_interet','cleabs','BD TOPO zone d’activité ou d’intérêt'],
 ['bdtopo-equipement-de-transport','BDTOPO_V3:equipement_de_transport','cleabs','BD TOPO équipement de transport (parkings, aires)']];
async function get(url){let last;for(let i=0;i<8;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,160)+' : '+last.message);}
fs.mkdirSync(DIR,{recursive:true});const bbox=[G.west,G.south,G.east,G.north];
for(const [name,type,sort,label] of LAYERS){const file=`${DIR}/${name}.geojson`;if(fs.existsSync(file)){console.log('conservé',file);continue;}
 const features=[];
 for(let start=0;;start+=1000){const j=await get(`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${type}&OUTPUTFORMAT=application/json&COUNT=1000&STARTINDEX=${start}${sort?'&SORTBY='+sort:''}${type.endsWith('codes_cultures')?'':`&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::2154`}`);features.push(...j.features);if(j.features.length<1000)break;}
 // Some layers (BCAE) are served in their native Lambert-93 even with outputFormat=application/json: the CRS is recorded as found.
 const first=JSON.stringify(features.find(f=>f.geometry)?.geometry?.coordinates||[]).match(/-?\d+\.?\d*/)?.[0];const crs=first&&Math.abs(+first)>1000?'EPSG:2154 (Lambert-93, servi tel quel)':'CRS84';
 const body={type:'FeatureCollection',metadata:{source:label,typename:type,service:WFS,request:`GetFeature ${type}${type.endsWith('codes_cultures')?'':' BBOX '+bbox.join(',')+' EPSG:2154 (emprise du terrain V1.7)'}`,retrievedAt:new Date().toISOString(),license:'Licence Ouverte Etalab 2.0 — © IGN / ASP',crs},features};
 const text=JSON.stringify(body);fs.writeFileSync(file,text);console.log(name,features.length,createHash('sha256').update(text).digest('hex').slice(0,12));}
