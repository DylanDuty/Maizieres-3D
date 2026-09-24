export const R = 6371008.8;
export function projection(origin) {
  const k=R*Math.PI/180, c=Math.cos(origin[1]*Math.PI/180);
  return ([lon,lat])=>[(lon-origin[0])*k*c,-(lat-origin[1])*k];
}
export function polygons(feature,project) {
  const g=feature.geometry;
  return (g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).map(poly=>poly.map(r=>r.map(project)));
}
export function lines(feature,project) {
  const g=feature.geometry;
  return (g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]).map(l=>l.map(project));
}
export function bounds(ring) {
  return {minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1]))};
}
export function area(ring) {let a=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)a+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];return Math.abs(a/2);}
export function inside(p,ring) {let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
export function insidePoly(p,poly){return inside(p,poly[0])&&!poly.slice(1).some(r=>inside(p,r));}
export function random(seed=10220){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function roadWidth(t){return Number.parseFloat(t.width)||({trunk:11,primary:10,secondary:8,tertiary:7,residential:5.5,unclassified:5.5,service:3.5,living_street:4,track:2.8,path:1.4,footway:1.5,cycleway:2,steps:1.5}[t.highway]||4);}
