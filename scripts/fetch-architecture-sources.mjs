// V2.3: downloads the sources used to describe roofs and heights, for the 22 LiDAR HD kilometre tiles that contain
// at least one of the 2 596 building footprints. Nothing here touches a footprint.
//  - IGN LiDAR HD MNH (modèle numérique de hauteur = surface − sol nu, 0,5 m, GeoTIFF float32), same tiles and
//    missions as the V1.7 terrain (index WFS IGNF_LIDAR-HD_METADONNEE:metadata, url_mnh);
//  - IGN BD ORTHO (WMS-R ORTHOIMAGERY.ORTHOPHOTOS), requested on exactly the same 0,5 m pixel grid (JPEG 2000 × 2000),
//    used only to classify the colour family of each roof.
// Raw tiles stay out of Git (data-sources/architecture/*/) and are pinned by SHA-256 in the committed manifest:
// an existing tile is verified, a tile that changed on the server is reported and never silently replaced.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {toL93} from './terrain-frame.mjs';
const D='data-sources/architecture',MNH=`${D}/lidar-hd-mnh`,ORTHO=`${D}/bdortho-0m50`,MANIFEST=`${D}/sources-manifest.json`;
const sha=b=>createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url,type,tries=6){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);if(type&&!String(r.headers.get('content-type')).includes(type))throw Error('type '+r.headers.get('content-type'));return Buffer.from(await r.arrayBuffer());}catch(e){last=e;await sleep(2000*(i+1));}}throw Error(url.slice(0,120)+' : '+last.message);}
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// Tiles containing at least one footprint vertex bounding box (L93 kilometre grid, north-west corner naming as IGN).
const tiles=new Map();
for(const file of ['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'])
 for(const f of read(file).features){const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates],pts=polys.flatMap(p=>p[0]);
  for(const q of pts){const [E,N]=toL93(q);const x=Math.floor(E/1000),y=Math.ceil(N/1000);tiles.set(`${x}-${y}`,{x,y});}}
const meta=read('data-sources/terrain/lidar-hd-metadata.json'),byNw=new Map(meta.features.map(f=>[f.properties.coordonnees_nw,f.properties]));
fs.mkdirSync(MNH,{recursive:true});fs.mkdirSync(ORTHO,{recursive:true});
const old=fs.existsSync(MANIFEST)?read(MANIFEST):null,oldTiles=new Map((old?.tiles||[]).map(t=>[t.key,t]));
const out=[];
for(const {x,y} of [...tiles.values()].sort((a,b)=>a.x-b.x||a.y-b.y)){
 const nw=`${String(x).padStart(4,'0')}-${y}`,p=byNw.get(nw);if(!p)throw Error('Dalle LiDAR HD absente de l’index : '+nw);
 const bbox=[x*1000-.25,y*1000-1000+.25,x*1000+1000-.25,y*1000+.25],known=oldTiles.get(nw);
 const mnhFile=`${MNH}/LHD_FXX_${nw.replace('-','_')}_MNH_0M50_LAMB93_IGN69.tif`,orthoFile=`${ORTHO}/BDORTHO_${nw.replace('-','_')}_0M50_LAMB93.jpg`;
 const orthoUrl=`https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS&STYLES=&CRS=EPSG:2154&BBOX=${bbox.join(',')}&WIDTH=2000&HEIGHT=2000&FORMAT=image/jpeg`;
 const take=async(file,url,type,field)=>{let buf;if(fs.existsSync(file)){buf=fs.readFileSync(file);if(known&&known[field]!==sha(buf))throw Error('Dalle locale modifiée (SHA-256) : '+file);}
  else{buf=await get(url,type);if(known&&known[field]!==sha(buf))throw Error('La dalle servie a changé depuis le manifeste : '+file+'. Rien n’est remplacé.');fs.writeFileSync(file,buf);process.stdout.write('.');}return buf;};
 const mnh=await take(mnhFile,p.url_mnh,'tiff','mnhSha256'),ortho=await take(orthoFile,orthoUrl,'jpeg','orthoSha256');
 out.push({key:nw,x,y,bboxL93:bbox,mnh:{file:mnhFile,url:p.url_mnh,bytes:mnh.length},mnhSha256:sha(mnh),ortho:{file:orthoFile,url:orthoUrl,bytes:ortho.length},orthoSha256:sha(ortho),
  lidarMission:p.code_mission,lidarAcquisition:[String(p.date_debut_acquisition).slice(0,10),String(p.date_fin_acquisition).slice(0,10)],lidarEdition:String(p.date_edition).slice(0,10),retrievedAt:known?.retrievedAt||new Date().toISOString()});}
fs.writeFileSync(MANIFEST,JSON.stringify({version:'2.3',generatedBy:'scripts/fetch-architecture-sources.mjs (npm run data:architecture-fetch)',
 lidar:{product:'IGN LiDAR HD — MNH (modèle numérique de hauteur : surface − sol nu), 0,5 m',service:'Géoplateforme IGN, WMS-R IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93 (GeoTIFF float32)',license:'Licence Ouverte Etalab 2.0 — © IGN'},
 orthophoto:{product:'IGN BD ORTHO (mosaïque la plus récente, prise de vue avril 2025 sur la commune)',service:'Géoplateforme IGN, WMS-R ORTHOIMAGERY.ORTHOPHOTOS, JPEG, même grille 0,5 m que le LiDAR',license:'Licence Ouverte Etalab 2.0 — © IGN',use:'classification de la famille de couleur des toitures uniquement ; aucune image ne devient un asset'},
 crs:'EPSG:2154',pixel:.5,note:'Dalles brutes hors Git ('+MNH+', '+ORTHO+') ; toute différence de SHA-256 arrête le pipeline.',tiles:out},null,1)+'\n');
console.log(`\n${out.length} dalles ; ${(out.reduce((s,t)=>s+t.mnh.bytes+t.ortho.bytes,0)/1e6).toFixed(0)} Mo`);
