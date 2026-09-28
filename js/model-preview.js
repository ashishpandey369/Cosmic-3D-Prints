(function(){
let threePromise=null;
let loaderPromise=null;
let occtPromise=null;
let viewer=null;
const THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const ADDON="https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/";
const OCCT_VERSION="0.0.23";
const OCCT_BASE="https://cdn.jsdelivr.net/npm/occt-import-js@"+OCCT_VERSION+"/dist/";

function previewStatus(message,type=""){
  const el=document.querySelector("#model-preview-status");
  if(!el)return;
  el.textContent=message;
  el.className="model-preview-status"+(type?" "+type:"");
}

async function loadThreeAndLoaders(){
  if(loaderPromise)return loaderPromise;
  loaderPromise=(async()=>{
    const THREE=await import(THREE_CDN);
    const [
      STLLoaderMod,OBJLoaderMod,ThreeMFLoaderMod,GLTFLoaderMod,PLYLoaderMod,
      FBXLoaderMod,TDSLoaderMod,ColladaLoaderMod,AMFLoaderMod,VRMLLoaderMod
    ]=await Promise.all([
      import(ADDON+"STLLoader.js"),import(ADDON+"OBJLoader.js"),import(ADDON+"3MFLoader.js"),
      import(ADDON+"GLTFLoader.js"),import(ADDON+"PLYLoader.js"),import(ADDON+"FBXLoader.js"),
      import(ADDON+"TDSLoader.js"),import(ADDON+"ColladaLoader.js"),import(ADDON+"AMFLoader.js"),
      import(ADDON+"VRMLLoader.js")
    ]);
    return {
      THREE,STLLoader:STLLoaderMod.STLLoader,OBJLoader:OBJLoaderMod.OBJLoader,
      ThreeMFLoader:ThreeMFLoaderMod.ThreeMFLoader,GLTFLoader:GLTFLoaderMod.GLTFLoader,
      PLYLoader:PLYLoaderMod.PLYLoader,FBXLoader:FBXLoaderMod.FBXLoader,
      TDSLoader:TDSLoaderMod.TDSLoader,ColladaLoader:ColladaLoaderMod.ColladaLoader,
      AMFLoader:AMFLoaderMod.AMFLoader,VRMLLoader:VRMLLoaderMod.VRMLLoader
    };
  })();
  return loaderPromise;
}

function loadOCCT(){
  if(occtPromise)return occtPromise;
  occtPromise=new Promise((resolve,reject)=>{
    const start=()=>{
      if(typeof window.occtimportjs!=="function"){reject(new Error("CAD engine loaded, but its browser module was not found."));return;}
      window.occtimportjs({locateFile:file=>OCCT_BASE+file}).then(resolve).catch(reject);
    };
    if(typeof window.occtimportjs==="function"){start();return;}
    const script=document.createElement("script");
    script.src=OCCT_BASE+"occt-import-js.js";
    script.async=true;
    script.onload=start;
    script.onerror=()=>reject(new Error("Could not load the CAD conversion engine. Check your internet connection and try again."));
    document.head.appendChild(script);
  });
  return occtPromise;
}

function disposeObject(object){
  object?.traverse?.(node=>{
    if(node.geometry)node.geometry.dispose();
    if(node.material){
      const materials=Array.isArray(node.material)?node.material:[node.material];
      materials.forEach(material=>material.dispose());
    }
  });
}

function ensureViewer(THREE){
  if(viewer)return viewer;
  const canvas=document.querySelector("#model-preview-canvas");
  if(!canvas)return null;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x08131d,1);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x08131d);
  const camera=new THREE.PerspectiveCamera(35,1,0.01,1000);
  camera.position.set(3,2.5,5);
  scene.add(new THREE.HemisphereLight(0xdff3ff,0x16212d,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,8,6);scene.add(key);
  const rim=new THREE.DirectionalLight(0x42b5ff,2);rim.position.set(-5,3,-4);scene.add(rim);
  const grid=new THREE.GridHelper(10,20,0x27516b,0x183242);grid.position.y=-1.01;scene.add(grid);
  viewer={THREE,renderer,scene,camera,grid,object:null,dragging:false,panning:false,lastX:0,lastY:0};

  function resize(){
    const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement||canvas);resize();

  canvas.addEventListener("pointerdown",e=>{
    if(!viewer.object)return;
    viewer.dragging=e.button===0;
    viewer.panning=e.button===2;
    viewer.lastX=e.clientX;viewer.lastY=e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointermove",e=>{
    if(!viewer.object||(!viewer.dragging&&!viewer.panning))return;
    const dx=e.clientX-viewer.lastX,dy=e.clientY-viewer.lastY;
    viewer.lastX=e.clientX;viewer.lastY=e.clientY;
    if(viewer.dragging){
      viewer.object.rotation.y+=dx*0.01;
      viewer.object.rotation.x+=dy*0.01;
    }else{
      const s=0.005*Math.max(1,viewer.camera.position.length());
      viewer.object.position.x+=dx*s;
      viewer.object.position.y-=dy*s;
    }
  });
  canvas.addEventListener("pointerup",()=>{viewer.dragging=false;viewer.panning=false;});
  canvas.addEventListener("pointercancel",()=>{viewer.dragging=false;viewer.panning=false;});
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.addEventListener("wheel",e=>{
    e.preventDefault();
    if(!viewer.object)return;
    viewer.object.scale.multiplyScalar(e.deltaY>0?1.1:0.9);
  },{passive:false});

  const animate=()=>{requestAnimationFrame(animate);renderer.render(scene,camera);};
  animate();
  return viewer;
}

function fitObject(object){
  const {THREE,camera}=viewer;
  object.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object);
  if(box.isEmpty())throw new Error("The model has no visible geometry.");
  const center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  const maxSize=Math.max(size.x,size.y,size.z)||1;
  const scale=3/maxSize;
  object.position.set(0,0,0);
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);
  const scaledBox=new THREE.Box3().setFromObject(object);
  const scaledCenter=scaledBox.getCenter(new THREE.Vector3());
  object.position.sub(scaledCenter);
  object.updateMatrixWorld(true);
  const fitted=new THREE.Box3().setFromObject(object);
  const radius=fitted.getBoundingSphere(new THREE.Sphere()).radius||1;
  camera.position.set(radius*2.2,radius*1.4,radius*2.2);
  camera.near=Math.max(radius/100,0.001);
  camera.far=Math.max(radius*100,100);
  camera.lookAt(0,0,0);camera.updateProjectionMatrix();
}

function makeMaterial(THREE,color=0x35aef5){
  return new THREE.MeshStandardMaterial({color,metalness:0.25,roughness:0.34,side:THREE.DoubleSide});
}

function applyPreviewMaterial(object,THREE){
  object.traverse(node=>{
    if(!node.isMesh)return;
    const old=node.material;
    let color=0x35aef5;
    if(old?.color&&old.color.isColor)color=old.color.getHex();
    node.material=makeMaterial(THREE,color);
    if(old){
      const mats=Array.isArray(old)?old:[old];
      mats.forEach(m=>{if(m&&m!==node.material)m.dispose?.();});
    }
  });
}

function matrixFromNode(THREE,n){
  if(Array.isArray(n?.matrix)&&n.matrix.length===16)return new THREE.Matrix4().fromArray(n.matrix);
  const q=n?.rotation||[0,0,0,1],s=n?.scale||[1,1,1],t=n?.translation||[0,0,0];
  const m=new THREE.Matrix4();
  m.compose(new THREE.Vector3(t[0]||0,t[1]||0,t[2]||0),new THREE.Quaternion(q[0]||0,q[1]||0,q[2]||0,q[3]??1),new THREE.Vector3(s[0]??1,s[1]??1,s[2]??1));
  return m;
}

function occtMeshToGeometry(THREE,mesh){
  const positions=mesh?.attributes?.position?.array;
  if(!positions?.length)throw new Error("CAD mesh has no position data.");
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  const normals=mesh?.attributes?.normal?.array;
  if(normals?.length)g.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  const indices=mesh?.index?.array;
  if(indices?.length)g.setIndex(Array.from(indices));
  if(!normals?.length)g.computeVertexNormals();
  return g;
}

function occtResultToObject(THREE,result){
  if(!result?.success||!Array.isArray(result.meshes))throw new Error("The CAD file could not be converted.");
  const group=new THREE.Group();
  const build=(node,parent)=>{
    if(!node)return;
    const holder=new THREE.Group();
    holder.name=node.name||"CAD part";
    holder.matrixAutoUpdate=false;
    holder.matrix.copy(matrixFromNode(THREE,node));
    holder.matrix.premultiply(parent.matrix);
    for(const idx of node.meshes||[]){
      const data=result.meshes[idx];
      if(!data)continue;
      const geometry=occtMeshToGeometry(THREE,data);
      let color=0x35aef5;
      if(Array.isArray(data.color)&&data.color.length>=3)color=new THREE.Color(data.color[0],data.color[1],data.color[2]).getHex();
      const mesh=new THREE.Mesh(geometry,makeMaterial(THREE,color));
      holder.add(mesh);
    }
    group.add(holder);
    for(const child of node.children||[])build(child,holder);
  };
  const root=result.root||{meshes:[],children:[]};
  const identity=new THREE.Group();identity.matrixAutoUpdate=false;identity.matrix.identity();
  build(root,identity);
  return group;
}

async function parseX3D(THREE,text){
  const xml=new DOMParser().parseFromString(text,"application/xml");
  if(xml.querySelector("parsererror"))throw new Error("Invalid X3D XML.");
  const group=new THREE.Group();
  for(const set of [...xml.getElementsByTagName("IndexedFaceSet")]){
    const coord=set.getElementsByTagName("Coordinate")[0];
    if(!coord)continue;
    const points=(coord.getAttribute("point")||"").trim().split(/\s+/).filter(Boolean).map(Number);
    const indices=(set.getAttribute("coordIndex")||"").trim().split(/\s+/).map(Number);
    const positions=[];
    let face=[];
    const flush=()=>{
      for(let i=1;i<face.length-1;i++){
        for(const id of [face[0],face[i],face[i+1]]){
          const p=id*3;
          if(p+2>=points.length)throw new Error("Invalid X3D coordinate index.");
          positions.push(points[p],points[p+1],points[p+2]);
        }
      }
      face=[];
    };
    for(const id of indices){if(id<0)flush();else face.push(id);}
    flush();
    if(positions.length){
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g,makeMaterial(THREE)));
    }
  }
  if(!group.children.length)throw new Error("No IndexedFaceSet geometry found in X3D.");
  return group;
}

async function loadZipModel(bytes){
  const JSZip=(await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
  const zip=await JSZip.loadAsync(bytes);
  const supported=/\.(stl|obj|3mf|glb|gltf|ply|off|step|stp|iges|igs|fbx|3ds|dae|amf|x3d|wrl)$/i;
  const entries=Object.values(zip.files).filter(x=>!x.dir&&supported.test(x.name));
  if(!entries.length)throw new Error("ZIP does not contain a supported 3D model file.");
  const preferred=entries.sort((a,b)=>{
    const rank=n=>/\.(step|stp|iges|igs|glb|3mf|stl)$/i.test(n)?0:1;
    return rank(a.name)-rank(b.name);
  })[0];
  const data=await preferred.async("uint8array");
  return loadParsedData(data,preferred.name);
}

function gltfParse(loader,bytes,name){
  return new Promise((resolve,reject)=>{
    loader.parse(bytes,"",g=>resolve(g.scene||g.scenes?.[0]),reject);
  });
}

async function loadParsedData(bytes,name){
  const ext=name.toLowerCase().split(".").pop();
  const {THREE,STLLoader,OBJLoader,ThreeMFLoader,GLTFLoader,PLYLoader,FBXLoader,TDSLoader,ColladaLoader,AMFLoader,VRMLLoader}=await loadThreeAndLoaders();
  const wrapGeometry=(geometry)=>{
    if(!geometry||!geometry.isBufferGeometry)throw new Error("The loader returned invalid geometry.");
    geometry.computeBoundingBox?.();
    geometry.computeVertexNormals?.();
    return new THREE.Mesh(geometry,makeMaterial(THREE));
  };
  if(ext==="zip")return loadZipModel(bytes);
  if(ext==="stl")return wrapGeometry(new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
  if(ext==="obj")return new OBJLoader().parse(new TextDecoder().decode(bytes));
  if(ext==="3mf")return new ThreeMFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  if(ext==="ply")return wrapGeometry(new PLYLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
  if(ext==="fbx")return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
  if(ext==="3ds")return new TDSLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
  if(ext==="dae"){
    const text=new TextDecoder().decode(bytes);
    const xml=new DOMParser().parseFromString(text,"application/xml");
    const unit=Number(xml.getElementsByTagName("unit")[0]?.getAttribute("meter")||1);
    const result=new ColladaLoader().parse(text,"");
    result.scene.userData.cosmicVolumeFactor=Math.pow(unit*1000,3)/1000;
    return result.scene;
  }
  if(ext==="amf")return new AMFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  if(ext==="wrl")return new VRMLLoader().parse(new TextDecoder().decode(bytes),"");
  if(ext==="x3d")return parseX3D(THREE,new TextDecoder().decode(bytes));
  if(ext==="off"){
    const a=new TextDecoder().decode(bytes).replace(/^OFF\s*/i,"").trim().split(/\s+/).map(Number),n=a[0],nf=a[1];
    let o=3;const v=[];for(let i=0;i<n;i++)v.push([a[o++],a[o++],a[o++]]);
    const pos=[];for(let i=0;i<nf;i++){const k=a[o++],ids=[];for(let j=0;j<k;j++)ids.push(a[o++]);for(let j=1;j<ids.length-1;j++)for(const id of [ids[0],ids[j],ids[j+1]])pos.push(...v[id]);}
    if(!pos.length)throw new Error("No OFF faces found.");
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    return new THREE.Mesh(g,makeMaterial(THREE));
  }
  if(ext==="glb"){
    const loader=new GLTFLoader();
    return gltfParse(loader,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name);
  }
  if(ext==="gltf"){
    const text=new TextDecoder().decode(bytes),json=JSON.parse(text);
    for(const b of json.buffers||[])if(b.uri&&!b.uri.startsWith("data:"))throw new Error("This GLTF references external files. Upload the model as GLB or ZIP the GLTF with its .bin/textures.");
    const loader=new GLTFLoader();
    return gltfParse(loader,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name);
  }
  if(ext==="step"||ext==="stp"||ext==="iges"||ext==="igs"){
    const occt=await loadOCCT();
    const params={linearUnit:"millimeter",linearDeflectionType:"bounding_box_ratio",linearDeflection:0.001,angularDeflection:0.5};
    const result=ext==="step"||ext==="stp"?occt.ReadStepFile(bytes,params):occt.ReadIgesFile(bytes,params);
    if(!result?.success)throw new Error("The CAD file could not be converted.");
    const object=occtResultToObject(THREE,result);
    object.userData.cosmicCadResult=result;
    object.userData.cosmicVolumeFactor=0.001;
    return object;
  }
  throw new Error("This format is not supported by the browser preview engine yet.");
}

function geometryVolumeCC(THREE,geometry,matrix,factor){
  const pos=geometry.getAttribute("position");
  if(!pos||pos.count<3)return 0;
  const index=geometry.getIndex();
  let volume=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const add=(ia,ib,ic)=>{
    a.fromBufferAttribute(pos,ia).applyMatrix4(matrix);
    b.fromBufferAttribute(pos,ib).applyMatrix4(matrix);
    c.fromBufferAttribute(pos,ic).applyMatrix4(matrix);
    volume+=(a.x*(b.y*c.z-b.z*c.y)-a.y*(b.x*c.z-b.z*c.x)+a.z*(b.x*c.y-b.y*c.x))/6;
  };
  if(index){for(let i=0;i+2<index.count;i+=3)add(index.getX(i),index.getX(i+1),index.getX(i+2));}
  else{for(let i=0;i+2<pos.count;i+=3)add(i,i+1,i+2);}
  return Math.abs(volume)*factor;
}

function calculateObjectVolume(THREE,object){
  object.updateMatrixWorld(true);
  const factor=Number(object.userData?.cosmicVolumeFactor)||0.001;
  let total=0;
  object.traverse(node=>{
    if(node.isMesh&&node.geometry)total+=geometryVolumeCC(THREE,node.geometry,node.matrixWorld,factor);
  });
  if(!Number.isFinite(total)||total<=0)throw new Error("The model was opened, but no positive enclosed volume could be measured.");
  return total;
}

async function parseFile(file){
  if(!file||file.size===0)throw new Error("The selected file is empty.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  const object=await loadParsedData(bytes,file.name);
  const {THREE}=await loadThreeAndLoaders();
  if(!object)throw new Error("The model could not be loaded.");
  return {object,THREE,volumeCC:calculateObjectVolume(THREE,object)};
}

async function loadModel(file){
  previewStatus("Loading 3D model…");
  try{
    const parsed=await parseFile(file);
    const v=ensureViewer(parsed.THREE);
    if(!v)throw new Error("3D preview area is unavailable.");
    if(v.object){v.scene.remove(v.object);disposeObject(v.object);v.object=null;}
    v.object=parsed.object;
    applyPreviewMaterial(v.object,parsed.THREE);
    v.scene.add(v.object);
    fitObject(v.object);
    previewStatus("3D preview ready • drag to rotate • scroll to zoom • right-click to pan","success");
    return parsed;
  }catch(error){
    console.error("Cosmic 3D preview:",error);
    previewStatus(error?.message||"Could not preview this model.","error");
    throw error;
  }
}

window.CosmicModelIO={parseFile,calculateVolume:async file=>(await parseFile(file)).volumeCC,loadModel};
window.CosmicPreview={loadModel};
})();