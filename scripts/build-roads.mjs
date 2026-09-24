// V1.8 road reference, built from local snapshots only (npm run data:roads).
// Geometry: IGN BD TOPO troncon_de_route (official, topological network) over the frozen V1.7 terrain extent.
// Complement: OpenStreetMap ways (project snapshot) absent from BD TOPO. Semantics: OSM tags transferred by exact
// proximity matching; names from BAN (via BD TOPO), OSM and BIBLE_01, never invented. Altitude: frozen V1.7 terrain GeoTIFF.
// The building and terrain references are read only. Outputs: public/data/roads.geojson, unreal/roads/road-splines.json,
// data-sources/roads/roads-report.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,fromL93,toUnreal} from './terrain-frame.mjs';
import {insidePoly,polygons} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),r2=v=>Math.round(v*100)/100,r1=v=>Math.round(v*10)/10;
const REVIEW='data-sources/roads/roads-review-v1.8.json',REV=fs.existsSync(REVIEW)?read(REVIEW):{osmComplements:{},anomalies:{}};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[-'’_.]/g,' ').replace(/\bst\b/g,'saint').replace(/\s+/g,' ').trim();

// ---------- Terrain (frozen V1.7, read only) ----------
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const terrainZ=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const inExtent=([E,N])=>E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north;

// ---------- Geometry helpers (Lambert-93 metres) ----------
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
function densify(l,step){const out=[l[0]];for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/step));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;}
function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return {d:Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy),t};}
// Inclusive variant (road split exactly on the rail line, as in the BD TOPO network): crossing or contact within tol.
function segTouch(a,b,c,d,tol=.3){const x=segCrossIn(a,b,c,d);if(x)return x;for(const [p,q,r] of [[a,c,d],[b,c,d],[c,a,b],[d,a,b]])if(segDist(p,q,r).d<=tol)return p;return null;}
function segCrossIn(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*r[0],a[1]+t*r[1]]:null;}
function segCross(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>1e-6&&t<1-1e-6&&u>1e-6&&u<1-1e-6?[a[0]+t*r[0],a[1]+t*r[1]]:null;}
// Segment index (grid of 50 m cells).
function segIndex(items){const g=new Map(),C=50;for(const it of items)for(let i=1;i<it.l.length;i++){const a=it.l[i-1],b=it.l[i];for(let x=Math.floor(Math.min(a[0],b[0])/C);x<=Math.floor(Math.max(a[0],b[0])/C);x++)for(let y=Math.floor(Math.min(a[1],b[1])/C);y<=Math.floor(Math.max(a[1],b[1])/C);y++){const k=x+','+y;if(!g.has(k))g.set(k,[]);g.get(k).push([it,i]);}}
 return (p,r)=>{const out=[];for(let x=Math.floor((p[0]-r)/C);x<=Math.floor((p[0]+r)/C);x++)for(let y=Math.floor((p[1]-r)/C);y<=Math.floor((p[1]+r)/C);y++)for(const s of g.get(x+','+y)||[])out.push(s);return out;};}
function nearest(q,p,r,skip){let best=null;for(const [it,i] of q(p,r)){if(skip&&skip(it))continue;const {d,t}=segDist(p,it.l[i-1],it.l[i]);if(d<=r&&(!best||d<best.d))best={it,i,d,t};}return best;}

// ---------- Sources ----------
const bd=read('data-sources/roads/bdtopo-troncon-de-route.geojson'),osmAll=read('public/data/maizieres.geojson'),rails=read('data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson'),pts=read('data-sources/roads/bdtopo-point-du-reseau.geojson'),constr=read('data-sources/roads/bdtopo-construction-lineaire.geojson');
const commune=read('public/data/commune.geojson'),communeL93=polygons(commune.features?commune.features[0]:commune,toL93),inCommune=p=>communeL93.some(poly=>insidePoly(p,poly));
const bdItems=bd.features.map(f=>({src:'bdtopo',f,p:f.properties,id:f.properties.cleabs,l:f.geometry.coordinates.map(c=>toL93(c)),zBd:f.geometry.coordinates.map(c=>c[2]??null)}));
const osmWays=osmAll.features.filter(f=>f.properties.highway&&f.geometry.type==='LineString').map(f=>({src:'osm',f,p:f.properties,id:f.id,l:f.geometry.coordinates.map(c=>toL93(c))}));
const bdQ=segIndex(bdItems),osmQ=segIndex(osmWays);

// ---------- OSM semantics transferred to BD TOPO (≥ 50 % of the troncon within 8 m of the same OSM way) ----------
const OSM_KEYS=['highway','name','ref','surface','oneway','lanes','bridge','tunnel','layer','tracktype','smoothness','service','access','junction','maxspeed','cycleway','footway'];
for(const it of bdItems){const s=densify(it.l,5),tally=new Map();let matched=0;for(const p of s){const n=nearest(osmQ,p,8);if(n){matched++;tally.set(n.it,(tally.get(n.it)||0)+1);}}
 const donor=[...tally].sort((a,b)=>b[1]-a[1])[0];it.osmCoverage=r2(matched/s.length);it.osm=donor&&donor[1]/s.length>=.5?donor[0]:null;it.osmIds=[...tally.keys()].map(o=>o.id);}
// ---------- OSM complements: ways mostly (> 50 %) farther than 8 m from any BD TOPO troncon ----------
// Only the runs of an OSM way lying more than 8 m from BD TOPO are kept (≥ 15 m long), so nothing is doubled; each run is a
// separate feature "way/…#k" whose geometry is the OSM geometry itself (cut where it meets BD TOPO, Douglas-Peucker 5 cm).
function simplify(pts,tol=.05){if(pts.length<3)return pts;let idx=0,dmax=0;for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i],pts[0],pts.at(-1)).d;if(d>dmax){dmax=d;idx=i;}}return dmax>tol?simplify(pts.slice(0,idx+1),tol).slice(0,-1).concat(simplify(pts.slice(idx),tol)):[pts[0],pts.at(-1)];}
const complements=[],partialOsm=[],fromL=[];
for(const o of osmWays){if(o.p.footway==='crossing'||!o.l.some(inExtent))continue;const d=densify(o.l,1),far=d.map(p=>inExtent(p)&&!nearest(bdQ,p,8)),cov=1-far.filter(Boolean).length/d.length;let runs=[],cur=null;
 d.forEach((p,i)=>{if(far[i]){if(!cur){cur=[];cur.cutA=i>0;runs.push(cur);if(i>0)cur.push(d[i-1]);}cur.push(p);}else if(cur){cur.push(p);cur.cutB=true;cur=null;}});
 runs=runs.map(r=>Object.assign(simplify(r),{cutA:r.cutA,cutB:r.cutB})).filter(r=>len(r)>=15);if(cov>=.1&&runs.length)partialOsm.push({id:o.id,highway:o.p.highway,name:o.p.name||null,bdCoverage:r2(cov),keptRuns:runs.length,keptM:Math.round(runs.reduce((s,r)=>s+len(r),0))});
 runs.forEach((r,k)=>complements.push({src:'osm',f:o.f,p:o.p,id:runs.length===1&&cov<.02?o.id:`${o.id}#${k+1}`,l:r,cutA:!!r.cutA,cutB:!!r.cutB,osmWay:o.id,bdCoverage:r2(cov),cut:!(runs.length===1&&cov<.02)}));}

// ---------- Classification ----------
const CAT={route_principale:'Route principale',route_secondaire:'Route secondaire',voie_locale:'Voie locale / résidentielle',voie_de_desserte:'Voie de desserte / accès',voie_pietonne:'Voie piétonne',chemin_carrossable:'Chemin carrossable (empierré)',chemin_rural:'Chemin rural / agricole (terre)',sentier:'Sentier / piste (non carrossable)'};
// Deterministic inferred widths (m), used only when no documented width exists. Never presented as a measurement.
const INFERRED={route_principale:7,route_secondaire:6,voie_locale:5,voie_de_desserte:4,voie_pietonne:3,chemin_carrossable:3,chemin_rural:2.5,sentier:1.5};
const UNREAL={route_principale:'paved',route_secondaire:'paved',voie_locale:'paved',voie_de_desserte:'paved',voie_pietonne:'paved-pedestrian',chemin_carrossable:'gravel-track',chemin_rural:'dirt-track',sentier:'footpath'};
function classifyBd(it){const p=it.p,o=it.osm?.p||{};
 if(p.nature==='Sentier')return 'sentier';if(p.nature==='Chemin')return p.acces_vehicule_leger==='Physiquement impossible'?'sentier':'chemin_rural';if(p.nature==='Route empierrée')return 'chemin_carrossable';
 const imp=+p.importance;if(imp<=2)return 'route_principale';if(imp<=4)return 'route_secondaire';if(o.highway==='pedestrian')return 'voie_pietonne';if(o.highway==='service')return 'voie_de_desserte';return 'voie_locale';}
function classifyOsm(o){const h=o.p.highway;if(['primary','trunk'].includes(h))return 'route_principale';if(['secondary','tertiary'].includes(h))return 'route_secondaire';if(['residential','unclassified','living_street'].includes(h))return 'voie_locale';if(h==='service')return 'voie_de_desserte';if(h==='pedestrian')return 'voie_pietonne';
 if(h==='track')return ['grade1','grade2'].includes(o.p.tracktype)?'chemin_carrossable':'chemin_rural';return 'sentier';}
const surfaceOf=(cat,p,o)=>{if(o?.surface)return {surface:o.surface,surfaceSource:'osm'};const bdn=p?.nature;
 if(bdn)return {surface:['Route à 1 chaussée','Route à 2 chaussées','Rond-point'].includes(bdn)?'revêtu':bdn==='Route empierrée'?'empierré (sommairement revêtu)':'non revêtu',surfaceSource:'bdtopo-nature'};return {surface:cat==='chemin_carrossable'?'empierré (présumé)':['chemin_rural','sentier'].includes(cat)?'non revêtu (présumé)':'revêtu (présumé)',surfaceSource:'inferred'};};
const PAVED=s=>/asphalt|paved|concrete|revêtu$|^revêtu|sett|paving/.test(s)&&!/unpaved|sommairement|non revêtu/.test(s);

// ---------- Names (BAN via BD TOPO, BD TOPO collaborative, OSM, BIBLE_01) ----------
const bible=read('public/data/bible-annotations.json'),bibleByNorm=new Map(Object.keys(bible.streets).map(n=>[norm(n),n]));
function names(p,o){const ban=[...new Set([p?.nom_voie_ban_gauche,p?.nom_voie_ban_droite].filter(Boolean))],collab=[...new Set([p?.nom_collaboratif_gauche,p?.nom_collaboratif_droite].filter(Boolean))],osmName=o?.name||null;
 const candidates=[osmName,...ban,...collab].filter(Boolean),agree=osmName&&ban.some(b=>norm(b)===norm(osmName));
 const name=agree?osmName:ban[0]||osmName||(collab[0]?collab[0]:null),nameSource=agree?'osm = BAN':ban[0]?'BAN (BD TOPO)':osmName?'osm':collab[0]?'BD TOPO (nom collaboratif)':null;
 const bibleName=candidates.map(c=>bibleByNorm.get(norm(c))).find(Boolean)||null;return {name,nameSource,nameBan:ban,nameCollaboratif:collab,nameOsm:osmName,nameBible:bibleName,routeNumber:p?.cpx_numero||o?.ref||null};}

// ---------- Structures: bridges, underpasses, level crossings ----------
const railL=rails.features.map(f=>({id:f.properties.cleabs,p:f.properties,l:f.geometry.coordinates.map(c=>toL93(c))})),railQ=segIndex(railL);
const bridgesL=constr.features.filter(f=>f.properties.nature==='Pont').map(f=>({id:f.properties.cleabs,l:f.geometry.coordinates.map(c=>toL93(c))})),bridgeQ=segIndex(bridgesL);
const pnPoints=pts.features.filter(f=>f.properties.nature==='Passage à niveau').map(f=>({id:f.properties.cleabs,name:f.properties.toponyme,p:toL93(f.geometry.coordinates)}));
const waterL=osmAll.features.filter(f=>f.properties.waterway&&/LineString/.test(f.geometry.type)).flatMap(f=>(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(l=>({id:f.id,name:f.properties.name||f.properties.waterway,l:l.map(c=>toL93(c))}))),waterQ=segIndex(waterL);

// ---------- Build road features ----------
const roads=[];
for(const it of [...bdItems,...complements]){const bdp=it.src==='bdtopo'?it.p:null,o=it.src==='bdtopo'?it.osm?.p:it.p,cat=it.src==='bdtopo'?classifyBd(it):classifyOsm(it);
 const officialW=bdp?.largeur_de_chaussee>0?+bdp.largeur_de_chaussee:null,osmW=o?.width?+o.width:null,lanes=bdp?.nombre_de_voies||(o?.lanes?+o.lanes:null);
 const inferred=INFERRED[cat],width=officialW??osmW??inferred,widthSource=officialW?'official':osmW?'osm':'inferred';
 const sens=bdp?.sens_de_circulation,oneway=sens==='Double sens'?'no':sens==='Sens direct'?'forward':sens==='Sens inverse'?'backward':o?.oneway==='yes'?'forward':o?.oneway==='-1'?'backward':o?.oneway==='no'?'no':null;
 const structure=bdp?(bdp.position_par_rapport_au_sol==='1'?'pont':bdp.position_par_rapport_au_sol==='-1'?'souterrain':'sol'):(o.bridge&&o.bridge!=='no'?'pont':o.tunnel&&o.tunnel!=='no'?'souterrain':'sol');
 const osmBridgeDisagree=!!(bdp&&o&&(!!(o.bridge&&o.bridge!=='no'))!==(structure==='pont'));
 const sf=surfaceOf(cat,bdp,o),nm=names(bdp,o),lenM=len(it.l),mid=densify(it.l,1)[Math.floor(densify(it.l,1).length/2)];
 const geometry=it.cut?{type:'LineString',coordinates:it.l.map(p=>fromL93(p).map(v=>+v.toFixed(8)))}:it.f.geometry;
 roads.push({it,geometry,id:it.id,provenance:it.src==='bdtopo'?(it.osm?'bdtopo+osm':'bdtopo'):'osm',category:cat,categoryLabel:CAT[cat],hierarchy:bdp?+bdp.importance:({route_principale:2,route_secondaire:4,voie_locale:5,voie_de_desserte:5}[cat]||6),
  serviceType:o?.service||null,unrealType:UNREAL[cat],paved:PAVED(sf.surface)&&!['chemin_carrossable','chemin_rural','sentier'].includes(cat),...sf,...nm,oneway,lanes,width,widthSource,widthOfficial:officialW,widthOsm:osmW,widthInferred:inferred,
  structure,osmBridgeDisagree,vehicleAccess:bdp?.acces_vehicule_leger||(o?.access||null),private:bdp?.prive||false,urban:bdp?.urbain??null,state:bdp?.etat_de_l_objet||'En service',
  lengthM:r1(lenM),inCommune:inCommune(mid),osmIds:it.src==='bdtopo'?it.osmIds:[it.osmWay],osmCoverage:it.osmCoverage??null,bdCoverage:it.bdCoverage??null,
  precisionPlanimetric:bdp?.precision_planimetrique??null,sourceDates:bdp?{created:String(bdp.date_creation).slice(0,10),modified:String(bdp.date_modification).slice(0,10)}:null});}
const byId=new Map(roads.map(r=>[r.id,r]));
// OSM complements reviewed on the orthophoto: withdrawn when the review proves they are not a way.
for(const [id,rv] of Object.entries(REV.osmComplements))if(rv.action==='exclure'){const r=byId.get(id);if(r){r.excluded=rv;}}

// ---------- Sectors ----------
const pt=id=>toL93(osmAll.features.find(f=>f.id===id).geometry.coordinates);
const zi=read('public/data/named-zones.geojson').features.filter(f=>/Glaci|Seveal/.test(f.properties.name||'')).flatMap(f=>polygons(f,toL93));
const SECT=[['centre-bourg',[O.E,O.N],650],['Les Granges',pt('node/5622940013'),600],['Poussey',pt('node/1637904805'),550]];
const sectorOf=p=>zi.some(poly=>insidePoly(p,poly))?'zone industrielle':(SECT.find(([,c,r])=>Math.hypot(p[0]-c[0],p[1]-c[1])<=r)||[inCommune(p)?'reste de la commune':'hors commune'])[0];
for(const r of roads){const d=densify(r.it.l,1);r.sector=sectorOf(d[Math.floor(d.length/2)]);}

// ---------- Topology ----------
const active=roads.filter(r=>!r.excluded&&r.state==='En service'),key=p=>Math.round(p[0]*20)+':'+Math.round(p[1]*20),nodes=new Map();
const node=(p,road,end)=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{p,ends:[],inner:[]});nodes.get(k).ends.push({road,end});return k;};
for(const r of active.filter(r=>r.it.src==='bdtopo')){r.nodeA=node(r.it.l[0],r,'A');r.nodeB=node(r.it.l.at(-1),r,'B');}
// OSM complements join the BD TOPO network when an end lies within 3 m of a node or a segment (a connection is recorded, geometry untouched).
const bdActive=active.filter(r=>r.it.src==='bdtopo').map(r=>r.it),bdActiveQ=segIndex(bdActive),snaps=[];
// A run end cut where the OSM way reaches BD TOPO lies up to 8 m from it: that end joins within 9 m.
// Uncut ends may also meet another OSM complement (T junctions inside car parks, footway networks).
const anyActiveQ=segIndex(active.map(r=>r.it));
for(const r of active.filter(r=>r.it.src==='osm'))for(const end of ['A','B']){const p=end==='A'?r.it.l[0]:r.it.l.at(-1);const n=r.it['cut'+end]?nearest(bdActiveQ,p,9):nearest(anyActiveQ,p,3,it=>it===r.it);
 if(n){const t=n.t,seg=[n.it.l[n.i-1],n.it.l[n.i]],q=[seg[0][0]+(seg[1][0]-seg[0][0])*t,seg[0][1]+(seg[1][1]-seg[0][1])*t],ends=[n.it.l[0],n.it.l.at(-1)],atEnd=ends.find(e=>Math.hypot(e[0]-q[0],e[1]-q[1])<1.5);
  const k=node(atEnd||q,r,end);if(!atEnd)nodes.get(k).inner.push(n.it.id);r['node'+end]=k;snaps.push({road:r.id,end,to:n.it.id,distanceM:r2(n.d)});}else r['node'+end]=node(p,r,end);}
// OSM complements connected to each other.
const nearBorder=p=>p[0]-G.west<5||G.east-p[0]<5||p[1]-G.south<5||G.north-p[1]<5;
const vehicle=r=>!['sentier','voie_pietonne'].includes(r.category);
// A way joining the interior of a BD TOPO troncon makes a T: the through troncon counts twice.
// ---------- Crossings of two ways without a shared node ----------
const allActiveQ=segIndex(active.map(r=>r.it)),rOf=new Map(active.map(r=>[r.it,r]));
const crossings=[];for(const r of active)for(let i=1;i<r.it.l.length;i++)for(const [it,j] of allActiveQ(r.it.l[i],Math.hypot(r.it.l[i][0]-r.it.l[i-1][0],r.it.l[i][1]-r.it.l[i-1][1])+1)){if(it===r.it||it.id<r.it.id)continue;const x=segCross(r.it.l[i-1],r.it.l[i],it.l[j-1],it.l[j]);if(!x)continue;const o=rOf.get(it);
 const graded=r.structure!=='sol'||o.structure!=='sol',kind=graded?'dénivelée (pont / souterrain)':r.provenance==='osm'||o.provenance==='osm'?'croisement OSM sans nœud':'croisement BD TOPO sans nœud';
 if(!crossings.some(c=>Math.hypot(c.L93[0]-x[0],c.L93[1]-x[1])<.5))crossings.push({L93:x.map(r2),roads:[r.id,o.id],names:[r.name,o.name],categories:[r.category,o.category],kind});}
// OSM ways crossing at grade without a shared node (car-park aisles, footways): the crossing becomes a topological node
// (geometry untouched). BD TOPO crossings without node would stay open inconsistencies.
const addedCrossNodes=[];for(const c of crossings.filter(c=>c.kind==='croisement OSM sans nœud')){const k=key(c.L93);nodes.set(k,{p:c.L93,ends:[],inner:[],crossing:c.roads});c.resolved='nœud de carrefour ajouté (croisement à niveau)';addedCrossNodes.push({L93:c.L93,roads:c.roads});}
const nodeList=[...nodes].map(([k,n])=>{const deg=n.crossing?4:n.ends.length+2*n.inner.length,roadsAt=[...new Set(n.ends.map(e=>e.road))],vdeg=n.ends.filter(e=>vehicle(e.road)).length+2*n.inner.length;
 if(n.crossing)roadsAt.push(...n.crossing.map(id=>byId.get(id)));const names=[...new Set(roadsAt.map(r=>r.name).filter(Boolean))],pn=pnPoints.find(q=>Math.hypot(q.p[0]-n.p[0],q.p[1]-n.p[1])<15);
 const type=deg>=4?'carrefour':deg===3?'embranchement':deg===2?(names.length>1?'changement de nom':'continuité'):nearBorder(n.p)?'limite d’emprise':vehicle(roadsAt[0])?'impasse':'extrémité de sentier';
 return {id:'N'+k.replace(':','_'),key:k,L93:n.p.map(r2),type,degree:deg,roundabout:roadsAt.some(r=>r.it.p?.nature==='Rond-point'),levelCrossing:pn?pn.name:null,roads:roadsAt.map(r=>r.id),names,z:r2(terrainZ(...n.p)),inCommune:inCommune(n.p),sector:sectorOf(n.p)};});
const nodeByKey=new Map(nodeList.map(n=>[n.key,n]));
// Connected components (all active ways) and orphan fragments (not the main network, not cut by the extent border).
const adj=new Map();for(const r of active){for(const k of [r.nodeA,r.nodeB]){if(!adj.has(k))adj.set(k,new Set());}adj.get(r.nodeA).add(r.nodeB);adj.get(r.nodeB).add(r.nodeA);}
for(const n of nodeList)for(const id of nodes.get(n.key).crossing||[]){const r=byId.get(id);if(!adj.has(n.key))adj.set(n.key,new Set());adj.get(n.key).add(r.nodeA);adj.get(r.nodeA).add(n.key);}
for(const n of nodeList)for(const inner of nodes.get(n.key).inner){const r=byId.get(inner);if(r){adj.get(n.key).add(r.nodeA);adj.get(r.nodeA).add(n.key);}}
const comp=new Map();let cid=0;for(const k of adj.keys()){if(comp.has(k))continue;const st=[k];comp.set(k,cid);while(st.length){const x=st.pop();for(const y of adj.get(x))if(!comp.has(y)){comp.set(y,cid);st.push(y);}}cid++;}
const comps=new Map();for(const r of active){const c=comp.get(r.nodeA);if(!comps.has(c))comps.set(c,{id:c,roads:[],length:0,border:false,vehicle:false});const o=comps.get(c);o.roads.push(r);o.length+=r.lengthM;if(nearBorder(r.it.l[0])||nearBorder(r.it.l.at(-1)))o.border=true;if(vehicle(r))o.vehicle=true;}
const main=[...comps.values()].sort((a,b)=>b.length-a.length)[0];for(const r of active)r.component=comp.get(r.nodeA)===main.id?'réseau principal':'fragment';
const orphans=[...comps.values()].filter(c=>c!==main&&!c.border).map(c=>({roads:c.roads.map(r=>r.id),lengthM:Math.round(c.length),categories:[...new Set(c.roads.map(r=>r.category))],names:[...new Set(c.roads.map(r=>r.name).filter(Boolean))],provenance:[...new Set(c.roads.map(r=>r.provenance))],inCommune:c.roads.some(r=>r.inCommune),centreL93:c.roads[0].it.l[Math.floor(c.roads[0].it.l.length/2)].map(Math.round)})).sort((a,b)=>b.lengthM-a.lengthM);
const cutByBorder=[...comps.values()].filter(c=>c!==main&&c.border).length;

// ---------- Topology checks: near misses, duplicates, crossings without node ----------
const nearMiss=[];for(const n of nodeList.filter(n=>n.degree===1&&n.type!=='limite d’emprise')){const own=nodes.get(n.key).ends[0].road;const hit=nearest(allActiveQ,n.L93,3,it=>it===own.it);
 if(hit&&Math.hypot(...[0,1].map(i=>n.L93[i]-(hit.it.l[hit.i-1][i]+(hit.it.l[hit.i][i]-hit.it.l[hit.i-1][i])*hit.t)))>.05)nearMiss.push({node:n.id,road:own.id,roadName:own.name,category:own.category,nearRoad:hit.it.id,nearName:rOf.get(hit.it)?.name||null,gapM:r2(hit.d),L93:n.L93,provenance:own.provenance});}
const duplicates=[];for(const r of active){const s=densify(r.it.l,2);for(const other of new Set(s.flatMap(p=>allActiveQ(p,1.5).map(([it])=>it)))){if(other===r.it||other.id<r.it.id)continue;const o=rOf.get(other);let a=0;for(const p of s)if(nearest(segIndex([other]),p,1.5))a++;if(a/s.length>.8){duplicates.push({a:r.id,b:o.id,share:r2(a/s.length),names:[r.name,o.name],provenance:[r.provenance,o.provenance]});}}}

// ---------- Road ↔ railway: level crossings, road bridges over rail, roads under rail bridges ----------
const railCross=[];for(const r of active)for(let i=1;i<r.it.l.length;i++)for(const [rl,j] of railQ(r.it.l[i],Math.hypot(r.it.l[i][0]-r.it.l[i-1][0],r.it.l[i][1]-r.it.l[i-1][1])+1)){const x=segTouch(r.it.l[i-1],r.it.l[i],rl.l[j-1],rl.l[j]);if(!x)continue;
 const pn=pnPoints.find(q=>Math.hypot(q.p[0]-x[0],q.p[1]-x[1])<25),type=r.structure==='pont'?'pont routier au-dessus de la voie ferrée':rl.p.position_par_rapport_au_sol==='1'?'passage sous un pont ferroviaire':pn?'passage à niveau':rl.p.nature==='Voie de service'?'croisement de niveau d’une voie de service ferroviaire (embranchement industriel)':'croisement de niveau non documenté';
 if(!railCross.some(c=>c.road===r.id&&Math.hypot(c.L93[0]-x[0],c.L93[1]-x[1])<3))railCross.push({road:r.id,name:r.name,category:r.category,rail:rl.id,railNature:rl.p.nature,L93:x.map(r2),type,levelCrossing:pn?.name||null});}
for(const c of railCross){const r=byId.get(c.road);r.railCrossings=(r.railCrossings||[]).concat(c.type);}
const pnFound=pnPoints.map(q=>({id:q.id,name:q.name,L93:q.p.map(r2),road:railCross.find(c=>c.levelCrossing===q.name)?.name??null,matched:railCross.some(c=>c.levelCrossing===q.name)}));

// ---------- Altitude: spline points on the terrain; bridge decks interpolated between abutments ----------
const STEP=5;
function profileAnomalies(l){// Terrain along the axis every metre: departures > 1.2 m from the chord over ±10 m flag a hidden structure or a cut.
 const d=densify(l,1),z=d.map(p=>terrainZ(...p)),out=[];let cur=null;
 for(let i=10;i<d.length-10;i++){const base=(z[i-10]+z[i+10])/2,dev=z[i]-base;if(Math.abs(dev)>1.2&&dev===dev){if(!cur||i-cur.end>2){cur={start:i,end:i,dev,at:d[i]};out.push(cur);}else{cur.end=i;if(Math.abs(dev)>Math.abs(cur.dev)){cur.dev=dev;cur.at=d[i];}}}}
 return out.map(a=>({L93:a.at.map(r2),deviationM:r2(a.dev),lengthM:a.end-a.start+1}));}
// A bridge split into several BD TOPO troncons is one deck: chain them through shared nodes and grade between the outer ends.
const deckOf=new Map();{const ponts=active.filter(r=>r.structure==='pont'),at=new Map();for(const r of ponts)for(const k of [r.nodeA,r.nodeB]){if(!at.has(k))at.set(k,[]);at.get(k).push(r);}
 const done=new Set(),out=(p,q)=>{const L=Math.hypot(p[0]-q[0],p[1]-q[1])||1,u=[(p[0]-q[0])/L,(p[1]-q[1])/L];return Math.max(...[0,1,2,3,4].map(k=>terrainZ(p[0]+u[0]*k,p[1]+u[1]*k)).filter(Number.isFinite));};
 for(const r0 of ponts){if(done.has(r0))continue;let start=r0,k=r0.nodeA;for(let g=0;g<50;g++){const nx=(at.get(k)||[]).find(x=>x!==start);if(!nx)break;start=nx;k=nx.nodeA===k?nx.nodeB:nx.nodeA;}
  const chain=[];let cur=start,from=k;while(cur&&!done.has(cur)){done.add(cur);const rev=cur.nodeB===from;chain.push({r:cur,rev});const to=rev?cur.nodeA:cur.nodeB;from=to;cur=(at.get(to)||[]).find(x=>!done.has(x));}
  const line=chain.flatMap(({r,rev},i)=>{const l=rev?r.it.l.slice().reverse():r.it.l;return i?l.slice(1):l;}),za=out(line[0],line[1]),zb=out(line.at(-1),line.at(-2)),Ltot=len(line);let acc=0;
  for(const {r,rev} of chain){const Lr=len(r.it.l);deckOf.set(r,{z0:rev?null:za+(zb-za)*acc/Ltot,z1:za+(zb-za)*(acc+Lr)/Ltot,rev,za,zb,acc,Ltot,members:chain.map(c=>c.r.id)});acc+=Lr;}}}
const bridgeLinks=[],anomalies=[];let bdVsTerrain=[];
for(const r of active){const lc=r.it.l,all=densify(lc,STEP),runs=[];let cur=null;for(const p of all){if(inExtent(p)){if(!cur){cur=[];runs.push(cur);}cur.push(p);}else cur=null;}
 const kept=runs.filter(x=>x.length>=2);r.clipped=kept.length!==1||kept[0].length<all.length;if(!kept.length){r.points=[];continue;}const d=kept.sort((a,b)=>b.length-a.length)[0];r.extraRuns=kept.slice(1).map(x=>x.map(p=>({L93:p,z:terrainZ(...p),zTerrain:terrainZ(...p)})));
 const zt=d.map(p=>terrainZ(...p));let z=zt.slice(),zSource='terrain V1.7 (MNT LiDAR HD)';
 if(r.structure==='pont'){// Abutment height: highest terrain within 4 m outward of each end along the axis (the approach embankment),
  // so a short deck ending on a stream bank does not dive into the gap.
  const out=(p,q)=>{const L=Math.hypot(p[0]-q[0],p[1]-q[1])||1,u=[(p[0]-q[0])/L,(p[1]-q[1])/L];return Math.max(...[0,1,2,3,4].map(k=>terrainZ(p[0]+u[0]*k,p[1]+u[1]*k)).filter(Number.isFinite));};
  const dk=deckOf.get(r),L=len(d);let acc=0;const zAt=t=>{const c=dk.rev?dk.acc+(len(lc)-t):dk.acc+t;return dk.za+(dk.zb-dk.za)*c/dk.Ltot;};z=d.map((p,i)=>{if(i)acc+=Math.hypot(p[0]-d[i-1][0],p[1]-d[i-1][1]);return zAt(acc);});const za=z[0],zb=z.at(-1);zSource='tablier interpolé entre les culées (terrain le plus haut à moins de 4 m à l’extérieur de chaque extrémité)';
  const bl=nearest(bridgeQ,d[Math.floor(d.length/2)],15);const under=[...new Set(d.flatMap(p=>[nearest(railQ,p,12)?'voie ferrée':null,nearest(waterQ,p,12)?.it.name||null]).filter(Boolean))];
  r.bridge={deckMembers:dk.members,ouvrageBdtopo:bl?.it.id||null,crosses:under,deckZStart:r2(za),deckZEnd:r2(zb),maxClearanceOverTerrainM:r2(Math.max(...z.map((v,i)=>v-zt[i]))),lengthM:r1(len(lc))};bridgeLinks.push({road:r.id,name:r.name,category:r.category,...r.bridge,L93:d[Math.floor(d.length/2)].map(r2)});}
 else if(r.structure==='sol'&&r.category!=='sentier'){for(const a of profileAnomalies(lc)){const w=nearest(waterQ,a.L93,15),rl=nearest(railQ,a.L93,15),rv=REV.anomalies[`${r.id}@${Math.round(a.L93[0])},${Math.round(a.L93[1])}`];
  anomalies.push({road:r.id,name:r.name,category:r.category,...a,near:w?'cours d’eau / fossé : '+w.it.name:rl?'voie ferrée':null,kind:a.deviationM<0?(w?'creux : ouvrage hydraulique probable (buse, ponceau)':rl?'creux : passage sous la voie ferrée':'creux à vérifier'):(rl?'bosse : franchissement de la voie ferrée':'bosse / remblai à vérifier'),review:rv||null});}}
 if(r.it.src==='bdtopo'&&r.structure==='sol'){const zb=r.it.zBd;for(let i=0;i<lc.length;i++)if(zb[i]!=null&&zb[i]>-100&&inExtent(lc[i]))bdVsTerrain.push(zb[i]-terrainZ(...lc[i]));}
 // Hidden structures confirmed on the orthophoto (culverts, bridge longer than its BD TOPO troncon): the axis does not dive into
 // the watercourse; Z is the chord between the terrain 12 m before and after the structure. These points are listed as zOverride.
 const hidden=anomalies.filter(a=>a.road===r.id&&a.review?.structure);r.zOverride=[];
 for(const a of hidden){const idx=d.map((p,i)=>[Math.hypot(p[0]-a.L93[0],p[1]-a.L93[1]),i]).filter(([dd])=>dd<=12).map(([,i])=>i);if(!idx.length)continue;const i0=Math.max(0,idx[0]-1),i1=Math.min(d.length-1,idx.at(-1)+1);
  for(let i=i0+1;i<i1;i++){z[i]=z[i0]+(z[i1]-z[i0])*(i-i0)/(i1-i0);r.zOverride.push(i);}r.hiddenStructures=(r.hiddenStructures||[]).concat({L93:a.L93,observation:a.review.observation});}
 if(r.zOverride.length)zSource+=' ; ouvrage non répertorié : corde entre les appuis (zOverride)';
 r.points=d.map((p,i)=>({L93:p,z:z[i],zTerrain:zt[i],override:r.zOverride.includes(i)}));r.zSource=zSource;}
for(const a of anomalies)if(a.review)a.kind=a.review.kind;
const bdStats=(()=>{const a=bdVsTerrain.filter(Number.isFinite),m=a.reduce((s,v)=>s+v,0)/a.length;return {vertices:a.length,meanM:r2(m),rmseM:r2(Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length))};})();

// ---------- Sidewalks: no reliable source; only flag where they may exist ----------
for(const r of roads)r.sidewalk=['sentier','chemin_rural','chemin_carrossable','voie_pietonne'].includes(r.category)?{status:'sans objet (chemin, sentier ou voie piétonne)'}:r.urban?{status:'à déterminer',note:'voie urbaine : présence de trottoirs à établir (orthophoto ou relevé)'}:{status:'non documenté',note:'voie hors agglomération ; trottoir peu probable, non vérifié'};

// ---------- Splines ("voies"): troncons chained through degree-2 nodes with identical attributes ----------
const sig=r=>[r.name||'',r.category,r.structure,r.width,r.surface,r.serviceType||'',r.oneway==='no'?'no':'x'].join('|');
const used=new Set(),splines=[];
for(const r of active.filter(r=>r.points.length>=2)){if(used.has(r))continue;let chain=[{r,rev:false}];used.add(r);
 const extend=(atEnd)=>{for(;;){const last=atEnd?chain.at(-1):chain[0],k=atEnd?(last.rev?last.r.nodeA:last.r.nodeB):(last.rev?last.r.nodeB:last.r.nodeA),n=nodes.get(k);if(n.ends.length+n.inner.length!==2)return;
  if(n.inner.length)return;const nx=n.ends.find(e=>e.road!==last.r);if(!nx||used.has(nx.road)||sig(nx.road)!==sig(last.r)||nx.road.points.length<2||nx.road.clipped||last.r.clipped)return;const rev=atEnd?nx.end==='B':nx.end==='A';used.add(nx.road);atEnd?chain.push({r:nx.road,rev}):chain.unshift({r:nx.road,rev});}};
 if(r.oneway==='no'||!r.oneway){extend(true);extend(false);}
 const points=[];for(const {r:x,rev} of chain){const p=rev?x.points.slice().reverse():x.points;for(const q of (points.length?p.slice(1):p))points.push(q);}
 const head=chain[0].r;const extra=chain.length===1?(head.extraRuns||[]):[];
 for(const [k,run] of [[0,points],...extra.map((x,i)=>[i+2,x])])splines.push({id:'spline:'+head.id+(k?'~'+k:''),troncons:chain.map(c=>c.r.id),name:head.name,nameBible:head.nameBible,routeNumber:head.routeNumber,category:head.category,categoryLabel:head.categoryLabel,unrealType:head.unrealType,paved:head.paved,surface:head.surface,
  serviceType:head.serviceType,width:head.width,widthSource:head.widthSource,oneway:chain.length===1?head.oneway:head.oneway,structure:head.structure,provenance:[...new Set(chain.map(c=>c.r.provenance))].join(','),hierarchy:head.hierarchy,inCommune:chain.some(c=>c.r.inCommune),sector:head.sector,
  lengthM:r1(chain.reduce((s,c)=>s+c.r.lengthM,0)),zSource:head.zSource,bridge:head.bridge||null,
  hiddenStructures:chain.flatMap(c=>c.r.hiddenStructures||[]),zOverride:run.map((q,i)=>q.override?i:-1).filter(i=>i>=0),
  points:run.map(q=>toUnreal([q.L93[0],q.L93[1],q.z]).map(v=>Math.round(v))),pointsL93:run.map(q=>[r2(q.L93[0]),r2(q.L93[1]),r2(q.z)]),clippedByExtent:head.clipped||false});}

// ---------- BIBLE_01: every odonym of sections 4, 5, 6, 7 looked up in the geographic names ----------
const B=fs.readFileSync('docs/bibles/BIBLE_01_CARTOGRAPHIE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_01_CARTOGRAPHIE_FINAL_V1.1.md','utf8').split('\n');
const section=(a,b)=>{const i=B.findIndex(l=>l.startsWith(a)),j=B.findIndex((l,k)=>k>i&&l.startsWith(b));return B.slice(i,j);};
const clean=l=>l.replace(/^- /,'').replace(/\*\*/g,'').split(/ — | ; |;$/)[0].trim();
const bibleNames=[...section('## 4.1','## 4.2').filter(l=>l.startsWith('- ')).map(l=>({name:clean(l),section:'4.1'})),...section('# 5.','## 5.1').filter(l=>l.startsWith('- ')).map(l=>({name:clean(l),section:'5'})),...section('# 6.','# 7.').filter(l=>l.startsWith('- ')).map(l=>({name:clean(l),section:'6'})),
 ...['Chemin du Pot Bancelin','Chemin à Leroy','Chemin Noir','Voie de la Garenne'].map(n=>({name:n,section:'5.1 / 7.11 / 7.12'}))];
const geoNames=new Map();const addName=(n,src)=>{if(!n)return;const k=norm(n);if(!geoNames.has(k))geoNames.set(k,new Set());geoNames.get(k).add(src);};
for(const r of roads){for(const n of r.nameBan)addName(n,'BAN');for(const n of r.nameCollaboratif)addName(n,'BD TOPO collaboratif');addName(r.nameOsm,'OSM voie');}
for(const f of read('data-sources/roads/bdtopo-voie-nommee.geojson').features)addName(f.properties.nom_minuscule||f.properties.nom_initial_troncon||f.properties.nom,'BD TOPO voie_nommee');
for(const f of osmAll.features)if(f.properties.name&&!f.properties.highway)addName(f.properties.name,'OSM lieu');
for(const k of [...geoNames.keys()]){const alt=k.replace(/^r /,'rue ').replace(/^(le|la|les) (?=(chemin|rue|voie|route|ruelle) )/,'');if(alt!==k){if(!geoNames.has(alt))geoNames.set(alt,new Set());for(const s of geoNames.get(k))geoNames.get(alt).add(s+' (forme « '+k+' »)');}}
const variants=n=>{const k=norm(n).replace(/^r /,'rue '),out=[k,k.replace(/^(le|la|les) /,'')];for(const alt of n.split(/ \/ /))out.push(norm(alt));out.push(k.replace(/^place \/ placette /,'place '),k.replace(/^place \/ placette /,'placette '));return [...new Set(out)];};
const bibleCheck=bibleNames.map(b=>{const hit=variants(b.name).map(v=>[v,geoNames.get(v)]).find(([,s])=>s);const core=v=>v.replace(/^(rue|chemin|place|placette|ruelle|avenue|impasse|boulevard|voie|route) (du |de la |des |de l |de |d |a )?/,'');const partial=hit?null:[...geoNames.keys()].find(k=>variants(b.name).some(v=>core(v).length>3&&new RegExp('(^| )'+core(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'( |$)').test(k)));
 return {name:b.name,section:b.section,found:!!hit,sources:hit?[...hit[1]]:[],closest:hit?null:partial||null};});

// ---------- Outputs ----------
const L=v=>v.map(p=>[r2(p[0]),r2(p[1])]);
const features=roads.map(r=>({type:'Feature',id:r.id,geometry:r.geometry,properties:{id:r.id,provenance:r.provenance,category:r.category,categoryLabel:r.categoryLabel,hierarchy:r.hierarchy,name:r.name,nameSource:r.nameSource,nameBan:r.nameBan,nameCollaboratif:r.nameCollaboratif,nameOsm:r.nameOsm,nameBible:r.nameBible,routeNumber:r.routeNumber,
 surface:r.surface,surfaceSource:r.surfaceSource,paved:r.paved,unrealType:r.unrealType,serviceType:r.serviceType,width:r.width,widthSource:r.widthSource,widthOfficial:r.widthOfficial,widthOsm:r.widthOsm,widthInferred:r.widthInferred,lanes:r.lanes,oneway:r.oneway,onewayReference:'sens de numérisation de la géométrie',
 structure:r.structure,bridge:r.bridge||null,hiddenStructures:r.hiddenStructures||[],railCrossings:r.railCrossings||[],osmBridgeDisagree:r.osmBridgeDisagree||false,vehicleAccess:r.vehicleAccess,private:r.private,urban:r.urban,state:r.state,excluded:r.excluded||null,sidewalk:r.sidewalk,
 lengthM:r.lengthM,inCommune:r.inCommune,sector:r.sector,component:r.component||null,nodeA:r.nodeA?nodeByKey.get(r.nodeA)?.id:null,nodeB:r.nodeB?nodeByKey.get(r.nodeB)?.id:null,osmIds:r.osmIds,osmCoverage:r.osmCoverage,bdCoverage:r.bdCoverage,precisionPlanimetric:r.precisionPlanimetric,sourceDates:r.sourceDates,clipped:r.clipped||false}}));
fs.writeFileSync('public/data/roads.geojson',JSON.stringify({type:'FeatureCollection',metadata:{name:'Référentiel voirie de Maizières-la-Grande-Paroisse',version:'1.8',generatedBy:'scripts/build-roads.mjs',
 sources:{bdtopo:{file:'data-sources/roads/bdtopo-troncon-de-route.geojson',sha256:sha(fs.readFileSync('data-sources/roads/bdtopo-troncon-de-route.geojson')),retrievedAt:bd.metadata.retrievedAt},osm:{file:'public/data/maizieres.geojson',sha256:sha(fs.readFileSync('public/data/maizieres.geojson')),snapshot:osmAll.metadata.osmTimestamp||null},terrain:'unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif',bible:'docs/bibles/BIBLE_01_CARTOGRAPHIE'},
 extent:{crs:'EPSG:2154',west:G.west,south:G.south,east:G.east,north:G.north,note:'emprise du terrain V1.7'},categories:CAT,inferredWidths:INFERRED,widthSources:{measured:'mesurée sur le terrain (aucune pour l’instant)',official:'BD TOPO largeur_de_chaussee',osm:'tag OSM width',inferred:'estimation déterministe par catégorie (INFERRED), jamais une mesure'}},features})+'\n');
const cats=Object.keys(CAT),km=f=>r2(f.reduce((s,r)=>s+r.lengthM,0)/1000),A=active;
const nodeTypes=nodeList.reduce((m,n)=>(m[n.type]=(m[n.type]||0)+1,m),{});
const unrealDoc={metadata:{version:'1.8',generatedBy:'scripts/build-roads.mjs',unrealOrigin:O,units:'centimètres Unreal ; X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude NGF-IGN69 × 100',
  pointSpacingMaxM:STEP,pointsNote:'points = sommets d’origine + densification tous les 5 m au plus, Z = terrain V1.7 (ou tablier interpolé pour les ponts) ; pointsL93 = mêmes points en Lambert-93 et altitude (m)',
  widthNote:'width en mètres ; widthSource = official | osm | inferred (inferred = estimation par catégorie, pas une mesure)',unrealTypes:{paved:'route revêtue','paved-pedestrian':'voie piétonne revêtue','gravel-track':'chemin empierré : ne pas goudronner','dirt-track':'chemin de terre : ne pas goudronner',footpath:'sentier : pas de chaussée'},
  splineCount:splines.length},splines,
 nodes:nodeList.filter(n=>n.type!=='continuité').map(n=>({id:n.id,type:n.type,degree:n.degree,roundabout:n.roundabout,levelCrossing:n.levelCrossing,names:n.names,roads:n.roads.map(r=>r.id),unrealCm:toUnreal([n.L93[0],n.L93[1],n.z]).map(Math.round),L93:n.L93,z:n.z,inCommune:n.inCommune,sector:n.sector})),
 structures:{hiddenStructures:active.flatMap(r=>(r.hiddenStructures||[]).map(h=>({road:r.id,name:r.name,category:r.category,...h,unrealCm:toUnreal([h.L93[0],h.L93[1],terrainZ(...h.L93)]).map(Math.round)}))),bridges:bridgeLinks.map(b=>({...b,unrealCm:toUnreal([b.L93[0],b.L93[1],(b.deckZStart+b.deckZEnd)/2]).map(Math.round)})),railCrossings:railCross,levelCrossings:pnFound}};
fs.mkdirSync('unreal/roads',{recursive:true});fs.writeFileSync('unreal/roads/road-splines.json',JSON.stringify(unrealDoc)+'\n');
const named=A.filter(r=>r.name),report={generatedAt:new Date().toISOString(),frozen:{buildingsSha256:sha(fs.readFileSync('public/data/buildings.geojson')),terrainGeoTiffSha256:sha(tb),unrealOrigin:O},
 totals:{troncons:A.length,splines:splines.length,lengthKm:km(A),inCommuneKm:km(A.filter(r=>r.inCommune)),excludedAfterReview:roads.filter(r=>r.excluded).length,inProject:roads.filter(r=>r.state!=='En service').length,
  byProvenance:A.reduce((m,r)=>(m[r.provenance]=(m[r.provenance]||0)+1,m),{}),kmByCategory:Object.fromEntries(cats.map(c=>[c,km(A.filter(r=>r.category===c))])),countByCategory:Object.fromEntries(cats.map(c=>[c,A.filter(r=>r.category===c).length])),
  kmBySector:[...new Set(A.map(r=>r.sector))].reduce((m,s)=>(m[s]=km(A.filter(r=>r.sector===s)),m),{}),
  named:{troncons:named.length,km:km(named),distinctNames:new Set(named.map(r=>norm(r.name))).size},unnamed:{troncons:A.length-named.length,km:km(A.filter(r=>!r.name))},
  width:{official:A.filter(r=>r.widthSource==='official').length,osm:A.filter(r=>r.widthSource==='osm').length,inferred:A.filter(r=>r.widthSource==='inferred').length,officialKm:km(A.filter(r=>r.widthSource==='official')),inferredKm:km(A.filter(r=>r.widthSource==='inferred')),measured:0,
   officialShareOfVehicleKm:r2(km(A.filter(r=>r.widthSource==='official'&&vehicle(r)))/km(A.filter(vehicle)))},
  surfaces:{pavedKm:km(A.filter(r=>r.paved)),notToPaveKm:km(A.filter(r=>['gravel-track','dirt-track','footpath'].includes(r.unrealType)))},
  chemins:{count:A.filter(r=>['chemin_carrossable','chemin_rural'].includes(r.category)).length,km:km(A.filter(r=>['chemin_carrossable','chemin_rural'].includes(r.category)))},sentiers:{count:A.filter(r=>r.category==='sentier').length,km:km(A.filter(r=>r.category==='sentier'))}},
 topology:{nodes:nodeList.length,nodeTypes,intersections:(nodeTypes.carrefour||0)+(nodeTypes.embranchement||0),impasses:nodeTypes.impasse||0,roundaboutNodes:nodeList.filter(n=>n.roundabout&&n.degree>=3).length,osmSnaps:snaps.length,components:comps.size,cutByExtentBorder:cutByBorder,
  orphans:{count:orphans.length,km:r2(orphans.reduce((s,o)=>s+o.lengthM,0)/1000),list:orphans},nearMisses:nearMiss,duplicates,crossingsWithoutNode:crossings.filter(c=>!c.kind.startsWith('dénivelée')&&!c.resolved),crossingNodesAdded:addedCrossNodes,gradeSeparatedCrossings:crossings.filter(c=>c.kind.startsWith('dénivelée')).length},
 structures:{bridges:bridgeLinks,bridgesCount:bridgeLinks.length,osmBridgeDisagreements:A.filter(r=>r.osmBridgeDisagree).map(r=>({id:r.id,name:r.name,bdtopo:r.structure,osmBridgeTag:!!(r.it.osm?.p.bridge&&r.it.osm.p.bridge!=='no'),osmWay:r.it.osm?.id||null})),railCrossings:railCross,levelCrossings:pnFound,
  profileAnomalies:anomalies,hiddenStructures:active.filter(r=>r.hiddenStructures).map(r=>({road:r.id,name:r.name,category:r.category,sites:r.hiddenStructures})),profileAnomaliesByKind:anomalies.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{})},
 altitude:{source:'terrain V1.7 (MNT LiDAR HD 1 m)',bdtopoZMinusTerrain:bdStats},
 osm:{ways:osmWays.length,transferredToBdtopo:bdItems.filter(i=>i.osm).length,complements:complements.length,partiallyOverlapping:partialOsm},
 sidewalks:{source:'aucune donnée fiable (OSM : aucun trottoir cartographié, seulement 14 passages piétons)',toDetermineKm:km(A.filter(r=>r.sidewalk.status==='à déterminer')),toDetermineBySector:[...new Set(A.map(r=>r.sector))].reduce((m,s)=>(m[s]=km(A.filter(r=>r.sector===s&&r.sidewalk.status==='à déterminer')),m),{})},
 openIssues:null,
 bible:{checked:bibleCheck.length,found:bibleCheck.filter(b=>b.found).length,missing:bibleCheck.filter(b=>!b.found),all:bibleCheck}};
// Open inconsistencies after the orthophoto review: what a later pass (or a field survey) must still settle.
report.openIssues={orphans:orphans.map(o=>({...o,review:REV.orphans?.[o.roads[0]]||null})),crossingsWithoutNode:report.topology.crossingsWithoutNode,nearMisses:nearMiss,duplicates,
 anomaliesToCheck:anomalies.filter(a=>!a.review||a.review.open),osmComplementsUnverifiable:Object.entries(REV.osmComplements).filter(([,v])=>v.verdict==='non vérifiable'||v.verdict==='douteux').map(([id,v])=>({id,...v})),
 osmBridgeDisagreements:report.structures.osmBridgeDisagreements,levelCrossingsUnmatched:pnFound.filter(p=>!p.matched),notes:REV.notes||[]};
report.openIssues.count=report.openIssues.orphans.length+report.openIssues.crossingsWithoutNode.length+nearMiss.length+duplicates.length+report.openIssues.anomaliesToCheck.length+report.openIssues.osmComplementsUnverifiable.length+report.openIssues.levelCrossingsUnmatched.length;
report.totals.osmComplementsReview=Object.values(REV.osmComplements).reduce((m,v)=>(m[v.verdict]=(m[v.verdict]||0)+1,m),{});
fs.writeFileSync('data-sources/roads/roads-report.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({openIssues:{count:report.openIssues.count,orphans:report.openIssues.orphans.length,crossings:report.openIssues.crossingsWithoutNode.length,anomalies:report.openIssues.anomaliesToCheck.length,unverifiable:report.openIssues.osmComplementsUnverifiable.length},totals:report.totals,topology:{...report.topology,orphans:{count:orphans.length,km:report.topology.orphans.km},nearMisses:nearMiss.length,duplicates:duplicates.length,crossingsWithoutNode:report.topology.crossingsWithoutNode.length},
 structures:{bridges:bridgeLinks.length,railCrossings:railCross.reduce((m,c)=>(m[c.type]=(m[c.type]||0)+1,m),{}),levelCrossings:pnFound,anomalies:report.structures.profileAnomaliesByKind,osmBridgeDisagree:report.structures.osmBridgeDisagreements.length},altitude:report.altitude,osm:{...report.osm,partiallyOverlapping:partialOsm.length},bibleMissing:report.bible.missing.map(b=>b.name+(b.closest?' (≈ '+b.closest+')':''))},null,1));
