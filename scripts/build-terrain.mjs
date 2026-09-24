// V1.7 terrain reference, built only from the stored official tiles (data-sources/terrain/lidar-hd-mnt, SHA-256 checked).
// Source: IGN LiDAR HD MNT 0.5 m (bare earth), EPSG:2154, NGF-IGN69. No altitude is ever invented:
//  - the 1 m grid keeps one source sample out of two in each direction (nodes on whole Lambert-93 metres), no averaging;
//  - NoData stays NoData in the GeoTIFF; it would only be filled (and reported, with a mask) in the 16-bit heightmap.
// Outputs: unreal/terrain/ (GeoTIFF 1 m, PNG 16-bit heightmap, reference JSON), public/data/terrain-threejs.* (10 m working
// grid in the Three.js local frame) and public/data/building-terrain-elevation.json (terrain under every frozen building).
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,QUADS_PER_COMPONENT,MIN_MARGIN_M,neededTiles,TILE_DIR,MANIFEST,toL93,toUnreal,LAMB93} from './terrain-frame.mjs';
import {writeGeoTiff,writePng16,GEOKEYS_L93_IGN69} from './raster-io.mjs';
import {projection,polygons,lines,bounds,insidePoly,R} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const UE='unreal/terrain',PNG=`${UE}/maizieres-heightmap-${G.cols}x${G.rows}.png`,R16=`${UE}/maizieres-heightmap-${G.cols}x${G.rows}.r16`,TIF=`${UE}/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif`,REFJ=`${UE}/terrain-reference.json`;
const WEB_BIN='public/data/terrain-threejs.bin',WEB_JSON='public/data/terrain-threejs.json',BLD='public/data/building-terrain-elevation.json',BUILDINGS='public/data/buildings.geojson';
fs.mkdirSync(UE,{recursive:true});const t0=Date.now(),log=m=>console.log(`[${((Date.now()-t0)/1000).toFixed(0)} s] ${m}`);

// ---- 1. Frame: recompute the extent from the commune and check the documented constants ----
const commune=read('public/data/commune.geojson');let cb=[1e12,1e12,-1e12,-1e12];
for(const poly of polygons(commune.features?commune.features[0]:commune,toL93))for(const [E,N] of poly[0])cb=[Math.min(cb[0],E),Math.min(cb[1],N),Math.max(cb[2],E),Math.max(cb[3],N)];
const comps=len=>Math.ceil((len+2*MIN_MARGIN_M)/QUADS_PER_COMPONENT),kx=comps(cb[2]-cb[0]),ky=comps(cb[3]-cb[1]);
const expect={west:Math.round((cb[0]+cb[2])/2-kx*QUADS_PER_COMPONENT/2),north:Math.round((cb[1]+cb[3])/2+ky*QUADS_PER_COMPONENT/2),cols:kx*QUADS_PER_COMPONENT+1,rows:ky*QUADS_PER_COMPONENT+1};
for(const k of Object.keys(expect))if(expect[k]!==G[k])throw Error(`Emprise : ${k} recalculé ${expect[k]} ≠ ${G[k]} (terrain-frame.mjs)`);
const margins={west:r2(cb[0]-G.west),east:r2(G.east-cb[2]),south:r2(cb[1]-G.south),north:r2(G.north-cb[3])};

// ---- 2. Source tiles: SHA-256, georeferencing, mosaic at 0.5 m ----
const manifest=read(MANIFEST),W2=(G.cols-1)*2+1,H2=(G.rows-1)*2+1,mosaic=new Float32Array(W2*H2).fill(NaN),tileStats=[];
for(const t of neededTiles()){const m=manifest.tiles.find(x=>x.name===t.name);if(!m)throw Error('Dalle absente du manifeste : '+t.name);
 const file=`${TILE_DIR}/${t.name}`;if(!fs.existsSync(file))throw Error(`Dalle source absente : ${file}. Lancer npm run data:terrain-fetch (téléchargement vérifié par SHA-256).`);
 const buf=fs.readFileSync(file);if(sha(buf)!==m.sha256)throw Error('Dalle source modifiée (SHA-256) : '+file);
 const im=await (await fromArrayBuffer(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length))).getImage(),[rx,ry]=im.getResolution(),bb=im.getBoundingBox();
 if(im.getWidth()!==2000||im.getHeight()!==2000||rx!==.5||ry!==-.5||bb[0]!==t.x*1000-.25||bb[3]!==t.y*1000+.25||im.getGeoKeys().ProjCoordTransGeoKey!==8)throw Error('Géoréférencement inattendu : '+t.name);
 const [src]=await im.readRasters(),i0=(t.x*1000-G.west)*2,j0=(G.north-t.y*1000)*2;let nd=0,inside=0,mn=Infinity,mx=-Infinity;
 for(let r=0;r<2000;r++){const j=j0+r;if(j<0||j>=H2)continue;for(let c=0;c<2000;c++){const i=i0+c;if(i<0||i>=W2)continue;const v=src[r*2000+c];inside++;if(!(v>-1000)){nd++;continue;}mosaic[j*W2+i]=v;if(v<mn)mn=v;if(v>mx)mx=v;}}
 tileStats.push({name:t.name,mission:m.mission,acquisition:m.acquisition,cellsInExtent:inside,noData:nd,min:r2(mn),max:r2(mx)});}
log('mosaïque 0,5 m assemblée');
let srcMin=Infinity,srcMax=-Infinity,srcNoData=0;for(const v of mosaic){if(v!==v){srcNoData++;continue;}if(v<srcMin)srcMin=v;if(v>srcMax)srcMax=v;}

// ---- 3. 1 m grid: exact source samples at whole metres ----
const grid=new Float32Array(G.cols*G.rows);let noData1=0,zMin=Infinity,zMax=-Infinity,zSum=0;
for(let j=0;j<G.rows;j++)for(let i=0;i<G.cols;i++){const v=mosaic[(2*j)*W2+2*i];grid[j*G.cols+i]=v;if(v!==v){noData1++;continue;}if(v<zMin)zMin=v;if(v>zMax)zMax=v;zSum+=v;}
const zMean=zSum/(G.cols*G.rows-noData1);
const at=(E,N)=>{const i=E-G.west,j=G.north-N;const i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const at05=(E,N)=>{const i=(E-G.west)*2,j=(G.north-N)*2;const i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=W2-1||j0>=H2-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*W2+i0;return (mosaic[k]*(1-fx)+mosaic[k+1]*fx)*(1-fy)+(mosaic[k+W2]*(1-fx)+mosaic[k+W2+1]*fx)*fy;};

// ---- 4. Loss caused by the 0.5 m → 1 m reduction (bilinear 1 m surface vs every discarded 0.5 m sample) ----
const hist=new Uint32Array(20001);let n=0,ss=0,maxErr=0,maxAt=null,sumAbs=0;
for(let j=0;j<H2;j++)for(let i=0;i<W2;i++){if(!(i&1)&&!(j&1))continue;const v=mosaic[j*W2+i];if(v!==v)continue;const E=G.west+i/2,N=G.north-j/2,e=at(E,N)-v;if(e!==e)continue;const a=Math.abs(e);n++;ss+=e*e;sumAbs+=a;hist[Math.min(20000,Math.round(a*1000))]++;if(a>maxErr){maxErr=a;maxAt=[E,N];}}
const pct=q=>{let c=0,target=q*n;for(let k=0;k<hist.length;k++){c+=hist[k];if(c>=target)return k/1000;}};
const reduction={comparedSamples:n,rmse:r3(Math.sqrt(ss/n)),meanAbs:r3(sumAbs/n),p95:pct(.95),p99:pct(.99),p999:pct(.999),max:r3(maxErr),maxAtL93:maxAt,note:'Écart entre la surface bilinéaire de la grille 1 m et les 3 échantillons 0,5 m sur 4 écartés ; les nœuds 1 m sont eux-mêmes identiques à la source.'};
log('perte de réduction calculée');

// ---- 5. Checks: tile seams, mission boundary, local steps, aberrant values ----
const seams=[];
const seam=(kind,pos,pairs)=>{let across=0,inside=0,cnt=0,steps=0;for(const [a,b,c,d] of pairs){const va=mosaic[a],vb=mosaic[b],vc=mosaic[c],vd=mosaic[d];if([va,vb,vc,vd].some(v=>v!==v))continue;const x=Math.abs(va-vb),y=(Math.abs(vc-va)+Math.abs(vb-vd))/2;across+=x;inside+=y;cnt++;if(x>.5&&x>5*y+.2)steps++;}seams.push({kind,position:pos,pairs:cnt,meanAcross:r3(across/cnt),meanInside:r3(inside/cnt),ratio:r2((across/cnt)/(inside/cnt)),abruptSteps:steps});};
for(let E=Math.ceil(G.west/1000)*1000;E<G.east;E+=1000){const i=(E-G.west)*2,p=[];for(let j=0;j<H2;j++)p.push([j*W2+i-1,j*W2+i,j*W2+i-2,j*W2+i+1]);seam('verticale (E)',E,p);}
for(let N=Math.floor(G.north/1000)*1000;N>G.south;N-=1000){const j=(G.north-N)*2,p=[];for(let i=0;i<W2;i++)p.push([(j-1)*W2+i,j*W2+i,(j-2)*W2+i,(j+1)*W2+i]);seam('horizontale (N)',N+.5,p);}
const seamWorst=seams.reduce((a,b)=>b.ratio>a.ratio?b:a);
// Local anomalies on the 1 m grid: a node more than 1 m away from the mean of its 4 neighbours (walls, embankments, pits).
let anomalies=0,aberrant=0,maxSlope=0,maxSlopeAt=null;const anomalyList=[];
for(let j=1;j<G.rows-1;j++)for(let i=1;i<G.cols-1;i++){const k=j*G.cols+i,v=grid[k];if(v!==v)continue;if(v<0||v>500)aberrant++;
 const nb=(grid[k-1]+grid[k+1]+grid[k-G.cols]+grid[k+G.cols])/4,d=v-nb;if(Math.abs(d)>1){anomalies++;if(anomalyList.length<5000)anomalyList.push([Math.abs(d),G.west+i,G.north-j,r2(d)]);}
 const s=Math.hypot((grid[k+1]-grid[k-1])/2,(grid[k+G.cols]-grid[k-G.cols])/2);if(s>maxSlope){maxSlope=s;maxSlopeAt=[G.west+i,G.north-j];}}
anomalyList.sort((a,b)=>b[0]-a[0]);
log('contrôles de raccords et d’anomalies faits');

// ---- 6. NoData handling for the heightmap only (none expected; every filled node is counted and masked) ----
const hm=Float32Array.from(grid),filled=[];if(noData1){let todo=[];for(let k=0;k<hm.length;k++)if(hm[k]!==hm[k])todo.push(k);
 while(todo.length){const next=[],upd=[];for(const k of todo){const i=k%G.cols,j=(k-i)/G.cols,vs=[];for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=G.cols||b>=G.rows)continue;const v=hm[b*G.cols+a];if(v===v)vs.push(v);}if(vs.length)upd.push([k,vs.reduce((s,v)=>s+v)/vs.length]);else next.push(k);}
  if(!upd.length)throw Error('NoData impossible à combler');for(const [k,v] of upd){hm[k]=v;filled.push(k);}todo=next;}}

// ---- 7. Unreal outputs: GeoTIFF 1 m, PNG 16-bit heightmap, RAW 16-bit ----
const tif=Float32Array.from(grid,v=>v===v?v:-9999);
writeGeoTiff(TIF,{width:G.cols,height:G.rows,data:tif,noData:-9999,tiepoint:[0,0,0,G.west-.5,G.north+.5,0],scale:[1,1,0],geoKeys:GEOKEYS_L93_IGN69,rowsPerStrip:8,level:9,description:'IGN LiDAR HD MNT 0.5 m, nodes on whole Lambert-93 metres (1 m), NGF-IGN69 metres; Maizieres-3D V1.7'});
log('GeoTIFF écrit');
const Z_SCALE_UE=100,UNITS_PER_METRE=128*100/Z_SCALE_UE,zRef=Math.round((zMin+zMax)/2),u16=new Uint16Array(G.cols*G.rows);let qMax=0,qSs=0;
for(let k=0;k<hm.length;k++){const v=Math.round(32768+(hm[k]-zRef)*UNITS_PER_METRE);if(v<0||v>65535)throw Error('Altitude hors plage 16 bits');u16[k]=v;const back=zRef+(v-32768)/UNITS_PER_METRE,e=Math.abs(back-hm[k]);if(e>qMax)qMax=e;qSs+=e*e;}
const landscape={overallResolution:[G.cols,G.rows],quadsPerSection:127,sectionsPerComponent:'2×2',quadsPerComponent:QUADS_PER_COMPONENT,components:[(G.cols-1)/QUADS_PER_COMPONENT,(G.rows-1)/QUADS_PER_COMPONENT],componentCount:(G.cols-1)/QUADS_PER_COMPONENT*(G.rows-1)/QUADS_PER_COMPONENT,
 scale:{x:100,y:100,z:Z_SCALE_UE},location:{x:(G.west-O.E)*100,y:-(G.north-O.N)*100,z:(zRef-O.H)*100},
 newLandscapeToolLocation:{x:(G.west+(G.cols-1)/2-O.E)*100,y:-(G.north-(G.rows-1)/2-O.N)*100,z:(zRef-O.H)*100},
 locationNote:'location = position de l’acteur Landscape = sommet (0, 0), coin nord-ouest. L’outil « New Landscape » de l’éditeur centre le paysage sur la valeur saisie : y saisir newLandscapeToolLocation (centre), puis vérifier que l’acteur obtenu est à location.',
 sizeMetres:[G.cols-1,G.rows-1],
 encoding:`valeur = round(32768 + (altitude_NGF − ${zRef}) × ${UNITS_PER_METRE}) ; altitude_NGF = ${zRef} + (valeur − 32768) / ${UNITS_PER_METRE}`,
 quantisationStepM:1/UNITS_PER_METRE,quantisationMaxErrorM:r3(qMax),quantisationRmseM:+(Math.sqrt(qSs/hm.length)).toFixed(4),
 unrealHeightFormula:'Z_unreal(cm) = location.z + (valeur − 32768) / 128 × scale.z : avec scale.z = 100, 1 m réel = 1 m Unreal (aucune exagération)',
 rowOrder:'ligne 0 = nord (N max), colonne 0 = ouest (E min) ; sommet (i, j) = (E = west + i, N = north − j)'};
writePng16(PNG,{width:G.cols,height:G.rows,data:u16,text:{Software:'Maizieres-3D scripts/build-terrain.mjs',Source:'IGN LiDAR HD MNT 0.5 m (1 m nodes), EPSG:2154, NGF-IGN69',Encoding:landscape.encoding,Origin:`NW node E=${G.west} N=${G.north}, step 1 m`}});
const r16=Buffer.alloc(u16.length*2);for(let k=0;k<u16.length;k++)r16.writeUInt16LE(u16[k],k*2);fs.writeFileSync(R16,r16);
log('heightmap écrite');

// ---- 8. Three.js working grid (10 m, local frame of src/geo.js), vertical reference = terrain at the common origin ----
const osm=read('public/data/maizieres.geojson'),origin=osm.metadata.origin,project=projection(origin),k0=R*Math.PI/180,c0=Math.cos(origin[1]*Math.PI/180);
const unproject=([x,z])=>[origin[0]+x/(k0*c0),origin[1]-z/k0],localToL93=p=>toL93(unproject(p));
const lb=bounds(polygons(commune.features?commune.features[0]:commune,project).flat(2)),lext={minX:lb.minX-150,maxX:lb.maxX+150,minZ:lb.minZ-150,maxZ:lb.maxZ+150};
const STEP=10,x0=Math.floor(lext.minX/STEP)*STEP,z0=Math.floor(lext.minZ/STEP)*STEP,wc=Math.ceil((lext.maxX-x0)/STEP)+1,wr=Math.ceil((lext.maxZ-z0)/STEP)+1;
const yRef=Math.round(at(O.E,O.N)*10)/10,zBase=Math.floor(zMin),web=new Uint16Array(wc*wr);let webNoData=0;
for(let r=0;r<wr;r++)for(let c=0;c<wc;c++){const [E,N]=localToL93([x0+c*STEP,z0+r*STEP]),v=at(E,N);if(v!==v){web[r*wc+c]=65535;webNoData++;}else web[r*wc+c]=Math.round((v-zBase)*100);}
// Error of the working grid against the 1 m grid (random points, fixed seed).
let seed=10220;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};let wss=0,wmax=0,wn=0;
for(let s=0;s<200000;s++){const x=x0+rnd()*(wc-1)*STEP,z=z0+rnd()*(wr-1)*STEP,c=Math.floor((x-x0)/STEP),r=Math.floor((z-z0)/STEP),fx=(x-x0)/STEP-c,fz=(z-z0)/STEP-r,g=(a,b)=>web[b*wc+a]/100+zBase;
 const w=(g(c,r)*(1-fx)+g(c+1,r)*fx)*(1-fz)+(g(c,r+1)*(1-fx)+g(c+1,r+1)*fx)*fz,[E,N]=localToL93([x,z]),v=at(E,N);if(v!==v)continue;const e=w-v;wss+=e*e;wn++;wmax=Math.max(wmax,Math.abs(e));}
const webMeta={source:'IGN LiDAR HD MNT (grille 1 m du référentiel V1.7), rééchantillonnage bilinéaire',frame:'repère local Three.js de src/geo.js (x est, z sud, mètres), origine '+origin.join(', '),x0,z0,step:STEP,cols:wc,rows:wr,
 encoding:'Uint16 little-endian, ligne par ligne (z croissant) : altitude_NGF = zBase + valeur / 100 ; 65535 = NoData',zBase,noData:webNoData,yReference:yRef,
 yReferenceNote:'Dans le mode ?diagnostic=terrain, y Three.js = altitude NGF − yReference (altitude du terrain à l’origine commune)',vsGrid1m:{rmse:r3(Math.sqrt(wss/wn)),max:r2(wmax),samples:wn}};
fs.writeFileSync(WEB_BIN,Buffer.from(web.buffer));fs.writeFileSync(WEB_JSON,JSON.stringify(webMeta,null,1)+'\n');
log('grille Three.js écrite');

// ---- 9. Terrain under every frozen building (geometry untouched; derived file keyed by the stable id) ----
const bRaw=fs.readFileSync(BUILDINGS),buildings=JSON.parse(bRaw),out={};const median=a=>{const s=Float64Array.from(a).sort();return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
let slopeFlag=0,noDataFlag=0;
for(const f of buildings.features){const p=f.properties,polys=polygons(f,toL93),interior=[],perimeter=[];let bb=[1e12,1e12,-1e12,-1e12],cx=0,cy=0,cn=0;
 for(const poly of polys){for(const [E,N] of poly[0]){bb=[Math.min(bb[0],E),Math.min(bb[1],N),Math.max(bb[2],E),Math.max(bb[3],N)];cx+=E;cy+=N;cn++;}
  for(const ring of poly)for(let q=0;q<ring.length;q++){const a=ring[q],b=ring[(q+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(L/.5));for(let s=0;s<steps;s++){const v=at05(a[0]+(b[0]-a[0])*s/steps,a[1]+(b[1]-a[1])*s/steps);if(v===v)perimeter.push(v);}}}
 for(let j=Math.ceil((G.north-bb[3])*2);j<=Math.floor((G.north-bb[1])*2);j++)for(let i=Math.ceil((bb[0]-G.west)*2);i<=Math.floor((bb[2]-G.west)*2);i++){const E=G.west+i/2,N=G.north-j/2;if(polys.some(poly=>insidePoly([E,N],poly))){const v=mosaic[j*W2+i];if(v===v)interior.push(v);}}
 const all=interior.concat(perimeter);if(!all.length){noDataFlag++;out[p.id]={noData:true};continue;}
 const min=Math.min(...all),max=Math.max(...all),centroid=[cx/cn,cy/cn],base=min;if(max-min>1.5)slopeFlag++;
 out[p.id]={inCommune:p.inCommune,baseZ:r2(base),medianZ:r2(median(all)),minZ:r2(min),maxZ:r2(max),drop:r2(max-min),interiorSamples:interior.length,perimeterSamples:perimeter.length,
  interiorMedianZ:interior.length?r2(median(interior)):null,perimeterMinZ:perimeter.length?r2(Math.min(...perimeter)):null,perimeterMaxZ:perimeter.length?r2(Math.max(...perimeter)):null,
  centroidL93:centroid.map(r2),unrealCm:toUnreal([centroid[0],centroid[1],base]).map(v=>Math.round(v))};}
fs.writeFileSync(BLD,JSON.stringify({metadata:{version:'1.7',source:'IGN LiDAR HD MNT 0,5 m (mosaïque source, sans rééchantillonnage pour l’intérieur)',buildings:BUILDINGS,buildingsSha256:sha(bRaw),count:Object.keys(out).length,
 fields:{baseZ:'altitude NGF-IGN69 recommandée pour le socle : minimum du terrain sous l’emprise et le long du contour (aucun côté ne flotte)',medianZ:'médiane du terrain (intérieur + contour)',minZ:'minimum',maxZ:'maximum',drop:'maxZ − minZ : dénivelé sous l’emprise',
  interiorMedianZ:'médiane des cellules 0,5 m dont le centre est dans l’emprise (sous un bâtiment, le MNT LiDAR est interpolé par l’IGN)',perimeterMinZ:'minimum le long du contour (échantillons tous les 0,5 m, bilinéaire)',centroidL93:'centre moyen des sommets, Lambert-93',unrealCm:'centre (X, Y) et baseZ en centimètres Unreal, origine UNREAL_ORIGIN'},
 unrealOrigin:O,note:'Les géométries de buildings.geojson ne sont pas modifiées. Pour Unreal : poser la base du bâtiment à baseZ et prolonger les murs jusqu’au terrain.'},buildings:out})+'\n');
log('altitudes des bâtiments écrites');

// ---- 10. Spatial controls on named sectors ----
const pt=id=>osm.features.find(f=>f.id===id)?.geometry.coordinates,zone=(name,[E,N],radius)=>{let mn=Infinity,mx=-Infinity,s=0,c=0,nd=0,sl=0;for(let y=N-radius;y<=N+radius;y+=2)for(let x=E-radius;x<=E+radius;x+=2){if(Math.hypot(x-E,y-N)>radius)continue;const v=at(x,y);if(v!==v){nd++;continue;}mn=Math.min(mn,v);mx=Math.max(mx,v);s+=v;c++;const g=Math.hypot(at(x+1,y)-at(x-1,y),at(x,y+1)-at(x,y-1))/2;if(g>sl)sl=g;}return {name,centreL93:[E,N].map(Math.round),radiusM:radius,min:r2(mn),max:r2(mx),mean:r2(s/c),maxSlopePct:Math.round(sl*100),noData:nd};};
const zi=read('public/data/named-zones.geojson').features.find(f=>/Glaci/.test(f.properties.name||''));const ziPoly=polygons(zi,toL93)[0][0],ziC=ziPoly.reduce((a,p)=>[a[0]+p[0]/ziPoly.length,a[1]+p[1]/ziPoly.length],[0,0]);
const communeRing=polygons(commune.features?commune.features[0]:commune,toL93)[0][0],ext=[['nord',p=>p[1]],['sud',p=>-p[1]],['est',p=>p[0]],['ouest',p=>-p[0]]].map(([n,k])=>{const p=communeRing.reduce((a,b)=>k(b)>k(a)?b:a);return {name:'extrémité '+n,L93:p.map(Math.round),z:r2(at(p[0],p[1]))};});
const profile=(name,ls)=>{let len=0,mn=Infinity,mx=-Infinity,maxGrade=0,where=null,jumps=0;for(const l of ls){for(let q=0;q<l.length-1;q++){const a=l[q],b=l[q+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),st=Math.max(1,Math.ceil(L/5));let prev=null;for(let s=0;s<=st;s++){const E=a[0]+(b[0]-a[0])*s/st,N=a[1]+(b[1]-a[1])*s/st,v=at(E,N);if(v!==v)continue;mn=Math.min(mn,v);mx=Math.max(mx,v);if(prev!==null){const d=Math.abs(v-prev.v)/Math.max(.1,Math.hypot(E-prev.E,N-prev.N));if(d>maxGrade){maxGrade=d;where=[E,N].map(Math.round);}if(Math.abs(v-prev.v)>1)jumps++;}prev={E,N,v};}len+=L;}}return {name,lengthM:Math.round(len),min:r2(mn),max:r2(mx),maxGradePct:Math.round(maxGrade*100),maxGradeAtL93:where,stepsOver1mPer5m:jumps};};
const rail=osm.features.filter(f=>f.properties.railway==='rail').flatMap(f=>lines(f,toL93)).filter(l=>l.some(([E,N])=>E>G.west&&E<G.east&&N>G.south&&N<G.north));
const roads=osm.features.filter(f=>f.properties.highway&&f.properties.name&&['primary','secondary','tertiary','residential','unclassified'].includes(f.properties.highway));const byName=new Map();for(const f of roads)byName.set(f.properties.name,(byName.get(f.properties.name)||[]).concat(lines(f,toL93)));
const roadProfiles=[...byName].map(([n,ls])=>profile(n,ls)).filter(r=>r.lengthM>100).sort((a,b)=>b.maxGradePct-a.maxGradePct);
const steepBuildings=Object.entries(out).filter(([,b])=>b.inCommune&&b.drop>1.5).sort((a,b)=>b[1].drop-a[1].drop);
const controls={zones:[zone('centre-bourg (origine commune)',[O.E,O.N],300),zone('Les Granges',toL93(pt('node/5622940013')),250),zone('Poussey',toL93(pt('node/1637904805')),250),zone('Zone industrielle la Glacière',ziC,300)],extremities:ext,
 railway:profile('voie ferrée (railway=rail, OSM)',rail),steepestRoads:roadProfiles.slice(0,8),roadsProfiled:roadProfiles.length,
 buildingsOnSlope:{threshold:'dénivelé > 1,5 m sous l’emprise',inCommune:steepBuildings.length,top:steepBuildings.slice(0,10).map(([id,b])=>({id,drop:b.drop,baseZ:b.baseZ,maxZ:b.maxZ,centroidL93:b.centroidL93}))}};

// ---- 11. Reference document ----
const files=[TIF,PNG,R16,WEB_BIN,WEB_JSON,BLD].map(f=>({file:f,bytes:fs.statSync(f).size,sha256:sha(fs.readFileSync(f)),inGit:!f.endsWith('.r16')}));
const reference={version:'1.7',generatedBy:'scripts/build-terrain.mjs (npm run data:terrain)',generatedAt:new Date().toISOString(),
 source:{product:manifest.product,service:manifest.service,license:manifest.license,resolution:0.5,missions:[...new Set(manifest.tiles.map(t=>t.mission))].map(m=>({mission:m,tiles:manifest.tiles.filter(t=>t.mission===m).length,acquisition:[...new Set(manifest.tiles.filter(t=>t.mission===m).flatMap(t=>t.acquisition))].sort(),edition:[...new Set(manifest.tiles.filter(t=>t.mission===m).map(t=>t.edition))]})),
  tiles:manifest.tiles.length,tileDirectory:TILE_DIR,manifest:MANIFEST,crs:manifest.crs,vertical:manifest.vertical,noDataValue:-9999,retrievedAt:manifest.metadataRetrievedAt},
 frame:{crs:'EPSG:2154',proj4:LAMB93,vertical:'NGF-IGN69 (EPSG:5720), mètres',lonLatNote:'Les GeoJSON du projet sont en CRS84/WGS84 ; RGF93 v1 et WGS84 sont confondus (écart < 1 m) : une seule transformation, proj4 CRS84 → EPSG:2154.',
  communeBboxL93:cb.map(r2),margins,grid:{...G,nodes:'nœuds sur les mètres entiers Lambert-93',sizeM:[G.cols-1,G.rows-1],areaKm2:r3((G.cols-1)*(G.rows-1)/1e6),cells:G.cols*G.rows},
  sourceMosaic:{step:.5,cols:W2,rows:H2,cells:W2*H2,min:r2(srcMin),max:r2(srcMax),noData:srcNoData}},
 stats:{min:r2(zMin),max:r2(zMax),amplitude:r2(zMax-zMin),mean:r2(zMean),noData1m:noData1,noDataSource:srcNoData,heightmapFilledNodes:filled.length,maxSlopePct:Math.round(maxSlope*100),maxSlopeAtL93:maxSlopeAt,aberrantValues:aberrant,
  localAnomaliesOver1m:anomalies,localAnomaliesTop:anomalyList.slice(0,15).map(([,E,N,d])=>({L93:[E,N],deviation:d})),tiles:tileStats},
 reduction,seams:{worst:seamWorst,all:seams},unrealOrigin:{...O,unrealCm:[0,0,0],realToUnreal:'X = (E − 758278) × 100 ; Y = −(N − 6823571) × 100 ; Z = (H − 0) × 100 (cm, X est, Y sud, Z haut)',unrealToReal:'E = 758278 + X / 100 ; N = 6823571 − Y / 100 ; H = Z / 100',terrainZAtOrigin:r2(at(O.E,O.N))},
 unrealLandscape:landscape,threejs:{file:WEB_BIN,meta:WEB_JSON,step:STEP,cols:wc,rows:wr,vertices:wc*wr,yReference:yRef,vsGrid1m:webMeta.vsGrid1m},
 buildings:{file:BLD,count:Object.keys(out).length,inCommune:Object.values(out).filter(b=>b.inCommune).length,noData:noDataFlag,dropOver1_5m:slopeFlag,buildingsSha256:sha(bRaw)},controls,files};
fs.writeFileSync(REFJ,JSON.stringify(reference,null,1)+'\n');
log('référence écrite');
console.log(JSON.stringify({stats:{...reference.stats,tiles:undefined,localAnomaliesTop:undefined},reduction,seamWorst,landscape,origin:reference.unrealOrigin,threejs:reference.threejs,buildings:reference.buildings,files:files.map(f=>[f.file,(f.bytes/1e6).toFixed(1)+' Mo'])},null,1));
