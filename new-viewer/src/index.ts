import * as THREE from "three";
import { SparkControls, SplatFileType, SplatMesh, VRButton } from "@sparkjsdev/spark";

const DEFAULT_SPZ_URL = "./splats/demo.spz";
const TARGET_SCENE_MAX_DIM_METERS = 900;
const HUMAN_EYE_HEIGHT_METERS = 1.7;

const query = new URLSearchParams(window.location.search);
const spzUrl = query.get("spz") || DEFAULT_SPZ_URL;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0b0d11");

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  1000,
);

const cameraRig = new THREE.Group();
cameraRig.position.set(0, 1.6, 2.5);
cameraRig.add(camera);
scene.add(cameraRig);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

const controls = new SparkControls({ canvas: renderer.domElement });
controls.fpsMovement.xr = renderer.xr;
controls.fpsMovement.moveSpeed = 1.8;
controls.fpsMovement.shiftMultiplier = 2.5;

const vrButton = VRButton.createButton(renderer, {
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["bounded-floor", "hand-tracking", "layers"],
});
if (vrButton) {
  document.body.appendChild(vrButton);
}

const help = document.createElement("div");
help.style.position = "fixed";
help.style.top = "16px";
help.style.left = "16px";
help.style.maxWidth = "min(560px, 85vw)";
help.style.padding = "10px 12px";
help.style.borderRadius = "10px";
help.style.background = "rgba(6, 8, 12, 0.75)";
help.style.backdropFilter = "blur(6px)";
help.style.color = "#e6edf3";
help.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
help.style.fontSize = "12px";
help.style.lineHeight = "1.35";
help.style.zIndex = "20";
document.body.appendChild(help);

const filePicker = document.createElement("input");
filePicker.type = "file";
filePicker.accept = ".spz,.ply,.splat,.ksplat";
filePicker.style.position = "fixed";
filePicker.style.top = "16px";
filePicker.style.right = "16px";
filePicker.style.zIndex = "20";
filePicker.style.maxWidth = "40vw";
document.body.appendChild(filePicker);

const grid = new THREE.GridHelper(40, 40, 0x27405b, 0x13202e);
grid.position.y = -0.01;
scene.add(grid);

let activeSplat: SplatMesh | null = null;
let activeSplatRoot: THREE.Group | null = null;

function inferFileType(fileName: string): SplatFileType | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".spz")) return SplatFileType.SPZ;
  if (lower.endsWith(".ply")) return SplatFileType.PLY;
  if (lower.endsWith(".splat")) return SplatFileType.SPLAT;
  if (lower.endsWith(".ksplat")) return SplatFileType.KSPLAT;
  return undefined;
}

function updateHelp(message: string, source: string): void {
  const inXR = renderer.xr.isPresenting ? "yes" : "no";
  help.innerHTML = [
    `<div><strong>SPZ WebVR Viewer (Meta Quest target)</strong></div>`,
    `<div>Source: ${source}</div>`,
    `<div>Status: ${message}</div>`,
    `<div>Desktop: drag (rotate), right-drag/two-finger (slide), wheel (move), WASD.</div>`,
    `<div>XR: Enter VR button, then use thumbsticks to rotate + locomote.</div>`,
    `<div>XR active: ${inXR}</div>`,
  ].join("");
}

function recenterView(mesh: SplatMesh, root: THREE.Group): void {
  const bounds = mesh.getBoundingBox(true);
  if (bounds.isEmpty()) {
    return;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const fitScale = THREE.MathUtils.clamp(
    TARGET_SCENE_MAX_DIM_METERS / maxDim,
    0.2,
    300,
  );

  // SPZ captures are commonly upside down in this scene orientation.
  root.rotation.set(Math.PI, 0, 0);
  root.scale.setScalar(fitScale);
  mesh.position.set(-center.x, -center.y, -center.z);

  const fittedMaxDim = maxDim * fitScale;
  const fittedHeight = size.y * fitScale;
  const distance = THREE.MathUtils.clamp(fittedMaxDim * 0.12, 1.2, 12);
  const floorY = -fittedHeight * 0.5;
  const eyeY = floorY + HUMAN_EYE_HEIGHT_METERS;

  cameraRig.position.set(0, eyeY, distance);
  cameraRig.lookAt(0, eyeY, 0);
}

async function loadSplatFromUrl(url: string): Promise<void> {
  updateHelp("Loading splat...", url);

  if (activeSplat) {
    if (activeSplatRoot) {
      scene.remove(activeSplatRoot);
      activeSplatRoot = null;
    } else {
      scene.remove(activeSplat);
    }
    activeSplat.dispose();
    activeSplat = null;
  }

  const mesh = new SplatMesh({
    url,
    onLoad: () => {
      updateHelp("Loaded", url);
    },
  });

  const root = new THREE.Group();
  root.add(mesh);
  scene.add(root);
  activeSplat = mesh;
  activeSplatRoot = root;

  await mesh.initialized;
  recenterView(mesh, root);
  updateHelp("Loaded and centered", url);
}

async function loadSplatFromFile(file: File): Promise<void> {
  updateHelp("Reading local file...", file.name);

  if (activeSplat) {
    if (activeSplatRoot) {
      scene.remove(activeSplatRoot);
      activeSplatRoot = null;
    } else {
      scene.remove(activeSplat);
    }
    activeSplat.dispose();
    activeSplat = null;
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const mesh = new SplatMesh({
    fileName: file.name,
    fileType: inferFileType(file.name),
    fileBytes,
    onLoad: () => {
      updateHelp("Loaded", file.name);
    },
  });

  const root = new THREE.Group();
  root.add(mesh);
  scene.add(root);
  activeSplat = mesh;
  activeSplatRoot = root;

  await mesh.initialized;
  recenterView(mesh, root);
  updateHelp("Loaded and centered", file.name);
}

filePicker.addEventListener("change", async () => {
  const file = filePicker.files?.[0];
  if (!file) {
    return;
  }

  try {
    await loadSplatFromFile(file);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown file load error";
    updateHelp(`Load failed: ${detail}`, file.name);
    console.error(error);
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyR") {
    return;
  }
  if (activeSplat && activeSplatRoot) {
    recenterView(activeSplat, activeSplatRoot);
    updateHelp("View recentered", filePicker.files?.[0]?.name ?? spzUrl);
  }
});

renderer.setAnimationLoop(() => {
  controls.update(cameraRig);
  renderer.render(scene, camera);
});

updateHelp("Initializing", spzUrl);
loadSplatFromUrl(spzUrl).catch((error) => {
  const detail = error instanceof Error ? error.message : "Unknown URL load error";
  updateHelp(`Initial load failed: ${detail}`, spzUrl);
  console.error(error);
});
