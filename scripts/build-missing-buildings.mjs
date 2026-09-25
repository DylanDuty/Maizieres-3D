// V2.0.1: reintegrates the buildings the visual audit found missing (data-sources/buildings-audit-v2.0.1/decisions.json).
// The frozen reference public/data/buildings.geojson (V1.6.2, 2 494 buildings) is NOT modified: the reintegrated footprints go to a
// complement file with the same schema, plus their terrain elevation computed like V1.7 (on the frozen 1 m GeoTIFF).
// Geometry is never drawn: a whole public footprint (Parcellaire Express, OSM, earlier withdrawal) is kept as is; for a building part
// that the reference misses, the geometry is the exact polygon difference « public footprint − reference footprints ».
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import ClipperLib from 'clipper-lib';
import {fromArrayBuffer} from 'geotiff';
import {toL93,fromL93,TERRAIN_GRID as G,toUnreal} from './terrain-frame.mjs';
import {projection,polygons,bounds,insidePoly} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='data-sources/buildings-audit-v2.0.1',OUT='public/data/buildings-additions-v2.0.1.geojson',ELEV='public/data/buildings-additions-elevation-v2.0.1.json';
const dec=read(`${D}/decisions.json`),ref=read('public/data/buildings.geojson'),osm=read('public/data/maizieres.geojson'),commune=read('public/data/commune.geojson');
const cad=read('data-sources/cadastre/pci-express-batiment.geojson'),removed=read('data-sources/building-removed.json'),rnb=read('data-sources/rnb/rnb-10220.json');
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
// Same display extent and commune test as the reference (scripts/validate-buildings.mjs).
const project=projection(osm.metadata.origin),border=polygons(commune,project),bb=bounds(border.flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const inCommune=c=>border.some(p=>insidePoly(c,p)),inExtent=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
// Planar work in Lambert-93 metres, relative to O and rounded to the millimetre (robust polygon clipping).
const O=[758000,6823000],rel=([E,N])=>[Math.round((E-O[0])*1000)/1000,Math.round((N-O[1])*1000)/1000],abs=([x,y])=>[x+O[0],y+O[1]];
const polysL93=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(q=>rel(toL93(q)))));
const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return a/2;};
const polyArea=p=>Math.abs(ringArea(p[0]))-p.slice(1).reduce((s,h)=>s+Math.abs(ringArea(h)),0);
const perim=r=>{let s=0;for(let i=1;i<r.length;i++)s+=Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]);return s;};
const bbox=ps=>{let b=[1e12,1e12,-1e12,-1e12];for(const p of ps)for(const [E,N] of p[0])b=[Math.min(b[0],E),Math.min(b[1],N),Math.max(b[2],E),Math.max(b[3],N)];return b;};
const hit=(a,b,m=0)=>a[0]-m<=b[2]&&a[2]+m>=b[0]&&a[1]-m<=b[3]&&a[3]+m>=b[1];
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const inRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
const distPoly=(p,poly)=>inRing(p,poly[0])&&!poly.slice(1).some(h=>inRing(p,h))?0:Math.min(...poly.flatMap(r=>r.slice(1).map((q,i)=>segDist(p,r[i],q))));
// Robust boolean operations and offsets (Clipper, integer millimetres).
const {Clipper,ClipperOffset,ClipType,PolyType,PolyFillType,PolyTree,JoinType,EndType}=ClipperLib;
const toPaths=list=>list.flatMap(ps=>ps.flatMap(p=>p.map((r,k)=>{const path=r.slice(0,-1).map(([x,y])=>({X:Math.round(x*1000),Y:Math.round(y*1000)}));if(Clipper.Orientation(path)!==(k===0))path.reverse();return path;})));
const fromTree=tree=>{const out=[],walk=node=>{for(const c of node.Childs()){if(!c.IsHole()){const close=path=>{const r=path.map(q=>[q.X/1000,q.Y/1000]);r.push(r[0]);return r;};out.push([close(c.Contour()),...c.Childs().map(h=>close(h.Contour()))]);for(const h of c.Childs())walk(h);}}};walk(tree);return out;};
const bool=(type,a,b)=>{const c=new Clipper();c.AddPaths(a,PolyType.ptSubject,true);if(b.length)c.AddPaths(b,PolyType.ptClip,true);const t=new PolyTree();c.Execute(type,t,PolyFillType.pftNonZero,PolyFillType.pftNonZero);return t;};
const offset=(paths,d)=>{const o=new ClipperOffset(2,250);o.AddPaths(paths,JoinType.jtMiter,EndType.etClosedPolygon);const out=new ClipperLib.Paths();o.Execute(out,d*1000);return out;};
const treePaths=t=>Clipper.PolyTreeToPaths(t);
const refL93=ref.features.map(f=>{const ps=polysL93(f.geometry);return {id:f.properties.id,ps,b:bbox(ps)};});
const source=d=>{
 if(d.source==='cadastre'){const gid=+d.sourceId.split(':')[1],f=cad.features.find(x=>x.properties.gid===gid);return f&&{f,props:f.properties};}
 const f=osm.features.find(x=>(x.properties['@id']||x.id)===d.sourceId)||removed.features.find(x=>x.properties.id===d.sourceId);return f&&{f,props:f.properties};};
const added=[],skipped=[];
for(const d of dec.reintegrate){
 const s=source(d);if(!s)throw new Error('Source introuvable : '+d.sourceId);
 const src=polysL93(s.f.geometry),sb=bbox(src),srcArea=src.reduce((a,p)=>a+polyArea(p),0);
 const near=[...refL93,...added.map(a=>({ps:a.ps,b:a.b}))].filter(r=>hit(r.b,sb,1));
 // Slivers between two slightly offset tracings are removed by a morphological opening: the part left once the reference is widened by
 // 0,5 m is widened back by 0,5 m, clipped by the public footprint and cut by the exact reference outline (no edge is invented).
 let diff=src;if(near.length){const P=treePaths(bool(ClipType.ctDifference,toPaths([src]),toPaths(near.map(r=>r.ps))));
  // Opening (erode then dilate by 0,5 m, mitred corners) removes the slivers left between two slightly offset tracings, then the result is
  // clipped by the exact difference: every edge still comes from the public footprint or from the reference outline.
  diff=P.length?fromTree(bool(ClipType.ctIntersection,offset(offset(P,-.5),.5),P)):[];}
 // Keep the parts at the audited place, above 8 m².
 let parts=diff.filter(p=>{const a=polyArea(p);return a>=8&&(d.mode==='empreinte entière'||d.seedsL93.some(q=>distPoly(rel(q),p)<=3));});
 const area=parts.reduce((a,p)=>a+polyArea(p),0);
 if(d.mode==='empreinte entière'&&area>=.97*srcArea)parts=src;
 const c=parts.length?(()=>{let x=0,y=0,n=0;for(const p of parts)for(const q of p[0]){x+=q[0];y+=q[1];n++;}return [x/n,y/n];})():null;
 const local=c&&project(fromL93(abs(c)));
 if(!parts.length){skipped.push({sourceId:d.sourceId,reason:'aucune partie non couverte exploitable après différence'});continue;}
 if(!inExtent(local)){skipped.push({sourceId:d.sourceId,reason:'hors de l’emprise du référentiel (commune + 150 m)',centerL93:abs(c).map(r1)});continue;}
 const id=d.mode==='empreinte entière'?d.sourceId:d.sourceId+'~partie',finalArea=parts.reduce((a,p)=>a+polyArea(p),0);
 const geometry=parts.length===1?{type:'Polygon',coordinates:parts[0].map(r=>r.map(q=>fromL93(abs(q)).map(v=>Math.round(v*1e8)/1e8)))}:{type:'MultiPolygon',coordinates:parts.map(p=>p.map(r=>r.map(q=>fromL93(abs(q)).map(v=>Math.round(v*1e8)/1e8))))};
 const rnbIds=rnb.buildings.filter(b=>b.status==='constructed'&&b.point).filter(b=>{const q=rel(toL93(b.point.coordinates));return parts.some(p=>distPoly(q,p)===0);}).map(b=>b.rnb_id);
 const osmProps=d.source==='osm'?(osm.features.find(x=>(x.properties['@id']||x.id)===d.sourceId)?.properties||{}):null;
 const provenanceLabel=d.source==='cadastre'?'Parcellaire Express (PCI DGFiP, IGN)':'OpenStreetMap';
 const evidence=[`${provenanceLabel} : ${d.sourceId}${d.sourceType?` (${d.sourceType})`:''}${d.mode==='partie non couverte'?` — partie non couverte par le référentiel V1.6.2 (${r1(finalArea)} m² sur ${r1(srcArea)} m²)`:''}`,
  'BD ORTHO IGN 20 cm (avril 2025) : '+d.observation,'BD TOPO : absent à cet endroit',rnbIds.length?`RNB : ${rnbIds.join(', ')} (point dans l’empreinte)`:'RNB : aucun point dans l’empreinte'];
 if(d.removedIn)evidence.push(`retiré en V${d.removedIn} (absent de la BD TOPO, du cadastre actuel et du RNB) ; retrait annulé : la construction est visible sur l’orthophoto 2025`);
 const props={id,source:provenanceLabel,provenance:d.source,inCommune:inCommune(local),areaM2:r2(finalArea),parts:parts.length,holes:parts.reduce((n,p)=>n+p.length-1,0),rnb:rnbIds.join('/')||null,ign:null,
  osm:osmProps?{ids:[d.sourceId],donor:d.sourceId,coverage:0,tags:Object.fromEntries(Object.entries(osmProps).filter(([k])=>!k.startsWith('@'))),sourceTag:osmProps.source||null}:null,
  derived:{wallHeight:null,roofHeight:null,floors:null,roofMaterials:[],roofMaterialCode:null,wallMaterialCode:null,usage:null,nature:null,lightConstruction:d.sourceType==='Construction légère',heightAccuracy:null},
  cadastre:d.source==='cadastre'?{type:d.sourceType,codeInsee:s.props.code_insee||null}:null,
  validation:{confidence:'B',status:d.mode==='partie non couverte'?'réintégré V2.0.1 : partie visible sur l’orthophoto 2025, absente du référentiel, géométrie issue de la source publique':'réintégré V2.0.1 : construction visible sur l’orthophoto 2025, géométrie de la source publique',evidence},
  audit:{version:'2.0.1',status:'réintégré',mode:d.mode,sourceId:d.sourceId,components:d.components,removedIn:d.removedIn||null}};
 added.push({f:{type:'Feature',id,geometry,properties:props},ps:parts,b:bbox(parts)});
}
// Terrain elevation of each reintegrated footprint, same method as V1.7 (minimum under the footprint and along the contour), on the frozen 1 m GeoTIFF.
const tif='unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif',tb=fs.readFileSync(tif),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const at=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const median=a=>{const s=Float64Array.from(a).sort();return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
const elev={};
for(const {f,ps,b} of added){const perimeter=[],interior=[];let cx=0,cy=0,cn=0;
 for(const p of ps){for(const [E,N] of p[0]){cx+=E;cy+=N;cn++;}for(const r of p)for(let q=1;q<r.length;q++){const a=r[q-1],c=r[q],steps=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.5));for(let s=0;s<steps;s++){const v=at(O[0]+a[0]+(c[0]-a[0])*s/steps,O[1]+a[1]+(c[1]-a[1])*s/steps);if(v===v)perimeter.push(v);}}}
 for(let N=Math.ceil(b[1])+.5;N<=b[3];N++)for(let E=Math.ceil(b[0])+.5;E<=b[2];E++)if(ps.some(p=>distPoly([E,N],p)===0)){const v=at(O[0]+E,O[1]+N);if(v===v)interior.push(v);}
 const all=interior.concat(perimeter),min=Math.min(...all),max=Math.max(...all),centroid=abs([cx/cn,cy/cn]);
 elev[f.properties.id]={inCommune:f.properties.inCommune,baseZ:r2(min),medianZ:r2(median(all)),minZ:r2(min),maxZ:r2(max),drop:r2(max-min),interiorSamples:interior.length,perimeterSamples:perimeter.length,
  interiorMedianZ:interior.length?r2(median(interior)):null,perimeterMinZ:r2(Math.min(...perimeter)),perimeterMaxZ:r2(Math.max(...perimeter)),centroidL93:centroid.map(r2),unrealCm:toUnreal([centroid[0],centroid[1],min]).map(v=>Math.round(v))};}
const features=added.map(a=>a.f),inC=features.filter(f=>f.properties.inCommune).length;
fs.writeFileSync(OUT,JSON.stringify({type:'FeatureCollection',metadata:{name:'Bâtiments réintégrés V2.0.1 (complément du référentiel bâti gelé V1.6.2)',version:'2.0.1',generatedBy:'scripts/build-missing-buildings.mjs',
 reference:{file:'public/data/buildings.geojson',sha256:sha('public/data/buildings.geojson'),count:ref.features.length,inCommune:ref.features.filter(f=>f.properties.inCommune).length},
 count:features.length,inCommune:inC,total:ref.features.length+features.length,totalInCommune:ref.features.filter(f=>f.properties.inCommune).length+inC,
 rule:dec.metadata.rule,sources:{decisions:`${D}/decisions.json`,decisionsSha256:sha(`${D}/decisions.json`),cadastre:sha('data-sources/cadastre/pci-express-batiment.geojson'),osm:sha('public/data/maizieres.geojson'),removed:sha('data-sources/building-removed.json')}},features})+'\n');
fs.writeFileSync(ELEV,JSON.stringify({metadata:{version:'2.0.1',source:'IGN LiDAR HD MNT, grille 1 m gelée du référentiel V1.7 ('+tif+')',sourceSha256:sha(tif),buildings:OUT,count:features.length,
 method:'comme building-terrain-elevation.json : baseZ = minimum du terrain sous l’emprise (cellules 1 m) et le long du contour (tous les 0,5 m, bilinéaire)'},buildings:elev})+'\n');
fs.writeFileSync(`${D}/build-report.json`,JSON.stringify({generatedBy:'scripts/build-missing-buildings.mjs',decisions:dec.reintegrate.length,added:features.length,inCommune:inC,
 byProvenance:Object.fromEntries(['cadastre','osm'].map(k=>[k,features.filter(f=>f.properties.provenance===k).length])),byMode:Object.fromEntries(['empreinte entière','partie non couverte'].map(k=>[k,features.filter(f=>f.properties.audit.mode===k).length])),
 fromRemovedV161:features.filter(f=>f.properties.audit.removedIn==='1.6.1').length,fromRemovedV162:features.filter(f=>f.properties.audit.removedIn==='1.6.2').length,areaM2:r1(features.reduce((s,f)=>s+f.properties.areaM2,0)),skipped},null,1)+'\n');
// Points for ?diagnostic=buildings-audit: visible constructions without any public footprint, and doubtful cases (nothing is drawn for them).
const review=read(`${D}/review.json`),pt=q=>fromL93(q).map(v=>Math.round(v*1e7)/1e7);
const doubtful=review.components.filter(c=>c.verdict==='douteux').map(c=>({id:c.sourceId+'#'+c.k,lonlat:pt(c.centerL93),observation:c.observation,source:c.source})).filter(c=>inExtent(project(c.lonlat)));
fs.writeFileSync('public/data/buildings-audit-v2.0.1.json',JSON.stringify({metadata:{version:'2.0.1',generatedBy:'scripts/build-missing-buildings.mjs',note:'Positions approximatives, à titre de diagnostic : aucune géométrie n’est créée pour ces constructions.'},
 withoutGeometry:dec.missing_buildings_without_geometry.map(m=>({id:m.id,lonlat:m.lonlat,observation:m.observation,sector:m.sector})),
 uncertain:[...dec.uncertain.map(u=>({id:u.id,lonlat:u.lonlat,observation:u.observation,sector:u.sector})),...doubtful]})+'\n');
console.log(JSON.stringify({added:features.length,inCommune:inC,total:ref.features.length+features.length,skipped:skipped.length}));
