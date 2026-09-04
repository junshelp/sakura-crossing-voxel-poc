import * as THREE from 'three';
import type { CompiledSurfaceGroup } from './compiler';

/** Adapter boundary: the browser renderer may turn one compiled group into geometry. */
export function surfaceGroupToBufferGeometry(group: CompiledSurfaceGroup): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(group.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(group.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(group.colors, 3));
  geometry.setAttribute('paletteId', new THREE.BufferAttribute(group.paletteIds, 1));
  geometry.setIndex(new THREE.BufferAttribute(group.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export const compiledSurfaceGroupToBufferGeometry = surfaceGroupToBufferGeometry;
export const toBufferGeometry = surfaceGroupToBufferGeometry;
