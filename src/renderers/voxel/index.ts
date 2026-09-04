import * as THREE from 'three';
import type { RendererAdapter, SceneEntity, SharedSceneSpecification } from '../../scene-spec';
import { seatRigidObject } from '../../world';
import { compileVoxelAsset, type CompiledVoxelChunk } from '../../voxel/compiler';
import { surfaceGroupToBufferGeometry } from '../../voxel/three-geometry';
import { getVoxelAssetForEntity } from '../../voxel/assets';
import type { VoxelAsset } from '../../voxel/asset';

const INFRASTRUCTURE_KINDS = new Set(['ground', 'road', 'footway', 'rail', 'wire']);
type VoxelSurfaceClass = 'opaque' | 'transparent' | 'emissive';

export interface PixelSignAtlasHandle { readonly texture: THREE.DataTexture; readonly material: THREE.MeshBasicMaterial; dispose(): void }

/** One deterministic nearest-filtered atlas shared by every sign plane. */
export function createPixelSignAtlas(): PixelSignAtlasHandle {
  const width = 32; const height = 8; const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const pixel = (y * width + x) * 4; const ink = y === 1 || y === 6 || x === 1 || x === 30 || ((x + y) % 7 === 0);
    data[pixel] = ink ? 255 : 24; data[pixel + 1] = ink ? 211 : 36; data[pixel + 2] = ink ? 92 : 54; data[pixel + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = 'pixel-sign-atlas'; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }); material.name = 'shared-pixel-sign-material';
  return { texture, material, dispose(): void { material.dispose(); texture.dispose(); } };
}

interface CompiledAsset { readonly asset: VoxelAsset; readonly chunks: readonly CompiledVoxelChunk[]; readonly geometries: readonly THREE.BufferGeometry[] }

/** Final renderer for the Shared Scene Specification, with no gameplay ownership. */
export class VoxelAdapter implements RendererAdapter {
  readonly name = 'voxel' as const;
  private readonly compiled = new Map<string, CompiledAsset>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Map<VoxelSurfaceClass, THREE.MeshStandardMaterial>();
  private readonly extraGeometries = new Set<THREE.BufferGeometry>();
  private readonly atlas = createPixelSignAtlas();
  private readonly petalMaterial = new THREE.PointsMaterial({ color: 0xf3a7ba, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.82, depthWrite: false });
  private disposed = false;
  private chunkMeshCount = 0;

  private material(surfaceClass: VoxelSurfaceClass): THREE.MeshStandardMaterial {
    let material = this.materials.get(surfaceClass);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: surfaceClass === 'transparent', opacity: surfaceClass === 'transparent' ? 0.72 : 1, depthWrite: surfaceClass !== 'transparent', emissive: surfaceClass === 'emissive' ? 0xffffff : 0x000000, emissiveIntensity: surfaceClass === 'emissive' ? 1.8 : 0, roughness: 0.82, metalness: 0.05 });
      material.name = `shared-voxel-${surfaceClass}-material`; this.materials.set(surfaceClass, material);
    }
    return material;
  }

  private compiledAsset(asset: VoxelAsset): CompiledAsset {
    const cached = this.compiled.get(asset.id); if (cached) return cached;
    const mesh = compileVoxelAsset(asset);
    const geometries = mesh.chunks.flatMap((chunk) => chunk.groups.map((group) => surfaceGroupToBufferGeometry(group)));
    geometries.forEach((geometry) => this.geometries.add(geometry));
    const result = { asset, chunks: mesh.chunks, geometries }; this.compiled.set(asset.id, result); return result;
  }

  private entityRoot(entity: SceneEntity, host: THREE.Object3D): THREE.Group {
    const group = new THREE.Group(); group.name = entity.id; group.userData.semanticKind = entity.kind;
    const [x, y, z] = entity.transform.position;
    seatRigidObject(group, { flatX: x, flatZ: z, localHeight: y - entity.transform.scale[1] / 2, localRotation: new THREE.Euler(...entity.transform.rotation) });
    host.add(group); return group;
  }

  private addCompiledAsset(entity: SceneEntity, group: THREE.Object3D, assetOverride?: VoxelAsset, offsetOverride?: THREE.Vector3): void {
    const asset = assetOverride ?? getVoxelAssetForEntity(entity.kind, entity.visual.variant); if (!asset) return;
    const compiled = this.compiledAsset(asset); let chunkIndex = 0;
    const bounds = asset.bounds!;
    const centeredOffset = new THREE.Vector3(-((bounds.max.x - bounds.min.x + 1) * 0.25) / 2, -bounds.min.y * 0.25, -((bounds.max.z - bounds.min.z + 1) * 0.25) / 2);
    const offset = offsetOverride ?? centeredOffset;
    for (const chunk of compiled.chunks) for (const surface of chunk.groups) {
      const geometry = compiled.geometries[chunkIndex]; chunkIndex += 1;
      const mesh = new THREE.Mesh(geometry, this.material(surface.surfaceClass));
      mesh.name = `${entity.id}--chunk-${chunk.coordinate.x}-${chunk.coordinate.y}-${chunk.coordinate.z}--${surface.surfaceClass}`;
      mesh.position.copy(offset); mesh.frustumCulled = true; mesh.userData.voxelChunk = chunk.coordinate; mesh.userData.surfaceClass = surface.surfaceClass; group.add(mesh); this.chunkMeshCount += 1;
    }
  }

  private addCrossing(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); this.addCompiledAsset(entity, group);
    for (const side of [-1, 1] as const) {
      const suffix = side < 0 ? 'west' : 'east';
      const pivot = new THREE.Group(); pivot.name = `crossing-barrier-${suffix}-pivot`; pivot.position.set(side * 1.6, 1.6, 0); group.add(pivot);
      const arm = new THREE.Group(); arm.name = `crossing-barrier-${suffix}-arm`; pivot.add(arm);
      this.addCompiledAsset(entity, arm, getVoxelAssetForEntity('crossing-barrier'), new THREE.Vector3(side < 0 ? 0 : -2.5, -1.5, -0.25));
      const warning = new THREE.Group(); warning.name = `crossing-warning-light-${suffix}`; warning.position.set(side * 1.6, 1.65, 1.1); group.add(warning);
      this.addCompiledAsset(entity, warning, getVoxelAssetForEntity('crossing-warning-light'));
    }
  }

  private addTrain(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const asset = getVoxelAssetForEntity(entity.kind, entity.visual.variant);
    if (!asset) return; const compiled = this.compiledAsset(asset);
    for (const [index, x] of [['a', -2.1], ['b', 2.1] ] as const) {
      const car = new THREE.Group(); car.name = `train-car-${index}`; car.position.x = x; group.add(car);
      const pivot = new THREE.Group(); pivot.name = `train-car-${index}-pivot`; car.add(pivot);
      let chunkIndex = 0;
      for (const chunk of compiled.chunks) for (const surface of chunk.groups) {
        const geometry = compiled.geometries[chunkIndex]; chunkIndex += 1;
        const mesh = new THREE.Mesh(geometry, this.material(surface.surfaceClass)); const bounds = asset.bounds!; mesh.position.set(-((bounds.max.x - bounds.min.x + 1) * 0.25) / 2, -bounds.min.y * 0.25, -((bounds.max.z - bounds.min.z + 1) * 0.25) / 2); mesh.name = `${car.name}--chunk-${chunk.coordinate.x}-${chunk.coordinate.y}-${chunk.coordinate.z}--${surface.surfaceClass}`; mesh.frustumCulled = true; pivot.add(mesh); this.chunkMeshCount += 1;
      }
    }
  }

  private addSign(group: THREE.Object3D, name: string, width: number, height: number, depth: number, slot: number): void {
    const geometry = new THREE.PlaneGeometry(width, height); this.extraGeometries.add(geometry);
    const uv = geometry.getAttribute('uv'); const u0 = slot * 0.25; const u1 = u0 + 0.24; for (let i = 0; i < uv.count; i += 1) uv.setX(i, i % 2 === 0 ? u0 : u1); uv.needsUpdate = true;
    const sign = new THREE.Mesh(geometry, this.atlas.material); sign.name = `${name}-pixel-sign`; sign.position.set(0, height * 1.1, depth / 2 + 0.03); group.add(sign);
  }

  private addPetals(entity: SceneEntity, host: THREE.Object3D, seed: number): void {
    const group = this.entityRoot(entity, host); const positions: number[] = [];
    for (let i = 0; i < 32; i += 1) { const x = ((i * 17 + seed + 11) % 47) - 23; const z = ((i * 29 + seed * 3 + 7) % 47) - 23; positions.push(x, 2.5 + ((i + seed) % 5) * 0.42, z); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.extraGeometries.add(geometry);
    const points = new THREE.Points(geometry, this.petalMaterial); points.name = `${entity.id}-drift`; points.frustumCulled = true; group.add(points);
  }

  private addEntity(entity: SceneEntity, host: THREE.Object3D, seed: number): void {
    if (entity.kind === 'petal') { this.addPetals(entity, host, seed); return; }
    const group = this.entityRoot(entity, host); this.addCompiledAsset(entity, group);
    if (entity.kind === 'shop') this.addSign(group, entity.id, 2.4, 0.6, entity.transform.scale[2], 0);
    else if (entity.kind === 'vending-machine') this.addSign(group, entity.id, 1.0, 0.4, entity.transform.scale[2], 1);
    else if (entity.kind === 'relay-box') this.addSign(group, entity.id, 0.9, 0.4, entity.transform.scale[2], 2);
  }

  mount(spec: SharedSceneSpecification, host: THREE.Object3D): void {
    if (this.disposed) throw new Error('Cannot mount a disposed VoxelAdapter');
    this.chunkMeshCount = 0;
    for (const entity of spec.entities) if (!INFRASTRUCTURE_KINDS.has(entity.kind)) {
      if (entity.kind === 'crossing') this.addCrossing(entity, host);
      else if (entity.kind === 'train') this.addTrain(entity, host);
      else this.addEntity(entity, host, spec.seed);
    }
    host.userData.voxelEntityIds = spec.entities.filter((entity) => !INFRASTRUCTURE_KINDS.has(entity.kind)).map((entity) => entity.id);
    host.userData.voxelChunkMeshCount = this.chunkMeshCount;
    host.userData.voxelUniqueMaterialCount = this.materials.size + 2;
    host.userData.voxelAtlasTextureCount = 1;
    host.userData.voxelCompiledAssetIds = [...this.compiled.keys()];
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose(); for (const geometry of this.extraGeometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose(); this.petalMaterial.dispose(); this.atlas.dispose();
    this.geometries.clear(); this.extraGeometries.clear(); this.materials.clear(); this.compiled.clear();
  }
}
