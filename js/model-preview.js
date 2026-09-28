const MODEL_VIEWER_VERSION = "0.180.0";
let viewer = null;

function previewStatus(message, type = "") {
  const el = document.querySelector("#model-preview-status");
  if (!el) return;
  el.textContent = message;
  el.className = "model-preview-status" + (type ? " " + type : "");
}

function disposeObject(object) {
  object?.traverse?.(node => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"]) {
          if (material[key]) material[key].dispose();
        }
        material.dispose();
      });
    }
  });
}

function ensureViewer() {
  if (viewer) return viewer;
  const canvas = document.querySelector("#model-preview-canvas");
  if (!canvas) return null;

  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x08131d, 0.0);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08131d);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100000);
  camera.position.set(3, 2.5, 5);

  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x16212d, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x42b5ff, 2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const grid = new THREE.GridHelper(10, 20, 0x27516b, 0x183242);
  grid.position.y = -1.01;
  scene.add(grid);

  viewer = { THREE, renderer, scene, camera, grid, object: null, controls: null };

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

  import("three/addons/controls/OrbitControls.js")
    .then(({ OrbitControls }) => {
      viewer.controls = new OrbitControls(camera, renderer.domElement);
      viewer.controls.enableDamping = true;
      viewer.controls.dampingFactor = 0.07;
      viewer.controls.minDistance = 0.05;
      viewer.controls.maxDistance = 100000;
    })
    .catch(() => {});

  function animate() {
    requestAnimationFrame(animate);
    viewer.controls?.update();
    renderer.render(scene, camera);
  }
  animate();

  return viewer;
}

function centerAndFit(object) {
  const v = viewer;
  const { THREE, camera } = v;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error("The model has no visible geometry.");

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const scale = 3 / maxSize;

  object.scale.multiplyScalar(scale);
  object.position.sub(center.multiplyScalar(scale));

  const fitted = new THREE.Box3().setFromObject(object);
  const fittedCenter = fitted.getCenter(new THREE.Vector3());
  object.position.sub(fittedCenter);

  const radius = fitted.getBoundingSphere(new THREE.Sphere()).radius || 1;
  camera.position.set(radius * 2.2, radius * 1.45, radius * 2.2);
  camera.near = Math.max(radius / 1000, 0.001);
  camera.far = Math.max(radius * 100, 100);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  if (v.controls) {
    v.controls.target.set(0, 0, 0);
    v.controls.minDistance = radius * 1.1;
    v.controls.maxDistance = radius * 20;
    v.controls.update();
  }
}

function makeMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x2da9f7,
    metalness: 0.32,
    roughness: 0.34,
    side: THREE.DoubleSide
  });
}

async function loadModel(file) {
  const v = ensureViewer();
  if (!v) return;

  if (v.object) {
    v.scene.remove(v.object);
    disposeObject(v.object);
    v.object = null;
  }

  const ext = file.name.toLowerCase().split(".").pop();
  const url = URL.createObjectURL(file);

  try {
    let object;

    if (ext === "stl") {
      const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
      const geometry = await new STLLoader().loadAsync(url);
      geometry.computeVertexNormals();
      object = new v.THREE.Mesh(geometry, makeMaterial(v.THREE));
    } else if (ext === "obj") {
      const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
      object = await new OBJLoader().loadAsync(url);
      object.traverse(node => {
        if (node.isMesh) node.material = makeMaterial(v.THREE);
      });
    } else if (ext === "glb" || ext === "gltf") {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      object = (await new GLTFLoader().loadAsync(url)).scene;
    } else if (ext === "3mf") {
      const { ThreeMFLoader } = await import("three/addons/loaders/3MFLoader.js");
      object = await new ThreeMFLoader().loadAsync(url);
      object.traverse(node => {
        if (node.isMesh && !node.material) node.material = makeMaterial(v.THREE);
      });
    } else {
      throw new Error("Preview is currently available for STL, OBJ, 3MF, GLB and GLTF. This file can still be used for manual quoting.");
    }

    object.traverse?.(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (!node.material) node.material = makeMaterial(v.THREE);
      }
    });

    v.object = object;
    v.scene.add(object);
    centerAndFit(object);
    previewStatus("3D preview ready • drag to rotate • scroll to zoom", "success");
  } catch (error) {
    previewStatus(error?.message || "Could not preview this model.", "error");
  } finally {
    URL.revokeObjectURL(url);
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
