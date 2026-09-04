import * as THREE from 'three';
import type { RendererAdapter, SharedSceneSpecification } from './scene-spec';

function addBoxes(spec: SharedSceneSpecification, host: THREE.Object3D, voxel: boolean, geometries: THREE.BufferGeometry[], materials: THREE.Material[]): void {
  for (const entity of spec.entities) {
    if (entity.kind === 'road' || entity.kind === 'footway' || entity.kind === 'rail' || entity.kind === 'wire') continue;
    const color = entity.kind === 'ground' ? 0x254a5c : voxel ? 0xf5c04a : 0xed6f8e;
    const geometry = new THREE.BoxGeometry(...entity.transform.scale);
    const material = new THREE.MeshBasicMaterial({ color, wireframe: voxel });
    geometries.push(geometry); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = entity.id;
    mesh.position.set(...entity.transform.position);
    mesh.rotation.set(...entity.transform.rotation);
    host.add(mesh);
  }
}
export class BaselineAdapter implements RendererAdapter {
  readonly name = 'baseline' as const;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  mount(spec: SharedSceneSpecification, host: THREE.Object3D): void { addBoxes(spec, host, false, this.geometries, this.materials); }
  dispose(): void { this.geometries.splice(0).forEach((geometry) => geometry.dispose()); this.materials.splice(0).forEach((material) => material.dispose()); }
}
export class VoxelAdapter implements RendererAdapter {
  readonly name = 'voxel' as const;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  mount(spec: SharedSceneSpecification, host: THREE.Object3D): void { addBoxes(spec, host, true, this.geometries, this.materials); }
  dispose(): void { this.geometries.splice(0).forEach((geometry) => geometry.dispose()); this.materials.splice(0).forEach((material) => material.dispose()); }
}
