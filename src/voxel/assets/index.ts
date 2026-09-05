import { validateVoxelAsset, type SurfaceClass, type VoxelAsset } from '../asset';

type Cell = { x: number; y: number; z: number; paletteId: string };

const PALETTE: Record<string, { surface: SurfaceClass; color: string }> = {
  wood: { surface: 'opaque', color: '#70452f' },
  wall: { surface: 'opaque', color: '#d7b891' },
  roof: { surface: 'opaque', color: '#2b4162' },
  tile: { surface: 'opaque', color: '#a94e49' },
  accent: { surface: 'opaque', color: '#d94f72' },
  metal: { surface: 'opaque', color: '#68737d' },
  leaf: { surface: 'opaque', color: '#4c8c59' },
  petal: { surface: 'opaque', color: '#f3a7ba' },
  glass: { surface: 'transparent', color: '#87c7d8' },
  lamp: { surface: 'emissive', color: '#ffd34d' },
  marker: { surface: 'emissive', color: '#f5c04a' },
};

function addBox(cells: Cell[], minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, paletteId: string, shell = false): void {
  for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) for (let z = minZ; z <= maxZ; z += 1) {
    if (!shell || x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ) cells.push({ x, y, z, paletteId });
  }
}

function addPillar(cells: Cell[], x: number, minY: number, maxY: number, z: number, paletteId: string, width = 1): void {
  addBox(cells, x, x + width - 1, minY, maxY, z, z + width - 1, paletteId);
}

function boundsFor(cells: readonly Cell[]): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
  const values = cells.length ? cells : [{ x: 0, y: 0, z: 0, paletteId: 'marker' }];
  return {
    min: { x: Math.min(...values.map((cell) => cell.x)), y: Math.min(...values.map((cell) => cell.y)), z: Math.min(...values.map((cell) => cell.z)) },
    max: { x: Math.max(...values.map((cell) => cell.x)), y: Math.max(...values.map((cell) => cell.y)), z: Math.max(...values.map((cell) => cell.z)) },
  };
}

function asset(id: string, cells: readonly Cell[], paletteIds: readonly string[] = [...new Set(cells.map((cell) => cell.paletteId))]): VoxelAsset {
  const palette = paletteIds.map((paletteId) => ({ id: paletteId, ...PALETTE[paletteId] }));
  // Details intentionally overwrite shell cells at the same coordinate. The
  // map keeps the authoring helpers compact while the validator still receives
  // a strict sparse asset with deterministic ordering and no duplicates.
  const occupied = new Map<string, Cell>();
  for (const cell of cells) occupied.set(`${cell.x},${cell.y},${cell.z}`, cell);
  const unique = [...occupied.values()];
  const minX = Math.min(...unique.map((cell) => cell.x)); const minZ = Math.min(...unique.map((cell) => cell.z));
  const normalized = unique.map((cell) => ({ ...cell, x: cell.x - minX, z: cell.z - minZ })).sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z || a.paletteId.localeCompare(b.paletteId));
  return validateVoxelAsset({ id, palette, cells: normalized, bounds: boundsFor(normalized) });
}

function building(id: string, width: number, height: number, depth: number, roofId: string, shop = false): VoxelAsset {
  const w = Math.round(width / 0.25); const h = Math.round(height / 0.25); const d = Math.round(depth / 0.25);
  const cells: Cell[] = [];
  addBox(cells, -Math.floor(w / 2), Math.ceil(w / 2) - 1, 0, Math.round(h * 0.72) - 1, -Math.floor(d / 2), Math.ceil(d / 2) - 1, shop ? 'wood' : 'wall', true);
  addBox(cells, -Math.floor(w / 2), Math.ceil(w / 2) - 1, Math.round(h * 0.72), Math.round(h * 0.88), -Math.floor(d / 2), Math.ceil(d / 2) - 1, roofId, true);
  addBox(cells, -2, 2, 0, Math.round(h * 0.4) - 1, Math.floor(d / 2), Math.floor(d / 2) + 1, shop ? 'accent' : 'wood');
  addBox(cells, -4, -1, Math.round(h * 0.42), Math.round(h * 0.58), Math.floor(d / 2), Math.floor(d / 2) + 1, 'glass');
  addBox(cells, 1, 4, Math.round(h * 0.42), Math.round(h * 0.58), Math.floor(d / 2), Math.floor(d / 2) + 1, 'glass');
  return asset(id, cells);
}

function createCrossingAsset(): VoxelAsset {
  const cells: Cell[] = [];
  addBox(cells, -10, 9, 0, 0, -6, 5, 'metal');
  for (const x of [-8, 7]) addPillar(cells, x, 1, 7, 3, 'metal', 1);
  addBox(cells, -3, 2, 6, 7, 4, 4, 'metal');
  return asset('crossing-equipment', cells);
}

function createBarrierAsset(): VoxelAsset { const cells: Cell[] = []; addBox(cells, -9, 0, 6, 7, -1, 0, 'accent'); return asset('crossing-barrier', cells); }
function createWarningAsset(): VoxelAsset { return asset('crossing-warning-light', [{ x: 0, y: 0, z: 0, paletteId: 'lamp' }]); }

function createTrainCarAsset(): VoxelAsset {
  const cells: Cell[] = [];
  addBox(cells, -7, 6, 0, 7, -5, 5, 'metal', true);
  addBox(cells, -8, 7, 8, 9, -6, 6, 'accent', true);
  for (const x of [-5, -1, 3]) addBox(cells, x, x + 1, 3, 5, 5, 5, 'glass');
  addBox(cells, -1, 0, 2, 3, -6, -5, 'lamp');
  return asset('train-car-shell', cells);
}

function createMachineAsset(id: string, relay: boolean): VoxelAsset {
  const cells: Cell[] = [];
  const width = relay ? 5 : 6; const depth = relay ? 3 : 3; const height = 9;
  addBox(cells, -Math.floor(width / 2), Math.ceil(width / 2) - 1, 0, height - 1, -1, depth - 2, relay ? 'metal' : 'accent', true);
  addBox(cells, -Math.floor(width / 2) + 1, Math.ceil(width / 2) - 2, 4, 7, depth - 1, depth, relay ? 'metal' : 'glass');
  addBox(cells, Math.ceil(width / 2) - 2, Math.ceil(width / 2) - 1, 1, 2, depth - 1, depth, 'lamp');
  return asset(id, cells);
}

function createPoleAsset(): VoxelAsset {
  const cells: Cell[] = []; addBox(cells, -1, 1, 0, 31, -1, 1, 'wood'); addBox(cells, -8, 8, 28, 29, -1, 1, 'wood'); return asset('utility-pole', cells);
}

function createFenceAsset(): VoxelAsset {
  const cells: Cell[] = [];
  for (let x = -104; x <= 103; x += 16) addBox(cells, x, x + 1, 0, 7, 0, 1, 'wood');
  addBox(cells, -104, 103, 5, 6, 0, 1, 'wood');
  return asset('safety-fence', cells);
}

function createTreeAsset(): VoxelAsset {
  const cells: Cell[] = []; addBox(cells, -1, 1, 0, 23, -1, 1, 'wood');
  addBox(cells, -5, 5, 16, 21, -4, 4, 'leaf', true); addBox(cells, -7, -2, 14, 19, -2, 3, 'leaf', true); addBox(cells, 2, 7, 14, 19, -3, 2, 'leaf', true);
  for (const [x, y, z] of [[-6, 14, -3], [5, 13, 3], [-3, 20, 4], [3, 19, -4]] as const) addBox(cells, x, x + 1, y, y + 1, z, z + 1, 'petal');
  return asset('cherry-tree', cells);
}

function createBicycleAsset(): VoxelAsset {
  const cells: Cell[] = []; addBox(cells, -5, 5, 1, 2, 0, 1, 'metal'); addBox(cells, -1, 1, 3, 3, 0, 1, 'accent'); addBox(cells, -1, 0, 4, 5, 0, 1, 'metal');
  for (const x of [-5, 4]) { addBox(cells, x, x + 1, 0, 5, 0, 1, 'metal'); addBox(cells, x - 1, x + 2, 0, 1, 0, 1, 'metal'); }
  return asset('parked-bicycle', cells);
}

function createMarkerAsset(): VoxelAsset { return asset('crossing-marker', [{ x: 0, y: 0, z: 0, paletteId: 'marker' }]); }
function createPetalAsset(): VoxelAsset { return asset('petal-drift', [{ x: 0, y: 0, z: 0, paletteId: 'petal' }]); }
function createDispensedDrinkAsset(): VoxelAsset {
  const cells: Cell[] = [{ x: 0, y: 0, z: 0, paletteId: 'accent' }, { x: 0, y: 1, z: 0, paletteId: 'metal' }];
  return asset('dispensed-drink', cells);
}

/** Deterministic visual assets; gameplay fields intentionally cannot enter this type. */
export const VOXEL_ASSETS: Readonly<Record<string, VoxelAsset>> = Object.freeze({
  crossing: createCrossingAsset(),
  'crossing-barrier': createBarrierAsset(),
  'crossing-warning-light': createWarningAsset(),
  train: createTrainCarAsset(),
  shop: building('corner-shop', 8, 4, 7, 'roof', true),
  'house-blue': building('house-blue-roof', 8, 4, 8, 'roof'),
  'house-tile': building('house-tile-roof', 9, 4, 8, 'tile'),
  'vending-machine': createMachineAsset('vending-machine', false),
  'relay-box': createMachineAsset('relay-box', true),
  'utility-pole': createPoleAsset(),
  fence: createFenceAsset(),
  'cherry-tree': createTreeAsset(),
  bicycle: createBicycleAsset(),
  marker: createMarkerAsset(),
  petal: createPetalAsset(),
  'dispensed-drink': createDispensedDrinkAsset(),
});

export const VOXEL_ASSET_IDS = Object.freeze(Object.keys(VOXEL_ASSETS));

export function getVoxelAssetForEntity(kind: string, variant?: string): VoxelAsset | undefined {
  if (kind === 'house') return VOXEL_ASSETS[variant === 'tile-roof' ? 'house-tile' : 'house-blue'];
  return VOXEL_ASSETS[kind];
}

export function buildVoxelAssets(): Readonly<Record<string, VoxelAsset>> { return VOXEL_ASSETS; }
