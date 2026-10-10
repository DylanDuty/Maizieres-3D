import * as THREE from 'three';
import {paintGround,GROUND_GRAIN} from '../v26/ground-v26.js';
import {toon} from '../v26/toon-materials.js';

// V2.7 — the whole-commune ground: the V2.4 terrain mesh (10 m LiDAR grid, altitudes untouched, painted hillshade kept as
// vertex colour) receives a new canvas painted with the V2.6 illustrated palette over the full extent, and the toon
// material. Nothing is rebuilt: only the texture and the material change.
export function buildGroundV27(v2,{size=4096}){
 const mesh=v2.group.getObjectByName('v2-terrain');if(!mesh)return null;
 const g=mesh.geometry,pos=g.getAttribute('position');let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);if(x<minX)minX=x;if(x>maxX)maxX=x;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;}
 const box={minX,maxX,minZ,maxZ},W=maxX-minX,D=maxZ-minZ,canvas=document.createElement('canvas'),w=size,h=Math.round(size*D/W);canvas.width=w;canvas.height=h;
 paintGround(canvas.getContext('2d'),{d:v2.data,box,w,h,seed:2027});
 const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const old=mesh.material;mesh.material=toon(new THREE.MeshLambertMaterial({map:texture,vertexColors:true}),'ground',GROUND_GRAIN);old.dispose?.();
 return {mesh,box,texture:{width:w,height:h,metresPerPixel:+(W/w).toFixed(2)},vertices:pos.count};
}
