import * as THREE from 'three';
import './style.css';
import { BaselineAdapter, VoxelAdapter } from './adapters';
import { assertValidSharedScene, SAMPLE_SCENE, type RendererAdapter } from './scene-spec';
import { createContinuousInfrastructure } from './world';
import { applyLook, createPlayerState, DEFAULT_EYE_HEIGHT, movePlayer, playerStateFromMarker, updateCameraFromPlayer, type PlayerState } from './gameplay';

const root = document.querySelector<HTMLDivElement>('#scene-root');
const modeLabel = document.querySelector<HTMLSpanElement>('#mode-label');
const modeToggle = document.querySelector<HTMLButtonElement>('#mode-toggle');
const activeMarkerLabel = document.querySelector<HTMLSpanElement>('#active-marker');
const telemetryFrame = document.querySelector<HTMLSpanElement>('#telemetry-frame');
const telemetryDraw = document.querySelector<HTMLSpanElement>('#telemetry-draw');
const telemetryTriangles = document.querySelector<HTMLSpanElement>('#telemetry-triangles');
if (!root || !modeLabel || !modeToggle || !activeMarkerLabel || !telemetryFrame || !telemetryDraw || !telemetryTriangles) throw new Error('Playable HUD is incomplete');
const sceneRoot = root;
const hudModeLabel = modeLabel;
const hudModeToggle = modeToggle;
const hudActiveMarker = activeMarkerLabel;
const hudTelemetryFrame = telemetryFrame;
const hudTelemetryDraw = telemetryDraw;
const hudTelemetryTriangles = telemetryTriangles;
assertValidSharedScene(SAMPLE_SCENE);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101827);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
const world = new THREE.Group(); world.name = 'shared-world'; scene.add(world);
const infrastructure = createContinuousInfrastructure(); world.add(infrastructure.root);
sceneRoot.dataset.continuousInfrastructureId = infrastructure.root.uuid;
sceneRoot.dataset.continuousInfrastructureName = infrastructure.root.name;
sceneRoot.dataset.continuousInfrastructureChildCount = String(infrastructure.root.children.length);
const lights = new THREE.Group(); lights.name = 'shared-lights'; world.add(lights);
lights.add(new THREE.HemisphereLight(0xd9ecff, 0x18222c, 1.7));
const sun = new THREE.DirectionalLight(0xffe4c2, 2.2); sun.position.set(-35, 45, 22); lights.add(sun);

const adapterRoot = new THREE.Group(); adapterRoot.name = 'renderer-adapter-root'; world.add(adapterRoot);
let renderer: THREE.WebGLRenderer | undefined;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  sceneRoot.appendChild(renderer.domElement);
} catch {
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Renderer fallback'); sceneRoot.appendChild(canvas);
  const context = canvas.getContext('2d');
  if (context) { canvas.width = innerWidth; canvas.height = innerHeight; context.fillStyle = '#101827'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#ed6f8e'; context.fillRect(innerWidth / 2 - 50, innerHeight / 2 - 50, 100, 100); }
}

let adapter: RendererAdapter = new BaselineAdapter();
const player: PlayerState = createPlayerState(0, 18);
const keys = new Set<string>();
let lastFrame = performance.now();
let telemetryAt = lastFrame;
let activeMarker = 'free';

function updateHooks(): void {
  sceneRoot.dataset.mode = adapter.name;
  sceneRoot.dataset.baselineEntityCount = String(adapterRoot.userData.baselineEntityIds?.length ?? 0);
  sceneRoot.dataset.voxelEntityCount = String(adapterRoot.userData.voxelEntityIds?.length ?? 0);
  sceneRoot.dataset.voxelChunkMeshCount = String(adapterRoot.userData.voxelChunkMeshCount ?? 0);
  sceneRoot.dataset.voxelUniqueMaterialCount = String(adapterRoot.userData.voxelUniqueMaterialCount ?? 0);
  sceneRoot.dataset.voxelAtlasTextureCount = String(adapterRoot.userData.voxelAtlasTextureCount ?? 0);
  sceneRoot.dataset.sampleSceneReference = String(SAMPLE_SCENE.seed);
  sceneRoot.dataset.activeMarker = activeMarker;
  hudActiveMarker.textContent = activeMarker === 'free' ? 'Free' : activeMarker;
}
function updatePlayerHook(): void {
  sceneRoot.dataset.playerX = player.x.toFixed(3);
  sceneRoot.dataset.playerZ = player.z.toFixed(3);
  sceneRoot.dataset.playerEyeHeight = player.eyeHeight.toFixed(3);
  sceneRoot.dataset.playerYaw = player.yaw.toFixed(3);
  sceneRoot.dataset.playerPitch = player.pitch.toFixed(3);
}

function mountMode(next: RendererAdapter): void {
  adapter.dispose(); adapterRoot.clear(); adapter = next; adapter.mount(SAMPLE_SCENE, adapterRoot);
  hudModeLabel.textContent = adapter.name === 'baseline' ? 'Baseline Mode' : 'Voxel Mode';
  hudModeToggle.textContent = adapter.name === 'baseline' ? 'Switch to Voxel Mode' : 'Switch to Baseline Mode';
  updateHooks();
}
function toggleMode(): void { mountMode(adapter.name === 'baseline' ? new VoxelAdapter() : new BaselineAdapter()); }
hudModeToggle.addEventListener('click', toggleMode);
adapter.mount(SAMPLE_SCENE, adapterRoot); hudModeLabel.textContent = 'Baseline Mode'; updateHooks(); updatePlayerHook();

function setMarker(name: string): void {
  const marker = SAMPLE_SCENE.benchmarkCameraMarkers[name];
  if (!marker) return;
  const next = playerStateFromMarker(marker);
  Object.assign(player, next); activeMarker = name; updateHooks(); updatePlayerHook(); updateCameraFromPlayer(camera, player);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-marker]')) button.addEventListener('click', () => setMarker(button.dataset.marker ?? ''));
addEventListener('keydown', (event) => {
  if (event.key === '1') setMarker('overview');
  else if (event.key === '2') setMarker('crossing');
  else if (event.key === '3') setMarker('railway');
  else keys.add(event.key.toLowerCase());
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
sceneRoot.addEventListener('click', () => renderer?.domElement.requestPointerLock());
addEventListener('mousemove', (event) => { if (document.pointerLockElement === renderer?.domElement) { applyLook(player, event.movementX * 0.0022, -event.movementY * 0.0022); activeMarker = 'free'; updateHooks(); updatePlayerHook(); } });

function resize(): void { const width = innerWidth; const height = innerHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer?.setSize(width, height, false); }
addEventListener('resize', resize); resize();

function readMovement(): { forward: number; strafe: number } {
  return { forward: Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')), strafe: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) };
}

function frame(): void {
  const now = performance.now(); const dt = Math.min((now - lastFrame) / 1000, 0.25); lastFrame = now;
  const input = readMovement();
  if (activeMarker !== 'free' && (input.forward !== 0 || input.strafe !== 0)) { player.eyeHeight = DEFAULT_EYE_HEIGHT; activeMarker = 'free'; updateHooks(); }
  const next = movePlayer(player, input, dt, SAMPLE_SCENE); Object.assign(player, next); updatePlayerHook(); updateCameraFromPlayer(camera, player);
  if (renderer) renderer.render(scene, camera);
  if (now - telemetryAt >= 200) {
    const frameMs = dt * 1000; hudTelemetryFrame.textContent = `Frame ${frameMs.toFixed(1)} ms`;
    hudTelemetryDraw.textContent = renderer ? `Draw ${renderer.info.render.calls}` : 'Draw —';
    hudTelemetryTriangles.textContent = renderer ? `Triangles ${renderer.info.render.triangles}` : 'Triangles —'; telemetryAt = now;
    sceneRoot.dataset.rendererDrawCalls = renderer ? String(renderer.info.render.calls) : '0';
  }
  requestAnimationFrame(frame);
}
frame();
