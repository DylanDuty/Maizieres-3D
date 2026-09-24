import {area} from './geo.js';
export function roofAxis(ring){let best=null;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dz=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dz);if(l<1)continue;const u=[dx/l,dz/l];let v=[-u[1],u[0]],a=ring.map(p=>p[0]*u[0]+p[1]*u[1]),b=ring.map(p=>p[0]*v[0]+p[1]*v[1]);const w=Math.max(...a)-Math.min(...a),h=Math.max(...b)-Math.min(...b);if(!best||w*h<best.area){if(w<h){v=u;b=a;}best={axis:v,min:Math.min(...b),max:Math.max(...b),area:w*h};}}return best;}
const positive=v=>Number.isFinite(Number.parseFloat(v))&&Number.parseFloat(v)>0?Number.parseFloat(v):null;
const palette={tile:'#b8724e',slate:'#647789',metal:'#929e9c',concrete:'#c5bcaa'};
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
 if(t.wall==='no'||['roof','carport'].includes(t.building))kind='canopy';
 const bulk=['industrial','agricultural','commercial','large'].includes(kind);
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
 let roofHeight=roofShape==='flat'?0:roofHeightOSM||extra.roofHeight||Math.min(bulk?3:3.8,Math.max(.65,span*(bulk?.12:kind==='annex'||kind==='garage'?.25:.34)));
 const sourceRoofHeight=roofHeight;
 if(!roofHeightOSM&&extra.roofHeight)roofHeight=plausibleRoofHeight(roofHeight,span,floors,extra.wallHeight,bulk);
 let wallHeight=extra.wallHeight||null,heightSource=wallHeight?'IGN BD TOPO':'estimated';
 const osmHeight=positive(t.height);if(osmHeight){wallHeight=Math.max(.5,osmHeight-roofHeight);heightSource='OSM';}
 if(!wallHeight){wallHeight=floors?Math.max(2.5,floors*2.65):({annex:2.5,garage:2.5,agricultural:4.5,industrial:6,commercial:5.5,large:5.5,greenhouse:2.3,silo:9,church:8.3,public:5.3}[kind]||4.4);heightSource=floors?'estimated from floors':'estimated';}
 const maxWindowFloors=Math.max(1,Math.floor((wallHeight-.2)/2.2));
 const windowFloors=Math.min(6,maxWindowFloors,floors||Math.max(1,Math.floor(wallHeight/2.65)));
 let wallColor=bulk?'#c7c8bd':kind==='public'?'#eadcc0':'#eadcc5';
 const wallCodes=[...new Set(String(extra.wallMaterialCode||'').replace(/[09]/g,'').split(''))];
 if(wallCodes.length===1)wallColor=({'1':'#d5cdb7','2':'#c4baa5','3':'#c3c1b7','4':'#b98c74','5':'#d5d0c2','6':'#b1a085'}[wallCodes[0]])||wallColor;
 const seed=[...id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,0);
 return {kind,bulk,size,axis,wallHeight,roofHeight,sourceRoofHeight,roofHeightClamped:roofHeight<sourceRoofHeight-.001,roofShape,roofMaterial,roofColor:palette[roofMaterial]||palette.tile,wallColor,windowFloors,knownUsage:!!(knownUsage||osmKind),heightSource,roofHeightSource:roofHeightOSM?'OSM':extra.roofHeight&&roofShape!=='flat'?'IGN statistical roof maximum':'estimated',roofDirectionSource:direction!=null?'OSM':'inferred from footprint',materialSource:t['roof:material']?'OSM':roofMaterials.length===1?'IGN cadastral declaration':'estimated',shade:((seed>>>0)%9-4)/100};
}
