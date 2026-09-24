// V1.7: downloads the official IGN LiDAR HD MNT tiles (bare-earth DTM, 0.5 m) covering the terrain grid.
// Source: Géoplateforme IGN, tile index WFS IGNF_LIDAR-HD_METADONNEE:metadata, tiles served by WMS-R as GeoTIFF.
// Tiles are stored byte for byte in data-sources/terrain/lidar-hd-mnt/ and never overwritten: an existing tile is
// only checked against the SHA-256 of the manifest. A changed tile on the server is reported, never silently replaced.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID,neededTiles,TILE_DIR,MANIFEST} from './terrain-frame.mjs';
const WFS='https://data.geopf.fr/wfs/ows',META='data-sources/terrain/lidar-hd-metadata.json';
const sha=b=>createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url,type,tries=6){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);if(type&&!String(r.headers.get('content-type')).includes(type))throw Error('type '+r.headers.get('content-type'));return Buffer.from(await r.arrayBuffer());}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,120)+' : '+last.message);}
fs.mkdirSync(TILE_DIR,{recursive:true});
const g=TERRAIN_GRID,bbox=[g.west-10,g.south-10,g.east+10,g.north+10];
const index=JSON.parse(await get(`${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=IGNF_LIDAR-HD_METADONNEE:metadata&OUTPUTFORMAT=application/json&COUNT=1000&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::2154`,'json'));
const byNw=new Map(index.features.map(f=>[f.properties.coordonnees_nw,f]));
const old=fs.existsSync(MANIFEST)?JSON.parse(fs.readFileSync(MANIFEST,'utf8')):null,oldTiles=new Map((old?.tiles||[]).map(t=>[t.name,t]));
const tiles=[];
for(const t of neededTiles()){const nw=`${String(t.x).padStart(4,'0')}-${t.y}`,f=byNw.get(nw);if(!f)throw Error('Dalle LiDAR HD absente de l’index IGN : '+nw);
 const p=f.properties,file=`${TILE_DIR}/${t.name}`,url=p.url_mnt;let buf;
 if(fs.existsSync(file)){buf=fs.readFileSync(file);const known=oldTiles.get(t.name);if(known&&known.sha256!==sha(buf))throw Error('Dalle locale modifiée (SHA-256 différent du manifeste) : '+file);}
 else{buf=await get(url,'geotiff');const known=oldTiles.get(t.name);if(known&&known.sha256!==sha(buf))throw Error('La dalle servie par l’IGN a changé depuis le manifeste : '+t.name+'. Rien n’est remplacé.');fs.writeFileSync(file,buf);process.stdout.write('.');}
 tiles.push({name:t.name,nw,x:t.x,y:t.y,bboxL93:[t.x*1000-.25,t.y*1000-1000+.25,t.x*1000+1000-.25,t.y*1000+.25],bytes:buf.length,sha256:sha(buf),url,
  mission:p.code_mission,acquisition:[String(p.date_debut_acquisition).slice(0,10),String(p.date_fin_acquisition).slice(0,10)],edition:String(p.date_edition).slice(0,10),classification:p.procede_classement,sensor:p.capteur,altimetry:p.systeme_altimetrique,planimetry:p.systeme_planimetrique,
  retrievedAt:oldTiles.get(t.name)?.retrievedAt||new Date().toISOString()});}
fs.writeFileSync(META,JSON.stringify({retrievedAt:old?.metadataRetrievedAt||new Date().toISOString(),request:`${WFS} GetFeature IGNF_LIDAR-HD_METADONNEE:metadata BBOX ${bbox.join(',')} EPSG:2154`,features:index.features.filter(f=>tiles.some(t=>t.nw===f.properties.coordonnees_nw)).sort((a,b)=>a.properties.coordonnees_nw.localeCompare(b.properties.coordonnees_nw))},null,1)+'\n');
fs.writeFileSync(MANIFEST,JSON.stringify({product:'IGN LiDAR HD — MNT (modèle numérique de terrain, sol nu), 0,5 m',service:'Géoplateforme IGN : index WFS IGNF_LIDAR-HD_METADONNEE:metadata, dalles WMS-R IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93 (GeoTIFF float32)',
 license:'Licence Ouverte Etalab 2.0 — © IGN',crs:'EPSG:2154 (RGF93 v1 / Lambert-93)',vertical:'NGF-IGN69 (EPSG:5720), mètres',noData:-9999,pixel:0.5,metadataRetrievedAt:old?.metadataRetrievedAt||new Date().toISOString(),grid:TERRAIN_GRID,
 note:'Dalles brutes conservées octet pour octet dans '+TILE_DIR+' (hors Git : 56 × 16 Mo). SHA-256 ci-dessous : toute différence arrête le pipeline.',tiles},null,1)+'\n');
console.log(`\n${tiles.length} dalles, ${(tiles.reduce((s,t)=>s+t.bytes,0)/1e6).toFixed(0)} Mo ; missions ${[...new Set(tiles.map(t=>t.mission))].join(', ')}`);
