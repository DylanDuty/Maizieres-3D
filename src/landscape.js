import * as THREE from 'three';
import {toon,crownGeometry as sculptedCrown} from './art.js';
import {Batch,material,strip,sampleLine,clipRing,clipLine} from './geometry.js';
import {polygons,lines,insidePoly,roadWidth,bounds,random} from './geo.js';
function fieldTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,128);for(let x=0;x<128;x+=64){ctx.fillStyle='#e0e2d8';ctx.fillRect(x,0,25,128);ctx.fillStyle='#f5f1df';ctx.fillRect(x+26,0,3,128);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
export function buildLandscape(scene,data,project,extent,ignLandscape={features:[]}){
  const rng=random(),surfaces=new Batch(material()),fields=new Batch(material({map:fieldTexture()})),roads=new Batch(material()),markings=new Batch(material()),rail=new Batch(material({metalness:.4,roughness:.7})),water=new Batch(material({roughness:.35,metalness:.12}));
  const width=extent.maxX-extent.minX,depth=extent.maxZ-extent.minZ;
  const base=new THREE.Mesh(new THREE.BoxGeometry(width,22,depth),toon({color:'#b3b67e'}));base.position.set((extent.minX+extent.maxX)/2,-11,(extent.minZ+extent.maxZ)/2);base.receiveShadow=true;scene.add(base);
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
    if(t.natural==='water'||t.waterway==='riverbank'||t.landuse==='reservoir'){water.polygon(poly,.10,'#77b5c5');maskPoly(poly);}
    else if(['forest','wood','scrub'].includes(kind)){surfaces.polygon(poly,.025,kind==='scrub'?'#7d9c66':'#688e5c');wooded.push({poly,scrub:kind==='scrub'});}
    else if(['farmland','orchard','vineyard'].includes(kind)){const color=['#d7bf72','#cdbc81','#789b60','#ddbf84','#a9be75','#b59876'][Math.floor(rng()*6)];const before=fields.uv.length;fields.polygon(poly,.03,color);let longest=0,angle=0;for(let j=1;j<poly[0].length;j++){const a=poly[0][j-1],b=poly[0][j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>longest){longest=length;angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}}const co=Math.cos(angle),si=Math.sin(angle),scale=12+rng()*8;for(let i=before;i<fields.uv.length;i+=2){const x=fields.uv[i],z=fields.uv[i+1];fields.uv[i]=(x*co-z*si)/scale;fields.uv[i+1]=(x*si+z*co)/scale;}}
    else if(kind==='farmyard')surfaces.polygon(poly,.04,'#b9b19a');
    else if(kind==='residential'){surfaces.polygon(poly,.035,'#b5c68b');gardens.push(poly);}
    else if(['industrial','commercial','retail','railway','military'].includes(kind))surfaces.polygon(poly,.04,'#bdb9a8');
    else if(['grass','meadow','grassland','village_green','recreation_ground','park','garden','cemetery'].includes(kind))surfaces.polygon(poly,.045,'#a7c27e');
    else if(kind==='pitch'||kind==='sports_centre'){surfaces.polygon(poly,.06,'#84ad80');if(kind==='pitch'){maskPoly(poly);const pts=[...poly[0],poly[0][0]];strip(markings,pts,.18,.08,'#e7e6d2');const b=bounds(poly[0]);if((b.maxX-b.minX)*(b.maxZ-b.minZ)>2500){const z=(b.minZ+b.maxZ)/2;strip(markings,[[b.minX+2,z],[b.maxX-2,z]],.15,.085,'#e7e6d2');}}}
    if(t.amenity==='parking'){surfaces.polygon(poly,.09,'#b9b9ae');maskPoly(poly);}
    if(t.name&&['sports_centre','stadium'].includes(t.leisure)){landmarks.push({name:t.name,position:[(b.minX+b.maxX)/2,5,(b.minZ+b.maxZ)/2]});}
  }
  }
  for(const f of data.features){const t=f.properties;for(const raw of lines(f,project))for(const pts of clipLine(raw,extent)){
    if(t.highway&&!['proposed','construction'].includes(t.highway)){
      const w=Math.min(20,Math.max(1,roadWidth(t))),path=['path','footway','track','cycleway','steps','bridleway'].includes(t.highway);
      strip(roads,pts,w+1.6,.115,path?'#bdb69e':'#efe2c1');strip(roads,pts,w,.15,path?'#c4baa0':'#a5a7a7');
      // Discs close joins and form simple, gap-free intersections.
      for(const p of pts){const r=[];for(let j=0;j<10;j++)r.push([p[0]+Math.cos(j*Math.PI/5)*w/2,p[1]+Math.sin(j*Math.PI/5)*w/2]);roads.polygon([r],.152,path?'#c4baa0':'#a5a7a7');}
      if(['primary','secondary','tertiary','trunk'].includes(t.highway)){sampleLine(pts,14,(p,angle)=>{const dx=Math.sin(angle)*2,dz=Math.cos(angle)*2;strip(markings,[[p[0]-dx,p[1]-dz],[p[0]+dx,p[1]+dz]],.17,.18,'#e2dfc9');});}
      maskLine(pts,w);roadsCount++;
    }
    if(t.railway==='rail'){
      strip(roads,pts,4.5,.23,'#8b897d');strip(rail,pts,.12,.46,'#4f5754',.7175);strip(rail,pts,.12,.46,'#4f5754',-.7175);sampleLine(pts,2.2,(p,a)=>sleepers.push({p,a}));maskLine(pts,6);railCount++;
    }
    if(t.waterway&&!['dam','weir'].includes(t.waterway)){const w=parseFloat(t.width)||({river:13,stream:4,ditch:1.5,canal:7}[t.waterway]||3);strip(surfaces,pts,w+4,.07,'#94a180');strip(water,pts,w,.10,'#77b5c5');maskLine(pts,w);}
    if(t.barrier==='hedge'){sampleLine(pts,4,(p,a)=>hedges.push({p,a}));}
  }}
  let ignHedges=0;
  // Supplementary IGN vegetation preserves all original OSM land polygons and transport lines.
  for(const f of ignLandscape.features)for(const raw of polygons(f,project)){
    const poly=clipped(raw);if(!poly.length)continue;
    if(f.properties.nature==='Haie'){
      surfaces.polygon(poly,1.65,'#91ab65');
      for(const r of poly)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];surfaces.quad([a[0],.08,a[1]],[b[0],.08,b[1]],[b[0],1.65,b[1]],[a[0],1.65,a[1]],'#638967');}
      maskPoly(poly);ignHedges++;
    }else{wooded.unshift({poly,scrub:false,ign:true,poplar:f.properties.nature==='Peupleraie'});}
  }
  surfaces.mesh(scene);fields.mesh(scene);roads.mesh(scene);markings.mesh(scene);water.mesh(scene);rail.mesh(scene);
  const matrix=new THREE.Object3D();
  const ties=new THREE.InstancedMesh(new THREE.PlaneGeometry(2.5,.24).rotateX(-Math.PI/2),toon({color:'#736954',side:THREE.DoubleSide}),sleepers.length);sleepers.forEach(({p,a},i)=>{matrix.position.set(p[0],.32,p[1]);matrix.rotation.set(0,a,0);matrix.updateMatrix();ties.setMatrixAt(i,matrix.matrix);});scene.add(ties);
  const pixels=ctx.getImageData(0,0,2048,2048).data;
  const blocked=p=>{const x=Math.floor(mx(p[0])),z=Math.floor(mz(p[1]));return x<0||x>=2048||z<0||z>=2048||pixels[(z*2048+x)*4+3]>0;};
  const trees=[],occupied=new Set();
  const nearVillage=p=>Math.min(Math.hypot(p[0],p[1]),Math.hypot(p[0]-1150,p[1]+600));
  const addTree=(p,h,poplar=false,real=false)=>{const key=`${Math.round(p[0]/7)},${Math.round(p[1]/7)}`;if((real||trees.length<3200)&&!blocked(p)&&!occupied.has(key)){trees.push({p,h,poplar});occupied.add(key);}};
  // Real tree points have priority; procedural gardens before peripheral woodland.
  for(const f of data.features)if(f.properties.natural==='tree'&&f.geometry.type==='Point')addTree(project(f.geometry.coordinates),8,false,true);
  for(const poly of gardens){const b=bounds(poly[0]);for(let x=b.minX;x<b.maxX;x+=38)for(let z=b.minZ;z<b.maxZ;z+=38){const p=[x+rng()*38,z+rng()*38];if(rng()>.48&&insidePoly(p,poly))addTree(p,5+rng()*5);}}
  wooded.sort((a,b)=>{const center=o=>{const b=bounds(o.poly[0]);return nearVillage([(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2]);};return center(a)-center(b);});
  for(const {poly,scrub,poplar} of wooded){const b=bounds(poly[0]),distance=nearVillage([(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2]),step=scrub?62:distance<1100?42:distance<1900?60:83;for(let x=b.minX;x<b.maxX;x+=step)for(let z=b.minZ;z<b.maxZ;z+=step){const p=[x+rng()*step,z+rng()*step];if(insidePoly(p,poly))addTree(p,scrub?4+rng()*4:poplar?13+rng()*5:9+rng()*7,poplar);}}
  const crownGeometry=sculptedCrown();
  const crowns=new THREE.InstancedMesh(crownGeometry,toon({vertexColors:true}),trees.length);
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.23,.35,1,5,1,true),toon({color:'#887254'}),trees.length);
  const leafColors=['#739e5e','#9fb867','#548972','#b5c67b','#83ad87'];
  trees.forEach(({p,h,poplar},i)=>{matrix.position.set(p[0],h*.64,p[1]);matrix.rotation.set(0,rng()*6,0);const broad=poplar?.19:.39+(i%3)*.025;matrix.scale.set(h*broad,h*(poplar?.48:.37),h*broad*.94);matrix.updateMatrix();crowns.setMatrixAt(i,matrix.matrix);crowns.setColorAt(i,new THREE.Color(leafColors[i%leafColors.length]));matrix.position.y=h*.27;matrix.scale.set(1,h*.55,1);matrix.updateMatrix();trunks.setMatrixAt(i,matrix.matrix);});
  crowns.castShadow=false;crowns.receiveShadow=false;trunks.castShadow=false;scene.add(crowns,trunks);
  const hedgeMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.6,1.8,4.1),toon({color:'#64894e'}),hedges.length);hedges.forEach(({p,a},i)=>{matrix.position.set(p[0],.9,p[1]);matrix.rotation.set(0,a,0);matrix.scale.set(1,1,1);matrix.updateMatrix();hedgeMesh.setMatrixAt(i,matrix.matrix);});scene.add(hedgeMesh);
  return {buildings,landmarks,stats:{ignHedges,roads:roadsCount,railways:railCount,trees:trees.length,sleepers:sleepers.length}};
}

