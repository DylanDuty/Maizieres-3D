// V1.9 railway reference (current state), built from local snapshots only (npm run data:rail).
// Sources: IGN BD TOPO troncon_de_voie_ferree (official axes, frozen V1.8 snapshot), OpenStreetMap (project snapshot:
// one way per physical track, connected at shared nodes), BD TOPO network points / structures / transport equipment,
// frozen V1.7 terrain (altitude), frozen V1.8 roads (level crossings), BIBLE_01 / BIBLE_03 (history, names).
// Frozen references (buildings, terrain, roads, UNREAL_ORIGIN) are read only. No track is drawn from the orthophoto or
// from history. Outputs: public/data/rail.geojson, unreal/rail/rail-splines.json, data-sources/rail/rail-report.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,fromL93,toUnreal} from './terrain-frame.mjs';
import {polygons,insidePoly} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const REVIEW='data-sources/rail/rail-review-v1.9.json',REV=fs.existsSync(REVIEW)?read(REVIEW):{tracks:{},notes:[]};

// ---------- Terrain (frozen V1.7) ----------
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const terrainZ=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const inExtent=([E,N])=>E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north;

// ---------- Geometry helpers (Lambert-93) ----------
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
function densify(l,step){const out=[l[0]];for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/step));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;}
function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return {d:Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy),t,q:[a[0]+t*dx,a[1]+t*dy]};}
function lineDist(p,l){let best={d:Infinity};for(let i=1;i<l.length;i++){const s=segDist(p,l[i-1],l[i]);if(s.d<best.d)best={...s,i};}return best;}
// Chainage (distance along l) of the projection of p.
function chainage(p,l){const b=lineDist(p,l);let c=0;for(let i=1;i<b.i;i++)c+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return c+b.t*Math.hypot(l[b.i][0]-l[b.i-1][0],l[b.i][1]-l[b.i-1][1]);}
function segCross(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*r[0],a[1]+t*r[1]]:null;}
function crossings(l1,l2){const out=[];for(let i=1;i<l1.length;i++)for(let j=1;j<l2.length;j++){const x=segCross(l1[i-1],l1[i],l2[j-1],l2[j]);if(x&&!out.some(o=>Math.hypot(o[0]-x[0],o[1]-x[1])<.5))out.push(x);}return out;}
// Clip a polyline to the terrain extent (keeps the longest inside run; the report records the clipping).
function clip(l){const d=densify(l,1),runs=[];let cur=null;for(const p of d){if(inExtent(p)){if(!cur){cur=[];runs.push(cur);}cur.push(p);}else cur=null;}
 if(!runs.length)return null;if(runs.length===1&&runs[0].length===d.length)return {l,clipped:false};const best=runs.sort((a,b)=>b.length-a.length)[0];
 // Keep the original vertices inside the run plus the two cut points.
 const s=chainage(best[0],l),e=chainage(best.at(-1),l);let c=0;const out=[best[0]];for(let i=1;i<l.length;i++){c+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);if(c>s+.01&&c<e-.01)out.push(l[i]);}out.push(best.at(-1));return {l:out,clipped:true};}

// ---------- Sources ----------
const osmAll=read('public/data/maizieres.geojson'),bdRail=read('data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson'),pts=read('data-sources/roads/bdtopo-point-du-reseau.geojson'),constr=read('data-sources/roads/bdtopo-construction-lineaire.geojson');
const equip=read('data-sources/rail/bdtopo-equipement-de-transport.geojson'),hydro=read('data-sources/rail/bdtopo-troncon-hydrographique.geojson'),roads=read('public/data/roads.geojson'),roadReport=read('data-sources/roads/roads-report.json');
const commune=read('public/data/commune.geojson'),communeL93=polygons(commune.features?commune.features[0]:commune,toL93),inCommune=p=>communeL93.some(poly=>insidePoly(p,poly));
const axes=bdRail.features.map(f=>({id:f.properties.cleabs,p:f.properties,l:f.geometry.coordinates.map(c=>toL93(c)),geometry:f.geometry}));
const osmRail=osmAll.features.filter(f=>f.properties.railway==='rail').map(f=>({id:f.id,p:f.properties,l:f.geometry.coordinates.map(c=>toL93(c)),geometry:f.geometry}));
const osmHistoric=osmAll.features.filter(f=>['abandoned','disused','razed','dismantled'].includes(f.properties.railway)||f.properties['abandoned:railway']||f.properties['disused:railway']);

// ---------- Tracks: one feature per physical track ----------
// OSM maps each track separately (main line V1 / V2 with SNCF Réseau track refs, sidings, spurs, crossover), and they share
// nodes at switches: it is the only source of individual tracks. Each OSM track is validated against the official BD TOPO axis.
// BD TOPO service troncons (single track) not represented by any OSM track are added from BD TOPO.
const tracks=[];
const coverBy=(l,others,tol)=>{const d=densify(l,2);let n=0;const dist=[];for(const p of d){const m=Math.min(...others.map(o=>lineDist(p,o.l).d));dist.push(m);if(m<=tol)n++;}dist.sort((a,b)=>a-b);return {share:n/d.length,median:dist[dist.length>>1],max:dist.at(-1)};};
for(const o of osmRail){const c=clip(o.l);if(!c)continue;const main=o.p.usage==='main',cov=coverBy(c.l,axes.filter(a=>main?a.p.nature==='Voie ferrée principale':true),main?3.5:3);
 tracks.push({id:o.id,src:'osm',o,l:c.l,clipped:c.clipped,geometry:c.clipped?{type:'LineString',coordinates:c.l.map(p=>fromL93(p).map(v=>+v.toFixed(8)))}:o.geometry,bdCover:cov});}
for(const a of axes.filter(a=>a.p.nature!=='Voie ferrée principale')){const cov=coverBy(a.l,tracks.filter(t=>t.src==='osm'),2.5);if(cov.share>=.5||REV.bdtopoAxes?.[a.id])continue;const c=clip(a.l);if(!c)continue;
 tracks.push({id:a.id,src:'bdtopo',a,l:c.l,clipped:c.clipped,geometry:c.clipped?{type:'LineString',coordinates:c.l.map(p=>fromL93(p).map(v=>+v.toFixed(8)))}:a.geometry,osmCover:cov});}
// Official attributes of the BD TOPO axis carrying each track (≥ 50 % of its length within 3.5 m).
for(const t of tracks){if(t.src==='bdtopo'){t.axis=[t.a];continue;}const d=densify(t.l,2),tally=new Map();for(const p of d){let best=null;for(const a of axes){const m=lineDist(p,a.l).d;if(m<=3.5&&(!best||m<best.m))best={a,m};}if(best)tally.set(best.a,(tally.get(best.a)||0)+1);}
 t.axis=[...tally].sort((x,y)=>y[1]-x[1]).map(([a])=>a);}

// ---------- Classification, status, attributes ----------
const TYPE={main:'voie principale',crossover:'communication (liaison entre voies principales)',siding:'voie de garage / faisceau',spur:'embranchement / voie de service',service:'voie de service'};
for(const t of tracks){const p=t.src==='osm'?t.o.p:{},ax=t.axis[0]?.p;
 t.kind=p.usage==='main'?'main':p.service==='crossover'?'crossover':p.service==='siding'?'siding':p.service==='spur'?'spur':'service';
 t.network=t.kind==='main'||t.kind==='crossover'?'principal':'service';
 // Status: BD TOPO "En service" + OSM railway=rail → active (main) / service (other tracks); a single source → unknown.
 const bdState=t.axis.map(a=>a.p.etat_de_l_objet);t.bdtopoConfirmed=t.src==='bdtopo'||(t.bdCover?.share??0)>=.8;
 const rv0=REV.tracks[t.id];t.status=t.bdtopoConfirmed?(t.network==='principal'?'active':'service'):rv0?.verdict==='visible'?'service':'unknown';
 t.statusConfidence=t.bdtopoConfirmed?'A':t.status==='unknown'?null:'B (OSM railway=rail + voie visible sur l’orthophoto)';
 t.statusEvidence=[t.src==='osm'?'OSM railway=rail'+(p.service?' service='+p.service:'')+(p.usage?' usage='+p.usage:''):'BD TOPO seule (absente d’OSM)',...new Set(bdState.map(s=>'BD TOPO : '+s))];
 if(!t.bdtopoConfirmed)t.statusEvidence.push('aucun axe BD TOPO à moins de 3 m sur '+Math.round((1-(t.bdCover?.share??0))*100)+' % du tracé');
 const rv=REV.tracks[t.id];if(rv){t.review=rv;t.statusEvidence.push('Orthophoto IGN 2025 : '+rv.observation);}
 t.gauge=p.gauge?+p.gauge/1000:ax?.largeur==='Normale'?1.435:null;t.gaugeSource=p.gauge?'osm':ax?.largeur?'bdtopo (largeur Normale)':null;
 t.trackRef=p['railway:track_ref']||p.ref||null;t.line=p.usage==='main'?{ref:p.ref,name:p.name,operator:p.operator,sncfReseau:p['ref:FR:SNCF_Reseau']||null}:p.operator?{operator:p.operator,ref:p.ref||null}:null;
 t.electrification={current:p.electrified||(ax?.electrifie===false?'no':ax?.electrifie?'yes':null),bdtopo:ax?.electrifie??null,planned:p['construction:electrified']?`${p['construction:electrified']} ${+p['construction:voltage']/1000} kV ${p['construction:frequency']} Hz (travaux en cours d’après OSM)`:null};
 t.maxspeed=p.maxspeed?+p.maxspeed:ax?.vitesse_maximale??null;t.trackCountAxis=ax?.nombre_de_voies??null;
 t.inCommune=(()=>{const d=densify(t.l,5);return d.filter(inCommune).length/d.length;})();
 t.bdtopoIds=t.axis.map(a=>a.id);t.osmId=t.src==='osm'?t.id:null;t.lengthM=len(t.l);}

// ---------- Topology ----------
// Nodes: track ends; a track end lying on another track (≤ 0.3 m) is a switch on that track. OSM tracks share exact nodes.
const nodes=[];const nodeAt=p=>{let n=nodes.find(n=>Math.hypot(n.p[0]-p[0],n.p[1]-p[1])<=.3);if(!n){n={p,ends:[],through:[]};nodes.push(n);}return n;};
for(const t of tracks)for(const end of ['A','B']){const p=end==='A'?t.l[0]:t.l.at(-1);const n=nodeAt(p);n.ends.push({t,end});t['node'+end]=n;}
for(const n of nodes)for(const t of tracks){if(n.ends.some(e=>e.t===t))continue;const d=lineDist(n.p,t.l);if(d.d<=.3)n.through.push(t);}
// BD TOPO-only tracks end on the official 2-track axis, i.e. about 1.85 m from the real OSM track: joined within 3 m (inferred).
const inferredJoins=[];for(const t of tracks.filter(t=>t.src==='bdtopo'))for(const end of ['A','B']){const n=t['node'+end];if(n.ends.length+n.through.length>1)continue;
 let best=null;for(const o of tracks){if(o===t)continue;const d=lineDist(n.p,o.l);if(d.d<=3&&(!best||d.d<best.d))best={o,d:d.d,q:d.q};}
 if(best){n.through.push(best.o);n.inferredJoin={to:best.o.id,gapM:r2(best.d),joinL93:best.q.map(r2)};inferredJoins.push({track:t.id,end,to:best.o.id,gapM:r2(best.d)});}}
const nearBorder=p=>p[0]-G.west<3||G.east-p[0]<3||p[1]-G.south<3||G.north-p[1]<3;
for(const n of nodes){const deg=n.ends.length+2*n.through.length;n.degree=deg;
 n.type=deg>=3?'aiguillage (branchement)':deg===2?'continuité':nearBorder(n.p)?'limite d’emprise':'extrémité de voie (heurtoir probable)';n.z=terrainZ(...n.p);n.inCommune=inCommune(n.p);}
// Components, orphans.
const adj=new Map(tracks.map(t=>[t,new Set()]));for(const n of nodes){const ts=[...new Set([...n.ends.map(e=>e.t),...n.through])];for(const a of ts)for(const b of ts)if(a!==b)adj.get(a).add(b);}
const comp=new Map();let cid=0;for(const t of tracks){if(comp.has(t))continue;const st=[t];comp.set(t,cid);while(st.length){const x=st.pop();for(const y of adj.get(x))if(!comp.has(y)){comp.set(y,cid);st.push(y);}}cid++;}
const mainComp=comp.get(tracks.find(t=>t.kind==='main'));
const orphans=[...new Set(tracks.map(t=>comp.get(t)))].filter(c=>c!==mainComp).map(c=>{const ts=tracks.filter(t=>comp.get(t)===c);return {tracks:ts.map(t=>t.id),lengthM:Math.round(ts.reduce((s,t)=>s+t.lengthM,0)),border:ts.some(t=>nearBorder(t.l[0])||nearBorder(t.l.at(-1))),kinds:[...new Set(ts.map(t=>t.kind))]};});
// Near misses (end 0.3–3 m from another track, not joined), duplicates, crossings without connection.
const nearMisses=[];for(const n of nodes.filter(n=>n.degree===1&&!nearBorder(n.p))){const own=n.ends[0].t;for(const o of tracks){if(o===own)continue;const d=lineDist(n.p,o.l);if(d.d>.3&&d.d<=3)nearMisses.push({track:own.id,end:n.ends[0].end,near:o.id,gapM:r2(d.d),L93:n.p.map(r2)});}}
const duplicates=[];for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++){const a=tracks[i],b=tracks[j];const d=densify(a.l,2);const s=d.filter(p=>lineDist(p,b.l).d<1).length/d.length;if(s>.8)duplicates.push({a:a.id,b:b.id,share:r2(s)});}
const trackCrossings=[];for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++)for(const x of crossings(tracks[i].l,tracks[j].l)){if(nodes.some(n=>Math.hypot(n.p[0]-x[0],n.p[1]-x[1])<=.5))continue;const rv=REV.crossings?.[tracks[i].id+'|'+tracks[j].id]||REV.crossings?.[tracks[j].id+'|'+tracks[i].id];trackCrossings.push({a:tracks[i].id,b:tracks[j].id,L93:x.map(r2),sameLevel:true,review:rv||null});}

// ---------- Structures ----------
// Rail bridges: BD TOPO axis above ground (position 1). Watercourses crossed (BD TOPO hydrography). Roads over / under the rail and
// level crossings come from the frozen V1.8 road reference.
const hydroL=hydro.features.filter(f=>f.properties.etat_de_l_objet!=='En projet').map(f=>({id:f.properties.cleabs,name:f.properties.cpx_toponyme_de_cours_d_eau||null,nature:f.properties.nature,fosse:f.properties.fosse,pos:f.properties.position_par_rapport_au_sol,l:f.geometry.coordinates.map(c=>toL93(c))}));
const bridges=axes.filter(a=>a.p.position_par_rapport_au_sol==='1').map(a=>{const under=hydroL.flatMap(h=>crossings(a.l,h.l).map(x=>({h,x})));
 return {id:'ouvrage:'+a.id,kind:'pont ferroviaire',bdtopo:a.id,startL93:a.l[0].map(r2),endL93:a.l.at(-1).map(r2),lengthM:r2(len(a.l)),crosses:under.map(u=>(u.h.name||u.h.nature)+(u.h.fosse?' (fossé)':'')),confidence:'A (BD TOPO position au-dessus du sol)',a};});
const hydroCross=[];for(const t of tracks)for(const h of hydroL){for(const x of crossings(t.l,h.l)){const onBridge=bridges.some(b=>lineDist(x,b.a.l).d<6);hydroCross.push({track:t.id,kind:t.kind,watercourse:h.name||h.nature,fosse:h.fosse,hydroId:h.id,hydroPosition:h.pos,L93:x.map(r2),onBridge});}}
const roadF=roads.features.filter(f=>!f.properties.excluded);const roadById=new Map(roadF.map(f=>[f.id,f]));const roadL=f=>f.geometry.coordinates.map(c=>toL93(c));
const overpasses=[],levelRoad=[];for(const f of roadF){const rl=roadL(f);for(const t of tracks)for(const x of crossings(rl,t.l)){const e={road:f.id,roadName:f.properties.name,roadCategory:f.properties.category,track:t.id,trackKind:t.kind,L93:x.map(r2)};if(f.properties.structure==='pont')overpasses.push(e);else levelRoad.push(e);}}
// A road split exactly on the rail line (BD TOPO network) touches it at a vertex: count contacts too.
for(const f of roadF){if(f.properties.structure==='pont')continue;const rl=roadL(f);for(const end of [rl[0],rl.at(-1)])for(const t of tracks){if(lineDist(end,t.l).d<=.3&&!levelRoad.some(e=>e.road===f.id&&e.track===t.id))levelRoad.push({road:f.id,roadName:f.properties.name,roadCategory:f.properties.category,track:t.id,trackKind:t.kind,L93:end.map(r2)});}}

// ---------- Level crossings (BD TOPO network points "Passage à niveau") ----------
const pnPts=pts.features.filter(f=>f.properties.nature==='Passage à niveau').map(f=>({id:f.properties.cleabs,name:f.properties.toponyme,p:toL93(f.geometry.coordinates),props:f.properties}));
const rrPN=roadReport.structures.levelCrossings;
const levelCrossings=pnPts.map(q=>{const num=+(q.name.match(/\d+/)?.[0]);const near=levelRoad.filter(e=>Math.hypot(e.L93[0]-q.p[0],e.L93[1]-q.p[1])<=25);const roadsAt=[...new Set(near.map(e=>e.road))],tracksAt=[...new Set(near.map(e=>e.track))];
 const at=near.length?near.reduce((s,e)=>[s[0]+e.L93[0]/near.length,s[1]+e.L93[1]/near.length],[0,0]):q.p,rn=roadsAt.map(id=>roadById.get(id)?.properties.name).find(Boolean)||null;
 const bible=num===73?'BIBLE_01 § 12.2 : passage à niveau de la Rue du Général-Leclerc identifié par SNCF Réseau (2025) ; § 12.1 : ancienne gare « près du passage à niveau »':null;
 return {id:'PN'+num,number:num,name:q.name,bdtopo:q.id,L93Bdtopo:q.p.map(r2),L93:at.map(r2),offsetBdtopoM:r2(Math.hypot(at[0]-q.p[0],at[1]-q.p[1])),road:{ids:roadsAt,name:rn,category:roadsAt.map(id=>roadById.get(id)?.properties.category)[0]||null},
  tracks:tracksAt,trackKinds:[...new Set(tracksAt.map(id=>tracks.find(t=>t.id===id)?.kind))],zTerrain:r2(terrainZ(...at)),inCommune:inCommune(at),type:'inconnu (classement SNCF non accessible ; barrières et signalisation non modélisées)',
  confidence:roadsAt.length&&tracksAt.length?(bible?'A (BD TOPO + voirie V1.8 + orthophoto + BIBLE_01)':'A (BD TOPO + voirie V1.8 + orthophoto)'):'B',sources:['BD TOPO point_du_reseau '+q.id+' (précision '+q.props.precision_planimetrique+' m, confirmé '+String(q.props.date_de_confirmation||'').slice(0,10)+')','voirie V1.8 (roads.geojson)','BD ORTHO IGN avril 2025',bible].filter(Boolean),
  v18:rrPN.find(r=>r.name===q.name)?.road??null,unrealCm:toUnreal([at[0],at[1],terrainZ(...at)]).map(Math.round)};});

// ---------- Altitude: physically coherent longitudinal profiles ----------
// 1. terrain every metre along the track; 2. structures (bridge span + 4 m) and hydraulic crossings (± 6 m) removed and
// bridged linearly between the abutments; 3. robust smoothing (median 15 m, then mean 41 m) that removes micro-irregularities
// (ballast, noise) but keeps real grades; 4. tracks joined at switches share the Z of the through track (blend over 30 m).
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
function profile(t){const d=densify(t.l,1),raw=d.map(p=>terrainZ(...p)),n=d.length,ch=[0];for(let i=1;i<n;i++)ch.push(ch[i-1]+Math.hypot(d[i][0]-d[i-1][0],d[i][1]-d[i-1][1]));
 const mask=new Array(n).fill(null);
 for(const b of bridges){const s=chainage(b.a.l[0],t.l),e=chainage(b.a.l.at(-1),t.l),near=lineDist(b.a.l[Math.floor(b.a.l.length/2)],t.l).d;if(near>6)continue;const lo=Math.min(s,e)-4,hi=Math.max(s,e)+4;for(let i=0;i<n;i++)if(ch[i]>=lo&&ch[i]<=hi)mask[i]=b.id;}
 // Road bridge above the track: the LiDAR ground may include the deck edges; the track passes under it on its own profile.
 for(const o of overpasses.filter(o=>o.track===t.id)){const c=chainage(o.L93,t.l);for(let i=0;i<n;i++)if(Math.abs(ch[i]-c)<=8&&!mask[i])mask[i]='passage-superieur:'+o.road;}
 for(const h of hydroCross.filter(h=>h.track===t.id&&!h.onBridge)){const c=chainage(h.L93,t.l);for(let i=0;i<n;i++)if(Math.abs(ch[i]-c)<=6&&!mask[i])mask[i]='hydro:'+h.hydroId;}
 const z=raw.slice();for(let i=0;i<n;){if(!mask[i]){i++;continue;}let j=i;while(j<n&&mask[j])j++;const a=i-1>=0?z[i-1]:z[j],b=j<n?z[j]:z[i-1];for(let k=i;k<j;k++)z[k]=a+(b-a)*(k-i+1)/(j-i+1);i=j;}
 const med=z.map((_,i)=>median(z.slice(Math.max(0,i-7),Math.min(n,i+8)))),sm=med.map((_,i)=>{const w=med.slice(Math.max(0,i-20),Math.min(n,i+21));return w.reduce((s,v)=>s+v,0)/w.length;});
 return {d,raw,z:sm,mask,ch};}
const byId=new Map(tracks.map(t=>[t.id,t]));const order=[...tracks].sort((a,b)=>(a.network==='principal'?0:1)-(b.network==='principal'?0:1)||b.lengthM-a.lengthM);
for(const t of order){t.prof=profile(t);const P=t.prof;
 // Pin ends that join a track already profiled (switch): Z of the through track, blended over 30 m.
 for(const [end,idx] of [['A',0],['B',P.d.length-1]]){const n=t['node'+end];const others=[...n.ends.map(e=>e.t),...n.through].filter(o=>o!==t&&o.prof);if(!others.length)continue;const o=others[0],c=chainage(n.p,o.l),k=Math.min(o.prof.z.length-1,Math.round(c)),target=o.prof.z[k],delta=target-P.z[idx];
  for(let i=0;i<P.d.length;i++){const dist=Math.abs(P.ch[i]-P.ch[idx]);if(dist<30)P.z[i]+=delta*(1-dist/30);}t.pinned=(t.pinned||[]).concat({end,to:o.id,deltaM:r2(delta)});}}
// Level crossings: rail top and road surface are at the same level; the rail profile is pinned to the terrain (= road Z of the
// frozen V1.8 splines) at each PN, blended over 40 m on each side.
for(const pn of levelCrossings)for(const id of pn.tracks){const t=byId.get(id),P=t.prof,c=chainage(pn.L93,t.l),k=Math.min(P.z.length-1,Math.round(c)),delta=terrainZ(...pn.L93)-P.z[k];
 for(let i=0;i<P.z.length;i++){const dist=Math.abs(P.ch[i]-P.ch[k]);if(dist<40)P.z[i]+=delta*(1-dist/40);}t.pinned=(t.pinned||[]).concat({levelCrossing:pn.id,deltaM:r2(delta)});}
// Grades and reliability.
const aberrant=[],cuts=[];
for(const t of tracks){const P=t.prof,n=P.d.length;let maxG=0,at=null;for(let i=50;i<n;i+=10){const g=Math.abs(P.z[i]-P.z[i-50])/50;if(g>maxG){maxG=g;at=P.d[i];}}t.maxGradePermil=Math.round(maxG*1000);t.maxGradeAt=at?.map(r2)||null;
 const lim=t.network==='principal'?.0125:.02;if(maxG>lim)aberrant.push({track:t.id,kind:t.kind,maxGradePermil:t.maxGradePermil,L93:t.maxGradeAt,limitPermil:lim*1000});
 // Reliable Z: ground points where the smoothed profile stays within 0.3 m of the terrain.
 let rel=0,struct=0,runs=[],cur=null;for(let i=0;i<n;i++){if(P.mask[i]){struct++;cur=null;continue;}const dv=P.z[i]-P.raw[i];if(Math.abs(dv)<=.3){rel++;cur=null;}else{if(!cur){cur={start:i,end:i,max:dv};runs.push(cur);}else{cur.end=i;if(Math.abs(dv)>Math.abs(cur.max))cur.max=dv;}}}
 t.zReliableShare=rel/n;t.zStructureShare=struct/n;for(const r of runs)if(r.end-r.start>=3)cuts.push({track:t.id,kind:t.kind,fromL93:P.d[r.start].map(r2),toL93:P.d[r.end].map(r2),lengthM:r.end-r.start+1,maxDeviationM:r2(r.max),kind2:r.max>0?'profil lissé au-dessus du MNT (creux local : ouvrage, fossé ou erreur MNT ?)':'profil lissé sous le MNT (bosse locale)'});}

// ---------- Bridge decks ----------
for(const b of bridges){const ts=tracks.filter(t=>lineDist(b.a.l[Math.floor(b.a.l.length/2)],t.l).d<=6);b.tracks=ts.map(t=>t.id);
 const decks=ts.map(t=>{const P=t.prof,i=P.mask.findIndex(m=>m===b.id),j=P.mask.lastIndexOf(b.id);return i<0?null:{track:t.id,zStart:r2(P.z[i]),zEnd:r2(P.z[j]),minTerrainBelow:r2(Math.min(...P.raw.slice(i,j+1))),clearanceMaxM:r2(Math.max(...P.raw.slice(i,j+1).map((v,k)=>P.z[i+k]-v)))};}).filter(Boolean);
 b.deck=decks;b.relationToTerrain=decks.length?`tablier au niveau des remblais d’accès ; terrain jusqu’à ${Math.max(...decks.map(d=>d.clearanceMaxM))} m plus bas sous l’ouvrage`:null;b.unrealCm=toUnreal([...b.a.l[Math.floor(b.a.l.length/2)],decks[0]?.zStart??terrainZ(...b.a.l[0])]).map(Math.round);}
const hydraulic=[];for(const h of hydroCross.filter(h=>!h.onBridge)){const t=byId.get(h.track),P=t.prof,c=chainage(h.L93,t.l),k=Math.min(P.z.length-1,Math.round(c)),dip=r2(P.z[k]-Math.min(...P.raw.slice(Math.max(0,k-3),k+4)));
 const g=hydraulic.find(x=>x.hydroId===h.hydroId&&Math.hypot(x.L93[0]-h.L93[0],x.L93[1]-h.L93[1])<30);if(g){g.tracks.push(h.track);continue;}
 hydraulic.push({id:'ouvrage:hydro:'+h.hydroId+':'+Math.round(h.L93[0]),kind:'ouvrage hydraulique sous voie (buse / ponceau, non répertorié comme pont)',hydroId:h.hydroId,watercourse:h.watercourse,fosse:h.fosse,L93:h.L93,tracks:[h.track],railZ:r2(P.z[k]),dipBelowRailM:dip,confidence:dip>.5?'B (croisement BD TOPO + creux du MNT)':'C (croisement BD TOPO seul, pas de creux marqué)',unrealCm:toUnreal([h.L93[0],h.L93[1],P.z[k]]).map(Math.round)});}

// Level crossings: rail and road must meet at the same level (road Z = frozen V1.8 spline = terrain).
for(const pn of levelCrossings){pn.railZ=pn.tracks.map(id=>{const t=byId.get(id),c=chainage(pn.L93,t.l);return {track:id,z:r2(t.prof.z[Math.min(t.prof.z.length-1,Math.round(c))])};});
 pn.roadNames=[...new Set(pn.road.ids.map(id=>roadById.get(id)?.properties.name).filter(Boolean))];pn.railMinusRoadM=r2(Math.max(...pn.railZ.map(r=>Math.abs(r.z-pn.zTerrain))));}
// ---------- Unreal splines (3D Douglas-Peucker, tolerance 3 cm, max 25 m between points) ----------
function simplify3(p,tol=.03,maxSeg=25){const keep=new Array(p.length).fill(false);keep[0]=keep[p.length-1]=true;const st=[[0,p.length-1]];
 while(st.length){const [a,b]=st.pop();let idx=-1,dm=0;const A=p[a],B=p[b],L2=(B[0]-A[0])**2+(B[1]-A[1])**2+(B[2]-A[2])**2;
  for(let i=a+1;i<b;i++){const P=p[i];let t=L2?((P[0]-A[0])*(B[0]-A[0])+(P[1]-A[1])*(B[1]-A[1])+(P[2]-A[2])*(B[2]-A[2]))/L2:0;t=Math.max(0,Math.min(1,t));const d=Math.hypot(P[0]-A[0]-t*(B[0]-A[0]),P[1]-A[1]-t*(B[1]-A[1]),P[2]-A[2]-t*(B[2]-A[2]));if(d>dm){dm=d;idx=i;}}
  const segLen=Math.hypot(B[0]-A[0],B[1]-A[1]);if(idx>0&&(dm>tol||segLen>maxSeg)){keep[idx]=true;st.push([a,idx],[idx,b]);}else if(segLen>maxSeg&&b-a>1){const m=(a+b)>>1;keep[m]=true;st.push([a,m],[m,b]);}}
 return p.map((q,i)=>keep[i]?i:-1).filter(i=>i>=0);}
const BALLAST={principal:{topWidthM:null,note:'plateforme double voie : largeur non documentée'},service:{topWidthM:null,note:'largeur non documentée'}};
const splines=tracks.map(t=>{const P=t.prof,p3=P.d.map((q,i)=>[q[0],q[1],P.z[i]]),idx=simplify3(p3);
 const structAt=idx.map(i=>P.mask[i]).map(m=>m||null);
 return {id:'rail:'+t.id,track:t.id,kind:t.kind,kindLabel:TYPE[t.kind],network:t.network,status:t.status,statusConfidence:t.statusConfidence,statusEvidence:t.statusEvidence,trackRef:t.trackRef,line:t.line,provenance:t.src==='osm'?(t.bdtopoConfirmed?'osm+bdtopo':'osm'):'bdtopo',osmId:t.osmId,bdtopoIds:t.bdtopoIds,
  gauge:t.gauge,gaugeSource:t.gaugeSource,electrification:t.electrification,maxspeed:t.maxspeed,trackCountOnAxis:t.trackCountAxis,surface:'ballast (présumé : voie ferrée classique ; aucune donnée de pose)',
  generation:{railsFromCentreline:t.gauge?`2 files de rails à ±${(t.gauge/2+.0325).toFixed(4)} m de l’axe (demi-écartement + demi-champignon 65 mm, valeur type UIC60 : estimation)`:null,sleeperSpacingM:{value:.6,source:'inferred (valeur type voie française)'},ballast:BALLAST[t.network]},
  structures:[...bridges.filter(b=>b.tracks?.includes(t.id)).map(b=>b.id),...hydraulic.filter(h=>h.tracks.includes(t.id)).map(h=>h.id)],pointStructure:structAt,
  confidence:t.bdtopoConfirmed?(t.src==='osm'?'A (OSM validé par l’axe BD TOPO)':'A (BD TOPO)'):t.review?.verdict==='visible'?'B (OSM seul, voie visible sur l’orthophoto)':'C (OSM seul, non vérifiable)',inCommuneShare:r2(t.inCommune),lengthM:r2(t.lengthM),clippedByExtent:t.clipped,
  zSource:'terrain V1.7 lissé (médiane 15 m + moyenne 41 m), ouvrages franchis en ligne droite entre appuis, raccords aux aiguillages alignés',zReliableShare:r2(t.zReliableShare),maxGradePermil:t.maxGradePermil,
  points:idx.map(i=>toUnreal([P.d[i][0],P.d[i][1],P.z[i]]).map(v=>Math.round(v))),pointsL93:idx.map(i=>[r2(P.d[i][0]),r2(P.d[i][1]),r3(P.z[i])]),terrainZ:idx.map(i=>r2(P.raw[i]))};});

// ---------- Historical layer (never mixed with the current network) ----------
const historic=[...osmHistoric.map(f=>({id:f.id,kind:'ancienne emprise ferroviaire sans voie',status:'former_alignment',source:'OSM railway='+f.properties.railway+(f.properties.source?' ('+f.properties.source+')':''),geometry:f.geometry,lengthM:r2(len(f.geometry.coordinates.map(c=>toL93(c)))),note:'tracé ancien documenté par OSM ; aucune voie actuelle ; hors réseau Unreal actuel'})),
 {id:'bible:gare-maizieres',kind:'gare (bâtiment voyageurs et quais)',status:'disparu',geometry:null,nearReference:'PN73 (rue du Général-Leclerc)',source:'BIBLE_03 § 6 (AD Aube S 362, 1857-1859 ; « Fermée — BV détruit ») ; BIBLE_01 § 12.1 (« près du passage à niveau »)',note:'aucune géométrie source : pas de position inventée'},
 {id:'bible:tipry',kind:'ancien réseau TIPRY (tramway / chemin de fer secondaire)',status:'disparu',geometry:null,source:'BIBLE_01 § 12.3 : « Église → Passage à niveau → De Gaulle »',note:'itinéraire historique, aucune géométrie'}];

// ---------- Railway land (separate layer; declared data only) ----------
const landuse=osmAll.features.filter(f=>f.properties.landuse==='railway').map(f=>({type:'Feature',id:f.id,geometry:f.geometry,properties:{id:f.id,kind:'emprise ferroviaire (OSM landuse=railway)',source:'OSM'+(f.properties.source?' ('+f.properties.source+')':''),official:false}}));
const equipF=equip.features.filter(f=>/triage|Gare/.test(f.properties.nature)).map(f=>({type:'Feature',id:f.properties.cleabs,geometry:f.geometry,properties:{id:f.properties.cleabs,kind:f.properties.nature+(f.properties.toponyme?' — '+f.properties.toponyme:''),source:'BD TOPO equipement_de_transport',official:true,fictif:f.properties.fictif,inCommune:(()=>{const r=polygons(f,toL93)[0][0];return inCommune(r.reduce((m,q)=>[m[0]+q[0]/r.length,m[1]+q[1]/r.length],[0,0]));})()}}));

// ---------- Outputs ----------
const trackFeatures=tracks.map(t=>({type:'Feature',id:t.id,geometry:t.geometry,properties:{id:t.id,layer:'track',kind:t.kind,kindLabel:TYPE[t.kind],network:t.network,status:t.status,statusConfidence:t.statusConfidence,statusEvidence:t.statusEvidence,review:t.review||null,trackRef:t.trackRef,line:t.line,provenance:t.src==='osm'?(t.bdtopoConfirmed?'osm+bdtopo':'osm'):'bdtopo',
 osmId:t.osmId,bdtopoIds:t.bdtopoIds,bdtopoDistanceM:t.bdCover?{median:r2(t.bdCover.median),max:r2(t.bdCover.max),shareWithin:r2(t.bdCover.share)}:null,gauge:t.gauge,gaugeSource:t.gaugeSource,electrification:t.electrification,maxspeed:t.maxspeed,trackCountOnAxis:t.trackCountAxis,
 lengthM:r2(t.lengthM),inCommuneShare:r2(t.inCommune),clippedByExtent:t.clipped,maxGradePermil:t.maxGradePermil,zReliableShare:r2(t.zReliableShare),structures:splines.find(s=>s.track===t.id).structures,pinnedAtSwitch:t.pinned||[]}}));
const axisFeatures=axes.map(a=>({type:'Feature',id:a.id,geometry:a.geometry,properties:{id:a.id,layer:'axis',nature:a.p.nature,trackCount:a.p.nombre_de_voies,position:a.p.position_par_rapport_au_sol==='1'?'pont':'sol',state:a.p.etat_de_l_objet,electrified:a.p.electrifie,gauge:a.p.largeur,precisionM:a.p.precision_planimetrique,
 representedBy:REV.bdtopoAxes?.[a.id]?.representedBy||tracks.filter(t=>t.bdtopoIds.includes(a.id)).map(t=>t.id),review:REV.bdtopoAxes?.[a.id]?.observation||null}}));
fs.writeFileSync('public/data/rail.geojson',JSON.stringify({type:'FeatureCollection',metadata:{name:'Référentiel ferroviaire de Maizières-la-Grande-Paroisse (état actuel)',version:'1.9',generatedBy:'scripts/build-rail.mjs',
 layers:{track:'une entité par voie physique (axe de la voie)',axis:'axes officiels BD TOPO (une ligne pour une voie double ; ne pas dédoubler)'},sources:{bdtopo:{file:'data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson',sha256:sha(fs.readFileSync('data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson'))},osm:{file:'public/data/maizieres.geojson',sha256:sha(fs.readFileSync('public/data/maizieres.geojson')),snapshot:osmAll.metadata.osmTimestamp||null}},
 statusValues:{active:'voie principale en service (BD TOPO + OSM)',service:'voie de service en service (BD TOPO + OSM)',neutralized:'neutralisée (aucune documentée)',removed:'déposée (aucune documentée)',former_alignment:'ancienne emprise sans voie (couche historique)',unknown:'une seule source ; statut non établi'}},
 features:[...trackFeatures,...axisFeatures]})+'\n');
fs.writeFileSync('public/data/rail-land.geojson',JSON.stringify({type:'FeatureCollection',metadata:{note:'Couche séparée : emprise déclarée (OSM) et équipements BD TOPO. Aucune plateforme ni ballast n’est estimé ici.'},features:[...landuse,...equipF]})+'\n');
const km=a=>r3(a.reduce((s,t)=>s+t.lengthM,0)/1000),kmC=a=>r3(a.reduce((s,t)=>s+t.lengthM*t.inCommune,0)/1000);
const nodeOut=nodes.filter(n=>n.type!=='continuité').map((n,i)=>({id:'RN'+i,type:n.type,degree:n.degree,tracks:[...new Set([...n.ends.map(e=>e.t.id),...n.through.map(t=>t.id)])],inferredJoin:n.inferredJoin||null,L93:n.p.map(r2),z:r2(n.z),inCommune:n.inCommune,unrealCm:toUnreal([n.p[0],n.p[1],n.z]).map(Math.round)}));
// Small QA file for the Three.js ?diagnostic=rail mode (longitude/latitude only).
fs.writeFileSync('public/data/rail-diagnostic.json',JSON.stringify({bridges:bridges.map(b=>({id:b.id,start:fromL93(b.a.l[0]),end:fromL93(b.a.l.at(-1))})),levelCrossings:levelCrossings.map(p=>({id:p.id,lonlat:fromL93(p.L93)})),historic:osmHistoric.map(f=>({id:f.id,geometry:f.geometry}))})+'\n');
fs.mkdirSync('unreal/rail',{recursive:true});
fs.writeFileSync('unreal/rail/rail-splines.json',JSON.stringify({metadata:{version:'1.9',generatedBy:'scripts/build-rail.mjs',unrealOrigin:O,units:'centimètres Unreal : X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude NGF-IGN69 × 100',
 splineNote:'une spline par voie physique (axe de la voie) ; les rails, traverses, ballast et caténaires restent à générer à partir des attributs (generation.*)',pointsNote:'Douglas-Peucker 3D (3 cm) sur le profil au mètre, 25 m au plus entre deux points ; pointsL93 = mêmes points en Lambert-93 + altitude ; terrainZ = MNT brut au même point ; pointStructure = ouvrage porté/franchi',
 excluded:'couche historique (voies disparues) jamais incluse'},splines,nodes:nodeOut,structures:{bridges:bridges.map(({a,...b})=>b),hydraulic,overpasses,levelCrossings,roadCrossingsOfServiceTracks:levelRoad.filter(e=>!levelCrossings.some(p=>p.road.ids.includes(e.road)))}})+'\n');
const S=splines,pointsTotal=S.reduce((s,x)=>s+x.points.length,0);
const report={generatedAt:new Date().toISOString(),frozen:{buildingsSha256:sha(fs.readFileSync('public/data/buildings.geojson')),terrainGeoTiffSha256:sha(tb),roadsSha256:sha(fs.readFileSync('public/data/roads.geojson')),roadSplinesSha256:sha(fs.readFileSync('unreal/roads/road-splines.json')),unrealOrigin:O},
 sources:{bdtopoAxes:axes.length,osmTracks:osmRail.length,osmHistoric:osmHistoric.length,unavailable:['API Overpass et api.openstreetmap.org : refusées par le proxy (aucun nœud OSM : aiguillages, heurtoirs, PN non disponibles)','data.sncf.com / ressources.data.sncf.com (SNCF Réseau open data) : refusés par le proxy']},
 totals:{tracks:tracks.length,axes:axes.length,splines:S.length,splinePoints:pointsTotal,lengthKm:km(tracks),inCommuneKm:kmC(tracks),axisLengthKm:r3(axes.reduce((s,a)=>s+len(a.l),0)/1000),
  byKind:Object.fromEntries(Object.keys(TYPE).map(k=>[k,{count:tracks.filter(t=>t.kind===k).length,km:km(tracks.filter(t=>t.kind===k)),inCommuneKm:kmC(tracks.filter(t=>t.kind===k))}])),
  byNetwork:{principal:{count:tracks.filter(t=>t.network==='principal').length,km:km(tracks.filter(t=>t.network==='principal')),inCommuneKm:kmC(tracks.filter(t=>t.network==='principal'))},service:{count:tracks.filter(t=>t.network==='service').length,km:km(tracks.filter(t=>t.network==='service')),inCommuneKm:kmC(tracks.filter(t=>t.network==='service'))}},
  byStatus:tracks.reduce((m,t)=>(m[t.status]=(m[t.status]||0)+1,m),{}),statusKnownShareKm:r3(km(tracks.filter(t=>t.status!=='unknown'))/km(tracks)),byProvenance:tracks.reduce((m,t)=>{const k=t.src==='osm'?(t.bdtopoConfirmed?'osm+bdtopo':'osm'):'bdtopo';m[k]=(m[k]||0)+1;return m;},{}),
  zReliableShare:r3(tracks.reduce((s,t)=>s+t.zReliableShare*t.lengthM,0)/tracks.reduce((s,t)=>s+t.lengthM,0)),zStructureShare:r3(tracks.reduce((s,t)=>s+t.zStructureShare*t.lengthM,0)/tracks.reduce((s,t)=>s+t.lengthM,0)),
  inactiveOrRemoved:0,historic:historic.length},
 validation:{osmVsBdtopo:tracks.filter(t=>t.src==='osm').map(t=>({id:t.id,kind:t.kind,medianM:r2(t.bdCover.median),maxM:r2(t.bdCover.max),shareWithin:r2(t.bdCover.share)})),bdtopoOnlyTracks:tracks.filter(t=>t.src==='bdtopo').map(t=>({id:t.id,osmShareWithin2_5m:r2(t.osmCover.share)})),
  mainTrackSpacingM:(()=>{const v=tracks.filter(t=>t.kind==='main');if(v.length<2)return null;const ds=densify(v[0].l,25).map(p=>lineDist(p,v[1].l).d).filter(d=>d<10).sort((a,b)=>a-b);return {min:r2(ds[0]),median:r2(ds[ds.length>>1]),max:r2(ds.at(-1))};})()},
 topology:{nodes:nodes.length,switches:nodes.filter(n=>n.type.startsWith('aiguillage')).length,switchesInCommune:nodes.filter(n=>n.type.startsWith('aiguillage')&&n.inCommune).length,bufferStops:nodes.filter(n=>n.type.startsWith('extrémité')).length,borderEnds:nodes.filter(n=>n.type==='limite d’emprise').length,
  components:new Set(tracks.map(t=>comp.get(t))).size,orphans:orphans.filter(o=>!o.border),orphansCutByBorder:orphans.filter(o=>o.border).length,inferredJoins,nearMisses,duplicates,crossingsWithoutConnection:trackCrossings},
 levelCrossings,structures:{bridges:bridges.map(({a,...b})=>b),hydraulic,overpasses,roadLevelCrossingsOfServiceTracks:levelRoad.filter(e=>!levelCrossings.some(p=>p.road.ids.includes(e.road))).length},
 profile:{aberrantGrades:aberrant,deviations:cuts,pinnedAtSwitches:tracks.filter(t=>t.pinned).map(t=>({id:t.id,pinned:t.pinned}))},historic,land:{osmLanduse:landuse.length,bdtopoEquipment:equipF.map(f=>f.properties)},notes:REV.notes||[]};
report.openIssues={unknownStatus:tracks.filter(t=>t.status==='unknown').map(t=>({id:t.id,kind:t.kind,lengthM:r2(t.lengthM),review:t.review?.observation||null})),orphans:report.topology.orphans,nearMisses,duplicates,crossingsWithoutConnection:trackCrossings,aberrantGrades:aberrant,
 largeDeviations:cuts.filter(c=>Math.abs(c.maxDeviationM)>.6),inferredJoins,unmatchedLevelCrossings:levelCrossings.filter(p=>!p.road.ids.length||!p.tracks.length)};
report.openIssues.count=Object.values(report.openIssues).reduce((s,v)=>s+(Array.isArray(v)?v.length:0),0);
fs.writeFileSync('data-sources/rail/rail-report.json',JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({totals:report.totals,validation:{...report.validation,osmVsBdtopo:undefined},topology:{...report.topology,inferredJoins:inferredJoins.length},levelCrossings:levelCrossings.map(p=>[p.id,p.road.name,p.tracks.length,p.offsetBdtopoM,p.confidence]),
 bridges:report.structures.bridges.map(b=>[b.id,b.lengthM,b.crosses,b.deck]),hydraulic:hydraulic.map(h=>[h.watercourse,h.fosse,h.tracks.length,h.dipBelowRailM,h.confidence]),overpasses:overpasses.map(o=>o.roadName+'/'+o.track),roadLevelService:report.structures.roadLevelCrossingsOfServiceTracks,
 aberrant,deviations:cuts.length,largeDeviations:report.openIssues.largeDeviations.length,open:report.openIssues.count},null,1));
