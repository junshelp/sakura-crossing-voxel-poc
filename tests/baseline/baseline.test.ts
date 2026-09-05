import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BaselineAdapter } from '../../src/adapters';
import { SAMPLE_SCENE } from '../../src/scene-spec';
import { createContinuousInfrastructure } from '../../src/world';

const infrastructureKinds = new Set(['ground', 'road', 'footway', 'rail', 'wire']);

describe('Baseline procedural slice', () => {
  it('emits the complete semantic inventory with stable rigs and no duplicated infrastructure', () => {
    const host = new THREE.Group(); const adapter = new BaselineAdapter(); adapter.mount(SAMPLE_SCENE, host);
    const names = host.children.map((child) => child.name);
    for (const entity of SAMPLE_SCENE.entities) if (!infrastructureKinds.has(entity.kind)) expect(names).toContain(entity.id);
    for (const entity of SAMPLE_SCENE.entities.filter((item) => infrastructureKinds.has(item.kind))) expect(names).not.toContain(entity.id);
    expect(host.getObjectByName('crossing-barrier-east-pivot')).toBeTruthy();
    expect(host.getObjectByName('crossing-barrier-west-pivot')).toBeTruthy();
    expect(host.getObjectByName('crossing-warning-light-east')).toBeTruthy();
    expect(host.getObjectByName('crossing-warning-light-west')).toBeTruthy();
    expect(host.getObjectByName('vending-machine-main-dispensed-drink')).toBeTruthy();
    expect(host.getObjectByName('vending-machine-main-dispensed-drink')!.visible).toBe(false);
    expect(host.getObjectByName('train-car-a')).toBeTruthy(); expect(host.getObjectByName('train-car-b')).toBeTruthy();
    expect(host.getObjectByName('train-car-a-pivot')).toBeTruthy(); expect(host.getObjectByName('train-car-b-pivot')).toBeTruthy();
    const cars: THREE.Object3D[] = []; host.traverse((object) => { if (/^train-car-[ab]$/.test(object.name)) cars.push(object); });
    expect(cars).toHaveLength(2);
    const renderables: Array<THREE.Mesh | THREE.Points> = []; host.traverse((object) => { if ((object as THREE.Mesh).isMesh || (object as THREE.Points).isPoints) renderables.push(object as THREE.Mesh | THREE.Points); });
    const materials = new Set(renderables.map((renderable) => renderable.material));
    expect(materials.size).toBeLessThanOrEqual(12);
    expect([...materials].some((material) => material instanceof THREE.PointsMaterial)).toBe(true);
    expect(host.userData.baselineEntityIds).toHaveLength(SAMPLE_SCENE.entities.filter((entity) => !infrastructureKinds.has(entity.kind)).length);
    adapter.dispose();
  });

  it('seats content on the curved surface and preserves child pivots', () => {
    const host = new THREE.Group(); const adapter = new BaselineAdapter(); adapter.mount(SAMPLE_SCENE, host);
    const tree = host.getObjectByName('cherry-tree-east')!; const house = host.getObjectByName('house-east')!;
    expect(tree.position.distanceTo(new THREE.Vector3(0, -160, 0))).toBeCloseTo(160, 0);
    expect(tree.getObjectByName('cherry-tree-east-trunk')).toBeTruthy();
    expect(tree.quaternion.length()).toBeCloseTo(1);
    const houseBody = house.getObjectByName('house-east-body') as THREE.Mesh;
    houseBody.geometry.computeBoundingBox();
    expect(houseBody.position.y + houseBody.geometry.boundingBox!.min.y).toBeCloseTo(0);
    adapter.dispose();
  });

  it('disposes owned resources once without touching Continuous Infrastructure', () => {
    const host = new THREE.Group(); const adapter = new BaselineAdapter(); adapter.mount(SAMPLE_SCENE, host);
    const infrastructure = createContinuousInfrastructure(); const planet = infrastructure.root.getObjectByName('planet-surface') as THREE.Mesh;
    const sharedGeometryDispose = vi.spyOn(planet.geometry, 'dispose');
    const mesh = host.getObjectByName('crossing-deck') as THREE.Mesh; const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    adapter.dispose(); adapter.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(sharedGeometryDispose).not.toHaveBeenCalled();
    infrastructure.dispose();
  });
});
