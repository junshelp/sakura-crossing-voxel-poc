import { describe, expect, it, vi } from 'vitest';
import { BaselineAdapter, VoxelAdapter } from '../src/adapters';
import { assertValidSharedScene, SAMPLE_SCENE } from '../src/scene-spec';
import * as THREE from 'three';

describe('Shared Scene Specification', () => {
  it('is deterministic and contains the complete miniature crossing inventory', () => {
    expect(SAMPLE_SCENE.seed).toBe(20260904);
    expect(SAMPLE_SCENE.world.planetRadius).toBe(160);
    expect(SAMPLE_SCENE.world.planetCircumference).toBeCloseTo(2 * Math.PI * 160);
    for (const kind of ['crossing', 'train', 'shop', 'vending-machine', 'relay-box', 'utility-pole', 'wire', 'fence', 'cherry-tree', 'petal', 'bicycle']) expect(SAMPLE_SCENE.entities.some((entity) => entity.kind === kind)).toBe(true);
    expect(SAMPLE_SCENE.entities.filter((entity) => entity.kind === 'cherry-tree')).toHaveLength(4);
    expect(SAMPLE_SCENE.entities.find((entity) => entity.kind === 'train')?.visual.variant).toBe('two-car');
    expect(assertValidSharedScene(SAMPLE_SCENE)).toBeUndefined();
  });
  it('is consumed by both adapters without mutation', () => {
    const before = JSON.stringify(SAMPLE_SCENE); const a = new THREE.Group(); const b = new THREE.Group();
    const baselineMount = vi.spyOn(BaselineAdapter.prototype, 'mount'); const voxelMount = vi.spyOn(VoxelAdapter.prototype, 'mount');
    new BaselineAdapter().mount(SAMPLE_SCENE, a); new VoxelAdapter().mount(SAMPLE_SCENE, b);
    expect(baselineMount.mock.calls[0]?.[0]).toBe(SAMPLE_SCENE); expect(voxelMount.mock.calls[0]?.[0]).toBe(SAMPLE_SCENE);
    expect(JSON.stringify(SAMPLE_SCENE)).toBe(before); expect(a.children[0].name).toBe(b.children[0].name); expect(a.children.length).toBe(b.children.length); expect((a.children[1] as THREE.Mesh).material).not.toBe((b.children[1] as THREE.Mesh).material);
    for (const child of [...a.children, ...b.children]) expect(child.userData).not.toHaveProperty('collider');
    baselineMount.mockRestore(); voxelMount.mockRestore();
  });
  it('deep-freezes nested fixture values and adapters release resources', () => {
    expect(Object.isFrozen(SAMPLE_SCENE)).toBe(true);
    expect(Object.isFrozen(SAMPLE_SCENE.benchmarkCameraMarkers)).toBe(true);
    expect(Object.isFrozen(SAMPLE_SCENE.entities[0].transform.position)).toBe(true);
    expect(Object.isFrozen(SAMPLE_SCENE.entities[1].interactions)).toBe(true);
    expect(Object.isFrozen(SAMPLE_SCENE.benchmarkCameraMarkers.overview)).toBe(true);
    const adapter = new BaselineAdapter(); const host = new THREE.Group(); adapter.mount(SAMPLE_SCENE, host);
    const mesh = host.children[0] as THREE.Mesh; const geometryDispose = vi.spyOn(mesh.geometry, 'dispose'); const materialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    adapter.dispose(); expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce();
  });
  it('rejects duplicate ids, invalid colliders, invalid interaction owners, and missing markers', () => {
    const duplicate = structuredClone(SAMPLE_SCENE) as any; duplicate.entities.push(structuredClone(duplicate.entities[0]));
    expect(() => assertValidSharedScene(duplicate)).toThrow(/Duplicate entity id/);
    const invalidCollider = structuredClone(SAMPLE_SCENE) as any; invalidCollider.entities[0].collider!.size[0] = 0;
    expect(() => assertValidSharedScene(invalidCollider)).toThrow(/collider/i);
    const invalidInteraction = structuredClone(SAMPLE_SCENE) as any; invalidInteraction.entities[0].interactions.push({ id: 'call-train', label: 'Call train', range: 2 });
    expect(() => assertValidSharedScene(invalidInteraction)).toThrow(/interaction ownership/i);
    expect(SAMPLE_SCENE.entities.find((entity) => entity.kind === 'shop')?.interactions).toHaveLength(0);
    const shopInteraction = structuredClone(SAMPLE_SCENE) as any; shopInteraction.entities.find((entity: any) => entity.kind === 'shop').interactions.push({ id: 'inspect', label: 'Inspect', range: 3 });
    expect(() => assertValidSharedScene(shopInteraction)).toThrow(/interaction ownership/i);
    const missingMarkers = structuredClone(SAMPLE_SCENE) as any; missingMarkers.benchmarkCameraMarkers = {};
    expect(() => assertValidSharedScene(missingMarkers)).toThrow(/camera markers/i);
    const outOfBounds = structuredClone(SAMPLE_SCENE) as any; outOfBounds.entities[0].transform.position[0] = 31;
    expect(() => assertValidSharedScene(outOfBounds)).toThrow(/out of bounds/i);
  });
});
