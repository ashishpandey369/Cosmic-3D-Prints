let previewThreePromise = null;
let viewer = null;

function previewStatus(message, type = "") {
  const el = document.querySelector("#model-preview-status");
  if (!el) return;
  el.textContent = message;
  el.className = "model-preview-status" + (type ? " " + type : "");
}

function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (previewThreePromise) return previewThreePromise;

  previewThreePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cosmic-three]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.THREE));
      existing.addEventListener("error", () => reject(new Error("Could not load the 3D viewer library.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.async = true;
    script.dataset.cosmicThree = "1";
    script.onload = () => window.THREE ? resolve(window.THREE) : reject(new Error("3D viewer library loaded incorrectly."));
    script.onerror = () => reject(new Error("Could not load the 3D viewer library. Check your internet connection or CDN access."));
    document.head.appendChild(script);
  });

  return previewThreePromise;
}

function disposeObject(object) {
  object?.traverse?.(node => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => material.dispose());
    }
  });
}

function ensureViewer(THREE) {
  if (viewer) return viewer;
  const canvas = document.querySelector("#model-preview-canvas");
  if (!canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x08131d, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08131d);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  camera.position.set(3, 2.5, 5);

  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x16212d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x42b5ff, 2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const grid = new THREE.GridHelper(10, 20, 0x27516b, 0x183242);
  grid.position.y = -1.01;
  scene.add(grid);

  viewer = { THREE, renderer, scene, camera, grid, object: null, dragging: false };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement || canvas);
  resize();

  let lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", e => {
    viewer.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!viewer.dragging || !viewer.object) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    viewer.object.rotation.y += dx * 0.01;
    viewer.object.rotation.x += dy * 0.01;
  });
  canvas.addEventListener("pointerup", () => viewer.dragging = false);
  canvas.addEventListener("pointercancel", () => viewer.dragging = false);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    if (!viewer.object) return;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    viewer.object.scale.multiplyScalar(factor);
  }, { passive: false });

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  return viewer;
}

function fitObject(object) {
  const { THREE, camera } = viewer;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error("The model has no visible geometry.");

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const scale = 3 / maxSize;

  object.scale.setScalar(scale);
  object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const fitted = new THREE.Box3().setFromObject(object);
  const fittedCenter = fitted.getCenter(new THREE.Vector3());
  object.position.sub(fittedCenter);

  const radius = fitted.getBoundingSphere(new THREE.Sphere()).radius || 1;
  camera.position.set(radius * 2.2, radius * 1.4, radius * 2.2);
  camera.near = Math.max(radius / 100, 0.001);
  camera.far = Math.max(radius * 100, 100);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function makeMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x35aef5,
    metalness: 0.25,
    roughness: 0.34,
    side: THREE.DoubleSide
  });
}

function parseSTL(THREE, input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const geometry=new THREE.BufferGeometry(),positions=[];
  const text=new TextDecoder().decode(bytes);
  const matches=[...text.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi)];
  if(matches.length>=3){
    for(const m of matches)positions.push(+m[1],+m[2],+m[3]);
  }else{
    if(bytes.length<84)throw new Error("The STL file is incomplete or is not a valid ASCII/binary STL.");
    const u32=i=>(bytes[i]|(bytes[i+1]<<8)|(bytes[i+2]<<16)|(bytes[i+3]<<24))>>>0;
    const f32=i=>{const ab=new ArrayBuffer(4),b=new Uint8Array(ab);b[0]=bytes[i];b[1]=bytes[i+1];b[2]=bytes[i+2];b[3]=bytes[i+3];return new Float32Array(ab)[0];};
    const count=u32(80),binarySize=84+count*50;
    if(!(count>0&&binarySize<=bytes.length))throw new Error("No STL triangles found.");
    let offset=84;
    for(let i=0;i<count;i++){
      offset+=12;
      for(let j=0;j<3;j++){const x=f32(offset),y=f32(offset+4),z=f32(offset+8);if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new Error("The STL contains invalid coordinate data.");positions.push(x,y,z);offset+=12;}
      offset+=2;
    }
  }
  if(positions.length<9)throw new Error("The STL file contains no usable geometry.");
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
function parseOBJ(THREE, text) {
  const vertices = [], positions = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v" && p.length >= 4) vertices.push([+p[1], +p[2], +p[3]]);
    if (p[0] === "f" && p.length >= 4) {
      const ids = p.slice(1).map(x => parseInt(x.split("/")[0], 10)).map(n => n < 0 ? vertices.length + n : n - 1);
      for (let i = 1; i < ids.length - 1; i++) {
        for (const id of [ids[0], ids[i], ids[i + 1]]) {
          const v = vertices[id];
          if (!v) throw new Error("Invalid OBJ face.");
          positions.push(v[0], v[1], v[2]);
        }
      }
    }
  }
  if (positions.length < 9) throw new Error("No OBJ faces found.");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

async function loadModel(file) {
  previewStatus("Loading 3D viewer…");
  try {
    const THREE = await loadThree();
    const v = ensureViewer(THREE);
    if (!v) throw new Error("3D preview area is unavailable.");

    if (v.object) {
      v.scene.remove(v.object);
      disposeObject(v.object);
      v.object = null;
    }

    const ext = file.name.toLowerCase().split(".").pop();
    let geometry;

    if (ext === "stl") {
      geometry = parseSTL(THREE, new Uint8Array(await file.arrayBuffer()));
    } else if (ext === "obj") {
      geometry = parseOBJ(THREE, await file.text());
    } else {
      throw new Error("Preview currently supports STL and OBJ. Your file can still be used for volume calculation and quoting.");
    }

    const mesh = new THREE.Mesh(geometry, makeMaterial(THREE));
    mesh.rotation.x = -Math.PI / 2;
    v.object = mesh;
    v.scene.add(mesh);
    fitObject(mesh);
    previewStatus("3D preview ready • drag to rotate • scroll to zoom", "success");
  } catch (error) {
    console.error("Cosmic 3D preview:", error);
    previewStatus(error?.message || "Could not preview this model.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("#cc-file");
  const preview = document.querySelector("#model-preview");

  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      preview?.classList.remove("visible");
      return;
    }
    preview?.classList.add("visible");
    previewStatus("Loading 3D preview…");
    loadModel(file);
  });
});
