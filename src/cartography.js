import {polygons,lines,bounds,area,insidePoly,roadWidth} from './geo.js';
import {clipLine,clipRing} from './geometry.js';

// This catalogue is derived in memory. No geographic source is rewritten.
export function createCatalogue(data,enrichment,project,extent,buildingItems,namedZones={features:[]},bible={streets:{},places:{},named:{},landmarks:[]}){
 const records=[],byId=new Map(),roadGroups=new Map();
 const within=p=>p[0]>=extent.minX&&p[0]<=extent.maxX&&p[1]>=extent.minZ&&p[1]<=extent.maxZ;
 const center=poly=>{const b=bounds(poly[0]);return [(b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2];};
 const add=r=>{records.push(r);byId.set(r.id,r);return r;};
 let unnamedRoads=0;
 for(const f of data.features){const t=f.properties,name=t.name?.trim();
  if(t.highway||t.railway==='rail'){
   const paths=lines(f,project).flatMap(l=>clipLine(l,extent));if(!paths.length)continue;
   if(!name&&!t.ref){if(t.highway)unnamedRoads++;continue;}
   const title=name||t.ref,key=(t.highway?'road:':'rail:')+title;
   let r=roadGroups.get(key);if(!r){r=add({id:key,name:title,kind:t.highway?'Rue / voie':'Voie ferrée',type:'line',lines:[],width:roadWidth(t),source:'OpenStreetMap',sourceIds:[],refs:[]});roadGroups.set(key,r);}if(name&&t.ref&&!r.refs.includes(t.ref))r.refs.push(t.ref);r.width=Math.max(r.width,roadWidth(t));
   r.lines.push(...paths);r.sourceIds.push(f.id);byId.set(f.id,r);continue;
  }
  if(t.building)continue;
  if(f.geometry.type==='Point'&&name){const p=project(f.geometry.coordinates);if(within(p))add({id:f.id,name,kind:t.place?'Lieu-dit / secteur':'Lieu / équipement',type:'point',position:[p[0],8,p[1]],major:['village','hamlet'].includes(t.place),source:'OpenStreetMap'});}
  else if(name){const polys=polygons(f,project).map(p=>p.map(r=>clipRing(r,extent))).filter(p=>p[0]?.length>=3);if(polys.length)add({id:f.id,name,kind:'Zone / lieu',type:'zone',polys,position:center(polys[0]),source:'OpenStreetMap'});}
 }
 for(const f of namedZones.features){const polys=polygons(f,project).map(p=>p.map(r=>clipRing(r,extent))).filter(p=>p[0]?.length>=3);if(polys.length)add({id:f.id,name:f.properties.name,kind:f.properties.nature||'Zone / lieu',type:'zone',polys,position:center(polys[0]),source:'IGN BD TOPO'});}
 for(const {id,poly,t} of buildingItems){if(area(poly[0])<3)continue;const e=enrichment.buildings[id]||{};
  const name=t.name||e.landmark?.name||({townhall:'Mairie',school:'École primaire',community_centre:'Salle communale'}[t.amenity]);
  if(name)add({id,name,type:'building',kind:'Bâtiment / équipement',polys:[poly],position:center(poly),source:t.name?'OpenStreetMap':e.landmark?'IGN BD TOPO':'Type d’équipement OpenStreetMap'});
 }
 // Named OSM points located in an existing building also make that building clickable.
 for(const r of records.filter(r=>r.type==='point'&&!r.kind.startsWith('Lieu-dit'))){const matches=buildingItems.filter(b=>insidePoly([r.position[0],r.position[2]],b.poly));if(matches.length===1&&!byId.has(matches[0].id)){const b=matches[0];add({id:b.id,name:r.name,type:'building',kind:'Bâtiment / équipement',polys:[b.poly],position:center(b.poly),source:r.source});}}
 for(const l of enrichment.landmarks){if(byId.has(l.id))continue;const p=[l.position[0],l.position[2]];if(!within(p))continue;
  const existing=records.find(r=>r.name===l.name&&r.position&&Math.hypot(r.position[0]-p[0],r.position[2]-p[1])<45);
  if(existing){byId.set(l.id,existing);continue;}
  add({id:l.id,name:l.name,kind:l.kind||'Lieu / équipement',type:'point',position:l.position,source:'IGN BD TOPO',locationOnly:true});
 }
 for(const r of records.filter(r=>r.type==='line')){const path=r.lines.reduce((a,b)=>a.length>b.length?a:b);const p=path[Math.floor(path.length/2)];r.position=[p[0],1,p[1]];}
 // BIBLE 01 junction landmarks: kept only when the two named OSM ways meet at a single point.
 let skippedLandmarks=0;
 for(const l of bible.landmarks||[]){const ways=l.junction.map(n=>data.features.filter(f=>f.properties.highway&&f.properties.name===n).flatMap(f=>lines(f,project)));const points=[];
  for(const a of ways[0])for(const b of ways[1])for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){const p=segmentIntersection(a[i-1],a[i],b[j-1],b[j]);if(p&&!points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<5))points.push(p);}
  if(points.length!==1||!within(points[0])){skippedLandmarks++;continue;}
  add({id:l.id,name:l.name,kind:l.kind,type:'point',position:[points[0][0],8,points[0][1]],source:'Bible 01 · position calculée sur les tracés OSM',bible:{notes:[l.location,...l.notes],method:l.method},major:false});
 }
 // Documentary context from the Bibles (exact quotes), attached without renaming anything.
 for(const r of records){if(r.bible)continue;const b=r.type==='line'?bible.streets?.[r.name]:bible.places?.[r.name]||bible.named?.[r.name];if(b)r.bible=b;}
 return {records,byId,stats:{bibleAnnotated:records.filter(r=>r.bible).length,bibleLandmarks:records.filter(r=>r.id.startsWith('bible')).length,skippedBibleLandmarks:skippedLandmarks,namedRoads:records.filter(r=>r.id.startsWith('road:')).length,namedRoadSegments:records.filter(r=>r.id.startsWith('road:')).reduce((n,r)=>n+r.sourceIds.length,0),unnamedRoadSegments:unnamedRoads,buildings:records.filter(r=>r.type==='building').length,zones:records.filter(r=>r.type==='zone').length,points:records.filter(r=>r.type==='point').length}};
}
export function segmentIntersection(p,q,r,s){const d1=[q[0]-p[0],q[1]-p[1]],d2=[s[0]-r[0],s[1]-r[1]],den=d1[0]*d2[1]-d1[1]*d2[0];if(Math.abs(den)<1e-9)return null;const t=((r[0]-p[0])*d2[1]-(r[1]-p[1])*d2[0])/den,u=((r[0]-p[0])*d1[1]-(r[1]-p[1])*d1[0])/den;return t>=-1e-6&&t<=1+1e-6&&u>=-1e-6&&u<=1+1e-6?[p[0]+t*d1[0],p[1]+t*d1[1]]:null;}
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export function featureAtFace(ranges,index){let lo=0,hi=ranges.length-1;while(lo<=hi){const m=(lo+hi)>>1,r=ranges[m];if(index<r.start)hi=m-1;else if(index>=r.end)lo=m+1;else return r.id;}return null;}
