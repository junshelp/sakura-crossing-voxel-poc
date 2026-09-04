import * as THREE from 'three';
import './style.css';
import { BaselineAdapter, VoxelAdapter } from './adapters';
import { SAMPLE_SCENE, type RendererAdapter } from './scene-spec';

const root = document.querySelector<HTMLDivElement>('#scene-root');
const label = document.querySelector<HTMLSpanElement>('#mode-label');
const toggle = document.querySelector<HTMLButtonElement>('#mode-toggle');
if (!root || !label || !toggle) throw new Error('Tracer UI is incomplete');
const modeLabel = label;
const modeToggle = toggle;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101827);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.set(0, 5, 14); camera.lookAt(0, 0, 0);
const world = new THREE.Group(); scene.add(world);
let renderer: THREE.WebGLRenderer | undefined;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); root.appendChild(renderer.domElement); } catch { const canvas = document.createElement('canvas'); root.appendChild(canvas); const context = canvas.getContext('2d'); if (context) { context.fillStyle = '#101827'; context.fillRect(0, 0, canvas.width = innerWidth, canvas.height = innerHeight); context.fillStyle = '#ed6f8e'; context.fillRect(innerWidth / 2 - 50, innerHeight / 2 - 50, 100, 100); } }
let adapter: RendererAdapter = new BaselineAdapter();
function renderMode(): void { adapter.dispose(); world.clear(); adapter = adapter.name === 'baseline' ? new VoxelAdapter() : new BaselineAdapter(); adapter.mount(SAMPLE_SCENE, world); modeLabel.textContent = adapter.name === 'baseline' ? 'Baseline Mode' : 'Voxel Mode'; modeToggle.textContent = adapter.name === 'baseline' ? 'Switch to Voxel Mode' : 'Switch to Baseline Mode'; }
modeToggle.addEventListener('click', renderMode); adapter.mount(SAMPLE_SCENE, world); modeLabel.textContent = 'Baseline Mode';
function resize(): void { const width = innerWidth; const height = innerHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer?.setSize(width, height, false); }
addEventListener('resize', resize); resize();
function frame(): void { if (renderer) renderer.render(scene, camera); requestAnimationFrame(frame); } frame();
