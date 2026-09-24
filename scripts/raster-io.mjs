// Minimal, dependency-free raster writers/readers for the V1.7 terrain pipeline.
// GeoTIFF: classic little-endian TIFF, one band, deflate + predictor (2 integer / 3 floating point, TIFF TN3), GeoKeys.
// PNG: 16-bit greyscale (the heightmap format Unreal imports), with an exact reader used by the checks.
import fs from 'node:fs';
import zlib from 'node:zlib';

// ---------- GeoTIFF ----------
// Floating-point predictor (TIFF Technical Note 3): per row, bytes split in planes MSB first, then byte differencing.
function predictFloatRow(src,width,out){const u8=new Uint8Array(src.buffer,src.byteOffset,width*4);for(let i=0;i<width;i++)for(let b=0;b<4;b++)out[(3-b)*width+i]=u8[i*4+b];for(let j=out.length-1;j>0;j--)out[j]=(out[j]-out[j-1])&255;}
function predictIntRow(src,width,out){const o=new Uint16Array(out.buffer,out.byteOffset,width);o[0]=src[0];for(let i=1;i<width;i++)o[i]=(src[i]-src[i-1])&65535;}
export function writeGeoTiff(path,{width,height,data,noData=null,tiepoint,scale,geoKeys,rowsPerStrip=8,level=6,description=''}){
 const float=data instanceof Float32Array,bps=float?4:2,rowBytes=width*bps,strips=[],row=new Uint8Array(rowBytes);
 for(let y0=0;y0<height;y0+=rowsPerStrip){const n=Math.min(rowsPerStrip,height-y0),buf=Buffer.alloc(n*rowBytes);
  for(let r=0;r<n;r++){const s=data.subarray((y0+r)*width,(y0+r+1)*width);(float?predictFloatRow:predictIntRow)(s,width,row);buf.set(row,r*rowBytes);}
  strips.push(zlib.deflateSync(buf,{level}));}
 const tags=[],extra=[];let extraSize=0;const addExtra=b=>{const off=extraSize;extra.push(b);extraSize+=b.length+(b.length&1);return off;};
 const T=(tag,type,values)=>tags.push({tag,type,values});
 const keys=[1,1,0,geoKeys.length,...geoKeys.flatMap(([k,v])=>[k,0,1,v])];
 T(256,4,[width]);T(257,4,[height]);T(258,3,[bps*8]);T(259,3,[8]);T(262,3,[1]);if(description)T(270,2,description);T(273,4,strips.map(()=>0));T(277,3,[1]);T(278,4,[rowsPerStrip]);T(279,4,strips.map(s=>s.length));T(284,3,[1]);T(305,2,'Maizieres-3D scripts/build-terrain.mjs');T(317,3,[float?3:2]);T(339,3,[float?3:1]);
 T(33550,12,scale);T(33922,12,tiepoint);T(34735,3,keys);if(noData!==null)T(42113,2,String(noData));
 tags.sort((a,b)=>a.tag-b.tag);
 const size={2:1,3:2,4:4,12:8},stripBytes=strips.reduce((s,b)=>s+b.length,0),ifdOffset=8+stripBytes+(stripBytes&1),ifdSize=2+tags.length*12+4,extraBase=ifdOffset+ifdSize;
 // Serialise tag payloads that do not fit in 4 bytes.
 const enc=t=>{if(t.type===2){const b=Buffer.from(t.values+'\0','latin1');return {count:b.length,b};}const n=t.values.length,b=Buffer.alloc(n*size[t.type]);t.values.forEach((v,i)=>t.type===3?b.writeUInt16LE(v,i*2):t.type===4?b.writeUInt32LE(v>>>0,i*4):b.writeDoubleLE(v,i*8));return {count:n,b};};
 let off=8;const stripOffsets=strips.map(s=>{const o=off;off+=s.length;return o;});tags.find(t=>t.tag===273).values=stripOffsets;
 const ifd=Buffer.alloc(ifdSize);ifd.writeUInt16LE(tags.length,0);
 tags.forEach((t,i)=>{const {count,b}=enc(t),p=2+i*12;ifd.writeUInt16LE(t.tag,p);ifd.writeUInt16LE(t.type,p+2);ifd.writeUInt32LE(count,p+4);if(b.length<=4)b.copy(ifd,p+8);else ifd.writeUInt32LE(extraBase+addExtra(b),p+8);});
 ifd.writeUInt32LE(0,ifdSize-4);
 const header=Buffer.alloc(8);header.write('II',0,'latin1');header.writeUInt16LE(42,2);header.writeUInt32LE(ifdOffset,4);
 const fd=fs.openSync(path,'w');fs.writeSync(fd,header);for(const s of strips)fs.writeSync(fd,s);if(stripBytes&1)fs.writeSync(fd,Buffer.alloc(1));fs.writeSync(fd,ifd);for(const b of extra){fs.writeSync(fd,b);if(b.length&1)fs.writeSync(fd,Buffer.alloc(1));}fs.closeSync(fd);
}
// GeoKeys: projected Lambert-93, pixel-is-area, vertical NGF-IGN69 metres.
export const GEOKEYS_L93_IGN69=[[1024,1],[1025,1],[3072,2154],[3076,9001],[4096,5720],[4099,9001]];

// ---------- PNG 16-bit greyscale ----------
const crc=b=>zlib.crc32(b)>>>0;
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type,'latin1'),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);}
export function writePng16(path,{width,height,data,text={}}){
 const stride=width*2,raw=Buffer.alloc(height*(stride+1)),cur=Buffer.alloc(stride),prev=Buffer.alloc(stride),cand=[0,1,2,3,4].map(()=>Buffer.alloc(stride));
 for(let y=0;y<height;y++){for(let x=0;x<width;x++)cur.writeUInt16BE(data[y*width+x],x*2);
  // Adaptive filter: smallest sum of absolute signed bytes (PNG recommendation).
  let best=0,bestSum=Infinity;for(let f=0;f<5;f++){const o=cand[f];let sum=0;for(let i=0;i<stride;i++){const a=i>=2?cur[i-2]:0,b=prev[i],c=i>=2?prev[i-2]:0;let p=cur[i];if(f===1)p-=a;else if(f===2)p-=b;else if(f===3)p-=(a+b)>>1;else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p-=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}o[i]=p&255;sum+=o[i]<128?o[i]:256-o[i];}if(sum<bestSum){bestSum=sum;best=f;}}
  raw[y*(stride+1)]=best;cand[best].copy(raw,y*(stride+1)+1);cur.copy(prev);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=16;ihdr[9]=0;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
 const texts=Object.entries(text).map(([k,v])=>chunk('tEXt',Buffer.from(k+'\0'+v,'latin1')));
 fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),...texts,chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}
export function readPng16(path){
 const f=fs.readFileSync(path);let p=8,width,height,idat=[];const text={};
 while(p<f.length){const len=f.readUInt32BE(p),type=f.toString('latin1',p+4,p+8),d=f.subarray(p+8,p+8+len);
  if(crc(f.subarray(p+4,p+8+len))!==f.readUInt32BE(p+8+len))throw Error('PNG CRC '+type);
  if(type==='IHDR'){width=d.readUInt32BE(0);height=d.readUInt32BE(4);if(d[8]!==16||d[9]!==0||d[12]!==0)throw Error('PNG non 16 bits gris');}
  else if(type==='IDAT')idat.push(d);else if(type==='tEXt'){const z=d.indexOf(0);text[d.toString('latin1',0,z)]=d.toString('latin1',z+1);}p+=12+len;}
 const raw=zlib.inflateSync(Buffer.concat(idat)),stride=width*2,out=new Uint16Array(width*height),prev=Buffer.alloc(stride),cur=Buffer.alloc(stride);
 for(let y=0;y<height;y++){const ft=raw[y*(stride+1)],s=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
  for(let i=0;i<stride;i++){const a=i>=2?cur[i-2]:0,b=prev[i],c=i>=2?prev[i-2]:0;let v=s[i];if(ft===1)v+=a;else if(ft===2)v+=b;else if(ft===3)v+=(a+b)>>1;else if(ft===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}cur[i]=v&255;}
  for(let x=0;x<width;x++)out[y*width+x]=cur.readUInt16BE(x*2);cur.copy(prev);}
 return {width,height,data:out,text};
}
