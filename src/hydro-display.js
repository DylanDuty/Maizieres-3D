// V2.1: keeps real watercourses visible in the V2 view. Riparian hedges of the DSB inventory follow the stream axis (their band can be
// tens of metres wide): drawn over the water they made the Ruisseau des Moulins de Poussey vanish and reappear. Water is therefore
// drawn after the hedges in the ground texture, and no 3D hedge wall is raised over a watercourse (axis ± half width + margin) or
// over a water surface. Data are unchanged; only the display is.
export function waterProximity(waterLines,water,cell=40){
 const grid=new Map(),key=(i,j)=>i+','+j,add=(i,j,v)=>{const k=key(i,j);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(v);};
 for(const l of waterLines){const p=l.p,h=(l.w||4)/2;for(let i=2;i<p.length;i+=2){const a=[p[i-2],p[i-1]],b=[p[i],p[i+1]],r=h+10;
  for(let x=Math.floor((Math.min(a[0],b[0])-r)/cell);x<=Math.floor((Math.max(a[0],b[0])+r)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-r)/cell);z<=Math.floor((Math.max(a[1],b[1])+r)/cell);z++)add(x,z,{a,b,h});}}
 const polys=water.flatMap(o=>o.r.map(p=>p.map(r=>{const out=[];for(let i=0;i<r.length;i+=2)out.push([r[i],r[i+1]]);return out;})));
 const pb=polys.map(p=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const [x,z] of p[0]){b=[Math.min(b[0],x),Math.min(b[1],z),Math.max(b[2],x),Math.max(b[3],z)];}return b;});
 const inRing=(x,z,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>z)!==(r[j][1]>z)&&x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
 const seg=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,t=L?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);};
 // true when (x, z) lies within `margin` metres of a watercourse bank, or inside a water surface.
 return (x,z,margin=0)=>{for(const s of grid.get(key(Math.floor(x/cell),Math.floor(z/cell)))||[])if(seg(x,z,s.a,s.b)<=s.h+margin)return true;
  for(let k=0;k<polys.length;k++){const b=pb[k];if(x<b[0]||x>b[2]||z<b[1]||z>b[3])continue;if(inRing(x,z,polys[k][0])&&!polys[k].slice(1).some(h=>inRing(x,z,h)))return true;}return false;};
}
export const HEDGE_WATER_MARGIN=1;
