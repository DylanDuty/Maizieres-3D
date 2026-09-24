import * as THREE from 'three';
// Four shared light bands: a tiny texture, no full-screen pass or black outlines.
const ramp=new THREE.DataTexture(new Uint8Array([74,132,202,255]),4,1,THREE.RedFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
export function toon(options={}){return new THREE.MeshToonMaterial({gradientMap:ramp,...options});}
export function crownGeometry(){
 const g=new THREE.SphereGeometry(1,10,5),p=g.getAttribute('position'),colors=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),theta=Math.atan2(z,x),lobes=1+.17*Math.cos(theta*3+.6)*(1-y*y);p.setXYZ(i,x*lobes,y*.92+.08*(1-y*y),z*lobes);const light=.82+.18*(y+1)/2;colors.push(light,light*.99,light*.95);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
