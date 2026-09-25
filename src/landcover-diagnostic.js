import {Batch,material,strip} from './geometry.js';

// V1.10 ?diagnostic=landcover: the land-cover reference drawn flat over the map for QA only (simplified 0.5 m shapes).
// Agriculture by RPG usage category, prairies, woods, hedges, water, artificial surfaces (filled) and functional perimeters
// (outline only: they also contain buildings and roads), uncertain objects (confidence C) outlined in pink.
export const LANDCOVER_COLORS={terre_arable:'#e9c46a',prairie:'#90be6d',jachere:'#c9ad7d',culture_permanente:'#b5838d',autre_surface_agricole:'#bfb8a6',
 bois:'#2d6a4f',peupleraie:'#52b788',haie:'#80b918',haie_polygone:'#b7e4c7',eau:'#0077b6',cours_eau:'#00b4d8',artificiel:'#8d99ae',perimetre:'#495057',incertain:'#ff006e'};
const agriKey=c=>c.startsWith('prairie')?'prairie':c;
export async function buildLandcoverDiagnostic(scene,project,base){
 const d=await fetch(`${base}data/landcover-diagnostic.json`).then(r=>r.json());
 const batch=new Batch(material()),stats={agriculture:0,prairie:0,woodland:0,hedge:0,hedgePolygon:0,water:0,waterLine:0,artificial:0,uncertain:0,hedgeKm:0,waterKm:0},km=l=>l.reduce((s,p,i)=>i?s+Math.hypot(p[0]-l[i-1][0],p[1]-l[i-1][1]):0,0)/1000;
 const fill=(o,y,color)=>{for(const poly of o.rings){try{batch.polygon(poly.map(r=>r.map(project)),y,color);}catch{}}};
 const outline=(o,y,color,w)=>{for(const poly of o.rings)for(const r of poly)strip(batch,r.map(project),w,y,color);};
 for(const o of d.polygons){
  if(o.layer==='agriculture'){const k=agriKey(o.cls);fill(o,.5,LANDCOVER_COLORS[k]);stats[k==='prairie'?'prairie':'agriculture']++;}
  else if(o.layer==='woodland'){fill(o,.7,o.cls==='peupleraie'?LANDCOVER_COLORS.peupleraie:LANDCOVER_COLORS.bois);stats.woodland++;}
  else if(o.layer==='hedge_polygon'){fill(o,.8,LANDCOVER_COLORS.haie_polygone);stats.hedgePolygon++;}
  else if(o.layer==='water_polygon'){fill(o,.9,LANDCOVER_COLORS.eau);stats.water++;}
  else if(o.layer==='artificial'){if(o.kind!=='surface')outline(o,1.1,LANDCOVER_COLORS.perimetre,2.5);else fill(o,.6,LANDCOVER_COLORS.artificiel);stats.artificial++;}
  if(o.conf==='C'){outline(o,1.3,LANDCOVER_COLORS.incertain,3);stats.uncertain++;}}
 for(const l of d.lines){const pts=l.coords.map(project);
  if(l.layer==='hedge'){strip(batch,pts,2.5,1,LANDCOVER_COLORS.haie);stats.hedge++;stats.hedgeKm+=km(pts);}
  else{strip(batch,pts,2,1.2,LANDCOVER_COLORS.cours_eau);stats.waterLine++;stats.waterKm+=km(pts);}}
 const mesh=batch.mesh(scene,false);if(mesh)mesh.name='landcover-diagnostic';
 return {mesh,stats};
}
