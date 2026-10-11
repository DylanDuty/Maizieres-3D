// V2.9.2 — semantic screening of every place (POI) of the commune. It never decides the truth: it measures, for each
// record, what an auditor needs to look at — position type of the address, how the building was linked, distance from
// the anchor to the linked footprints, buildings claimed by several places, public facilities on tiny annexes, RNB
// addresses that disagree, anchors across a road from their building, displayed records outside the commune or
// historical. The canonical registry (scripts/build-places-canonical.mjs) combines these measures with the audited
// decisions. Read-only on every frozen file.
import fs from 'node:fs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
export function loadSources(){
 const web=read('public/data/poi.json'),full=read('unreal/poi/poi.json').pois;
 const feats=[...read('public/data/buildings.geojson').features,...read('public/data/buildings-additions-v2.0.1.geojson').features,...read('public/data/buildings-manual-v2.2.geojson').features];
 const fp=new Map(feats.map(f=>[f.properties.id||f.id,f]));
 const rnb=new Map();for(const b of read('data-sources/rnb/rnb-10220.json').buildings)for(const e of b.ext_ids||[])if(e.source==='bdtopo')rnb.set(e.id,b);
 const ban=new Map(read('data-sources/poi/ban-adresses.geojson').features.map(f=>[f.properties.id,f.properties]));
 const osm=read('public/data/maizieres.geojson').features.filter(f=>f.properties.name&&(f.properties.amenity||f.properties.shop||f.properties.office||f.properties.craft||f.properties.leisure||f.properties.tourism||f.properties.healthcare));
 const scene=read('public/data/v2-scene.json');
 return {web,full,fp,rnb,ban,osm,roads:scene.roads};
}
const M=111320*Math.cos(48.5097657*Math.PI/180),O=[3.7890245,48.5097657];
export const local=([lon,lat])=>[(lon-O[0])*M,-(lat-O[1])*110540];
export const ringsOf=g=>g.type==='Polygon'?[g.coordinates[0]]:g.coordinates.map(p=>p[0]);
const inside=([x,y],r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[i],[x2,y2]=r[j];if((y1>y)!==(y2>y)&&x<(x2-x1)*(y-y1)/(y2-y1)+x1)c=!c;}return c;};
const dist=(a,b)=>Math.hypot((a[0]-b[0])*M,(a[1]-b[1])*110540);
const segDist=(p,a,b)=>{const P=local(p),A=local(a),B=local(b),dx=B[0]-A[0],dz=B[1]-A[1],L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((P[0]-A[0])*dx+(P[1]-A[1])*dz)/L));return Math.hypot(P[0]-A[0]-t*dx,P[1]-A[1]-t*dz);};
export function footprintDistance(pt,f){let best=Infinity;for(const r of ringsOf(f.geometry)){if(inside(pt,r))return 0;for(let i=0,j=r.length-1;i<r.length;j=i++)best=Math.min(best,segDist(pt,r[j],r[i]));}return best;}
const areaM2=f=>f.properties.areaM2||0;
const cross=(a,b,c,d)=>{const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`\-]/g,' ').replace(/\b(rue|avenue|av|bd|boulevard|place|chemin|impasse|allee|route|ruelle|du|de|la|le|les|des|d|l)\b/g,' ').replace(/\s+/g,' ').trim();
export const interactive=p=>!!(p.display||p.landmark||(['secteur','lieu_dit'].includes(p.category)&&p.coh==='current'));
export function screen(S){
 const {web,full,fp,rnb,ban,osm,roads}=S,webById=new Map(web.pois.map(p=>[p.id,p]));
 const claims=new Map();for(const p of web.pois)if(interactive(p))for(const id of p.building_ids||[]){if(!claims.has(id))claims.set(id,[]);claims.get(id).push(p.id);}
 const roadSegs=roads.filter(r=>r.n).map(r=>{const pts=[];for(let i=0;i<r.p.length;i+=3)pts.push([r.p[i],r.p[i+1]]);return {n:r.n,pts};});
 const out=[];
 for(const u of full){const w=webById.get(u.id),rec={id:u.id,name:u.name,type:u.type,category:u.category,status:u.status,coh:u.current_or_historical,inCommune:u.inCommune,inWeb:!!w,interactive:!!(w&&interactive(w)),displayFlag:!!w?.display,landmark:w?.landmark||null,
   lonlat:w?.lonlat||null,positionSource:u.positionSource,geometryKind:u.geometryKind,address:u.address||null,banId:u.ban_id||null,buildingLink:u.buildingLink||null,building_ids:(w?.building_ids)||u.building_ids||[],flags:[]};
  rec.level=rec.interactive?1:rec.inCommune===false?3:2;
  const b=rec.banId&&ban.get(rec.banId);rec.banPosition=b?b.type_position:null;
  if(rec.lonlat&&rec.building_ids.length){const fs_=rec.building_ids.map(id=>fp.get(id)).filter(Boolean);rec.buildingsMissing=rec.building_ids.length-fs_.length;
   rec.anchorDistanceM=fs_.length?Math.round(Math.min(...fs_.map(f=>footprintDistance(rec.lonlat,f)))):null;rec.buildingsAreaM2=Math.round(fs_.reduce((s,f)=>s+areaM2(f),0));rec.largestM2=Math.round(Math.max(0,...fs_.map(areaM2)));
   rec.usage=[...new Set(fs_.map(f=>f.properties.ign?.usage1).filter(Boolean))];
   const addrs=fs_.flatMap(f=>(rnb.get(f.properties.id)?.addresses||[]).map(a=>`${a.street_number||''} ${a.street||''}`.trim()));rec.rnbAddresses=[...new Set(addrs)];
   if(rec.address&&rec.rnbAddresses.length){const num=(rec.address.match(/^\d+\s*\w{0,3}/)||[''])[0].replace(/\s+/g,'').toLowerCase(),st=norm(rec.address.replace(/^\d+\s*(bis|ter|a|b)?\s*/i,''));
    rec.rnbAddressMatch=rec.rnbAddresses.some(a=>{const an=(a.match(/^\d+\s*\w{0,3}/)||[''])[0].replace(/\s+/g,'').toLowerCase(),as=norm(a.replace(/^\d+\s*(bis|ter|a|b)?\s*/i,''));return as===st&&(!num||an.replace(/[a-z]+$/,'')===num.replace(/[a-z]+$/,''));});}
   // anchor across a named road from its nearest footprint
   if(rec.anchorDistanceM>0){const f=fs_[0],r=ringsOf(f.geometry)[0];let c=[0,0];for(const q of r){c[0]+=q[0];c[1]+=q[1];}c=[c[0]/r.length,c[1]/r.length];const A=local(rec.lonlat),C=local(c);
    rec.crossesRoad=roadSegs.filter(s=>s.pts.some((q,i)=>i&&cross(A,C,s.pts[i-1],q))).map(s=>s.n).filter((v,i,a)=>a.indexOf(v)===i);}
   rec.sharedWith=[...new Set(rec.building_ids.flatMap(id=>(claims.get(id)||[]).filter(x=>x!==rec.id)))];}
  // OSM named object nearby with a similar name
  if(rec.lonlat){const n=norm(rec.name);rec.osmNamed=osm.map(f=>{let c=f.geometry.coordinates;while(Array.isArray(c[0]))c=c[0];return {name:f.properties.name,id:f.properties.id,d:Math.round(dist(rec.lonlat,c)),k:norm(f.properties.name)};}).filter(o=>o.d<400&&(o.k===n||(o.k.length>4&&(n.includes(o.k)||o.k.includes(n))))).map(({name,id,d})=>({name,id,d}));}
  // flags
  const F=(k,sev,msg)=>rec.flags.push({k,sev,msg});
  if(rec.buildingLink?.startsWith('BAN PLUS')&&rec.banPosition==='segment')F('BAN_SEGMENT_BUILDING','MAJOR','bâtiment choisi par BAN PLUS depuis une position BAN « segment »');
  if(rec.anchorDistanceM>60)F('ANCHOR_FAR','MAJOR',`ancre à ${rec.anchorDistanceM} m du bâtiment associé`);
  else if(rec.anchorDistanceM>25)F('ANCHOR_FAR','MINOR',`ancre à ${rec.anchorDistanceM} m du bâtiment associé`);
  if(rec.sharedWith?.length)F('SHARED_BUILDING','MAJOR','bâtiment aussi revendiqué par '+rec.sharedWith.join(', '));
  if(rec.building_ids.length>5&&!['zone_activite','secteur','lieu_dit'].includes(rec.category))F('MANY_BUILDINGS','MAJOR',`${rec.building_ids.length} bâtiments associés`);
  if(['equipement_public','equipement_sportif','sante'].includes(rec.category)&&rec.largestM2&&rec.largestM2<60)F('SMALL_BUILDING','MINOR',`équipement sur un bâtiment de ${rec.largestM2} m²`);
  if(rec.rnbAddressMatch===false)F('RNB_ADDRESS_MISMATCH','MINOR','adresse absente du RNB des bâtiments associés : '+rec.rnbAddresses.join(' ; '));
  if(rec.crossesRoad?.length)F('ACROSS_ROAD','MAJOR','ancre de l’autre côté de '+rec.crossesRoad.join(', '));
  if(rec.interactive&&rec.coh==='historical')F('HISTORIC_DISPLAYED','MAJOR','lieu historique affiché comme actuel');
  if(rec.interactive&&rec.inCommune===false)F('OUTSIDE_DISPLAYED','MINOR','lieu hors commune interactif');
  if(rec.interactive&&!rec.lonlat)F('NO_POSITION','BLOCKER','lieu interactif sans position');
  out.push(rec);}
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){const S=loadSources(),r=screen(S);fs.writeFileSync(process.argv[2]||'/dev/stdout',JSON.stringify(r,null,1));}
