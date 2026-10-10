// V2.9.1 — semantic errata for landmark POIs. The frozen POI layer (public/data/poi.json) keeps its V1.11 values; the
// audit reference (src/content/landmark-audit-v291.json) lists the associations proved wrong and their correction. They are
// applied here, in memory, once the layer is loaded: building association, label/selection anchor, position source.
// No footprint, no coordinate of a building, no other record is touched. A correction is applied only when the frozen
// record still holds the documented "from" value: if the frozen data is ever fixed upstream the errata becomes a no-op,
// and if it holds something else the record is left alone and reported (scripts/check-landmark-positioning.mjs fails).
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function applyLandmarkErrata(pois,audit){
 const byId=new Map(pois.map(p=>[p.id,p])),report={applied:[],alreadyFixed:[],mismatch:[]};
 for(const l of audit?.landmarks||[]){const c=l.correction;if(!c||!l.poiId)continue;const p=byId.get(l.poiId);if(!p){report.mismatch.push(l.poiId);continue;}
  if(same(p.building_ids,c.building_ids.to)&&same(p.lonlat,c.lonlat.to)){report.alreadyFixed.push(l.poiId);continue;}
  if(!same(p.building_ids,c.building_ids.from)||!same(p.lonlat,c.lonlat.from)){report.mismatch.push(l.poiId);continue;}
  p.building_ids=[...c.building_ids.to];p.lonlat=[...c.lonlat.to];p.positionSource=c.positionSource.to;p.errata='V2.9.1';report.applied.push(l.poiId);}
 return report;
}
