// V2.9.2 — the canonical place layer. The frozen POI layer (public/data/poi.json, V1.11) is the input; the certified
// register (docs/freeze/MLGU_PLACES_CANONICAL_V1.json, semantic freeze V1) decides. The map reads the register's runtime
// projection (src/content/places-runtime-v292.json): for each corrected record, its certified building ids and anchor,
// and whether it is hidden from the normal mode (pending review, or a lieu-dit of a neighbouring commune). This replaces
// the V2.9.1 landmark errata: one source, generated, hash-locked by check:semantic-freeze.
export function applyPlaceCorrections(pois,runtime){
 const report={corrected:0,hidden:0,missing:[]};const byId=new Map(pois.map(p=>[p.id,p]));
 for(const [id,o] of Object.entries(runtime?.places||{})){const p=byId.get(id);if(!p){report.missing.push(id);continue;}
  if(o.building_ids){p.building_ids=[...o.building_ids];report.corrected++;}
  if(o.lonlat)p.lonlat=[...o.lonlat];
  if(o.address)p.address=o.address;
  if(o.hidden){p.hidden=o.hidden;report.hidden++;}
  p.canonical='V2.9.2';}
 return report;
}
export const isHidden=p=>!!p.hidden;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`\-]/g,' ').replace(/\s+/g,' ').trim();

// V2.9.2: the certified registers govern every named record of the map.
// Streets: one record per canonical road of docs/freeze/MLGU_ROADS_CANONICAL_V1.json (BAN odonym, else documented OSM name,
// else route number), drawn on the very tronçons the scene renders; the OSM ways only keep their label bindings. Rail: the
// crossover numbered « 1000 » joins its line, the sidings numbered 1–4 become unnamed service tracks.
// Named records built at load time from OSM / BD TOPO / Bible (src/cartography.js), in the normal view: an alias of a
// certified place disappears (a zone stays clickable and opens that place), a record outside the commune or not displayed
// by the register disappears, a building named after a place it does not house loses that name.
export function applyRegisters(catalogue,v2,technical,{places:PLACES_RUNTIME,roads:ROADS_RUNTIME}){
 const {records,byId}=catalogue,heightAt=v2.heightAt,removed=new Set();
 const drop=r=>{removed.add(r);const i=records.indexOf(r);if(i>=0)records.splice(i,1);};
 const oldLines=records.filter(r=>r.type==='line'&&r.id.startsWith('road:'));
 const bibleByName=new Map(oldLines.filter(r=>r.bible).map(r=>[norm(r.name),r.bible]));
 for(const r of oldLines)drop(r);
 const splines=new Map(v2.data.roads.map(r=>[r.id.replace(/^spline:/,'').replace(/^TRONROUT0+/,'T'),r])),roadById=new Map();
 for(const road of ROADS_RUNTIME.roads){const lines=[];let width=3;
  for(const s of road.s){const sp=splines.get(s);if(!sp)continue;const l=[];for(let i=0;i<sp.p.length;i+=3)l.push([sp.p[i],sp.p[i+1]]);lines.push(l);width=Math.max(width,sp.w||3);}
  if(!lines.length)continue;const path=lines.reduce((a,b)=>a.length>b.length?a:b),m=path[Math.floor(path.length/2)];
  const rec={id:road.id,name:road.name,kind:'Rue / voie',type:'line',lines,width,refs:road.ref,commune:road.commune,searchable:road.searchable,aliases:road.aliases,canonical:true,
   source:technical?`Registre des voies V2.9.2 : ${road.s.length} tronçon(s) BD TOPO`:'',position:[m[0],heightAt(m[0],m[1])+1,m[1]]};
  const b=bibleByName.get(norm(road.name))||road.aliases.map(a=>bibleByName.get(norm(a))).find(Boolean);if(b)rec.bible=b;
  records.push(rec);byId.set(rec.id,rec);roadById.set(rec.id,rec);}
 for(const [w,id] of Object.entries(ROADS_RUNTIME.osmWays))if(roadById.has(id))byId.set(w,roadById.get(id));
 // A square that is also a certified place (Place Saint-Denis) is searched once: through the place's card.
 const placeNames=new Set(records.filter(r=>r.poi).map(r=>norm(r.name)));for(const r of roadById.values())if(placeNames.has(norm(r.name)))r.searchable=false;
 for(const [id,g] of Object.entries(ROADS_RUNTIME.rail)){const r=byId.get(id);if(!r)continue;
  if(g.merge){const line=byId.get(g.merge);if(line){line.lines.push(...r.lines);for(const w of r.sourceIds)byId.set(w,line);drop(r);byId.set(id,line);}}
  else if(g.service){r.name='Voie ferrée de service';r.searchable=false;r.refs=[];r.service=true;}
  else{r.name=g.name;r.refs=[];r.railLine='1000';}}
 let alias=0,hidden=0,unnamed=0;
 if(!technical)for(const r of [...records]){const g=PLACES_RUNTIME.catalogue?.[r.id];if(!g||r.poi||r.type==='line')continue;
  if(g.a==='alias'){alias++;const target=byId.get(g.poi);if(r.type==='zone'&&target?.poi){r.alias=target;r.searchable=false;continue;}}
  else if(g.a==='unname')unnamed++;else hidden++;
  drop(r);}
 for(const [k,v] of byId)if(removed.has(v))byId.delete(k);
 return {roads:roadById.size,governed:{alias,hidden,unnamed}};
}
