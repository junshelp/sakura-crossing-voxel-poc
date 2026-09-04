import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, VOXEL_SIZE, validateVoxelAsset, type VoxelAsset } from '../../src/voxel/asset';
import { compileVoxelAsset } from '../../src/voxel/compiler';
import { surfaceGroupToBufferGeometry } from '../../src/voxel/three-geometry';

const palette = [
  { id: 'stone', surface: 'opaque' as const, color: '#808080' },
  { id: 'glass', surface: 'transparent' as const, color: '#66ccff' },
  { id: 'lamp', surface: 'emissive' as const, color: [1, 0.5, 0] as const },
];
function asset(cells: readonly { x: number; y: number; z: number; paletteId: string }[]): VoxelAsset {
  return validateVoxelAsset({ id: 'test-asset', palette, cells });
}
function groups(result: ReturnType<typeof compileVoxelAsset>) { return result.chunks.flatMap((chunk) => chunk.groups); }
function positionBounds(result: ReturnType<typeof compileVoxelAsset>) { return result.chunks.map((chunk) => chunk.bounds); }

describe('Voxel Asset validation', () => {
  it('normalizes valid sparse palette data and rejects malformed inputs', () => {
    const value = validateVoxelAsset({ id: 'house', palette: [{ id: 'wall', surface: 'opaque', color: [255, 0, 0] }], cells: [{ x: 0, y: 0, z: 0, paletteId: 'wall' }] });
    expect(value.palette[0].surface).toBe('opaque');
    expect(value.palette[0].color).toEqual([1, 0, 0]);
    const rejects: unknown[] = [
      null, 3, { id: 'x', palette: [], cells: [], extra: true },
      { id: ' ', palette: [], cells: [] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }, { id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [{ x: 0.5, y: 0, z: 0, paletteId: 'p' }] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [{ x: 0, y: 0, z: 0, paletteId: 'p' }, { x: 0, y: 0, z: 0, paletteId: 'p' }] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [{ x: 0, y: 0, z: 0, paletteId: 'missing' }] },
      { id: 'x', palette: [{ id: 'p', surface: 'wrong', color: '#ffffff' }], cells: [] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: 'red' }], cells: [] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff', onUse: 'open-door' }], cells: [] },
      { id: 'x', palette: [{ id: 'p', surfaceClass: 'opaque', color: '#ffffff' }], cells: [] },
      { id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [], gameplay: { onInteract: true } },
    ];
    for (const input of rejects) expect(() => validateVoxelAsset(input)).toThrow();
  });
  it('validates optional bounds and rejects cells outside them', () => {
    expect(() => validateVoxelAsset({ id: 'x', palette: [], cells: [], bounds: { min: { x: 1, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } } })).toThrow();
    expect(() => validateVoxelAsset({ id: 'x', palette: [{ id: 'p', surface: 'opaque', color: '#ffffff' }], cells: [{ x: 2, y: 0, z: 0, paletteId: 'p' }], bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 0 } } })).toThrow();
  });
});

describe('deterministic chunk greedy compiler', () => {
  it('returns no chunks for an empty asset', () => { expect(compileVoxelAsset(asset([])).chunks).toEqual([]); });
  it('emits six outward, correctly wound faces for one voxel', () => {
    const result = compileVoxelAsset(asset([{ x: 0, y: 0, z: 0, paletteId: 'stone' }]));
    const group = groups(result)[0];
    expect(group.quadCount).toBe(6);
    expect(group.positions).toHaveLength(6 * 4 * 3);
    for (let quad = 0; quad < 6; quad += 1) {
      const i = quad * 12;
      const a = new THREE.Vector3().fromArray(group.positions, i);
      const b = new THREE.Vector3().fromArray(group.positions, i + 3);
      const c = new THREE.Vector3().fromArray(group.positions, i + 6);
      const actual = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      const normal = new THREE.Vector3().fromArray(group.normals, quad * 12);
      expect(actual.dot(normal)).toBeGreaterThan(0.99);
    }
    expect(group.bounds.min).toEqual([0, 0, 0]);
    expect(group.bounds.max).toEqual([VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]);
  });
  it('merges a solid rectangular volume into six exterior quads', () => {
    const cells = Array.from({ length: 2 }, (_, x) => Array.from({ length: 3 }, (_, y) => Array.from({ length: 2 }, (_, z) => ({ x, y, z, paletteId: 'stone' as const })))).flat(2);
    const result = compileVoxelAsset(asset(cells));
    expect(groups(result).length).toBe(1);
    expect(groups(result)[0].quadCount).toBe(6);
  });
  it('keeps all six cavity surfaces in a complete 3x3x3 shell', () => {
    const hollow = Array.from({ length: 3 }, (_, x) => Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, z) => ({ x, y, z, paletteId: 'stone' as const })))).flat(2).filter((cell) => !(cell.x === 1 && cell.y === 1 && cell.z === 1));
    const result = compileVoxelAsset(asset(hollow));
    expect(groups(result).reduce((count, group) => count + group.quadCount, 0)).toBe(12);
    const adjacent = compileVoxelAsset(asset([{ x: 0, y: 0, z: 0, paletteId: 'stone' }, { x: 1, y: 0, z: 0, paletteId: 'glass' }]));
    expect(groups(adjacent).reduce((count, group) => count + group.quadCount, 0)).toBe(10);
  });
  it('resolves chunk seams and negative floor partitioning globally', () => {
    const result = compileVoxelAsset(asset([{ x: 31, y: 0, z: 0, paletteId: 'stone' }, { x: 32, y: 0, z: 0, paletteId: 'stone' }, { x: -32, y: 0, z: 0, paletteId: 'lamp' }, { x: -31, y: 0, z: 0, paletteId: 'lamp' }]));
    expect(result.chunks.map((chunk) => chunk.coordinate)).toEqual([{ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]);
    expect(groups(result).filter((group) => group.surfaceClass === 'opaque').reduce((count, group) => count + group.quadCount, 0)).toBe(10);
    expect(groups(result).find((group) => group.surfaceClass === 'emissive')?.quadCount).toBe(6);
    expect(positionBounds(result)[0].min[0]).toBe(-8);
  });
  it('is byte-for-byte deterministic independent of input order and separates surface groups', () => {
    const cells = [{ x: 0, y: 0, z: 0, paletteId: 'stone' }, { x: 1, y: 0, z: 0, paletteId: 'glass' }, { x: 0, y: 1, z: 0, paletteId: 'lamp' }];
    const a = compileVoxelAsset(asset(cells));
    const b = compileVoxelAsset(asset([...cells].reverse()));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(groups(a).map((group) => group.surfaceClass)).toEqual(['opaque', 'transparent', 'emissive']);
  });
  it('keeps one group per surface class while retaining palette data per vertex', () => {
    const result = compileVoxelAsset(asset([{ x: 0, y: 0, z: 0, paletteId: 'stone' }, { x: 2, y: 0, z: 0, paletteId: 'glass' }, { x: 4, y: 0, z: 0, paletteId: 'stone' }]));
    const opaque = groups(result).find((group) => group.surfaceClass === 'opaque')!;
    expect(groups(result).filter((group) => group.surfaceClass === 'opaque')).toHaveLength(1);
    expect([...new Set(opaque.paletteIds)]).toEqual([0]);
    const mixedPalette = validateVoxelAsset({ id: 'mixed', palette: [{ id: 'a', surface: 'opaque', color: '#ff0000' }, { id: 'b', surface: 'opaque', color: '#00ff00' }], cells: [{ x: 0, y: 0, z: 0, paletteId: 'a' }, { x: 2, y: 0, z: 0, paletteId: 'b' }] });
    const mixedOpaque = compileVoxelAsset(mixedPalette).chunks[0].groups[0];
    expect(mixedOpaque.surfaceClass).toBe('opaque');
    expect([...new Set(mixedOpaque.paletteIds)].sort()).toEqual([0, 1]);
  });
  it('converts one surface group to indexed Three.js geometry with bounds', () => {
    const group = groups(compileVoxelAsset(asset([{ x: 0, y: 0, z: 0, paletteId: 'stone' }])))[0];
    const geometry = surfaceGroupToBufferGeometry(group);
    expect(geometry.index?.count).toBe(36);
    expect(geometry.getAttribute('position').count).toBe(24);
    expect(geometry.getAttribute('normal').count).toBe(24);
    expect(geometry.getAttribute('color').count).toBe(24);
    expect(geometry.getAttribute('paletteId').count).toBe(24);
    expect(geometry.boundingBox?.min.toArray()).toEqual([0, 0, 0]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]);
    geometry.dispose();
  });
  it('uses the canonical chunk size', () => { expect(CHUNK_SIZE).toBe(32); expect(VOXEL_SIZE).toBe(0.25); });
});
