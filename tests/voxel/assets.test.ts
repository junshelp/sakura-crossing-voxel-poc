import { describe, expect, it } from 'vitest';
import { VOXEL_ASSETS, VOXEL_ASSET_IDS, buildVoxelAssets, getVoxelAssetForEntity } from '../../src/voxel/assets';
import { validateVoxelAsset, VOXEL_SIZE } from '../../src/voxel/asset';
import { compileVoxelAsset } from '../../src/voxel/compiler';
import { SAMPLE_SCENE } from '../../src/scene-spec';

describe('approved deterministic Voxel Assets', () => {
  it('covers every rendered semantic archetype and validates at the boundary', () => {
    for (const id of VOXEL_ASSET_IDS) {
      const asset = VOXEL_ASSETS[id];
      expect(() => validateVoxelAsset(asset)).not.toThrow();
      expect(asset.cells.length).toBeGreaterThan(0);
      expect(asset.bounds).toBeTruthy();
      for (const cell of asset.cells) {
        expect(Number.isInteger(cell.x)).toBe(true);
        expect(Number.isFinite(cell.x * VOXEL_SIZE)).toBe(true);
        expect(Math.round((cell.x * VOXEL_SIZE) / VOXEL_SIZE)).toBe(cell.x);
        expect(cell.x).toBeGreaterThanOrEqual(asset.bounds!.min.x);
        expect(cell.x).toBeLessThanOrEqual(asset.bounds!.max.x);
        expect(cell.y).toBeGreaterThanOrEqual(asset.bounds!.min.y); expect(cell.y).toBeLessThanOrEqual(asset.bounds!.max.y);
        expect(cell.z).toBeGreaterThanOrEqual(asset.bounds!.min.z); expect(cell.z).toBeLessThanOrEqual(asset.bounds!.max.z);
        expect(cell).not.toHaveProperty('collider');
        expect(cell).not.toHaveProperty('interaction');
        expect(cell).not.toHaveProperty('simulation');
      }
    }
    expect(getVoxelAssetForEntity('house', 'blue-roof')?.id).toBe('house-blue-roof');
    expect(getVoxelAssetForEntity('house', 'tile-roof')?.id).toBe('house-tile-roof');
    expect(getVoxelAssetForEntity('cherry-tree')?.id).toBe('cherry-tree');
  });

  it('maps every non-infrastructure scene kind and every special rig part', () => {
    const infrastructure = new Set(['ground', 'road', 'footway', 'rail', 'wire']);
    for (const entity of SAMPLE_SCENE.entities) if (!infrastructure.has(entity.kind)) expect(getVoxelAssetForEntity(entity.kind, entity.visual.variant), entity.id).toBeTruthy();
    for (const id of ['crossing', 'crossing-barrier', 'crossing-warning-light', 'train', 'shop', 'house-blue', 'house-tile', 'vending-machine', 'dispensed-drink', 'relay-box', 'utility-pole', 'fence', 'cherry-tree', 'bicycle', 'marker', 'petal']) expect(VOXEL_ASSETS[id], id).toBeTruthy();
  });

  it('is byte-equivalent and duplicate-free across repeated builds', () => {
    const first = buildVoxelAssets(); const second = buildVoxelAssets();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    for (const asset of Object.values(first)) expect(new Set(asset.cells.map((cell) => `${cell.x},${cell.y},${cell.z}`)).size).toBe(asset.cells.length);
  });

  it('uses shells/details and keeps the canonical grid bounded', () => {
    expect(VOXEL_ASSETS.shop.cells.length).toBeLessThan(32 * 20 * 32);
    expect(VOXEL_ASSETS['cherry-tree'].bounds!.max.y).toBeGreaterThanOrEqual(23);
    expect(compileVoxelAsset(VOXEL_ASSETS.shop).chunks.length).toBeGreaterThan(0);
  });
});
