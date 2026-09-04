import * as THREE from 'three';
import type { RendererAdapter, SharedSceneSpecification } from './scene-spec';
export { BaselineAdapter } from './renderers/baseline';

function addBoxes(spec: SharedSceneSpecification, host: THREE.Object3D, geometries: THREE.BufferGeometry[], materials: THREE.Material[]): void {
  for (const entity of spec.entities) {
    if (entity.kind === 'ground' || entity.kind === 'road' || entity.kind === 'footway' || entity.kind === 'rail' || entity.kind === 'wire') continue;
    const color = 0xf5c04a;
    const geometry = new THREE.BoxGeometry(...entity.transform.scale);
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true });
    geometries.push(geometry); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = entity.id;
    mesh.position.set(...entity.transform.position);
    mesh.rotation.set(...entity.transform.rotation);
    host.add(mesh);
  }
  host.userData.voxelEntityIds = spec.entities.filter((entity) => !['ground', 'road', 'footway', 'rail', 'wire'].includes(entity.kind)).map((entity) => entity.id);
}
export class VoxelAdapter implements RendererAdapter {
  readonly name = 'voxel' as const;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  mount(spec: SharedSceneSpecification, host: THREE.Object3D): void { addBoxes(spec, host, this.geometries, this.materials); }
  dispose(): void { this.geometries.splice(0).forEach((geometry) => geometry.dispose()); this.materials.splice(0).forEach((material) => material.dispose()); }
}
