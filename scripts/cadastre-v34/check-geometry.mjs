// V3.4 check:cadastre-geometry — the render copy is the source geometry, only projected and rounded to the centimetre:
// counts and identifiers, rings and holes, no translation / rotation / scaling, projection control against the IGN
// Lambert-93 copy, deduplicated limits, bounds and coverage.
import fs from 'node:fs';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {projection} from '../../src/geo.js';import {toL93} from '../terrain-frame.mjs';
const DIR='data-sources/cadastre-parcelles-v34',ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const M=read(`${DIR}/source-manifest.json`),R=read('public/data/cadastre-parcels-v3.4.json'),S=read(`${DIR}/build-report.json`),scene=read('public/data/v2-scene.json');
const raw=M.canonical.pages.flatMap(pg=>JSON.parse(gunzipSync(fs.readFileSync(pg.file)).toString('utf8')).features);
// 1
assert.equal(R.metadata.source.edition,M.canonical.edition);assert.deepEqual(R.metadata.source.pages.map(p=>p.sha256),M.canonical.pages.map(p=>p.sha256));
assert.equal(R.p.length,raw.length);assert.deepEqual(new Set(R.p.map(p=>p.id)),new Set(raw.map(f=>f.properties.idu)));
ok(`1. ${R.p.length} parcelles importées = ${raw.length} parcelles source, mêmes identifiants, même édition (${M.canonical.edition})`);
// 2
const V=R.v,nv=V.length/2;assert.ok(V.every(x=>Number.isFinite(x)&&Math.abs(x*100-Math.round(x*100))<1e-6),'sommet non arrondi au centimètre');
let holes=0;for(const p of R.p)for(const poly of p.r){holes+=poly.length-1;for(const r of poly){assert.ok(r.length>=3,'anneau dégénéré '+p.id);assert.ok(r.every(i=>Number.isInteger(i)&&i>=0&&i<nv));assert.equal(new Set(r).size,r.length,'sommet répété '+p.id);}}
const srcHoles=raw.reduce((s,f)=>s+f.geometry.coordinates.reduce((t,poly)=>t+poly.length-1,0),0);assert.equal(holes,srcHoles);assert.equal(R.p.reduce((s,p)=>s+p.r.length,0),raw.reduce((s,f)=>s+f.geometry.coordinates.length,0));
ok(`2. ${nv} sommets finis arrondis au cm, anneaux ≥ 3 sommets distincts, ${holes} trous = ${srcHoles} trous source, parties identiques`);
// 3 — every vertex against the source projected again: only the rounding differs
const project=projection(scene.metadata.origin),byId=new Map(raw.map(f=>[f.properties.idu,f]));let maxD=0,cmp=0;
for(const p of R.p){const f=byId.get(p.id);f.geometry.coordinates.forEach((poly,k)=>poly.forEach((ring,h)=>{const src=[];for(const q of ring.slice(0,-1)){const e=project(q);const l=src.at(-1);if(l&&Math.abs(l[0]-e[0])<.005&&Math.abs(l[1]-e[1])<.005)continue;src.push(e);}
 const idx=p.r[k][h];assert.equal(idx.length,src.length,'nombre de sommets différent '+p.id);idx.forEach((i,j)=>{const d=Math.hypot(V[2*i]-src[j][0],V[2*i+1]-src[j][1]);maxD=Math.max(maxD,d);cmp++;});}));}
assert.ok(maxD<=.0071+1e-9,'écart au contour source '+maxD);
ok(`3. ${cmp} sommets comparés à la source reprojetée : écart maximal ${(maxD*1000).toFixed(2)} mm (arrondi seul ; aucune translation, rotation ni mise à l’échelle)`);
// 4 — projection: our CRS84 → Lambert-93 against the copy served in EPSG:2154
const ctl=JSON.parse(gunzipSync(fs.readFileSync(M.l93Control.file)).toString('utf8')).features;let pm=0,pn=0;
for(const f of ctl){const o=byId.get(f.properties.idu);const A=f.geometry.coordinates.flat(2),B=o.geometry.coordinates.flat(2);assert.equal(A.length,B.length);for(let i=0;i<A.length;i++){const e=toL93(B[i]);pm=Math.max(pm,Math.hypot(e[0]-A[i][0],e[1]-A[i][1]));pn++;}}
assert.ok(pm<.05,'projection : écart '+pm);
ok(`4. projection Lambert-93 du projet contre la copie EPSG:2154 de l’IGN : ${pn} sommets, écart maximal ${(pm*1000).toFixed(1)} mm`);
// 5 — limits: each pair of vertices once, valid parcel references, every parcel bounded
const E=R.e,seen=new Set(),touched=new Set();for(let k=0;k<E.length;k+=4){const a=E[k],b=E[k+1];assert.ok(a!==b&&a<nv&&b<nv);const key=Math.min(a,b)+'-'+Math.max(a,b);assert.ok(!seen.has(key),'limite en double');seen.add(key);
 assert.ok(E[k+2]>=0&&E[k+2]<R.p.length&&E[k+3]<R.p.length);touched.add(E[k+2]);if(E[k+3]>=0)touched.add(E[k+3]);}
assert.equal(touched.size,R.p.length);
ok(`5. ${E.length/4} limites uniques (${S.topology.shared} partagées entre deux parcelles, ${S.topology.single} vers le domaine non cadastré), aucune en double, chaque parcelle bordée`);
// 6 — bounds and coverage
const com=read('public/data/commune.geojson'),cg=com.geometry||com.features[0].geometry,cr=(cg.type==='Polygon'?[cg.coordinates]:cg.coordinates).flat(2).map(project);
const bb=[Math.min(...cr.map(q=>q[0])),Math.min(...cr.map(q=>q[1])),Math.max(...cr.map(q=>q[0])),Math.max(...cr.map(q=>q[1]))];
for(let i=0;i<nv;i++)assert.ok(V[2*i]>bb[0]-300&&V[2*i]<bb[2]+300&&V[2*i+1]>bb[1]-300&&V[2*i+1]<bb[3]+300,'sommet hors de l’emprise communale');
const c=S.coverage;assert.ok(c.coverageOfContour>.9&&c.coverageOfContour<=1);
ok(`6. emprise dans la commune ±300 m ; couverture du contour communal ${(100*c.coverageOfContour).toFixed(1)} % (${c.notCadastredInsideHa.toFixed(1)} ha non cadastrés : voirie, eau, domaine public ; ${c.parcelsOutsideContourHa.toFixed(1)} ha au-delà du contour généralisé)`);
