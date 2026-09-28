
const ccRates={
  "sla-white":{minimum:1000,lowRate:35,highRate:32,threshold:100},
  "sla-clear":{minimum:1500,lowRate:60,highRate:55,threshold:100},
  "mjf-pa12":{minimum:2000,lowRate:60,highRate:55,threshold:100},
  "sls-pa12":{minimum:2000,lowRate:60,highRate:55,threshold:100},
  "figure-pro":{minimum:2500,lowRate:250,highRate:200,threshold:20}
};

function meshVolumeCC(tris){
  let v=0;
  for(const t of tris){
    const a=t[0],b=t[1],c=t[2];
    v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  return Math.abs(v)/1000;
}
function triVolume(pos,indices,unitFactor){
  let v=0;
  for(let i=0;i+2<indices.length;i+=3){
    const a=pos[indices[i]],b=pos[indices[i+1]],c=pos[indices[i+2]];
    if(!a||!b||!c)continue;
    v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  return Math.abs(v)*unitFactor;
}
function parseSTL(buf){
  if(!(buf instanceof ArrayBuffer))buf=buf?.buffer instanceof ArrayBuffer?buf.buffer:buf;
  if(!(buf instanceof ArrayBuffer))throw Error("The selected file could not be read as binary data.");
  const d=new DataView(buf),count=d.byteLength>=84?d.getUint32(80,true):0;
  if(count&&84+count*50===d.byteLength){
    const tris=[];let o=84;
    for(let i=0;i<count;i++){o+=12;const t=[];for(let j=0;j<3;j++){t.push([d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]);o+=12}o+=2;tris.push(t)}
    return meshVolumeCC(tris);
  }
  const nums=[...new TextDecoder().decode(buf).matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi)].map(m=>m.slice(1).map(Number)),tris=[];
  for(let i=0;i+2<nums.length;i+=3)tris.push([nums[i],nums[i+1],nums[i+2]]);
  if(!tris.length)throw Error("No STL triangles found");return meshVolumeCC(tris);
}
function parseOBJ(text){
  const v=[],tris=[];
  for(const line of text.split(/\r?\n/)){const p=line.trim().split(/\s+/);
    if(p[0]==="v"&&p.length>=4)v.push([+p[1],+p[2],+p[3]]);
    if(p[0]==="f"&&p.length>=4){const ids=p.slice(1).map(x=>parseInt(x.split("/")[0],10)).map(n=>n<0?v.length+n:n-1);for(let i=1;i<ids.length-1;i++)tris.push([v[ids[0]],v[ids[i]],v[ids[i+1]]])}
  }
  if(!tris.length)throw Error("No OBJ faces found");return meshVolumeCC(tris);
}
function parseOFF(text){
  const a=text.replace(/^OFF\s*/i,"").trim().split(/\s+/).map(Number),n=a[0],nf=a[1];let o=3;const v=[];
  for(let i=0;i<n;i++)v.push([a[o++],a[o++],a[o++]]);
  const tris=[];for(let i=0;i<nf;i++){const k=a[o++],ids=[];for(let j=0;j<k;j++)ids.push(a[o++]);for(let j=1;j<ids.length-1;j++)tris.push([v[ids[0]],v[ids[j]],v[ids[j+1]]])}
  if(!tris.length)throw Error("No OFF faces found");return meshVolumeCC(tris);
}
function parsePLY(text){
  const lines=text.split(/\r?\n/);let nv=0,nf=0,end=-1,format="";
  for(let i=0;i<lines.length;i++){const l=lines[i].trim();if(l.startsWith("format "))format=l.split(/\s+/)[1];if(l.startsWith("element vertex "))nv=+l.split(/\s+/)[2];if(l.startsWith("element face "))nf=+l.split(/\s+/)[2];if(l==="end_header"){end=i;break}}
  if(format!=="ascii")throw Error("Binary PLY needs server-side conversion");
  const v=lines.slice(end+1,end+1+nv).map(l=>l.trim().split(/\s+/).slice(0,3).map(Number)),tris=[];
  for(let i=0;i<nf;i++){const a=lines[end+1+nv+i].trim().split(/\s+/).map(Number),ids=a.slice(1);for(let j=1;j<ids.length-1;j++)tris.push([v[ids[0]],v[ids[j]],v[ids[j+1]]])}
  if(!tris.length)throw Error("No PLY faces found");return meshVolumeCC(tris);
}
function identity(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
function mul(a,b){const r=new Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)r[col*4+row]=a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];return r}
function nodeMatrix(n){
  if(n.matrix)return n.matrix;const q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0],x=q[0],y=q[1],z=q[2],w=q[3];
  return[(1-2*y*y-2*z*z)*s[0],(2*x*y+2*w*z)*s[0],(2*x*z-2*w*y)*s[0],0,(2*x*y-2*w*z)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*w*x)*s[1],0,(2*x*z+2*w*y)*s[2],(2*y*z-2*w*x)*s[2],(1-2*x*x-2*y*y)*s[2],0,t[0],t[1],t[2],1]
}
function tx(v,m){return[v[0]*m[0]+v[1]*m[4]+v[2]*m[8]+m[12],v[0]*m[1]+v[1]*m[5]+v[2]*m[9]+m[13],v[0]*m[2]+v[1]*m[6]+v[2]*m[10]+m[14]]}
function accessor(g,a){
  const bv=g.bufferViews[a.bufferView],b=g.__buffers[bv.buffer],map={5121:[Uint8Array,1],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},c=map[a.componentType],n=types[a.type];
  if(!bv||!c||!n)throw Error("Unsupported GLTF accessor");
  const C=c[0],size=c[1]*n,start=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||size,out=[];
  for(let i=0;i<a.count;i++){const x=new C(b,start+i*stride,n);out.push(n===1?x[0]:Array.from(x))}return out;
}
function parseGLTF(g){
  let total=0;
  function primitive(p,m){const pos=accessor(g,g.accessors[p.attributes.POSITION]).map(x=>tx(x,m));const ind=p.indices==null?pos.map((_,i)=>i):accessor(g,g.accessors[p.indices]);return triVolume(pos,ind,1e6)}
  function walk(i,parent){const n=g.nodes[i],m=mul(parent,nodeMatrix(n));if(n.mesh!=null)for(const p of g.meshes[n.mesh].primitives||[])total+=primitive(p,m);for(const ch of n.children||[])walk(ch,m)}
  for(const n of (g.scenes?.[g.scene||0]?.nodes||[]))walk(n,identity());
  if(total<=0)throw Error("No measurable GLTF mesh found");return total;
}
async function parseGLB(buf){
  const d=new DataView(buf);if(d.getUint32(0,true)!==0x46546c67)throw Error("Invalid GLB");
  let o=12,json=null,bin=null;while(o<buf.byteLength){const len=d.getUint32(o,true),type=d.getUint32(o+4,true),data=buf.slice(o+8,o+8+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(data));if(type===0x004e4942)bin=data;o+=8+len}
  if(!json||!bin)throw Error("Incomplete GLB");json.__buffers=[bin];return parseGLTF(json);
}
async function parse3MF(buf){
  const d=new DataView(buf);if(d.getUint32(0,true)!==0x04034b50)throw Error("Invalid 3MF ZIP");let o=0,model=null;
  while(o+30<=buf.byteLength){const sig=d.getUint32(o,true);if(sig!==0x04034b50)break;const method=d.getUint16(o+8,true),cs=d.getUint32(o+18,true),nl=d.getUint16(o+26,true),xl=d.getUint16(o+28,true),name=new TextDecoder().decode(new Uint8Array(buf,o+30,nl)),data=new Uint8Array(buf,o+30+nl+xl,cs);
    if(/3d\/3dmodel\.model$/i.test(name)||/\.model$/i.test(name)){if(method===0)model=new TextDecoder().decode(data);else if(method===8){const raw=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();model=new TextDecoder().decode(raw)}}
    o+=30+nl+xl+cs;
  }
  if(!model)throw Error("3MF model data not found");const doc=new DOMParser().parseFromString(model,"application/xml"),tris=[];
  for(const mesh of [...doc.getElementsByTagName("mesh")]){const vs=[...mesh.getElementsByTagName("vertex")].map(x=>[+x.getAttribute("x"),+x.getAttribute("y"),+x.getAttribute("z")]);for(const t of [...mesh.getElementsByTagName("triangle")])tris.push([vs[+t.getAttribute("v1")],vs[+t.getAttribute("v2")],vs[+t.getAttribute("v3")]])}
  if(!tris.length)throw Error("No 3MF triangles found");return meshVolumeCC(tris);
}
function readFileAsArrayBuffer(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("Could not read the selected file."));
    reader.readAsArrayBuffer(file);
  });
}
async function calculateModelVolume(file){
  const buf=await readFileAsArrayBuffer(file),ext=file.name.toLowerCase().split(".").pop();
  if(ext==="stl")return parseSTL(buf);
  if(ext==="obj")return parseOBJ(new TextDecoder().decode(buf));
  if(ext==="off")return parseOFF(new TextDecoder().decode(buf));
  if(ext==="ply")return parsePLY(new TextDecoder().decode(buf));
  if(ext==="3mf")return parse3MF(buf);
  if(ext==="glb")return parseGLB(buf);
  if(ext==="gltf"){const g=JSON.parse(new TextDecoder().decode(buf));g.__buffers=[];for(const b of g.buffers||[]){if(!b.uri?.startsWith("data:"))throw Error("Use GLB for GLTF files with external .bin files");g.__buffers.push(await(await fetch(b.uri)).arrayBuffer())}return parseGLTF(g)}
  throw Error("This file is accepted, but automatic CC calculation needs mesh conversion. Use STL, OBJ, 3MF, GLB, GLTF, PLY or OFF for instant calculation.");
}
function updateCCPrice(){
  const material=document.querySelector("#cc-material")?.value,volume=Number(document.querySelector("#cc-volume")?.value||0),price=document.querySelector("#cc-price"),breakdown=document.querySelector("#cc-breakdown"),rate=ccRates[material];
  if(!rate||!price||!breakdown)return;if(volume<=0){price.textContent="₹0";breakdown.textContent="Upload a model or enter CC manually.";return}
  const per=volume<rate.threshold?rate.lowRate:rate.highRate,raw=volume*per,quantity=Math.max(1,Number(document.querySelector("#quote-quantity")?.value||1)),total=raw*quantity;price.textContent="₹"+Math.round(total).toLocaleString("en-IN");
  const one=volume.toFixed(2)+" CC × ₹"+per+"/CC = ₹"+Math.round(raw).toLocaleString("en-IN");
  breakdown.textContent=quantity>1?one+" • "+quantity+" copies = ₹"+Math.round(total).toLocaleString("en-IN"):one;
}
document.addEventListener("DOMContentLoaded",()=>{
  const input=document.querySelector("#cc-file"),volume=document.querySelector("#cc-volume"),status=document.querySelector("#cc-file-status"),name=document.querySelector("#cc-file-name");
  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];if(!file)return;name.textContent=file.name;status.className="cc-file-status";status.textContent="Reading 3D geometry…";
    try{const cc=await calculateModelVolume(file);if(!Number.isFinite(cc)||cc<=0)throw Error("The model has no positive enclosed volume.");volume.value=cc.toFixed(2);volume.readOnly=true;status.className="cc-file-status success";status.textContent="Calculated volume: "+cc.toFixed(2)+" CC";updateCCPrice()}
    catch(e){volume.readOnly=false;status.className="cc-file-status error";status.textContent=e.message||"Could not calculate this file. Enter CC manually."}
  });
  document.querySelector("#cc-material")?.addEventListener("change",updateCCPrice);volume?.addEventListener("input",updateCCPrice);document.querySelector("#quote-quantity")?.addEventListener("input",updateCCPrice);updateCCPrice();
});
