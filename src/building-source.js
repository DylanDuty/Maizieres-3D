import {polygons,bounds} from './geo.js';
import {clipRing} from './geometry.js';

// Turns the unified building reference (public/data/buildings.geojson) into render items.
// Every part of every feature becomes an item; nothing is filtered on size or attributes.
// Geometry, identifiers, provenance and attributes stay separate from the Three.js scene.
export const OSM_CHURCH='way/588791993';
export function buildingItems(fc,project,extent){
 const items=[],stats={features:fc.features.length,parts:0,outsideExtent:0,emptyAfterClip:0};
 const inside=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
 for(const f of fc.features){const p=f.properties,parts=polygons(f,project);
  parts.forEach((raw,k)=>{stats.parts++;const b=bounds(raw[0]);if(!inside([(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2])){stats.outsideExtent++;return;}
   const poly=raw.map(r=>clipRing(r,extent)).filter(r=>r.length>=3);if(!poly.length){stats.emptyAfterClip++;return;}
   // OSM tags (semantics only) keep the renderer's historical vocabulary; '@' keys are provenance helpers.
   const t={...(p.osm?.tags||{}),'@osm':p.osm?.ids||[],'@donor':p.osm?.donor||null,'@names':p.osm?.names||[]};
   const extra=p.derived?{...p.derived,ignId:p.ign.cleabs,landmark:p.landmark}:p.landmark?{landmark:p.landmark}:{};
   items.push({poly,t,id:parts.length>1?`${p.id}#${k+1}`:p.id,featureId:p.id,provenance:p.provenance,source:p.source,rnb:p.rnb,inCommune:p.inCommune,extra});
  });
 }
 return {items,stats};
}
export const isChurch=item=>item.id===OSM_CHURCH||item.t['@osm']?.includes(OSM_CHURCH);
