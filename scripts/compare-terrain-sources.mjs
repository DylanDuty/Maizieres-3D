// V1.7 audit (network): compares the chosen LiDAR HD MNT (1 m grid of the reference) with the IGN RGE ALTI 1 m MNT on
// control windows, to document the choice of source. RGE ALTI is read raw (image/x-bil;bits=32) from the Géoplateforme WMS-R.
import fs from 'node:fs';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93} from './terrain-frame.mjs';
import {polygons} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),r3=v=>Math.round(v*1000)/1000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const osm=read('public/data/maizieres.geojson'),pt=id=>toL93(osm.features.find(f=>f.id===id).geometry.coordinates).map(Math.round);
const zi=polygons(read('public/data/named-zones.geojson').features.find(f=>/Glaci/.test(f.properties.name)),toL93)[0][0],ziC=zi.reduce((a,p)=>[a[0]+p[0]/zi.length,a[1]+p[1]/zi.length],[0,0]).map(Math.round);
const windows=[['centre-bourg',[O.E,O.N]],['Les Granges',pt('node/5622940013')],['Poussey',pt('node/1637904805')],['ZI la Glacière',ziC],['vallée de la Seine (Pont de Seine)',pt('node/8912942374')]];
async function get(url){for(let i=0;i<6;i++){try{const r=await fetch(url);if(r.ok&&String(r.headers.get('content-type')).includes('bil'))return Buffer.from(await r.arrayBuffer());}catch{}await sleep(2000*(i+1));}throw Error('RGE ALTI inaccessible');}
const S=400,out=[];
for(const [name,[cE,cN]] of windows){const w=cE-S/2,n=cN+S/2,url=`https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLES=&CRS=EPSG:2154&BBOX=${w-.5},${n-S+.5},${w+S-.5},${n+.5}&WIDTH=${S}&HEIGHT=${S}&FORMAT=image/x-bil;bits=32`;
 const b=await get(url),rge=new Float32Array(b.buffer,b.byteOffset,S*S);let n1=0,sum=0,ss=0,max=0,dup=0;
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const E=w+i,N=n-j,v=grid[(G.north-N)*G.cols+(E-G.west)],r=rge[j*S+i];if(i&&r===rge[j*S+i-1])dup++;if(v===-9999||!(r>-1000))continue;const d=r-v;n1++;sum+=d;ss+=d*d;max=Math.max(max,Math.abs(d));}
 out.push({window:name,centreL93:[cE,cN],sizeM:S,samples:n1,meanRgeMinusLidar:r3(sum/n1),rmse:r3(Math.sqrt(ss/n1)),maxAbs:r3(max),rgeRepeatedNeighbourShare:+(dup/(S*(S-1))).toFixed(2)});}
const res={generatedAt:new Date().toISOString(),compared:'RGE ALTI 1 m (WMS-R ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES, x-bil float32) − LiDAR HD MNT (nœuds 1 m du référentiel)',
 note:'rgeRepeatedNeighbourShare : part des pixels RGE ALTI égaux à leur voisin de gauche ; proche de 0,5 ou plus, la résolution effective du RGE ALTI est plus grossière que 1 m (source rééchantillonnée).',windows:out};
fs.writeFileSync('data-sources/terrain/source-comparison.json',JSON.stringify(res,null,1)+'\n');console.log(JSON.stringify(res,null,1));
