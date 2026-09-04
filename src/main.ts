import * as THREE from 'three';
import './style.css';
import { BaselineAdapter, VoxelAdapter } from './adapters';
import { assertValidSharedScene, SAMPLE_SCENE, type RendererAdapter } from './scene-spec';
import { createContinuousInfrastructure, projectFlatPoint } from './world';

const root = document.querySelector<HTMLDivElement>('#scene-root');
const label = document.querySelector<HTMLSpanElement>('#mode-label');
const toggle = document.querySelector<HTMLButtonElement>('#mode-toggle');
if (!root || !label || !toggle) throw new Error('Tracer UI is incomplete');
const modeLabel = label;
const modeToggle = toggle;
assertValidSharedScene(SAMPLE_SCENE);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101827);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const benchmark = SAMPLE_SCENE.benchmarkCameraMarkers.overview;
camera.position.copy(projectFlatPoint({ x: benchmark.position[0], y: benchmark.position[1], z: benchmark.position[2] }));
camera.lookAt(projectFlatPoint({ x: benchmark.lookAt[0], y: benchmark.lookAt[1], z: benchmark.lookAt[2] }));
const world = new THREE.Group(); world.name = 'shared-world'; scene.add(world);
const infrastructure = createContinuousInfrastructure(); world.add(infrastructure.root);
root.dataset.continuousInfrastructureId = infrastructure.root.uuid;
root.dataset.continuousInfrastructureName = infrastructure.root.name;
root.dataset.continuousInfrastructureChildCount = String(infrastructure.root.children.length);
const adapterRoot = new THREE.Group(); adapterRoot.name = 'renderer-adapter-root'; world.add(adapterRoot);
let renderer: THREE.WebGLRenderer | undefined;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); root.appendChild(renderer.domElement); } catch { const canvas = document.createElement('canvas'); root.appendChild(canvas); const context = canvas.getContext('2d'); if (context) { context.fillStyle = '#101827'; context.fillRect(0, 0, canvas.width = innerWidth, canvas.height = innerHeight); context.fillStyle = '#ed6f8e'; context.fillRect(innerWidth / 2 - 50, innerHeight / 2 - 50, 100, 100); } }
let adapter: RendererAdapter = new BaselineAdapter();
function renderMode(): void { adapter.dispose(); adapterRoot.clear(); adapter = adapter.name === 'baseline' ? new VoxelAdapter() : new BaselineAdapter(); adapter.mount(SAMPLE_SCENE, adapterRoot); modeLabel.textContent = adapter.name === 'baseline' ? 'Baseline Mode' : 'Voxel Mode'; modeToggle.textContent = adapter.name === 'baseline' ? 'Switch to Voxel Mode' : 'Switch to Baseline Mode'; }
modeToggle.addEventListener('click', renderMode); adapter.mount(SAMPLE_SCENE, adapterRoot); modeLabel.textContent = 'Baseline Mode';
function resize(): void { const width = innerWidth; const height = innerHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer?.setSize(width, height, false); }
addEventListener('resize', resize); resize();
function frame(): void { if (renderer) renderer.render(scene, camera); requestAnimationFrame(frame); } frame();
