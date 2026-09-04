import type { Object3D } from 'three';
import { PLANET_CIRCUMFERENCE, PLANET_RADIUS } from './world/planet';

export const FLAT_BOUNDS = Object.freeze({ minX: -30, maxX: 30, minZ: -30, maxZ: 30 });

export type SemanticKind = 'ground' | 'road' | 'footway' | 'rail' | 'crossing' | 'train' | 'shop' | 'house' | 'vending-machine' | 'relay-box' | 'utility-pole' | 'wire' | 'fence' | 'cherry-tree' | 'petal' | 'bicycle' | 'marker';
export type PaletteRole = 'ground' | 'accent' | 'marker' | 'rail' | 'wood' | 'roof' | 'leaf' | 'petal' | 'metal' | 'glass' | 'emissive';
export type AnimationBinding = 'crossing-barrier' | 'crossing-warning-lights' | 'train-loop' | 'petal-drift';

export interface Transform { readonly position: readonly [number, number, number]; readonly rotation: readonly [number, number, number]; readonly scale: readonly [number, number, number] }
export interface Collider { readonly center: readonly [number, number, number]; readonly size: readonly [number, number, number] }
export interface Interaction { readonly id: string; readonly label: string; readonly range: number }
export interface VisualDescription { readonly archetype: string; readonly variant: string }
export interface SceneEntity { readonly id: string; readonly kind: SemanticKind; readonly transform: Transform; readonly collider?: Collider; readonly interactions: readonly Interaction[]; readonly paletteRoles: readonly PaletteRole[]; readonly animationBindings: readonly AnimationBinding[]; readonly visual: VisualDescription }
export interface BenchmarkCameraMarker { readonly position: readonly [number, number, number]; readonly lookAt: readonly [number, number, number] }
export interface WorldSettings { readonly planetRadius: number; readonly planetCircumference: number; readonly coordinateSystem: 'flat-x-east-y-up-z-north' }
export interface SharedSceneSpecification { readonly world: WorldSettings; readonly flatBounds: typeof FLAT_BOUNDS; readonly seed: number; readonly benchmarkCameraMarkers: Readonly<Record<string, BenchmarkCameraMarker>>; readonly entities: readonly SceneEntity[] }

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

const transform = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Transform => ({ position: [x, y, z], rotation: [0, 0, 0], scale: [sx, sy, sz] });
const collider = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Collider => ({ center: [x, y, z], size: [sx, sy, sz] });
const entity = (id: string, kind: SemanticKind, t: Transform, visual: VisualDescription, roles: readonly PaletteRole[], c?: Collider, interactions: readonly Interaction[] = [], animationBindings: readonly AnimationBinding[] = []): SceneEntity => ({ id, kind, transform: t, visual, paletteRoles: roles, ...(c ? { collider: c } : {}), interactions, animationBindings });
/** The fixed, deliberately small 60 x 60 m population used by both adapters. */
export const SAMPLE_SCENE: SharedSceneSpecification = deepFreeze({
  world: { planetRadius: PLANET_RADIUS, planetCircumference: PLANET_CIRCUMFERENCE, coordinateSystem: 'flat-x-east-y-up-z-north' },
  flatBounds: FLAT_BOUNDS,
  seed: 20260904,
  benchmarkCameraMarkers: {
    overview: { position: [0, 9, 22], lookAt: [0, 0, 0] },
    crossing: { position: [10, 5, 16], lookAt: [0, 1, 0] },
    railway: { position: [0, 4, 26], lookAt: [0, 0, 0] },
  },
  entities: [
    entity('ground-tracer', 'ground', transform(0, -0.5, 0, 60, 1, 60), { archetype: 'ground-plane', variant: 'tracer' }, ['ground'], collider(0, -0.5, 0, 60, 1, 60)),
    entity('road-tracer', 'road', transform(0, 0, 4), { archetype: 'curved-road', variant: 'tracer' }, ['ground']),
    entity('footway-tracer', 'footway', transform(0, 0.1, 4), { archetype: 'footway', variant: 'tracer' }, ['ground']),
    entity('equatorial-rail-loop', 'rail', transform(0, 0, 0), { archetype: 'rail-loop', variant: 'continuous' }, ['rail']),
    entity('crossing-main', 'crossing', transform(0, 1, 0, 5, 2, 3), { archetype: 'rail-crossing', variant: 'single-operating' }, ['accent', 'metal'], collider(0, 1, 0, 5, 2, 3), [], ['crossing-barrier', 'crossing-warning-lights']),
    entity('train-two-car', 'train', transform(-12, 1.2, 0, 8, 2.4, 3), { archetype: 'train', variant: 'two-car' }, ['metal', 'accent'], collider(-12, 1.2, 0, 8, 2.4, 3), [], ['train-loop']),
    entity('corner-shop', 'shop', transform(-18, 2, -15, 8, 4, 7), { archetype: 'corner-shop', variant: 'sakura-kiosk' }, ['wood', 'roof', 'glass'], collider(-18, 2, -15, 8, 4, 7)),
    entity('house-west', 'house', transform(-17, 2, 15, 8, 4, 8), { archetype: 'house', variant: 'blue-roof' }, ['wood', 'roof', 'glass'], collider(-17, 2, 15, 8, 4, 8)),
    entity('house-east', 'house', transform(18, 2, 15, 9, 4, 8), { archetype: 'house', variant: 'tile-roof' }, ['wood', 'roof', 'glass'], collider(18, 2, 15, 9, 4, 8)),
    entity('vending-machine-main', 'vending-machine', transform(-10, 1.2, -8, 1.5, 2.4, 0.8), { archetype: 'vending-machine', variant: 'red-drink' }, ['metal', 'glass', 'emissive'], collider(-10, 1.2, -8, 1.5, 2.4, 0.8), [{ id: 'dispense-drink', label: 'Dispense drink', range: 2 }]),
    entity('relay-box-main', 'relay-box', transform(10, 1.2, -2, 1.2, 2.4, 0.9), { archetype: 'relay-box', variant: 'crossing-relay' }, ['metal', 'emissive'], collider(10, 1.2, -2, 1.2, 2.4, 0.9), [{ id: 'call-train', label: 'Call train', range: 2 }]),
    entity('utility-pole-west', 'utility-pole', transform(-25, 4, -3, 0.6, 8, 0.6), { archetype: 'utility-pole', variant: 'wood' }, ['wood'], collider(-25, 4, -3, 0.6, 8, 0.6)),
    entity('utility-pole-east', 'utility-pole', transform(25, 4, -3, 0.6, 8, 0.6), { archetype: 'utility-pole', variant: 'wood' }, ['wood'], collider(25, 4, -3, 0.6, 8, 0.6)),
    entity('utility-wires', 'wire', transform(0, 7, -3), { archetype: 'utility-wire', variant: 'three-lines' }, ['metal']),
    entity('fence-north', 'fence', transform(0, 1, 29, 52, 2, 0.3), { archetype: 'safety-fence', variant: 'wood-post' }, ['wood'], collider(0, 1, 29, 52, 2, 0.3)),
    entity('cherry-tree-west', 'cherry-tree', transform(-25, 3, 12, 3, 6, 3), { archetype: 'cherry-tree', variant: 'full-bloom' }, ['wood', 'leaf', 'petal']),
    entity('cherry-tree-east', 'cherry-tree', transform(25, 3, 12, 3, 6, 3), { archetype: 'cherry-tree', variant: 'full-bloom' }, ['wood', 'leaf', 'petal']),
    entity('cherry-tree-shop', 'cherry-tree', transform(-24, 3, -20, 3, 6, 3), { archetype: 'cherry-tree', variant: 'full-bloom' }, ['wood', 'leaf', 'petal']),
    entity('cherry-tree-crossing', 'cherry-tree', transform(23, 3, -20, 3, 6, 3), { archetype: 'cherry-tree', variant: 'full-bloom' }, ['wood', 'leaf', 'petal']),
    entity('petals-restrained', 'petal', transform(0, 5, 0, 50, 10, 50), { archetype: 'petal-drift', variant: 'restrained' }, ['petal'], undefined, [], ['petal-drift']),
    entity('parked-bicycle', 'bicycle', transform(15, 0.8, -12, 2, 1.6, 0.8), { archetype: 'parked-bicycle', variant: 'city-bike' }, ['metal', 'accent']),
    entity('crossing-marker', 'marker', transform(0, 2, 0), { archetype: 'marker', variant: 'tracer' }, ['accent', 'marker']),
  ],
});

const finiteTuple = (value: unknown, length: number): value is readonly number[] => Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
const allowedKinds = new Set<SemanticKind>(['ground', 'road', 'footway', 'rail', 'crossing', 'train', 'shop', 'house', 'vending-machine', 'relay-box', 'utility-pole', 'wire', 'fence', 'cherry-tree', 'petal', 'bicycle', 'marker']);
const allowedRoles = new Set<PaletteRole>(['ground', 'accent', 'marker', 'rail', 'wood', 'roof', 'leaf', 'petal', 'metal', 'glass', 'emissive']);
const interactionOwners = new Map<SemanticKind, Set<string>>([['vending-machine', new Set(['dispense-drink'])], ['relay-box', new Set(['call-train'])]]);

/** Validate public scene invariants and throw a descriptive error on failure. */
export function assertValidSharedScene(spec: SharedSceneSpecification): asserts spec is SharedSceneSpecification {
  if (!spec || typeof spec !== 'object') throw new Error('Shared Scene Specification must be an object');
  if (!Number.isInteger(spec.seed)) throw new Error('Shared Scene Specification seed must be an integer');
  if (spec.world.planetRadius !== PLANET_RADIUS || Math.abs(spec.world.planetCircumference - PLANET_CIRCUMFERENCE) > 1e-9) throw new Error('Shared Scene Specification planet settings are invalid');
  if (spec.world.coordinateSystem !== 'flat-x-east-y-up-z-north') throw new Error('Shared Scene Specification coordinate system is invalid');
  if (spec.flatBounds.minX >= spec.flatBounds.maxX || spec.flatBounds.minZ >= spec.flatBounds.maxZ) throw new Error('Shared Scene Specification bounds are invalid');
  if (!spec.benchmarkCameraMarkers || Object.keys(spec.benchmarkCameraMarkers).length === 0) throw new Error('Shared Scene Specification requires camera markers');
  for (const marker of Object.values(spec.benchmarkCameraMarkers)) if (!finiteTuple(marker.position, 3) || !finiteTuple(marker.lookAt, 3)) throw new Error('Shared Scene Specification camera marker is invalid');
  const ids = new Set<string>();
  for (const item of spec.entities) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate entity id: ${item.id}`);
    ids.add(item.id);
    if (!allowedKinds.has(item.kind)) throw new Error(`Invalid entity kind: ${item.kind}`);
    if (!finiteTuple(item.transform.position, 3) || !finiteTuple(item.transform.rotation, 3) || !finiteTuple(item.transform.scale, 3) || item.transform.scale.some((value) => value <= 0)) throw new Error(`Invalid transform: ${item.id}`);
    const [x, , z] = item.transform.position;
    if (x < spec.flatBounds.minX || x > spec.flatBounds.maxX || z < spec.flatBounds.minZ || z > spec.flatBounds.maxZ) throw new Error(`Entity out of bounds: ${item.id}`);
    if (item.collider && (!finiteTuple(item.collider.center, 3) || !finiteTuple(item.collider.size, 3) || item.collider.size.some((value) => value <= 0))) throw new Error(`Invalid collider dimensions: ${item.id}`);
    if (!item.visual?.archetype || !item.visual.variant || item.paletteRoles.length === 0 || item.paletteRoles.some((role) => !allowedRoles.has(role))) throw new Error(`Invalid visual description: ${item.id}`);
    const owner = interactionOwners.get(item.kind) ?? new Set<string>();
    for (const interaction of item.interactions) if (!interaction.id || !interaction.label || !Number.isFinite(interaction.range) || interaction.range <= 0 || !owner.has(interaction.id)) throw new Error(`Invalid interaction ownership: ${item.id}/${interaction.id}`);
    if (item.kind === 'crossing' && !item.animationBindings.includes('crossing-barrier')) throw new Error('Crossing animation binding is missing');
    if (item.kind === 'train' && !item.animationBindings.includes('train-loop')) throw new Error('Train animation binding is missing');
  }
}
export function validateSharedScene(spec: SharedSceneSpecification): boolean { try { assertValidSharedScene(spec); return true; } catch { return false; } }

export interface RendererAdapter { readonly name: 'baseline' | 'voxel'; mount(spec: SharedSceneSpecification, host: Object3D): void; dispose(): void }
