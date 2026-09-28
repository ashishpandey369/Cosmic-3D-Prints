(function(){
let threePromise=null;
let viewer=null;
const THREE_URL="three";
const ADDON="three/addons/loaders/";
const OCCT_VERSION="0.0.23";
const OCCT_BASE="https://cdn.jsdelivr.net/npm/occt-import-js@"+OCCT_VERSION+"/dist/";

function previewStatus(message,type=""){
  const el=document.querySelector("#model-preview-status");
  if(!el)return;
  el.textContent=message;
  el.className="model-preview-status"+(type?" "+type:"");
}
function loadThree(){
  if(threePromise)return threePromise;
  threePromise=import(THREE_URL);
  return threePromise;
}
async function loaderFor(ext){
  const map={
    stl:["STLLoader","STLLoader.js"],obj:["OBJLoader","OBJLoader.js"],"3mf":["ThreeMFLoader","3MFLoader.js"],
    glb:["GLTFLoader","GLTFLoader.js"],gltf:["GLTFLoader","GLTFLoader.js"],ply:["PLYLoader","PLYLoader.js"],
    fbx:["FBXLoader","FBXLoader.js"],"3ds":["TDSLoader","TDSLoader.js"],dae:["ColladaLoader","ColladaLoader.js"],
    amf:["AMFLoader","AMFLoader.js"],wrl:["VRMLLoader","VRMLLoader.js"]
  };
  const item=map[ext];
  if(!item)return null;
  const mod=await import(ADDON+item[1]);
  return mod[item[0]];
}
let occtPromise=null;
function loadOCCT(){
  if(occtPromise)return occtPromise;
  occtPromise=new Promise((resolve,reject)=>{
    const start=()=>{
      if(typeof window.occtimportjs!=="function"){reject(new Error("CAD engine loaded, but its browser module was not found."));return;}
      window.occtimportjs({locateFile:file=>OCCT_BASE+file}).then(resolve).catch(reject);
    };
    if(typeof window.occtimportjs==="function"){start();return;}
    const s=document.createElement("script");s.src=OCCT_BASE+"occt-import-js.js";s.async=true;s.onload=start;
    s.onerror=()=>reject(new Error("Could not load the CAD engine. Check your internet connection."));
    document.head.appendChild(s);
  });
  return occtPromise;
}
function disposeObject(o){
  o?.traverse?.(n=>{
    n.geometry?.dispose();
    if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose?.());
  });
}
function ensureViewer(THREE){
  if(viewer)return viewer;
  const canvas=document.querySelector("#model-preview-canvas");
  if(!canvas)return null;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x08131d,1);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x08131d);
  const camera=new THREE.PerspectiveCamera(35,1,.01,1000);
  scene.add(new THREE.HemisphereLight(0xdff3ff,0x16212d,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,8,6);scene.add(key);
  const rim=new THREE.DirectionalLight(0x42b5ff,2);rim.position.set(-5,3,-4);scene.add(rim);
  const grid=new THREE.GridHelper(10,20,0x27516b,0x183242);grid.position.y=-1.01;scene.add(grid);
  viewer={THREE,renderer,scene,camera,object:null,drag:false,pan:false,x:0,y:0};
  const resize=()=>{const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(canvas.parentElement||canvas);resize();
  canvas.addEventListener("pointerdown",e=>{if(!viewer.object)return;viewer.drag=e.button===0;viewer.pan=e.button===2;viewer.x=e.clientX;viewer.y=e.clientY;canvas.setPointerCapture?.(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(!viewer.object||(!viewer.drag&&!viewer.pan))return;const dx=e.clientX-viewer.x,dy=e.clientY-viewer.y;viewer.x=e.clientX;viewer.y=e.clientY;if(viewer.drag){viewer.object.rotation.y+=dx*.01;viewer.object.rotation.x+=dy*.01;}else{const s=.005*Math.max(1,viewer.camera.position.length());viewer.object.position.x+=dx*s;viewer.object.position.y-=dy*s;}});
  ["pointerup","pointercancel"].forEach(t=>canvas.addEventListener(t,()=>{viewer.drag=false;viewer.pan=false;}));
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.addEventListener("wheel",e=>{e.preventDefault();if(viewer.object)viewer.object.scale.multiplyScalar(e.deltaY>0?1.1:.9);},{passive:false});
  (function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);})();
  return viewer;
}
function material(THREE){return new THREE.MeshStandardMaterial({color:0x35aef5,metalness:.2,roughness:.35,side:THREE.DoubleSide});}
function recolor(o,THREE){o.traverse(n=>{if(n.isMesh)n.material=material(THREE);});}
function fit(o){
  const {THREE,camera}=viewer;o.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o);
  if(b.isEmpty())throw Error("The model has no visible geometry.");
  const size=b.getSize(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;
  o.position.set(0,0,0);o.scale.setScalar(3/max);o.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(o),c=b2.getCenter(new THREE.Vector3());o.position.sub(c);o.updateMatrixWorld(true);
  const r=b2.getBoundingSphere(new THREE.Sphere()).radius||1;camera.position.set(r*2.2,r*1.4,r*2.2);camera.near=Math.max(r/100,.001);camera.far=Math.max(r*100,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
}
function geoVolume(THREE,g,matrix,factor){
  const p=g.getAttribute("position");if(!p)return 0;const idx=g.getIndex();let v=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const add=(i,j,k)=>{a.fromBufferAttribute(p,i).applyMatrix4(matrix);b.fromBufferAttribute(p,j).applyMatrix4(matrix);c.fromBufferAttribute(p,k).applyMatrix4(matrix);v+=(a.x*(b.y*c.z-b.z*c.y)-a.y*(b.x*c.z-b.z*c.x)+a.z*(b.x*c.y-b.y*c.x))/6;};
  if(idx){for(let i=0;i+2<idx.count;i+=3)add(idx.getX(i),idx.getX(i+1),idx.getX(i+2));}
  else for(let i=0;i+2<p.count;i+=3)add(i,i+1,i+2);
  return Math.abs(v)*factor;
}
function objectVolume(THREE,o,factor){
  o.updateMatrixWorld(true);let v=0;o.traverse(n=>{if(n.isMesh&&n.geometry)v+=geoVolume(THREE,n.geometry,n.matrixWorld,factor);});
  if(!Number.isFinite(v)||v<=0)throw Error("The model was opened, but no positive enclosed volume could be measured.");
  return v;
}
function offObject(THREE,text){
  const a=text.replace(/^OFF\s*/i,"").trim().split(/\s+/).map(Number),nv=a[0],nf=a[1];let q=3,v=[],pos=[];
  for(let i=0;i<nv;i++)v.push([a[q++],a[q++],a[q++]]);
  for(let i=0;i<nf;i++){const k=a[q++],ids=[];for(let j=0;j<k;j++)ids.push(a[q++]);for(let j=1;j<ids.length-1;j++)for(const id of [ids[0],ids[j],ids[j+1]])pos.push(...v[id]);}
  if(!pos.length)throw Error("No OFF faces found.");
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return new THREE.Mesh(g,material(THREE));
}
function x3dObject(THREE,text){
  const xml=new DOMParser().parseFromString(text,"application/xml"),group=new THREE.Group();
  for(const set of [...xml.getElementsByTagName("IndexedFaceSet")]){
    const co=set.getElementsByTagName("Coordinate")[0];if(!co)continue;
    const pts=(co.getAttribute("point")||"").trim().split(/\s+/).filter(Boolean).map(Number),ids=(set.getAttribute("coordIndex")||"").trim().split(/\s+/).map(Number),pos=[];let face=[];
    const flush=()=>{for(let i=1;i<face.length-1;i++)for(const id of [face[0],face[i],face[i+1]]){const k=id*3;if(k+2>=pts.length)throw Error("Invalid X3D coordinate index.");pos.push(pts[k],pts[k+1],pts[k+2]);}face=[];};
    ids.forEach(id=>id<0?flush():face.push(id));flush();
    if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();group.add(new THREE.Mesh(g,material(THREE)));}
  }
  if(!group.children.length)throw Error("No X3D surface geometry found.");return group;
}
function occtObject(THREE,result){
  if(!result?.success||!Array.isArray(result.meshes))throw Error("The CAD file could not be converted.");
  const group=new THREE.Group();
  for(const m of result.meshes){const p=m?.attributes?.position?.array;if(!p?.length)continue;const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));if(m.attributes.normal?.array)g.setAttribute("normal",new THREE.Float32BufferAttribute(m.attributes.normal.array,3));if(m.index?.array)g.setIndex(Array.from(m.index.array));else g.computeVertexNormals();group.add(new THREE.Mesh(g,material(THREE)));}
  if(!group.children.length)throw Error("The CAD file contains no displayable geometry.");return group;
}
async function parseFile(file){
  if(!file||!file.size)throw Error("The selected file is empty.");
  const THREE=await loadThree(),bytes=new Uint8Array(await file.arrayBuffer()),ext=file.name.toLowerCase().split(".").pop();
  let object,factor=.001;
  if(ext==="step"||ext==="stp"||ext==="iges"||ext==="igs"){
    previewStatus("Converting CAD model…");const occt=await loadOCCT(),params={linearUnit:"millimeter",linearDeflectionType:"bounding_box_ratio",linearDeflection:.001,angularDeflection:.5};
    const r=ext==="step"||ext==="stp"?occt.ReadStepFile(bytes,params):occt.ReadIgesFile(bytes,params);object=occtObject(THREE,r);factor=.001;
  }else if(ext==="off"){object=offObject(THREE,new TextDecoder().decode(bytes));}
  else if(ext==="x3d"){object=x3dObject(THREE,new TextDecoder().decode(bytes));}
  else if(ext==="zip"){
    const JSZip=(await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default,zip=await JSZip.loadAsync(bytes),names=Object.keys(zip.files).filter(n=>/\.(stl|obj|3mf|glb|gltf|ply|step|stp|iges|igs|fbx|3ds|dae|amf|x3d|wrl)$/i.test(n)&&!zip.files[n].dir);
    if(!names.length)throw Error("ZIP does not contain a supported 3D model.");const n=names[0],b=await zip.files[n].async("uint8array");return parseFile(new File([b],n));
  }else{
    const Loader=await loaderFor(ext);if(!Loader)throw Error("This file format is not supported by the browser preview engine.");
    const loader=new Loader();
    const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    if(ext==="stl"){const g=loader.parse(ab);object=new THREE.Mesh(g,material(THREE));}
    else if(ext==="obj")object=loader.parse(new TextDecoder().decode(bytes));
    else if(ext==="3mf"||ext==="fbx"||ext==="3ds"||ext==="amf")object=loader.parse(ab, "");
    else if(ext==="ply"){const g=loader.parse(ab);object=new THREE.Mesh(g,material(THREE));}
    else if(ext==="glb"||ext==="gltf"){
      object=await new Promise((resolve,reject)=>loader.parse(ab,"",g=>resolve(g.scene||g.scenes?.[0]),reject));
      factor=1e6;
    }else if(ext==="dae")object=loader.parse(new TextDecoder().decode(bytes),"").scene;
    else if(ext==="wrl")object=loader.parse(new TextDecoder().decode(bytes),"");
    else throw Error("This file format is not supported by the browser preview engine.");
  }
  if(!object)throw Error("The model could not be loaded.");
  recolor(object,THREE);
  const volumeCC=objectVolume(THREE,object,factor);
  return {THREE,object,volumeCC};
}
async function loadModel(file){
  previewStatus("Loading 3D model…");
  try{
    const parsed=await parseFile(file),v=ensureViewer(parsed.THREE);if(!v)throw Error("3D preview area is unavailable.");
    if(v.object){v.scene.remove(v.object);disposeObject(v.object);}
    v.object=parsed.object;v.scene.add(v.object);fit(v.object);
    previewStatus("3D preview ready • drag to rotate • scroll to zoom • right-click to pan","success");
    return parsed;
  }catch(e){console.error("Cosmic 3D preview:",e);previewStatus(e?.message||"Could not preview this model.","error");throw e;}
}
window.CosmicModelIO={parseFile};
window.CosmicPreview={loadModel};
})();