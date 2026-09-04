import { CHUNK_SIZE, VOXEL_SIZE, type SurfaceClass, type VoxelAsset, type VoxelCell, type VoxelColor, type VoxelPaletteEntry } from './asset';

export interface ChunkCoordinate { readonly x: number; readonly y: number; readonly z: number }
export interface CompiledBounds { readonly min: VoxelColor; readonly max: VoxelColor }

export interface CompiledSurfaceGroup {
  readonly surfaceClass: SurfaceClass;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  /** One palette index per emitted vertex, useful to palette-shader adapters. */
  readonly paletteIds: Uint32Array;
  readonly indices: Uint32Array;
  readonly bounds: CompiledBounds;
  readonly quadCount: number;
}

export interface CompiledVoxelChunk {
  readonly coordinate: ChunkCoordinate;
  readonly groups: readonly CompiledSurfaceGroup[];
  readonly bounds: CompiledBounds;
}

export interface CompiledVoxelMesh {
  readonly assetId: string;
  readonly chunks: readonly CompiledVoxelChunk[];
}

interface CellRecord extends VoxelCell { readonly palette: VoxelPaletteEntry; readonly paletteIndex: number }
interface FaceKey { readonly paletteId: string; readonly surfaceClass: SurfaceClass; readonly paletteIndex: number }
interface Face { readonly key: FaceKey; readonly cell: CellRecord }
interface CompiledFace extends Face { readonly width: number; readonly height: number; readonly direction: typeof DIRECTIONS[number] }

const DIRECTIONS = [
  { axis: 0, sign: 1, normal: [1, 0, 0] as const, u: 1, v: 2 },
  { axis: 0, sign: -1, normal: [-1, 0, 0] as const, u: 1, v: 2 },
  { axis: 1, sign: 1, normal: [0, 1, 0] as const, u: 2, v: 0 },
  { axis: 1, sign: -1, normal: [0, -1, 0] as const, u: 2, v: 0 },
  { axis: 2, sign: 1, normal: [0, 0, 1] as const, u: 0, v: 1 },
  { axis: 2, sign: -1, normal: [0, 0, -1] as const, u: 0, v: 1 },
] as const;
const SURFACE_ORDER: readonly SurfaceClass[] = ['opaque', 'transparent', 'emissive'];

function chunkPart(coordinate: number): number { return Math.floor(coordinate / CHUNK_SIZE); }
function localPart(coordinate: number): number { return ((coordinate % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE; }
function chunkKey(x: number, y: number, z: number): string { return `${x},${y},${z}`; }
function cellKey(x: number, y: number, z: number): string { return `${x},${y},${z}`; }
function compareCoordinate(a: ChunkCoordinate, b: ChunkCoordinate): number { return a.x - b.x || a.y - b.y || a.z - b.z; }
function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function getAxis(cell: VoxelCell, axis: 0 | 1 | 2): number { return axis === 0 ? cell.x : axis === 1 ? cell.y : cell.z; }
function setAxis(target: [number, number, number], axis: 0 | 1 | 2, value: number): void { target[axis] = value; }

function makeBounds(vertices: readonly number[]): CompiledBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], vertices[i + axis]); max[axis] = Math.max(max[axis], vertices[i + axis]); }
  }
  return { min, max };
}

function emitQuad(
  output: { positions: number[]; normals: number[]; colors: number[]; paletteIds: number[]; indices: number[] },
  cell: CellRecord, direction: typeof DIRECTIONS[number], uStart: number, vStart: number, width: number, height: number,
): void {
  const base = output.positions.length / 3;
  const coordinates: [number, number, number] = [cell.x, cell.y, cell.z];
  const plane = getAxis(cell, direction.axis) + (direction.sign > 0 ? 1 : 0);
  setAxis(coordinates, direction.axis, plane);
  const p = coordinates.map((value) => value * VOXEL_SIZE) as [number, number, number];
  const u = direction.u;
  const v = direction.v;
  const points: [number, number, number][] = [
    [...p] as [number, number, number], [...p] as [number, number, number],
    [...p] as [number, number, number], [...p] as [number, number, number],
  ];
  setAxis(points[1], u, (getAxis(cell, u) + uStart + width) * VOXEL_SIZE);
  setAxis(points[1], v, (getAxis(cell, v) + vStart) * VOXEL_SIZE);
  setAxis(points[2], u, (getAxis(cell, u) + uStart + width) * VOXEL_SIZE);
  setAxis(points[2], v, (getAxis(cell, v) + vStart + height) * VOXEL_SIZE);
  setAxis(points[3], u, (getAxis(cell, u) + uStart) * VOXEL_SIZE);
  setAxis(points[3], v, (getAxis(cell, v) + vStart + height) * VOXEL_SIZE);
  // For negative directions reverse the winding while retaining an outward normal.
  const ordered = direction.sign > 0 ? points : [points[0], points[3], points[2], points[1]];
  for (const point of ordered) {
    output.positions.push(...point); output.normals.push(...direction.normal); output.colors.push(...cell.palette.color); output.paletteIds.push(cell.paletteIndex);
  }
  output.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function compileGroup(surfaceClass: SurfaceClass, faces: readonly CompiledFace[]): CompiledSurfaceGroup {
  const output = { positions: [] as number[], normals: [] as number[], colors: [] as number[], paletteIds: [] as number[], indices: [] as number[] };
  const sortedFaces = [...faces].sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y || a.cell.z - b.cell.z || a.direction.axis - b.direction.axis || a.direction.sign - b.direction.sign || compareText(a.key.paletteId, b.key.paletteId));
  for (const face of sortedFaces) {
    // face.cell is the lower-left cell of the rectangle in the selected u/v
    // ordering, so offsets are relative to that cell.
    emitQuad(output, face.cell, face.direction, 0, 0, face.width, face.height);
  }
  const bounds = makeBounds(output.positions);
  return { surfaceClass, positions: new Float32Array(output.positions), normals: new Float32Array(output.normals), colors: new Float32Array(output.colors), paletteIds: new Uint32Array(output.paletteIds), indices: new Uint32Array(output.indices), bounds, quadCount: output.indices.length / 6 };
}

function compileFacesForPalette(key: FaceKey, chunkCells: readonly CellRecord[], occupied: ReadonlyMap<string, CellRecord>): CompiledFace[] {
  const faces: CompiledFace[] = [];
  for (const direction of DIRECTIONS) {
    const slices = new Set<number>(chunkCells.filter((cell) => cell.paletteId === key.paletteId && cell.palette.surface === key.surfaceClass).map((cell) => getAxis(cell, direction.axis)));
    for (const slice of [...slices].sort((a, b) => a - b)) {
      const mask: (Face | undefined)[][] = Array.from({ length: CHUNK_SIZE }, () => Array<Face | undefined>(CHUNK_SIZE));
      // Build one 2D slice at this face's plane. The nested mask is local to a
      // direction and slice, making greedy rectangles deterministic and bounded.
      for (const candidate of chunkCells) {
        if (candidate.paletteId !== key.paletteId || candidate.palette.surface !== key.surfaceClass || getAxis(candidate, direction.axis) !== slice) continue;
        const n = [candidate.x, candidate.y, candidate.z] as [number, number, number]; n[direction.axis] += direction.sign;
        if (occupied.has(cellKey(n[0], n[1], n[2]))) continue;
        const u = localPart(getAxis(candidate, direction.u));
        const v = localPart(getAxis(candidate, direction.v));
        mask[u][v] = { key, cell: candidate };
      }
      for (let u = 0; u < CHUNK_SIZE; u += 1) {
        for (let v = 0; v < CHUNK_SIZE; v += 1) {
          const face = mask[u][v];
          if (!face) continue;
          let width = 1;
          while (u + width < CHUNK_SIZE && mask[u + width][v]) width += 1;
          let height = 1;
          outer: while (v + height < CHUNK_SIZE) {
            for (let x = 0; x < width; x += 1) if (!mask[u + x][v + height]) break outer;
            height += 1;
          }
          const rectangle: CompiledFace = { key, cell: face.cell, direction, width, height };
          faces.push(rectangle);
          for (let x = 0; x < width; x += 1) for (let y = 0; y < height; y += 1) mask[u + x][v + y] = undefined;
        }
      }
    }
  }
  return faces;
}

/** Compile a validated asset into deterministic, chunked greedy surfaces. */
export function compileVoxelAsset(asset: VoxelAsset): CompiledVoxelMesh {
  const paletteById = new Map(asset.palette.map((entry, index) => [entry.id, { entry, index }]));
  const occupied = new Map<string, CellRecord>();
  const chunks = new Map<string, { coordinate: ChunkCoordinate; cells: CellRecord[] }>();
  for (const cell of asset.cells) {
    const palette = paletteById.get(cell.paletteId);
    if (!palette) throw new Error(`Unknown palette id ${cell.paletteId}`);
    const record = { ...cell, palette: palette.entry, paletteIndex: palette.index };
    occupied.set(cellKey(cell.x, cell.y, cell.z), record);
    const coordinate = { x: chunkPart(cell.x), y: chunkPart(cell.y), z: chunkPart(cell.z) };
    const key = chunkKey(coordinate.x, coordinate.y, coordinate.z);
    const chunk = chunks.get(key) ?? { coordinate, cells: [] };
    chunk.cells.push(record); chunks.set(key, chunk);
  }
  const compiledChunks: CompiledVoxelChunk[] = [];
  for (const chunk of [...chunks.values()].sort((a, b) => compareCoordinate(a.coordinate, b.coordinate))) {
    const chunkCells = [...chunk.cells].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    const keys = new Map<string, FaceKey>();
    for (const cell of chunkCells) keys.set(`${cell.palette.surface}\u0000${cell.paletteId}`, { surfaceClass: cell.palette.surface, paletteId: cell.paletteId, paletteIndex: cell.paletteIndex });
    const groups: CompiledSurfaceGroup[] = [];
    for (const surfaceClass of SURFACE_ORDER) {
      const faces = [...keys.values()]
        .filter((value) => value.surfaceClass === surfaceClass)
        .sort((a, b) => compareText(a.paletteId, b.paletteId))
        .flatMap((key) => compileFacesForPalette(key, chunkCells, occupied));
      if (faces.length > 0) groups.push(compileGroup(surfaceClass, faces));
    }
    const allPositions = groups.flatMap((group) => [...group.positions]);
    const bounds = makeBounds(allPositions);
    compiledChunks.push({ coordinate: chunk.coordinate, groups, bounds });
  }
  return { assetId: asset.id, chunks: compiledChunks };
}

export const compileVoxelMesh = compileVoxelAsset;
export const partitionVoxelChunks = compileVoxelAsset;
