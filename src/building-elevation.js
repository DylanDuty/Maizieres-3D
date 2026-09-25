// V2.0.1: base of a building in the V2 view. The reference altitude (building-terrain-elevation.json, minimum of the LiDAR terrain
// under the footprint) stays the export value; the display grid (10 m, bilinear) can be up to ~1,5 m higher or lower on slopes,
// which half-buried small houses. The shown base follows the lowest point of the displayed terrain along the outline (no side
// floats, nothing sinks), within ±4 m of the reference altitude (largest gap: a 3,9 m pit under BATIMENT0000000301149777).
export const DISPLAY_TOLERANCE=.25;
export function displayBase(poly,baseY,heightAt,maxShift=4){let min=Infinity,max=-Infinity;const r=poly[0];
 for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));for(let s=0;s<n;s++){const h=heightAt(a[0]+(b[0]-a[0])*s/n,a[1]+(b[1]-a[1])*s/n);if(h<min)min=h;if(h>max)max=h;}}
 const delta=Math.max(-maxShift,Math.min(maxShift,min-baseY));return {base:baseY+delta,delta,terrainMin:min,terrainMax:max,corrected:Math.abs(delta)>DISPLAY_TOLERANCE};}
