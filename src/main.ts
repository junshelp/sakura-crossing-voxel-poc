import * as THREE from 'three';
import './style.css';
import { BaselineAdapter, VoxelAdapter } from './adapters';
import { assertValidSharedScene, SAMPLE_SCENE, type RendererAdapter } from './scene-spec';
import { createContinuousInfrastructure } from './world';
import { activateCurrentInteraction, applyLook, createPlayerState, DEFAULT_EYE_HEIGHT, movePlayer, playerStateFromMarker, resolveInteraction, type ResolvedInteraction, updateCameraFromPlayer, type PlayerState } from './gameplay';
import { createCrossingSimulation, TRAIN_INITIAL_OFFSET } from './simulation';
import { applySimulationSnapshot } from './runtime/visual-binding';
import { BENCHMARK_SCHEMA, DIAGNOSTIC_DURATIONS, LEG_ORDER, STANDARD_DURATIONS, FrameSampler, cameraMarkerAt, downloadReport, evaluateThresholds, validateBenchmarkReport, type BenchmarkDurations, type BenchmarkReport, type BenchmarkMode } from './benchmark';
declare const __SOURCE_COMMIT__: string;
declare const __DIRTY_BUILD__: boolean;

const root = document.querySelector<HTMLDivElement>('#scene-root');
const modeLabel = document.querySelector<HTMLSpanElement>('#mode-label');
const modeToggle = document.querySelector<HTMLButtonElement>('#mode-toggle');
const activeMarkerLabel = document.querySelector<HTMLSpanElement>('#active-marker');
const telemetryFrame = document.querySelector<HTMLSpanElement>('#telemetry-frame');
const telemetryDraw = document.querySelector<HTMLSpanElement>('#telemetry-draw');
const telemetryTriangles = document.querySelector<HTMLSpanElement>('#telemetry-triangles');
const interactionPrompt = document.querySelector<HTMLButtonElement>('#interaction-prompt');
const interactionState = document.querySelector<HTMLSpanElement>('#interaction-state');
if (!root || !modeLabel || !modeToggle || !activeMarkerLabel || !telemetryFrame || !telemetryDraw || !telemetryTriangles || !interactionPrompt || !interactionState) throw new Error('Playable HUD is incomplete');
const sceneRoot = root;
const hudModeLabel = modeLabel;
const hudModeToggle = modeToggle;
const hudActiveMarker = activeMarkerLabel;
const hudTelemetryFrame = telemetryFrame;
const hudTelemetryDraw = telemetryDraw;
const hudTelemetryTriangles = telemetryTriangles;
const hudInteractionPrompt = interactionPrompt;
const hudInteractionState = interactionState;
const benchmarkRun = document.querySelector<HTMLButtonElement>('#benchmark-run')!;
const benchmarkDiagnostic = document.querySelector<HTMLButtonElement>('#benchmark-diagnostic')!;
const benchmarkCancel = document.querySelector<HTMLButtonElement>('#benchmark-cancel')!;
const benchmarkDownload = document.querySelector<HTMLButtonElement>('#benchmark-download')!;
const benchmarkStatus = document.querySelector<HTMLSpanElement>('#benchmark-status')!;
const benchmarkProfile = document.querySelector<HTMLInputElement>('#benchmark-profile')!;
const benchmarkPower = document.querySelector<HTMLInputElement>('#benchmark-power')!;
if (!benchmarkRun || !benchmarkDiagnostic || !benchmarkCancel || !benchmarkDownload || !benchmarkStatus || !benchmarkProfile || !benchmarkPower) throw new Error('Benchmark HUD is incomplete');
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
const simulation = createCrossingSimulation();
const player: PlayerState = createPlayerState(0, 18);
const keys = new Set<string>();
let lastFrame = performance.now();
let telemetryAt = lastFrame;
let activeMarker = 'free';
let currentInteraction: ResolvedInteraction | null = null;
let benchmarkBusy = false;
let lastBenchmark: BenchmarkReport | null = null;
type SavedBenchmarkState = { mode: BenchmarkMode; player: PlayerState; marker: string; simulation: ReturnType<typeof createCrossingSimulation>['snapshot']; dpr: number; size: THREE.Vector2; cameraAspect: number };
type ActiveBenchmark = { diagnostic: boolean; durations: BenchmarkDurations; saved: SavedBenchmarkState; initial: ReturnType<typeof createCrossingSimulation>['snapshot']; index: number; legStart: number; previous: number | null; sampler: FrameSampler | null; legs: BenchmarkReport['legs'] };
let activeBenchmark: ActiveBenchmark | null = null;

function updateInteractionHooks(): void {
  currentInteraction = resolveInteraction(SAMPLE_SCENE, player);
  sceneRoot.dataset.currentInteractionId = currentInteraction?.interactionId ?? '';
  sceneRoot.dataset.currentInteractionLabel = currentInteraction?.label ?? '';
  hudInteractionPrompt.hidden = !currentInteraction;
  hudInteractionPrompt.textContent = currentInteraction ? `E · ${currentInteraction.label}` : 'No interaction in range';
  hudInteractionState.textContent = currentInteraction ? `${currentInteraction.label} (${currentInteraction.distance.toFixed(1)} m)` : 'No interaction in range';
}

function updateSimulationHooks(): void {
  const snapshot = simulation.snapshot;
  sceneRoot.dataset.crossingPhase = snapshot.crossingPhase;
  sceneRoot.dataset.trainOffset = snapshot.trainOffset.toFixed(3);
  sceneRoot.dataset.barrierClosure = snapshot.barrierClosure.toFixed(3);
  sceneRoot.dataset.barrierClosed = String(snapshot.barrierClosed);
  sceneRoot.dataset.warningActive = String(snapshot.warningActive);
  sceneRoot.dataset.dispensedDrink = String(snapshot.dispensedDrink);
  applySimulationSnapshot(adapterRoot, snapshot);
}

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
  updateSimulationHooks();
  updateInteractionHooks();
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
function toggleMode(): void { if (!benchmarkBusy) mountMode(adapter.name === 'baseline' ? new VoxelAdapter() : new BaselineAdapter()); }
hudModeToggle.addEventListener('click', toggleMode);
adapter.mount(SAMPLE_SCENE, adapterRoot); hudModeLabel.textContent = 'Baseline Mode'; updateHooks(); updatePlayerHook();

function activateCurrent(): void {
  if (benchmarkBusy) return;
  const result = activateCurrentInteraction(simulation, SAMPLE_SCENE, player);
  if (result.activated) { updateSimulationHooks(); updateInteractionHooks(); }
}
hudInteractionPrompt.addEventListener('click', (event) => { event.stopPropagation(); activateCurrent(); });

function setMarker(name: string, force = false): void {
  if (benchmarkBusy && !force) return;
  const marker = SAMPLE_SCENE.benchmarkCameraMarkers[name];
  if (!marker) return;
  const next = playerStateFromMarker(marker);
  Object.assign(player, next); activeMarker = name; updateHooks(); updatePlayerHook(); updateCameraFromPlayer(camera, player);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-marker]')) button.addEventListener('click', () => setMarker(button.dataset.marker ?? ''));
addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.matches('input, textarea, [contenteditable="true"]')) return;
  if (benchmarkBusy) { if (event.key !== 'Tab' && event.key !== 'Enter') event.preventDefault(); return; }
  if (event.key === '1') setMarker('overview');
  else if (event.key === '2') setMarker('crossing');
  else if (event.key === '3') setMarker('railway');
  else if (event.key.toLowerCase() === 'e') { event.preventDefault(); activateCurrent(); }
  else keys.add(event.key.toLowerCase());
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
sceneRoot.addEventListener('click', () => { if (!benchmarkBusy) renderer?.domElement.requestPointerLock(); });
addEventListener('mousemove', (event) => { if (!benchmarkBusy && document.pointerLockElement === renderer?.domElement) { applyLook(player, event.movementX * 0.0022, -event.movementY * 0.0022); activeMarker = 'free'; updateHooks(); updatePlayerHook(); } });

function resize(): void { const width = benchmarkBusy ? 1600 : innerWidth; const height = benchmarkBusy ? 900 : innerHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer?.setSize(width, height, false); }
addEventListener('resize', resize); resize();

function readMovement(): { forward: number; strafe: number } {
  if (benchmarkBusy) return { forward: 0, strafe: 0 };
  return { forward: Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')), strafe: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) };
}

function rendererProfile(): { renderer: string; hardware: string } {
  const gl = renderer?.getContext(); const info = gl?.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number; UNMASKED_VENDOR_WEBGL: number } | null;
  return { renderer: info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? 'unknown') : 'unknown', hardware: info ? String(gl?.getParameter(info.UNMASKED_VENDOR_WEBGL) ?? 'unknown') : 'unknown' };
}
function gpuTimerStatus(): 'unsupported' | 'not-measured' { const gl = renderer?.getContext(); return gl?.getExtension('EXT_disjoint_timer_query_webgl2') ? 'not-measured' : 'unsupported'; }
function generatedGeometryBytes(): number | null { const buffers = new Set<ArrayBufferLike>(); adapterRoot.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (!g) return; Object.values(g.attributes).forEach(a => buffers.add(a.array.buffer)); if (g.index) buffers.add(g.index.array.buffer); }); return buffers.size ? [...buffers].reduce((n, b) => n + b.byteLength, 0) : null; }
function restoreBenchmark(reason?: string): void { const run = activeBenchmark; if (!run || !renderer) return; activeBenchmark = null; benchmarkBusy = false; keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); mountMode(run.saved.mode === 'baseline' ? new BaselineAdapter() : new VoxelAdapter()); Object.assign(player, run.saved.player); activeMarker = run.saved.marker; simulation.restore(run.saved.simulation); renderer.setPixelRatio(run.saved.dpr); renderer.setSize(run.saved.size.x, run.saved.size.y, false); camera.aspect = run.saved.cameraAspect; camera.updateProjectionMatrix(); updateCameraFromPlayer(camera, player); lastFrame = performance.now(); updateHooks(); updatePlayerHook(); benchmarkRun.disabled = benchmarkDiagnostic.disabled = benchmarkProfile.disabled = benchmarkPower.disabled = false; benchmarkCancel.hidden = true; if (reason) { lastBenchmark = null; benchmarkDownload.hidden = true; benchmarkStatus.textContent = `Benchmark invalidated: ${reason}`; } }
function beginBenchmark(diagnostic: boolean): void { if (benchmarkBusy || !renderer) return; const size = renderer.getSize(new THREE.Vector2()); benchmarkBusy = true; benchmarkRun.disabled = benchmarkDiagnostic.disabled = benchmarkProfile.disabled = benchmarkPower.disabled = true; benchmarkCancel.hidden = false; benchmarkDownload.hidden = true; activeBenchmark = { diagnostic, durations: diagnostic ? DIAGNOSTIC_DURATIONS : STANDARD_DURATIONS, saved: { mode: adapter.name as BenchmarkMode, player: { ...player }, marker: activeMarker, simulation: simulation.snapshot, dpr: renderer.getPixelRatio(), size, cameraAspect: camera.aspect }, initial: createCrossingSimulation(TRAIN_INITIAL_OFFSET).snapshot, index: 0, legStart: 0, previous: null, sampler: null, legs: [] }; renderer.setPixelRatio(1); renderer.setSize(1600, 900, false); camera.aspect = 1600 / 900; camera.updateProjectionMatrix(); keys.clear(); }
function finishBenchmark(run: ActiveBenchmark): void { const profile = rendererProfile(); const report: BenchmarkReport = { schema: BENCHMARK_SCHEMA, diagnostic: run.diagnostic, seed: SAMPLE_SCENE.seed, durations: run.durations, legs: run.legs, referenceProfile: { profileName: benchmarkProfile.value.trim() || 'unknown', userAgent: navigator.userAgent || 'unknown', platform: navigator.platform || 'unknown', hardware: profile.hardware, renderer: profile.renderer, viewport: { width: 1600, height: 900 }, dpr: 1, timestamp: new Date().toISOString(), sourceCommit: __SOURCE_COMMIT__ || 'unknown', dirtyBuild: __DIRTY_BUILD__, hardwarePowerContext: benchmarkPower.value.trim() || 'unknown' }, gpuTimer: { status: gpuTimerStatus(), values: null }, conclusion: evaluateThresholds(run.legs, run.diagnostic) }; if (!validateBenchmarkReport(report)) { restoreBenchmark('report validation failed'); return; } lastBenchmark = report; restoreBenchmark(); benchmarkDownload.hidden = false; benchmarkStatus.textContent = run.diagnostic ? 'Diagnostic complete (inconclusive by design)' : `Complete: ${report.conclusion.status}`; }
benchmarkRun.addEventListener('click', () => beginBenchmark(false));
benchmarkDiagnostic.addEventListener('click', () => beginBenchmark(true));
benchmarkCancel.addEventListener('click', () => restoreBenchmark('cancelled'));
benchmarkDownload.addEventListener('click', () => { if (lastBenchmark) downloadReport(lastBenchmark); });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') restoreBenchmark('visibility lost'); });
renderer?.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); restoreBenchmark('WebGL context lost'); });

function frame(): void {
  let now = performance.now(); const dt = Math.min((now - lastFrame) / 1000, 0.25); lastFrame = now;
  const run = activeBenchmark;
  if (run && renderer) {
    try {
      if (run.legStart === 0) {
      const mode = LEG_ORDER[run.index]; const mountedAt = performance.now();
      mountMode(mode === 'baseline' ? new BaselineAdapter() : new VoxelAdapter());
      const mountMs = performance.now() - mountedAt;
      simulation.restore(run.initial); setMarker('overview', true);
      now = performance.now(); run.legStart = now; run.previous = null; run.sampler = new FrameSampler(now, run.durations);
      adapterRoot.userData.benchmarkMountMs = mountMs;
      benchmarkStatus.textContent = `${run.diagnostic ? 'Diagnostic ' : ''}leg ${run.index + 1}/6 (${mode})`;
      }
    const elapsed = now - run.legStart;
    setMarker(cameraMarkerAt(elapsed, run.durations), true);
    // Every benchmark frame is derived from the same initial snapshot and the
    // same elapsed clock; the ordinary gameplay dt clamp never participates.
    simulation.restore(run.initial); simulation.step(elapsed / 1000); updateSimulationHooks(); updateInteractionHooks(); updateCameraFromPlayer(camera, player);
    // Renderer telemetry still describes the preceding render, which is the
    // frame whose interval closes at `now`; sample it before issuing this one.
    if (run.previous !== null) run.sampler?.add(run.previous, now, { frameMs: now - run.previous, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textureCount: renderer.info.memory.textures, shaderProgramCount: renderer.info.programs?.length ?? 0 });
    renderer.render(scene, camera);
    sceneRoot.dataset.rendererDrawCalls = String(renderer.info.render.calls);
    sceneRoot.dataset.benchmarkLeg = String(run.index);
    sceneRoot.dataset.benchmarkStatus = 'running';
    sceneRoot.dataset.benchmarkWidth = String(renderer.domElement.width);
    sceneRoot.dataset.benchmarkHeight = String(renderer.domElement.height);
    run.previous = now;
    if (elapsed >= run.durations.warmupMs + run.durations.sampleMs) {
      run.legs.push(run.sampler!.summarize(LEG_ORDER[run.index], run.index, Number(adapterRoot.userData.benchmarkMountMs), generatedGeometryBytes()));
      run.index++; run.legStart = 0; run.previous = null; run.sampler = null;
      if (run.index === LEG_ORDER.length) finishBenchmark(run);
    }
    } catch (error) { restoreBenchmark(error instanceof Error ? error.message : 'runtime failure'); }
    requestAnimationFrame(frame); return;
  }
  const input = readMovement();
  if (activeMarker !== 'free' && (input.forward !== 0 || input.strafe !== 0)) { player.eyeHeight = DEFAULT_EYE_HEIGHT; activeMarker = 'free'; updateHooks(); }
  const next = movePlayer(player, input, dt, SAMPLE_SCENE); Object.assign(player, next); updatePlayerHook(); updateCameraFromPlayer(camera, player);
  simulation.step(dt); updateSimulationHooks(); updateInteractionHooks();
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
