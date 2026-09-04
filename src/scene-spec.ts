import type { Object3D } from 'three';

export type SemanticKind = 'ground' | 'marker';
export type PaletteRole = 'ground' | 'accent' | 'marker';
export interface Transform { readonly position: readonly [number, number, number]; readonly rotation: readonly [number, number, number]; readonly scale: readonly [number, number, number] }
export interface Collider { readonly center: readonly [number, number, number]; readonly size: readonly [number, number, number] }
export interface Interaction { readonly id: string; readonly label: string; readonly range: number }
export interface SceneEntity { readonly id: string; readonly kind: SemanticKind; readonly transform: Transform; readonly collider: Collider; readonly interactions: readonly Interaction[]; readonly paletteRoles: readonly PaletteRole[]; readonly animationBindings: readonly string[] }
export interface SharedSceneSpecification { readonly seed: number; readonly benchmarkCameraMarkers: Readonly<Record<string, Transform>>; readonly entities: readonly SceneEntity[] }

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

export const SAMPLE_SCENE: SharedSceneSpecification = deepFreeze({
  seed: 20260904,
  benchmarkCameraMarkers: { overview: { position: [0, 8, 14], rotation: [-0.35, 0, 0], scale: [1, 1, 1] } },
  entities: Object.freeze([
    { id: 'ground-tracer', kind: 'ground', transform: { position: [0, -1, 0], rotation: [0, 0, 0], scale: [14, 0.5, 10] }, collider: { center: [0, -1, 0], size: [14, 0.5, 10] }, interactions: [], paletteRoles: ['ground'], animationBindings: [] },
    { id: 'crossing-marker', kind: 'marker', transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [2, 2, 2] }, collider: { center: [0, 1, 0], size: [2, 2, 2] }, interactions: [{ id: 'inspect-marker', label: 'Inspect marker', range: 3 }], paletteRoles: ['accent', 'marker'], animationBindings: ['marker-pulse'] }
  ])
});

export interface RendererAdapter { readonly name: 'baseline' | 'voxel'; mount(spec: SharedSceneSpecification, host: Object3D): void; dispose(): void }
