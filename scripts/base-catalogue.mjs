// V2.9.2 — rebuilds in Node the catalogue the map assembles at load time (src/cartography.js createCatalogue, same inputs
// as src/main.js in the normal V2 view: OSM layer, BD TOPO named zones, enrichment landmarks, Bible annotations, building
// reference with the V2.0.1 additions and the V2.2 manual layer). Used by the canonical register (governance of every named
// interactive record) and by check:search-targets. Reads frozen files only.
import fs from 'node:fs';
import {projection,polygons,bounds,insidePoly} from '../src/geo.js';
import {createCatalogue} from '../src/cartography.js';
import {buildingItems} from '../src/building-source.js';
const read=f=>JSON.parse(fs.readFileSync('public/data/'+f,'utf8'));
export function loadBaseCatalogue(){
 const data=read('maizieres.geojson'),boundary=read('commune.geojson'),enrichment=read('building-enrichment.json'),namedZones=read('named-zones.geojson'),bible=read('bible-annotations.json'),ref=read('buildings.geojson');
 ref.features.push(...read('buildings-additions-v2.0.1.geojson').features,...read('buildings-manual-v2.2.geojson').features);
 const project=projection(data.metadata.origin),boundaryPolys=polygons(boundary,project),b=bounds(boundaryPolys.flat(2));
 const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
 const items=buildingItems(ref,project,extent).items;
 // same step as src/main.js: an OSM school / townhall / community centre point inside a footprint tags that footprint
 for(const f of data.features)if(f.geometry.type==='Point'&&['school','townhall','community_centre'].includes(f.properties.amenity)){const p=project(f.geometry.coordinates);const building=items.find(b=>insidePoly(p,b.poly));if(building)building.t={...building.t,amenity:f.properties.amenity,name:f.properties.name};}
 const catalogue=createCatalogue(data,enrichment,project,extent,items,namedZones,bible);
 const itemById=new Map(items.map(i=>[i.id,i]));
 return {catalogue,project,extent,boundaryPolys,items,itemById,data};
}
