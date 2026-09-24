import * as THREE from 'three';
import {toon,paintedGround,fieldMosaic,canopyGround,crownGeometry,palette as P} from './art.js';
import {Batch,material,strip,sampleLine,clipRing,clipLine} from './geometry.js';
import {polygons,lines,insidePoly,roadWidth,bounds,random} from './geo.js';
export const TREE_LIMIT=2900;
export function buildLandscape(scene,data,project,extent,ignLandscape={features:[]}){
  const rng=random(),surfaces=new Batch(paintedGround({vertexColors:true,side:THREE.DoubleSide})),fields=new Batch(fieldMosaic()),roads=new Batch(material()),markings=new Batch(material()),rail=new Batch(material()),water=new Batch(material()),woods=new Batch(canopyGround());
  const width=extent.maxX-extent.minX,depth=extent.maxZ-extent.minZ,cx=(extent.minX+extent.maxX)/2,cz=(extent.minZ+extent.maxZ)/2;
  // Ground of the mapped extent, plus a hazy apron beyond it so the horizon is not a cut box edge.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2),paintedGround({color:P.meadow}));ground.position.set(cx,0,cz);ground.receiveShadow=true;scene.add(ground);
  const apronShape=new THREE.Shape([[-30000,-30000],[30000,-30000],[30000,30000],[-30000,30000]].map(p=>new THREE.Vector2(...p)));apronShape.holes.push(new THREE.Path([[-width/2,-depth/2],[-width/2,depth/2],[width/2,depth/2],[width/2,-depth/2]].map(p=>new THREE.Vector2(...p))));
  const apron=new THREE.Mesh(new THREE.ShapeGeometry(apronShape).rotateX(Math.PI/2),paintedGround({color:'#bfca95',side:THREE.DoubleSide}));apron.position.set(cx,-.05,cz);scene.add(apron);
  // Low-resolution exclusion mask prevents procedural trees from occupying real buildings, roads or water.
  const mask=document.createElement('canvas');mask.width=mask.height=2048;const ctx=mask.getContext('2d',{willReadFrequently:true});const mx=x=>(x-extent.minX)/width*2048,mz=z=>(z-extent.minZ)/depth*2048;
  function maskPoly(poly){ctx.beginPath();for(const ring of poly){ring.forEach((p,i)=>i?ctx.lineTo(mx(p[0]),mz(p[1])):ctx.moveTo(mx(p[0]),mz(p[1])));ctx.closePath();}ctx.fill('evenodd');ctx.lineWidth=4;ctx.stroke();}
  function maskLine(pts,w){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(mx(p[0]),mz(p[1])):ctx.moveTo(mx(p[0]),mz(p[1])));ctx.lineWidth=(w+9)/width*2048;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  const wooded=[],gardens=[],buildings=[],sleepers=[],hedges=[],landmarks=[];let roadsCount=0,railCount=0;
  const clipped=poly=>poly.map(r=>clipRing(r,extent)).filter(r=>r.length>=3);
  for(const f of data.features){const t=f.properties;for(const raw of polygons(f,project)){
    const poly=clipped(raw);if(!poly.length)continue;
    const b=bounds(raw[0]);if(t.building){const cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;if(cx<extent.minX||cx>extent.maxX||cz<extent.minZ||cz>extent.maxZ)continue;buildings.push({poly,t,id:f.id});maskPoly(poly);continue;}
    const kind=t.landuse||t.natural||t.leisure;
    if(t.natural==='water'||t.waterway==='riverbank'||t.landuse==='reservoir'||t.landuse==='basin'||t.leisure==='swimming_pool'){water.polygon(poly,.10,P.water);maskPoly(poly);}
    else if(['forest','wood','scrub'].includes(kind)){woods.polygon(poly,.025,kind==='scrub'?P.scrub:P.wood);wooded.push({poly,scrub:kind==='scrub'});}
    else if(['farmland','orchard','vineyard'].includes(kind)){fields.polygon(poly,.03,'#ffffff');}
    else if(kind==='farmyard')surfaces.polygon(poly,.04,P.yard);
    else if(kind==='residential'){surfaces.polygon(poly,.035,P.lawn);gardens.push(poly);}
    else if(['industrial','commercial','retail','railway','military'].includes(kind))surfaces.polygon(poly,.04,P.activity);
    else if(['grass','meadow','grassland','village_green','recreation_ground','park','garden','cemetery'].includes(kind))surfaces.polygon(poly,.045,kind==='cemetery'?'#b3c08f':'#aecb7e');
    else if(kind==='pitch'||kind==='sports_centre'){surfaces.polygon(poly,.06,P.pitch);if(kind==='pitch'){maskPoly(poly);const pts=[...poly[0],poly[0][0]];strip(markings,pts,.22,.08,P.line);const b=bounds(poly[0]);if((b.maxX-b.minX)*(b.maxZ-b.minZ)>2500){const z=(b.minZ+b.maxZ)/2;strip(markings,[[b.minX+2,z],[b.maxX-2,z]],.2,.085,P.line);}}}
    if(t.amenity==='parking'){surfaces.polygon(poly,.09,'#c4c3ba');maskPoly(poly);}
    if(t.name&&['sports_centre','stadium'].includes(t.leisure)){landmarks.push({name:t.name,position:[(b.minX+b.maxX)/2,5,(b.minZ+b.maxZ)/2]});}
  }
  }
  for(const f of data.features){const t=f.properties;for(const raw of lines(f,project))for(const pts of clipLine(raw,extent)){
    if(t.highway&&!['proposed','construction'].includes(t.highway)){
      const w=Math.min(20,Math.max(1,roadWidth(t))),path=['path','footway','track','cycleway','steps','bridleway'].includes(t.highway),main=['primary','secondary','tertiary','trunk'].includes(t.highway);
      // Light verge/pavement, then the carriageway: readable from far away, soft up close.
      strip(roads,pts,w+(path?1.2:main?3.2:2.4),.115,path?P.trackEdge:P.asphaltEdge);strip(roads,pts,w,.15,path?P.track:main?'#91959b':P.asphalt);
      // Discs close joins and form simple, gap-free intersections.
      for(const p of pts){const r=[];for(let j=0;j<8;j++)r.push([p[0]+Math.cos(j*Math.PI/4)*w/2,p[1]+Math.sin(j*Math.PI/4)*w/2]);roads.polygon([r],.152,path?P.track:main?'#91959b':P.asphalt);}
      if(main){sampleLine(pts,14,(p,angle)=>{const dx=Math.sin(angle)*2.2,dz=Math.cos(angle)*2.2;strip(markings,[[p[0]-dx,p[1]-dz],[p[0]+dx,p[1]+dz]],.2,.18,'#f6f1dc');});}
      maskLine(pts,w);roadsCount++;
    }
    if(t.railway==='rail'){
      strip(roads,pts,5,.2,'#b3a896');strip(roads,pts,3.6,.23,'#9a8f80');strip(rail,pts,.14,.46,'#5d5f66',.7175);strip(rail,pts,.14,.46,'#5d5f66',-.7175);sampleLine(pts,2.2,(p,a)=>sleepers.push({p,a}));maskLine(pts,6);railCount++;
    }
    if(t.waterway&&!['dam','weir'].includes(t.waterway)){const w=parseFloat(t.width)||({river:13,stream:4,ditch:1.5,canal:7}[t.waterway]||3);strip(surfaces,pts,w+4,.07,P.waterEdge);strip(water,pts,w,.10,P.water);maskLine(pts,w);}
    if(t.barrier==='hedge'){sampleLine(pts,4,(p,a)=>hedges.push({p,a}));}
  }}
  let ignHedges=0;
  // Supplementary IGN vegetation preserves all original OSM land polygons and transport lines.
  for(const f of ignLandscape.features)for(const raw of polygons(f,project)){
    const poly=clipped(raw);if(!poly.length)continue;
    if(f.properties.nature==='Haie'){
      surfaces.polygon(poly,1.65,P.hedge);
      for(const r of poly)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];surfaces.quad([a[0],.08,a[1]],[b[0],.08,b[1]],[b[0],1.65,b[1]],[a[0],1.65,a[1]],P.hedgeSide);}
      maskPoly(poly);ignHedges++;
    }else{woods.polygon(poly,.028,f.properties.nature==='Peupleraie'?'#7fa55c':P.wood);wooded.unshift({poly,scrub:false,ign:true,poplar:f.properties.nature==='Peupleraie'});}
  }
  surfaces.mesh(scene);woods.mesh(scene);fields.mesh(scene);roads.mesh(scene);markings.mesh(scene);water.mesh(scene);rail.mesh(scene);
  const matrix=new THREE.Object3D();
  const ties=new THREE.InstancedMesh(new THREE.PlaneGeometry(2.5,.24).rotateX(-Math.PI/2),toon({color:'#7b6c58',side:THREE.DoubleSide}),sleepers.length);sleepers.forEach(({p,a},i)=>{matrix.position.set(p[0],.3,p[1]);matrix.rotation.set(0,a,0);matrix.updateMatrix();ties.setMatrixAt(i,matrix.matrix);});scene.add(ties);
  const pixels=ctx.getImageData(0,0,2048,2048).data;
  const blocked=p=>{const x=Math.floor(mx(p[0])),z=Math.floor(mz(p[1]));return x<0||x>=2048||z<0||z>=2048||pixels[(z*2048+x)*4+3]>0;};
  const trees=[],occupied=new Set();
  const nearVillage=p=>Math.min(Math.hypot(p[0],p[1]),Math.hypot(p[0]-1150,p[1]+600));
  const addTree=(p,h,type='round',real=false)=>{const key=`${Math.round(p[0]/7)},${Math.round(p[1]/7)}`;if((real||trees.length<TREE_LIMIT)&&!blocked(p)&&!occupied.has(key)){trees.push({p,h,type});occupied.add(key);}};
  // Real tree points have priority; procedural gardens before peripheral woodland.
  for(const f of data.features)if(f.properties.natural==='tree'&&f.geometry.type==='Point')addTree(project(f.geometry.coordinates),8,'round',true);
  for(const poly of gardens){const b=bounds(poly[0]);for(let x=b.minX;x<b.maxX;x+=38)for(let z=b.minZ;z<b.maxZ;z+=38){const p=[x+rng()*38,z+rng()*38];if(rng()>.48&&insidePoly(p,poly))addTree(p,5+rng()*5,rng()<.12?'poplar':'round');}}
  wooded.sort((a,b)=>{const center=o=>{const b=bounds(o.poly[0]);return nearVillage([(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2]);};return center(a)-center(b);});
  for(const {poly,scrub,poplar} of wooded){const b=bounds(poly[0]),distance=nearVillage([(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2]),step=scrub?62:distance<1100?42:distance<1900?60:83;for(let x=b.minX;x<b.maxX;x+=step)for(let z=b.minZ;z<b.maxZ;z+=step){const p=[x+rng()*step,z+rng()*step];if(insidePoly(p,poly))addTree(p,scrub?4+rng()*4:poplar?15+rng()*5:12+rng()*7+step*.09,scrub?'bush':poplar?'poplar':'wood');}}
  // Two shared crown shapes (round and columnar), each a single InstancedMesh without shadows.
  const leaf=['#6f9d4f','#7ea957','#5f9151','#88b05b','#6a9446','#94b865'],poplarLeaf=['#6e9a48','#7aa451','#658f45'];
  const round=trees.filter(t=>t.type!=='poplar'),tall=trees.filter(t=>t.type==='poplar');
  const crowns=new THREE.InstancedMesh(crownGeometry({lobes:5,flatten:.86}),toon({vertexColors:true}),round.length);
  const columns=new THREE.InstancedMesh(crownGeometry({lobes:3,flatten:1,seed:1.3}),toon({vertexColors:true}),tall.length);
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.34,1,5,1,true),toon({color:'#8a6d4e'}),trees.length);
  const color=new THREE.Color();let ti=0;
  round.forEach(({p,h,type},i)=>{const s=type==='bush'?.52:type==='wood'?.52:.4+(i%3)*.03,lift=type==='bush'?.42:.62;matrix.position.set(p[0],h*lift,p[1]);matrix.rotation.set(0,rng()*6,0);matrix.scale.set(h*s,h*(type==='bush'?.36:.4),h*s*.95);matrix.updateMatrix();crowns.setMatrixAt(i,matrix.matrix);crowns.setColorAt(i,color.set(leaf[(i*7+Math.floor(p[0]))%leaf.length]).offsetHSL(0,0,(rng()-.5)*.05));if(type!=='bush'){matrix.position.y=h*.24;matrix.scale.set(1,h*.5,1);matrix.updateMatrix();trunks.setMatrixAt(ti++,matrix.matrix);}});
  tall.forEach(({p,h},i)=>{matrix.position.set(p[0],h*.6,p[1]);matrix.rotation.set(0,rng()*6,0);matrix.scale.set(h*.16,h*.46,h*.16);matrix.updateMatrix();columns.setMatrixAt(i,matrix.matrix);columns.setColorAt(i,color.set(poplarLeaf[i%poplarLeaf.length]));matrix.position.y=h*.2;matrix.scale.set(.8,h*.4,.8);matrix.updateMatrix();trunks.setMatrixAt(ti++,matrix.matrix);});
  trunks.count=ti;
  for(const m of [crowns,columns,trunks]){m.castShadow=false;m.receiveShadow=false;}scene.add(crowns,columns,trunks);
  const hedgeMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.6,1.8,4.1),toon({color:P.hedge}),hedges.length);hedges.forEach(({p,a},i)=>{matrix.position.set(p[0],.9,p[1]);matrix.rotation.set(0,a,0);matrix.scale.set(1,1,1);matrix.updateMatrix();hedgeMesh.setMatrixAt(i,matrix.matrix);});scene.add(hedgeMesh);
  return {buildings,landmarks,stats:{ignHedges,roads:roadsCount,railways:railCount,trees:trees.length,sleepers:sleepers.length}};
}
