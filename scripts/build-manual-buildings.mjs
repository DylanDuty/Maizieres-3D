// V2.2: builds the separate, explicitly non-official layer of buildings surveyed by hand on the IGN orthophoto
// (data-sources/buildings-manual-v2.2/decisions.json). It never touches the frozen reference (V1.6.2) nor the V2.0.1 additions.
// Outputs: public/data/buildings-manual-v2.2.geojson, its terrain elevation (V1.7 method on the frozen 1 m grid), and the Unreal
// provenance table unreal/buildings/buildings-provenance-v2.2.json that keeps official / V2.0.1 / manual V2.2 apart.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {fromL93,TERRAIN_GRID as G,toUnreal,UNREAL_ORIGIN} from './terrain-frame.mjs';
import {projection,polygons,insidePoly} from '../src/geo.js';
import {inPoly} from './geo-audit-lib.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),r2=v=>Math.round(v*100)/100;
const D='data-sources/buildings-manual-v2.2',OUT='public/data/buildings-manual-v2.2.geojson',ELEV='public/data/buildings-manual-elevation-v2.2.json',UNREAL='unreal/buildings/buildings-provenance-v2.2.json';
const dec=read(`${D}/decisions.json`),osm=read('public/data/maizieres.geojson'),commune=read('public/data/commune.geojson');
const project=projection(osm.metadata.origin),border=polygons(commune,project),inCommune=c=>border.some(p=>insidePoly(c,p));
const area=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(a/2);};
const CAT={habitation:'habitation',annexe:'annexe / dépendance',garage:'garage',abri:'abri',hangar:'hangar',serre:'serre',usage_non_etabli:'usage non établi'};
const features=[];
for(const c of [...dec.cases,...dec.newFindings].filter(c=>c.decision==='ajout_manuel')){
 const ring=[...c.poly,c.poly[0]],cL=[c.poly.reduce((s,q)=>s+q[0],0)/c.poly.length,c.poly.reduce((s,q)=>s+q[1],0)/c.poly.length];
 const id='manual-v2.2:'+c.id;
 features.push({type:'Feature',id,geometry:{type:'Polygon',coordinates:[ring.map(q=>fromL93(q).map(v=>Math.round(v*1e8)/1e8))]},properties:{
  id,source:'BD ORTHO IGN avril 2025 - relevé manuel V2.2',provenance:'orthophoto_manual_v2.2',confidence:c.confidence,inCommune:inCommune(project(fromL93(cL))),
  observation:c.observation,sector:null,originalMissingId:c.id,auditVersion:'2.2',manualGeometry:true,evidence:c.evidence,geometryMethod:c.geometryMethod,
  reviewStatus:'relevé V2.2, à valider visuellement par l’utilisateur',uncertainty:c.uncertainty,category:c.category,categoryLabel:CAT[c.category],categoryNote:c.categoryNote,
  areaM2:r2(area(c.poly)),parts:1,holes:0,rnb:null,ign:null,osm:null,
  derived:{wallHeight:null,roofHeight:null,floors:null,roofMaterials:[],roofMaterialCode:null,wallMaterialCode:null,usage:null,nature:null,lightConstruction:['abri','serre','hangar'].includes(c.category),heightAccuracy:null},
  height:{status:'unknown',value:null,note:'aucune hauteur mesurée : le rendu utilise une hauteur par défaut estimée d’après la forme, à ne jamais présenter comme officielle'},
  validation:{confidence:c.confidence,status:'relevé manuel sur orthophoto (V2.2), aucune géométrie publique disponible',evidence:c.evidence},
  audit:{version:'2.2',status:'manuel',originalMissingId:c.id}}});}
// Sector: nearest BAN address (same rule as V2.0.1).
const ban=read('data-sources/poi/ban-adresses.geojson').features.filter(f=>f.properties.code_insee==='10220').map(f=>({x:+f.properties.x,y:+f.properties.y,n:f.properties.nom_voie}));
for(const f of features){const c=dec.cases.concat(dec.newFindings).find(x=>'manual-v2.2:'+x.id===f.id).poly,m=[c.reduce((s,q)=>s+q[0],0)/c.length,c.reduce((s,q)=>s+q[1],0)/c.length];
 let best=null;for(const b of ban){const d=Math.hypot(b.x-m[0],b.y-m[1]);if(!best||d<best.d)best={d,n:b.n};}f.properties.sector=best.d<80?`${best.n} (adresse BAN la plus proche, ${Math.round(best.d)} m)`:`sans adresse à moins de 80 m (${best.n} à ${Math.round(best.d)} m)`;}
// Terrain elevation: minimum under the footprint (1 m cells) and along the outline (every 0,5 m), as in V1.7.
const tif='unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif',tb=fs.readFileSync(tif),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const at=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const elev={};
for(const f of features){const c=dec.cases.concat(dec.newFindings).find(x=>'manual-v2.2:'+x.id===f.id).poly,ring=[...c,c[0]],v=[];
 for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5));for(let s=0;s<n;s++){const z=at(a[0]+(b[0]-a[0])*s/n,a[1]+(b[1]-a[1])*s/n);if(z===z)v.push(z);}}
 const xs=c.map(q=>q[0]),ys=c.map(q=>q[1]);for(let N=Math.ceil(Math.min(...ys))+.5;N<=Math.max(...ys);N++)for(let E=Math.ceil(Math.min(...xs))+.5;E<=Math.max(...xs);E++)if(inPoly([E,N],[ring])){const z=at(E,N);if(z===z)v.push(z);}
 const min=Math.min(...v),max=Math.max(...v),cL=[xs.reduce((s,x)=>s+x,0)/xs.length,ys.reduce((s,y)=>s+y,0)/ys.length];
 elev[f.properties.id]={inCommune:f.properties.inCommune,baseZ:r2(min),minZ:r2(min),maxZ:r2(max),drop:r2(max-min),samples:v.length,centroidL93:cL.map(r2),unrealCm:toUnreal([cL[0],cL[1],min]).map(Math.round)};}
fs.writeFileSync(OUT,JSON.stringify({type:'FeatureCollection',metadata:{name:'Bâtiments relevés manuellement sur orthophoto (V2.2) — couche non officielle, séparée et désactivable',version:'2.2',generatedBy:'scripts/build-manual-buildings.mjs',
 provenance:'orthophoto_manual_v2.2',decisionsSha256:sha(`${D}/decisions.json`),count:features.length,inCommune:features.filter(f=>f.properties.inCommune).length,
 disable:'retirer ce fichier de la liste chargée par src/main.js (ou ?manual=0) suffit à revenir à la V2.1'},features})+'\n');
fs.writeFileSync(ELEV,JSON.stringify({metadata:{version:'2.2',source:tif,sourceSha256:sha(tif),method:'minimum du terrain sous l’emprise (cellules 1 m) et le long du contour (tous les 0,5 m)'},buildings:elev})+'\n');
// Unreal: one table for all footprints, split by provenance class, with height status (measured / estimated / unknown).
const ref=read('public/data/buildings.geojson').features,add=read('public/data/buildings-additions-v2.0.1.geojson').features;
const refElev=read('public/data/building-terrain-elevation.json').buildings,addElev=read('public/data/buildings-additions-elevation-v2.0.1.json').buildings;
const heightStatus=p=>p.derived?.wallHeight!=null?'measured':'unknown';
const row=(f,cls,e)=>({id:f.properties.id,class:cls,provenance:f.properties.provenance,inCommune:f.properties.inCommune,confidence:f.properties.validation?.confidence||f.properties.confidence||null,
 heightStatus:heightStatus(f.properties),wallHeightM:f.properties.derived?.wallHeight??null,baseZ:e?.baseZ??null,unrealCm:e?.unrealCm??null});
fs.mkdirSync('unreal/buildings',{recursive:true});
const rows=[...ref.map(f=>row(f,'official_v1.6.2',refElev[f.properties.id])),...add.map(f=>row(f,'reintegrated_v2.0.1',addElev[f.properties.id])),...features.map(f=>({...row(f,'manual_orthophoto_v2.2',elev[f.properties.id]),originalMissingId:f.properties.originalMissingId,category:f.properties.category}))];
fs.writeFileSync(UNREAL,JSON.stringify({metadata:{version:'2.2',generatedBy:'scripts/build-manual-buildings.mjs',unrealOrigin:UNREAL_ORIGIN,units:'unrealCm = [X, Y, Z] en centimètres, X = (E − E0) × 100, Y = −(N − N0) × 100, Z = baseZ × 100',
 classes:{official_v1_6_2:'référentiel gelé public/data/buildings.geojson (BD TOPO, cadastre, OSM)',reintegrated_v2_0_1:'public/data/buildings-additions-v2.0.1.geojson (géométrie publique, preuve orthophoto)',manual_orthophoto_v2_2:'public/data/buildings-manual-v2.2.geojson (relevé manuel, non officiel)'},
 heightStatus:{measured:'hauteur de murs mesurée (BD TOPO)',unknown:'aucune hauteur mesurée : hauteur estimée au rendu, à ne pas présenter comme officielle'},
 counts:Object.fromEntries(['official_v1.6.2','reintegrated_v2.0.1','manual_orthophoto_v2.2'].map(k=>[k,rows.filter(r=>r.class===k).length])),total:rows.length},buildings:rows})+'\n');
// Diagnostic markers after V2.2: only the cases still not modelled remain as « visible sans empreinte » points.
const v201=read('public/data/buildings-audit-v2.0.1.json'),left=new Set(dec.cases.filter(c=>c.decision==='non_modelise').map(c=>c.id));
fs.writeFileSync('public/data/buildings-audit-v2.2.json',JSON.stringify({metadata:{version:'2.2',generatedBy:'scripts/build-manual-buildings.mjs',note:'Positions approximatives ; aucune géométrie pour ces points.'},
 withoutGeometry:v201.withoutGeometry.filter(m=>left.has(m.id)).map(m=>({...m,reason:dec.cases.find(c=>c.id===m.id).reason})),uncertain:v201.uncertain})+'\n');
console.log(JSON.stringify({manual:features.length,inCommune:features.filter(f=>f.properties.inCommune).length,total:rows.length,byCategory:Object.fromEntries(Object.keys(CAT).map(k=>[k,features.filter(f=>f.properties.category===k).length]))}));
