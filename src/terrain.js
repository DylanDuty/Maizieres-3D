import * as THREE from 'three';

// V1.7 technical terrain (?diagnostic=terrain only). Real IGN LiDAR HD relief at true scale (no exaggeration), sampled on a
// 10 m working grid in the local frame of geo.js. y = altitude NGF − yReference (terrain altitude at the common origin).
// V2.0 passes name='v2-terrain' (same encoding, whole V1.7 extent); the V1.7 diagnostic keeps terrain-threejs.
export async function loadTerrain(base,name='terrain-threejs'){
 const [meta,bin,elevation]=await Promise.all([fetch(`${base}data/${name}.json`).then(r=>r.json()),fetch(`${base}data/${name}.bin`).then(r=>r.arrayBuffer()),fetch(`${base}data/building-terrain-elevation.json`).then(r=>r.json())]);
 const data=new Uint16Array(bin),alt=(c,r)=>{const v=data[r*meta.cols+c];return v===65535?NaN:meta.zBase+v/100;};
 // Bilinear altitude (NGF metres) at local (x, z); NaN outside the grid or on NoData.
 const sample=(x,z)=>{const fx=(x-meta.x0)/meta.step,fz=(z-meta.z0)/meta.step,c=Math.floor(fx),r=Math.floor(fz);if(c<0||r<0||c>=meta.cols-1||r>=meta.rows-1)return NaN;const u=fx-c,w=fz-r;return (alt(c,r)*(1-u)+alt(c+1,r)*u)*(1-w)+(alt(c,r+1)*(1-u)+alt(c+1,r+1)*u)*w;};
 return {meta,data,alt,sample,elevation};
}

// Hypsometric ramp, 100 m grid and 5 m contour lines drawn in the shader; NoData vertices in magenta.
export function buildTerrainDiagnostic(scene,terrain){
 const {meta,alt}=terrain,{cols,rows,step,x0,z0,yReference}=meta,pos=new Float32Array(cols*rows*3),col=new Float32Array(cols*rows*3);
 let min=Infinity,max=-Infinity,noData=0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const v=alt(c,r);if(v===v){min=Math.min(min,v);max=Math.max(max,v);}}
 const ramp=[[0,'#2f6b4f'],[.35,'#8fb56a'],[.65,'#d8c77a'],[1,'#a8683c']].map(([t,c])=>[t,new THREE.Color(c)]),tmp=new THREE.Color();
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,v=alt(c,r);pos[k*3]=x0+c*step;pos[k*3+2]=z0+r*step;
  if(v!==v){noData++;pos[k*3+1]=0;col.set([1,0,1],k*3);continue;}pos[k*3+1]=v-yReference;
  const t=(v-min)/(max-min);let i=1;while(i<ramp.length-1&&ramp[i][0]<t)i++;tmp.copy(ramp[i-1][1]).lerp(ramp[i][1],(t-ramp[i-1][0])/(ramp[i][0]-ramp[i-1][0]));col.set([tmp.r,tmp.g,tmp.b],k*3);}
 const index=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,d=a+cols,e=d+1;index.push(a,d,b,b,d,e);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(index);g.computeVertexNormals();
 const material=new THREE.MeshLambertMaterial({vertexColors:true});
 material.onBeforeCompile=shader=>{shader.uniforms.yRef={value:yReference};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrain;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrain=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrain;\nuniform float yRef;\nfloat gridLine(float v,float period,float width){float d=abs(fract(v/period+.5)-.5)*period;return 1.-smoothstep(0.,width*fwidth(v),d);}')
   .replace('#include <dithering_fragment>','#include <dithering_fragment>\nfloat grid=max(gridLine(vTerrain.x,100.,1.2),gridLine(vTerrain.z,100.,1.2));float contour=gridLine(vTerrain.y+yRef,5.,1.);\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.12,.1,.08),max(grid*.55,contour*.35));');};
 const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;mesh.name='terrain-diagnostic';scene.add(mesh);
 return {mesh,stats:{vertices:cols*rows,triangles:index.length/3,step,min:+min.toFixed(2),max:+max.toFixed(2),noData,yReference}};
}
