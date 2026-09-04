import { describe, expect, it, vi } from 'vitest';
import { BaselineAdapter, VoxelAdapter } from '../src/adapters';
import { SAMPLE_SCENE } from '../src/scene-spec';
import * as THREE from 'three';

describe('Shared Scene Specification', () => {
  it('is deterministic and contains required entities', () => { expect(SAMPLE_SCENE.seed).toBe(20260904); expect(SAMPLE_SCENE.entities.map(e => e.id)).toEqual(['ground-tracer', 'crossing-marker']); });
  it('is consumed by both adapters without mutation', () => {
    const before = JSON.stringify(SAMPLE_SCENE); const a = new THREE.Group(); const b = new THREE.Group();
    new BaselineAdapter().mount(SAMPLE_SCENE, a); new VoxelAdapter().mount(SAMPLE_SCENE, b);
    expect(JSON.stringify(SAMPLE_SCENE)).toBe(before); expect(a.children[0].name).toBe(b.children[0].name); expect(a.children.length).toBe(b.children.length); expect((a.children[1] as THREE.Mesh).material).not.toBe((b.children[1] as THREE.Mesh).material);
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
});
