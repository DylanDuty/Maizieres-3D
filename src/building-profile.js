import {area} from './geo.js';
// Minimum-area rectangle over edges ≥ 1 m; round or finely digitised outlines (silos, tanks) fall back to all edges.
export function roofAxis(ring,minEdge=1){let best=null;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dz=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dz);if(l<minEdge||l===0)continue;const u=[dx/l,dz/l];let v=[-u[1],u[0]],a=ring.map(p=>p[0]*u[0]+p[1]*u[1]),b=ring.map(p=>p[0]*v[0]+p[1]*v[1]);const w=Math.max(...a)-Math.min(...a),h=Math.max(...b)-Math.min(...b);if(!best||w*h<best.area){if(w<h){v=u;b=a;}best={axis:v,min:Math.min(...b),max:Math.max(...b),area:w*h};}}return best||(minEdge>0?roofAxis(ring,0):null);}
const positive=v=>Number.isFinite(Number.parseFloat(v))&&Number.parseFloat(v)>0?Number.parseFloat(v):null;
// V1.4 art palettes (village français stylisé).
const WALLS={house:['#f2e7cf','#f5efe3','#ead8b6','#e2cfb0','#eddcc4','#e9e0cf','#f1dcc4','#e6e3cc','#efe4d4','#e8d2b4'],stone:['#dccdb0','#d6c6a6','#e2d4b8'],brick:['#c98f70','#c4866a'],public:['#f1e3c6','#ece0c8'],commercial:['#f3f1ea','#ecebe4','#e9e4d8'],industrial:['#e4e1d6','#d3dde2','#e8dcc6','#d6e0d8'],hangar:['#c9ccc2','#bfc6c3','#d0c7b2'],farm:['#dfcfae','#d8c39f','#e0d3b8'],light:['#c7a883','#b99a78','#d2bd9a','#c9c2ad'],annex:['#e3d6bd','#dccfb6','#e8dcc6']};
const ROOFS={tile:['#c2653f','#b85b3b','#cb7249','#ab573c','#bd6c49','#a35d45','#c9805a'],slate:['#5f6b78','#66717c'],metal:['#8e9a9c','#97a3a2'],concrete:['#c8c1b1','#bdb7a8'],sheet:['#9aabb8','#a9b8ad','#b8b3a2','#8f9faa','#b0b7b4'],shed:['#7c6a5a','#8c7b69','#6f7775','#a0593f']};
const SHUTTERS=['#7d9fb3','#8aa58a','#b9c8c9','#9c5b4e','#c9b99a','#6f8f9e','#eee8da','#a3b89a'];
export function plausibleRoofHeight(height,span,floors,wallHeight,bulk=false){
 // Conservative envelope only for derived IGN rises: no change to plausible values.
 const widthLimit=Math.max(1.2,span*(bulk?.5:.85));
 const storeyLimit=floors?Math.max(3.2,floors*2.65+1):Infinity;
 const wallLimit=wallHeight?Math.max(3.2,wallHeight+1):Infinity;
 return Math.min(height,9,widthLimit,storeyLimit,wallLimit);
}
export function buildingProfile(t,poly,extra={},id=''){
 const size=area(poly[0]),axis=roofAxis(poly[0]);if(!axis)return null;
 const knownUsage=extra.usage&&extra.usage!=='Indifférencié';
 let kind=({'Résidentiel':'house','Annexe':'annex','Agricole':'agricultural','Industriel':'industrial','Commercial et services':'commercial','Religieux':'church','Sportif':'public'}[extra.usage]);
 const osmKind=({church:'church',garage:'garage',garages:'garage',shed:'annex',barn:'agricultural',farm_auxiliary:'agricultural',farm:'farm',industrial:'industrial',warehouse:'industrial',retail:'commercial',commercial:'commercial',school:'public',public:'public',greenhouse:'greenhouse'}[t.building]);
 kind=osmKind||kind||(size<45?'annex':size>900?'large':'house');
 if(extra.nature==='Silo')kind='silo';if(extra.nature==='Serre')kind='greenhouse';
 if(extra.landmark||['school','townhall','community_centre','fire_station'].includes(t.amenity))kind='public';
 // Truly open structures stay open. In the French cadastre import, wall=no marks a light construction
 // (IGN BD TOPO confirms construction_legere for most matched cases): a closed shed, not a floating roof.
 if(['roof','carport'].includes(t.building)||t.amenity==='fuel')kind='canopy';
 else if(t.wall==='no'||extra.lightConstruction===true&&!['church','public'].includes(kind))kind=kind==='agricultural'||kind==='industrial'||size>160?'hangar':'light';
 const bulk=['industrial','agricultural','commercial','large','hangar'].includes(kind);
 const roofMaterials=extra.roofMaterials||[];let roofMaterial=t['roof:material']?({roof_tiles:'tile',tiles:'tile',slate:'slate',metal:'metal',concrete:'concrete'}[t['roof:material']]):null;
 // A mixed declaration does not establish which material dominates: retain it as mixed provenance.
 if(!roofMaterial&&roofMaterials.length===1)roofMaterial=roofMaterials[0];
 roofMaterial??=bulk?'metal':kind==='church'?'slate':'tile';
 const floors=positive(t['building:levels'])||extra.floors||null;
 const roofHeightOSM=positive(t['roof:height']);
 let roofShape=t['roof:shape']==='flat'||kind==='canopy'?'flat':'gabled';
 if(!t['roof:shape']&&roofMaterials.length===1&&roofMaterials[0]==='concrete'&&!extra.roofHeight)roofShape='flat';
 // Without a surveyed bearing, keep the footprint-derived ridge and label it as inferred.
 const direction=Number.isFinite(parseFloat(t['roof:direction']))?parseFloat(t['roof:direction']):null;if(direction!=null){const angle=direction*Math.PI/180;axis.axis=[Math.sin(angle),-Math.cos(angle)];const values=poly[0].map(p=>p[0]*axis.axis[0]+p[1]*axis.axis[1]);axis.min=Math.min(...values);axis.max=Math.max(...values);}
 const span=axis.max-axis.min;
 let roofHeight=roofShape==='flat'?0:roofHeightOSM||extra.roofHeight||Math.min(bulk?3:kind==='light'?1.1:3.8,Math.max(.5,span*(bulk?.12:kind==='light'?.16:kind==='annex'||kind==='garage'?.25:.34)));
 const sourceRoofHeight=roofHeight;
 if(!roofHeightOSM&&extra.roofHeight)roofHeight=plausibleRoofHeight(roofHeight,span,floors,extra.wallHeight,bulk);
 let wallHeight=extra.wallHeight||null,heightSource=wallHeight?'IGN BD TOPO':'estimated';
 const osmHeight=positive(t.height);if(osmHeight){wallHeight=Math.max(.5,osmHeight-roofHeight);heightSource='OSM';}
 if(!wallHeight){wallHeight=floors&&kind!=='light'?Math.max(2.5,floors*2.65):({annex:2.5,garage:2.5,light:2.3,hangar:4.8,agricultural:4.5,industrial:6,commercial:5.5,large:5.5,greenhouse:2.3,silo:9,church:8.3,public:5.3}[kind]||4.4);heightSource=floors?'estimated from floors':'estimated';}
 const maxWindowFloors=Math.max(1,Math.floor((wallHeight-.2)/2.2));
 const windowFloors=Math.min(6,maxWindowFloors,floors||Math.max(1,Math.floor(wallHeight/2.65)));
 const seed=[...id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,0)>>>0,pick=(list,salt=0)=>list[(seed>>>salt)%list.length];
 // Deterministic art palettes per building family: stable across reloads, never a survey of real colours.
 let wallColor=pick(({house:WALLS.house,public:WALLS.public,commercial:WALLS.commercial,industrial:WALLS.industrial,large:WALLS.industrial,hangar:WALLS.hangar,agricultural:WALLS.farm,light:WALLS.light,annex:WALLS.annex,garage:WALLS.annex}[kind])||WALLS.house);
 const wallCodes=[...new Set(String(extra.wallMaterialCode||'').replace(/[09]/g,'').split(''))];
 if(wallCodes.length===1&&!['light','hangar'].includes(kind))wallColor=pick(({'1':WALLS.stone,'2':WALLS.stone,'3':WALLS.house,'4':WALLS.brick,'5':WALLS.house,'6':WALLS.light}[wallCodes[0]])||[wallColor],3);
 // BIBLE 03 §5: the town hall facade is documented as brick and stone.
 if(t.amenity==='townhall'||/^Mairie/.test(extra.landmark?.name||''))wallColor='#d9a986';
 let roofColor=roofMaterial==='tile'?pick(ROOFS.tile,5):pick(ROOFS[roofMaterial]||ROOFS.tile,5);
 if(kind==='hangar'||kind==='industrial'||kind==='large')roofColor=pick(ROOFS.sheet,5);if(kind==='light')roofColor=pick(ROOFS.shed,5);
 return {kind,bulk,size,axis,wallHeight,roofHeight,sourceRoofHeight,roofHeightClamped:roofHeight<sourceRoofHeight-.001,roofShape,roofMaterial,roofColor,wallColor,shutterColor:pick(SHUTTERS,7),seed,windowFloors,knownUsage:!!(knownUsage||osmKind),heightSource,roofHeightSource:roofHeightOSM?'OSM':extra.roofHeight&&roofShape!=='flat'?'IGN statistical roof maximum':'estimated',roofDirectionSource:direction!=null?'OSM':'inferred from footprint',materialSource:t['roof:material']?'OSM':roofMaterials.length===1?'IGN cadastral declaration':'estimated',shade:((seed>>>0)%9-4)/100};
}
