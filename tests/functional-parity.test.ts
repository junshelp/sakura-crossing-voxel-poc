import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BaselineAdapter, VoxelAdapter } from '../src/adapters';
import { SAMPLE_SCENE } from '../src/scene-spec';
import { CrossingSimulation, TRAIN_APPROACH_OFFSET, TRAIN_CLOSING_START, TRAIN_SPEED } from '../src/simulation';
import { applySimulationSnapshot } from '../src/runtime/visual-binding';
import { createPlayerState, movePlayer } from '../src/gameplay';

function relativeBounds(parent: THREE.Object3D, child: THREE.Object3D): THREE.Box3 {
  parent.updateWorldMatrix(true, false); child.updateWorldMatrix(true, true);
  const worldBounds = new THREE.Box3().setFromObject(child);
  const inverse = parent.matrixWorld.clone().invert(); const relative = new THREE.Box3();
  for (const x of [worldBounds.min.x, worldBounds.max.x]) for (const y of [worldBounds.min.y, worldBounds.max.y]) for (const z of [worldBounds.min.z, worldBounds.max.z]) relative.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inverse));
  return relative;
}

describe('Baseline/Voxel functional parity', () => {
  it('keeps scene-owned public contracts identical', () => {
    const before = JSON.stringify(SAMPLE_SCENE);
    const baseline = new THREE.Group(); const voxel = new THREE.Group();
    const baselineAdapter = new BaselineAdapter(); const voxelAdapter = new VoxelAdapter();
    baselineAdapter.mount(SAMPLE_SCENE, baseline); voxelAdapter.mount(SAMPLE_SCENE, voxel);
    expect(baseline.userData.baselineEntityIds).toEqual(voxel.userData.voxelEntityIds);
    const sceneById = new Map(SAMPLE_SCENE.entities.map((entity) => [entity.id, { id: entity.id, collider: entity.collider, interactions: entity.interactions, animationBindings: entity.animationBindings }]));
    const baselineContract = (baseline.userData.baselineEntityIds as string[]).map((id) => sceneById.get(id));
    const voxelContract = (voxel.userData.voxelEntityIds as string[]).map((id) => sceneById.get(id));
    expect(baselineContract).toEqual(voxelContract);
    expect(SAMPLE_SCENE.flatBounds).toEqual({ minX: -30, maxX: 30, minZ: -30, maxZ: 30 });
    for (const name of ['train-two-car', 'train-car-a', 'train-car-b', 'crossing-barrier-west-pivot', 'crossing-barrier-east-pivot', 'crossing-warning-light-west', 'crossing-warning-light-east', 'vending-machine-main-dispensed-drink']) {
      expect(baseline.getObjectByName(name)).toBeTruthy(); expect(voxel.getObjectByName(name)).toBeTruthy();
    }
    for (const host of [baseline, voxel]) {
      const vending = host.getObjectByName('vending-machine-main')!;
      const drink = host.getObjectByName('vending-machine-main-dispensed-drink')!;
      expect(relativeBounds(vending, drink).min.z).toBeGreaterThan(SAMPLE_SCENE.entities.find((entity) => entity.id === 'vending-machine-main')!.transform.scale[2] / 2);
    }
    baselineAdapter.dispose(); voxelAdapter.dispose();
    expect(JSON.stringify(SAMPLE_SCENE)).toBe(before);
  });

  it('applies one shared snapshot and preserves movement outcomes', () => {
    const simulation = new CrossingSimulation(); const baseline = new THREE.Group(); const voxel = new THREE.Group();
    const baselineAdapter = new BaselineAdapter(); const voxelAdapter = new VoxelAdapter();
    baselineAdapter.mount(SAMPLE_SCENE, baseline); voxelAdapter.mount(SAMPLE_SCENE, voxel);
    simulation.activate('call-train'); simulation.step((TRAIN_CLOSING_START - TRAIN_APPROACH_OFFSET) / TRAIN_SPEED + 1 / TRAIN_SPEED); applySimulationSnapshot(baseline, simulation.snapshot); applySimulationSnapshot(voxel, simulation.snapshot);
    expect(baseline.getObjectByName('train-two-car')!.position.distanceTo(voxel.getObjectByName('train-two-car')!.position)).toBeCloseTo(0);
    expect(baseline.getObjectByName('crossing-barrier-west-pivot')!.rotation.z).toBeCloseTo(voxel.getObjectByName('crossing-barrier-west-pivot')!.rotation.z);
    expect(simulation.snapshot.barrierClosure).toBeGreaterThan(0);
    expect(simulation.snapshot.barrierClosure).toBeLessThan(1);
    expect(baseline.getObjectByName('crossing-warning-light-west')!.visible).toBe(true);
    const baselinePose = baseline.getObjectByName('train-two-car')!.quaternion.clone(); applySimulationSnapshot(baseline, simulation.snapshot);
    expect(baseline.getObjectByName('train-two-car')!.quaternion.angleTo(baselinePose)).toBeCloseTo(0);
    const closedSimulation = new CrossingSimulation(-8); applySimulationSnapshot(baseline, closedSimulation.snapshot); applySimulationSnapshot(voxel, closedSimulation.snapshot);
    expect(closedSimulation.snapshot.barrierClosure).toBe(1);
    expect(closedSimulation.snapshot.barrierClosed).toBe(true);
    expect(baseline.getObjectByName('crossing-barrier-west-pivot')!.rotation.z).toBeCloseTo(0);
    expect(baseline.getObjectByName('crossing-barrier-east-pivot')!.rotation.z).toBeCloseTo(0);
    expect(voxel.getObjectByName('crossing-barrier-west-pivot')!.rotation.z).toBeCloseTo(0);
    expect(voxel.getObjectByName('crossing-barrier-east-pivot')!.rotation.z).toBeCloseTo(0);
    expect(baseline.getObjectByName('crossing-warning-light-west')!.visible).toBe(true);
    expect(voxel.getObjectByName('crossing-warning-light-west')!.visible).toBe(true);
    simulation.activate('dispense-drink'); applySimulationSnapshot(baseline, simulation.snapshot); applySimulationSnapshot(voxel, simulation.snapshot);
    expect(baseline.getObjectByName('vending-machine-main-dispensed-drink')!.visible).toBe(true);
    expect(voxel.getObjectByName('vending-machine-main-dispensed-drink')!.visible).toBe(true);
    const openSimulation = new CrossingSimulation(32); applySimulationSnapshot(baseline, openSimulation.snapshot); applySimulationSnapshot(voxel, openSimulation.snapshot);
    expect(openSimulation.snapshot.barrierClosure).toBe(0);
    expect(baseline.getObjectByName('crossing-barrier-west-pivot')!.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(baseline.getObjectByName('crossing-barrier-east-pivot')!.rotation.z).toBeCloseTo(-Math.PI / 2);
    expect(voxel.getObjectByName('crossing-barrier-west-pivot')!.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(voxel.getObjectByName('crossing-barrier-east-pivot')!.rotation.z).toBeCloseTo(-Math.PI / 2);
    expect(baseline.getObjectByName('crossing-warning-light-west')!.visible).toBe(false);
    expect(voxel.getObjectByName('crossing-warning-light-west')!.visible).toBe(false);
    const route = { forward: 1, strafe: 0 }; const a = movePlayer(createPlayerState(4.5, 22), route, 1, SAMPLE_SCENE); const b = movePlayer(createPlayerState(4.5, 22), route, 1, SAMPLE_SCENE);
    expect(b).toEqual(a);
    const uninterruptedInputs = [{ forward: 1, strafe: 0 }, { forward: 0, strafe: 1 }, { forward: -1, strafe: 0 }];
    let uninterrupted = createPlayerState(4.5, 22); let toggled = createPlayerState(4.5, 22);
    for (const input of uninterruptedInputs) uninterrupted = movePlayer(uninterrupted, input, 0.7, SAMPLE_SCENE);
    for (const input of uninterruptedInputs) {
      toggled = movePlayer(toggled, input, 0.7, SAMPLE_SCENE);
      baselineAdapter.dispose(); baseline.clear(); const nextBaseline = new BaselineAdapter(); nextBaseline.mount(SAMPLE_SCENE, baseline);
      applySimulationSnapshot(baseline, simulation.snapshot); nextBaseline.dispose(); baseline.clear(); const nextVoxel = new VoxelAdapter(); nextVoxel.mount(SAMPLE_SCENE, voxel);
      applySimulationSnapshot(voxel, simulation.snapshot); nextVoxel.dispose(); voxel.clear();
    }
    expect(toggled).toEqual(uninterrupted);
    baselineAdapter.dispose(); voxelAdapter.dispose();
  });
});
