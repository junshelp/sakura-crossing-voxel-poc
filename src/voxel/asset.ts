/** Canonical authored voxel scale. All emitted positions are in metres. */
export const VOXEL_SIZE = 0.25;
/** Number of cells on each side of a Voxel Chunk. */
export const CHUNK_SIZE = 32;
export const MAX_PALETTE_ENTRIES = 64;
export const MAX_CELLS = 1_000_000;

export type SurfaceClass = 'opaque' | 'transparent' | 'emissive';
export type VoxelColor = readonly [number, number, number];

export interface VoxelPaletteEntry {
  readonly id: string;
  readonly surface: SurfaceClass;
  readonly color: VoxelColor;
}

export interface VoxelCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly paletteId: string;
}

export interface VoxelBounds {
  readonly min: VoxelCellCoordinate;
  readonly max: VoxelCellCoordinate;
}

export interface VoxelCellCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VoxelAsset {
  readonly id: string;
  readonly palette: readonly VoxelPaletteEntry[];
  readonly cells: readonly VoxelCell[];
  readonly bounds?: VoxelBounds;
}

export class VoxelAssetValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'VoxelAssetValidationError';
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new VoxelAssetValidationError(path, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${path}.${key}`, 'unknown field');
  }
}

function assertId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(path, 'id must be a non-blank string without surrounding whitespace');
  }
  return value;
}

function parseColor(value: unknown, path: string): VoxelColor {
  if (typeof value === 'string') {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) fail(path, 'color must be a #RRGGBB value');
    return [
      Number.parseInt(value.slice(1, 3), 16) / 255,
      Number.parseInt(value.slice(3, 5), 16) / 255,
      Number.parseInt(value.slice(5, 7), 16) / 255,
    ];
  }
  if (Array.isArray(value) && value.length === 3 && value.every((component) => typeof component === 'number' && Number.isFinite(component))) {
    const components = value as number[];
    const isUnit = components.every((component) => component >= 0 && component <= 1);
    const isByte = components.every((component) => Number.isInteger(component) && component >= 0 && component <= 255);
    if (isUnit) return [components[0], components[1], components[2]];
    if (isByte) return [components[0] / 255, components[1] / 255, components[2] / 255];
  }
  fail(path, 'color must be #RRGGBB or three finite RGB components');
}

function parseCoordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'coordinate must be an integer');
  return value;
}

function parseBounds(value: unknown, path: string): VoxelBounds {
  if (!isRecord(value)) fail(path, 'bounds must be an object');
  assertKeys(value, ['min', 'max'], path);
  if (!isRecord(value.min) || !isRecord(value.max)) fail(path, 'bounds min and max must be objects');
  assertKeys(value.min, ['x', 'y', 'z'], `${path}.min`);
  assertKeys(value.max, ['x', 'y', 'z'], `${path}.max`);
  const min = { x: parseCoordinate(value.min.x, `${path}.min.x`), y: parseCoordinate(value.min.y, `${path}.min.y`), z: parseCoordinate(value.min.z, `${path}.min.z`) };
  const max = { x: parseCoordinate(value.max.x, `${path}.max.x`), y: parseCoordinate(value.max.y, `${path}.max.y`), z: parseCoordinate(value.max.z, `${path}.max.z`) };
  if (min.x > max.x || min.y > max.y || min.z > max.z) fail(path, 'bounds min must not exceed max');
  return { min, max };
}

/** Validate and normalize unknown data at the visual-data boundary. */
export function validateVoxelAsset(input: unknown): VoxelAsset {
  if (!isRecord(input)) fail('$', 'asset must be an object');
  assertKeys(input, ['id', 'palette', 'cells', 'bounds'], '$');
  const id = assertId(input.id, '$.id');
  if (!Array.isArray(input.palette)) fail('$.palette', 'palette must be an array');
  if (input.palette.length > MAX_PALETTE_ENTRIES) fail('$.palette', `palette may contain at most ${MAX_PALETTE_ENTRIES} entries`);
  const palette: VoxelPaletteEntry[] = [];
  const paletteIds = new Set<string>();
  input.palette.forEach((raw, index) => {
    const path = `$.palette[${index}]`;
    if (!isRecord(raw)) fail(path, 'palette entry must be an object');
    assertKeys(raw, ['id', 'surface', 'color'], path);
    const paletteId = assertId(raw.id, `${path}.id`);
    if (paletteIds.has(paletteId)) fail(`${path}.id`, 'duplicate palette id');
    paletteIds.add(paletteId);
    const surface = raw.surface;
    if (surface !== 'opaque' && surface !== 'transparent' && surface !== 'emissive') fail(`${path}.surface`, 'surface must be opaque, transparent, or emissive');
    palette.push(Object.freeze({ id: paletteId, surface, color: Object.freeze(parseColor(raw.color, `${path}.color`)) }));
  });
  if (!Array.isArray(input.cells)) fail('$.cells', 'cells must be an array');
  if (input.cells.length > MAX_CELLS) fail('$.cells', `cells may contain at most ${MAX_CELLS} entries`);
  const cells: VoxelCell[] = [];
  const occupancy = new Set<string>();
  input.cells.forEach((raw, index) => {
    const path = `$.cells[${index}]`;
    if (!isRecord(raw)) fail(path, 'cell must be an object');
    assertKeys(raw, ['x', 'y', 'z', 'paletteId'], path);
    const cell = { x: parseCoordinate(raw.x, `${path}.x`), y: parseCoordinate(raw.y, `${path}.y`), z: parseCoordinate(raw.z, `${path}.z`), paletteId: assertId(raw.paletteId, `${path}.paletteId`) };
    const key = `${cell.x},${cell.y},${cell.z}`;
    if (occupancy.has(key)) fail(path, 'duplicate occupied coordinate');
    if (!paletteIds.has(cell.paletteId)) fail(`${path}.paletteId`, 'unknown palette id');
    occupancy.add(key);
    cells.push(Object.freeze(cell));
  });
  const bounds = input.bounds === undefined ? undefined : parseBounds(input.bounds, '$.bounds');
  if (bounds) {
    for (const cell of cells) {
      if (cell.x < bounds.min.x || cell.x > bounds.max.x || cell.y < bounds.min.y || cell.y > bounds.max.y || cell.z < bounds.min.z || cell.z > bounds.max.z) {
        fail('$.bounds', 'all cells must lie within bounds');
      }
    }
  }
  return Object.freeze({ id, palette: Object.freeze(palette), cells: Object.freeze(cells), ...(bounds ? { bounds: Object.freeze({ min: Object.freeze(bounds.min), max: Object.freeze(bounds.max) }) } : {}) });
}

export function isVoxelAsset(input: unknown): input is VoxelAsset {
  try { validateVoxelAsset(input); return true; } catch { return false; }
}

export const parseVoxelAsset = validateVoxelAsset;
