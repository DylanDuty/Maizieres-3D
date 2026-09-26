import * as THREE from 'three';
// V2.1 ?diagnostic=hydro-audit: official axes (BD TOPO = BD TOPAGE, codes SANDRE), water surfaces (ground texture), BCAE and OSM
// complements, terminal points by class, BD TOPO confluences / diffluences, road and rail crossings, and the V2.1 display
// corrections (3D hedge walls no longer raised over a watercourse).
export const HYDRO_COLORS={permanent:'#00d4ff',intermittent:'#4fdc4f',bcae:'#ffd400',osm:'#ff3dd8','limite de l’emprise':'#ffffff','source (BD TOPO)':'#ff9a1f',
 'exutoire (BD TOPO)':'#ff2a2a','surface en eau':'#2f5bff',suspect:'#ff00aa',Confluent:'#0b3c8c',Diffluent:'#7a2bd1',bridge:'#f5f5f5',culvert:'#b04ad6',correction:'#e8202a'};
export function buildHydroAudit(scene,v2,project,audit){
 const g=new THREE.Group();g.name='hydro-audit';scene.add(g);const y=(x,z,l=1.5)=>v2.heightAt(x,z)+l;
 const lines=(list,color,lift,opacity=1)=>{const pos=[];for(const pts of list)for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];pos.push(a[0],y(a[0],a[1],lift),a[1],b[0],y(b[0],b[1],lift),b[1]);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));const m=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));g.add(m);return m;};
 const pair=p=>{const out=[];for(let i=0;i<p.length;i+=2)out.push([p[i],p[i+1]]);return out;};
 lines(v2.data.waterLines.filter(l=>l.perm).map(l=>pair(l.p)),HYDRO_COLORS.permanent,2.2);lines(v2.data.waterLines.filter(l=>!l.perm).map(l=>pair(l.p)),HYDRO_COLORS.intermittent,2.2);
 lines(audit.bcae.map(c=>c.map(project)),HYDRO_COLORS.bcae,3.2,.85);lines(audit.osm.map(o=>o.coords.map(project)),HYDRO_COLORS.osm,4.2,.85);
 lines(v2.hedgeCuts.map(c=>[[c[0],c[1]],[c[2],c[3]]]),HYDRO_COLORS.correction,5);
 const pins=(list,color,h,r=5)=>{if(!list.length)return;const mesh=new THREE.InstancedMesh(new THREE.ConeGeometry(r,h,8),new THREE.MeshBasicMaterial({color}),list.length),m=new THREE.Matrix4();
  list.forEach((q,i)=>{const [x,z]=project(q.lonlat);m.makeRotationX(Math.PI);m.setPosition(x,y(x,z,h/2+1),z);mesh.setMatrixAt(i,m);});g.add(mesh);};
 for(const cls of ['limite de l’emprise','source (BD TOPO)','exutoire (BD TOPO)','surface en eau'])pins(audit.terminals.filter(t=>t.cls===cls&&!t.suspect),HYDRO_COLORS[cls],cls==='limite de l’emprise'?16:28);
 pins(audit.terminals.filter(t=>t.suspect),HYDRO_COLORS.suspect,40,8);
 for(const cat of ['Confluent','Diffluent'])pins(audit.nodes.filter(n=>n.cat===cat),HYDRO_COLORS[cat],14,3.5);
 pins(audit.crossings.filter(c=>/pont/.test(c.kind)),HYDRO_COLORS.bridge,16,4);pins(audit.crossings.filter(c=>!/pont/.test(c.kind)),HYDRO_COLORS.culvert,16,4);
 const c=audit.counts,d=audit.display,legend=document.createElement('div');legend.id='diagnostic-legend';
 const items=[['permanent','Axe permanent BD TOPO (BD TOPAGE, codes SANDRE)'],['intermittent','Axe intermittent BD TOPO'],['bcae',`BCAE 2026 (${audit.bcae.length} lignes)`],['osm',`OSM (${audit.osm.length} voies d’eau)`],
  ['limite de l’emprise',`Sortie de l’emprise · ${c.byClass['limite de l’emprise']||0}`],['source (BD TOPO)',`Source BD TOPO · ${c.byClass['source (BD TOPO)']||0}`],['exutoire (BD TOPO)',`Exutoire BD TOPO · ${c.byClass['exutoire (BD TOPO)']||0}`],['surface en eau',`Arrivée dans une surface en eau · ${c.byClass['surface en eau']||0}`],
  ['suspect',`Point terminal ou écart suspect · ${c.suspects}`],['Confluent','Confluent BD TOPO'],['Diffluent','Diffluent BD TOPO'],['bridge','Pont (route, rail)'],['culvert','Buse ou ouvrage non documenté'],['correction',`Correction V2.1 : haie 3D retirée au-dessus de l’eau · ${Math.round(v2.stats.hedges.wallsCutOverWaterM)} m`]];
 legend.innerHTML=items.map(([k,v])=>`<span><i style="background:${HYDRO_COLORS[k]}"></i>${v}</span>`).join('')+`<span>${c.lines} tronçons · ${c.km} km · ${c.components} composantes connexes · ${c.terminals} extrémités libres · ${c.crossings} franchissements</span><span>Eau masquée à l’écran : V2.0.1 ${d.hiddenKm.byHedgeTextureV201} km (texture) · V2.1 ${d.hiddenKm.byHedgeTextureV21} km</span>`;
 document.body.appendChild(legend);return {group:g,counts:c};
}
