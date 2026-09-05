import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_SCENE } from '../../src/scene-spec';
import { VoxelAdapter, createPixelSignAtlas } from '../../src/adapters';
import { createContinuousInfrastructure } from '../../src/world';

const infrastructureKinds = new Set(['ground', 'road', 'footway', 'rail', 'wire']);

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = []; root.traverse((object) => { if ((object as THREE.Mesh).isMesh) result.push(object as THREE.Mesh); }); return result;
}

describe('Voxel adapter batching and parity', () => {
  it('mounts semantic roots and animation-ready train/crossing rigs without infrastructure', () => {
    const host = new THREE.Group(); const adapter = new VoxelAdapter(); adapter.mount(SAMPLE_SCENE, host);
    for (const entity of SAMPLE_SCENE.entities) {
      if (infrastructureKinds.has(entity.kind)) expect(host.getObjectByName(entity.id)).toBeUndefined();
      else expect(host.getObjectByName(entity.id)).toBeTruthy();
    }
    const eastBarrier = host.getObjectByName('crossing-barrier-east-pivot')!; const westBarrier = host.getObjectByName('crossing-barrier-west-pivot')!;
    const westWarning = host.getObjectByName('crossing-warning-light-west')!;
    expect(eastBarrier.getObjectByName('crossing-barrier-east-arm')?.children.some((child) => (child as THREE.Mesh).isMesh)).toBe(true);
    expect(westBarrier.getObjectByName('crossing-barrier-west-arm')?.children.some((child) => (child as THREE.Mesh).isMesh)).toBe(true);
    expect(westWarning.children.some((child) => (child as THREE.Mesh).isMesh)).toBe(true);
    const armMeshes = (root: THREE.Object3D) => { const result: THREE.Mesh[] = []; root.traverse((object) => { if ((object as THREE.Mesh).isMesh && object.name.includes('crossing-main--chunk')) result.push(object as THREE.Mesh); }); return result; };
    const eastLocal = armMeshes(eastBarrier)[0]; const westLocal = armMeshes(westBarrier)[0];
    expect(eastLocal.position.x + eastLocal.geometry.boundingBox!.max.x).toBeLessThanOrEqual(0);
    expect(westLocal.position.x + westLocal.geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(0);
    expect(host.getObjectByName('train-car-a')).toBeTruthy(); expect(host.getObjectByName('train-car-b')).toBeTruthy();
    expect(host.getObjectByName('vending-machine-main-dispensed-drink')).toBeTruthy();
    expect(host.getObjectByName('vending-machine-main-dispensed-drink')!.visible).toBe(false);
    const a = host.getObjectByName('train-car-a')!; const b = host.getObjectByName('train-car-b')!;
    expect(a.position.x).toBeLessThan(b.position.x); expect(a.position.x + 3.5).toBeLessThan(b.position.x);
    expect(host.userData.voxelEntityIds).toHaveLength(17); expect(host.userData.voxelChunkMeshCount).toBeGreaterThan(0);
    adapter.dispose();
  });

  it('reuses compiled geometry for repeated trees, bounds chunks, and bounds material paths', () => {
    const host = new THREE.Group(); const adapter = new VoxelAdapter(); adapter.mount(SAMPLE_SCENE, host);
    const treeMeshes = meshes(host).filter((mesh) => mesh.name.startsWith('cherry-tree-') && mesh.name.includes('--chunk'));
    expect(treeMeshes.length).toBeGreaterThan(1); expect(new Set(treeMeshes.map((mesh) => mesh.geometry)).size).toBeLessThan(treeMeshes.length);
    for (const mesh of meshes(host).filter((entry) => entry.name.includes('--chunk'))) { expect(mesh.frustumCulled).toBe(true); expect(mesh.geometry.boundingBox).toBeTruthy(); expect(mesh.geometry.boundingSphere).toBeTruthy(); }
    const materials = new Set(meshes(host).filter((mesh) => mesh.name.includes('--chunk')).map((mesh) => mesh.material));
    expect(materials.size).toBeLessThanOrEqual(3); expect(host.userData.voxelUniqueMaterialCount).toBeLessThanOrEqual(5);
    adapter.dispose();
  });

  it('derives restrained petals from the shared scene seed', () => {
    const firstHost = new THREE.Group(); const secondHost = new THREE.Group();
    const first = new VoxelAdapter(); first.mount(SAMPLE_SCENE, firstHost);
    const second = new VoxelAdapter(); second.mount({ ...SAMPLE_SCENE, seed: SAMPLE_SCENE.seed + 1 }, secondHost);
    const firstPetals = (firstHost.getObjectByName('petals-restrained-drift') as THREE.Points).geometry.getAttribute('position');
    const secondPetals = (secondHost.getObjectByName('petals-restrained-drift') as THREE.Points).geometry.getAttribute('position');
    expect(firstPetals.array).not.toEqual(secondPetals.array); first.dispose(); second.dispose();
  });

  it('shares one nearest-filtered atlas across all three signs and disposes owned resources once', () => {
    const atlas = createPixelSignAtlas(); expect(atlas.texture.minFilter).toBe(THREE.NearestFilter); expect(atlas.texture.magFilter).toBe(THREE.NearestFilter); atlas.dispose();
    const host = new THREE.Group(); const adapter = new VoxelAdapter(); adapter.mount(SAMPLE_SCENE, host);
    const signs = meshes(host).filter((mesh) => mesh.name.endsWith('-pixel-sign'));
    expect(signs).toHaveLength(3); expect(new Set(signs.map((mesh) => (mesh.material as THREE.MeshBasicMaterial).map)).size).toBe(1);
    const infrastructure = createContinuousInfrastructure(); const planet = infrastructure.root.getObjectByName('planet-surface') as THREE.Mesh; const worldDispose = vi.spyOn(planet.geometry, 'dispose');
    const ownedGeometries = new Set<THREE.BufferGeometry>(); const ownedMaterials = new Set<THREE.Material>();
    host.traverse((object) => {
      const renderable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; isMesh?: boolean; isPoints?: boolean };
      if (!renderable.isMesh && !renderable.isPoints) return;
      ownedGeometries.add(renderable.geometry!);
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((entry) => ownedMaterials.add(entry)); else if (material) ownedMaterials.add(material);
    });
    const ownedTextures = new Set([...ownedMaterials].flatMap((material) => { const map = (material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial).map; return map ? [map] : []; }));
    const geometrySpies = [...ownedGeometries].map((geometry) => vi.spyOn(geometry, 'dispose')); const materialSpies = [...ownedMaterials].map((material) => vi.spyOn(material, 'dispose')); const textureSpies = [...ownedTextures].map((texture) => vi.spyOn(texture, 'dispose'));
    adapter.dispose(); adapter.dispose();
    for (const spy of geometrySpies) expect(spy).toHaveBeenCalledOnce(); for (const spy of materialSpies) expect(spy).toHaveBeenCalledOnce(); for (const spy of textureSpies) expect(spy).toHaveBeenCalledOnce();
    expect(worldDispose).not.toHaveBeenCalled(); infrastructure.dispose();
  });
});
