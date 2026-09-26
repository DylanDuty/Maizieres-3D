// V2.1 geographic audit helpers: planar geometry in Lambert-93 metres (points [E, N]), spatial grid index.
export const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export const lineDist=(p,l)=>{let d=Infinity;for(let i=1;i<l.length;i++){const v=segDist(p,l[i-1],l[i]);if(v<d)d=v;}return l.length===1?Math.hypot(p[0]-l[0][0],p[1]-l[0][1]):d;};
export const lineLength=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
export const inRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
export const inPoly=(p,poly)=>inRing(p,poly[0])&&!poly.slice(1).some(h=>inRing(p,h));
export const polyDist=(p,poly)=>inPoly(p,poly)?0:Math.min(...poly.map(r=>lineDist(p,r)));
export const bboxOf=pts=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of pts){if(q[0]<b[0])b[0]=q[0];if(q[1]<b[1])b[1]=q[1];if(q[0]>b[2])b[2]=q[0];if(q[1]>b[3])b[3]=q[1];}return b;};
// Samples every `step` metres along a line (with the vertices).
export function densify(l,step){const out=[l[0]];for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;}
// Grid index of objects with a bbox `b`; query(point or bbox, margin) returns candidates.
export function gridIndex(items,size=100){const g=new Map(),key=(x,y)=>x+','+y;
 for(const it of items){const b=it.b;for(let x=Math.floor(b[0]/size);x<=Math.floor(b[2]/size);x++)for(let y=Math.floor(b[1]/size);y<=Math.floor(b[3]/size);y++){const k=key(x,y);if(!g.has(k))g.set(k,[]);g.get(k).push(it);}}
 return (q,m=0)=>{const b=q.length===2?[q[0],q[1],q[0],q[1]]:q,out=new Set();for(let x=Math.floor((b[0]-m)/size);x<=Math.floor((b[2]+m)/size);x++)for(let y=Math.floor((b[1]-m)/size);y<=Math.floor((b[3]+m)/size);y++)for(const it of g.get(key(x,y))||[])out.add(it);return [...out];};}
export const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
