export const BENCHMARK_SCHEMA = 'sakura-crossing-benchmark/v1' as const;
export type BenchmarkMode = 'baseline' | 'voxel';
export interface BenchmarkDurations { warmupMs: number; sampleMs: number }
export const STANDARD_DURATIONS = Object.freeze({ warmupMs: 5000, sampleMs: 30000 });
export const DIAGNOSTIC_DURATIONS = Object.freeze({ warmupMs: 200, sampleMs: 600 });
export const LEG_ORDER: readonly BenchmarkMode[] = Object.freeze(['baseline', 'voxel', 'baseline', 'voxel', 'baseline', 'voxel']);

export interface LegMetrics {
  mode: BenchmarkMode;
  index: number;
  sampleCount: number;
  p50FrameMs: number | null;
  p95FrameMs: number | null;
  meanFrameMs: number | null;
  medianDrawCalls: number | null;
  triangles: number | null;
  textureCount: number | null;
  shaderProgramCount: number | null;
  mountMs: number;
  generatedGeometryBytes: number | null;
}
export interface ReferenceProfile {
  profileName: string;
  userAgent: string;
  platform: string;
  hardware: string;
  renderer: string;
  viewport: { width: number; height: number };
  dpr: number;
  timestamp: string;
  sourceCommit: string;
  dirtyBuild: boolean;
  hardwarePowerContext: string;
}
export interface BenchmarkReport {
  schema: typeof BENCHMARK_SCHEMA;
  diagnostic: boolean;
  seed: number;
  durations: BenchmarkDurations;
  legs: LegMetrics[];
  referenceProfile: ReferenceProfile;
  gpuTimer: { status: 'unsupported' | 'not-measured'; values: null };
  conclusion: {
    status: 'continue' | 'revise' | 'reject' | 'inconclusive';
    drawCallReductionPct: number | null;
    p95ImprovementPct: number | null;
    secondaryRegressionPct: number | null;
    reasons: string[];
  };
}
export interface FrameMetrics {
  frameMs: number;
  drawCalls: number;
  triangles: number;
  textureCount: number;
  shaderProgramCount: number;
}

const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const measuredFields = ['p50FrameMs', 'p95FrameMs', 'meanFrameMs', 'medianDrawCalls', 'triangles', 'textureCount', 'shaderProgramCount', 'generatedGeometryBytes'] as const;

/** Linearly interpolated percentile. Invalid input is explicit, not silently zero. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length || !nonnegative(p) || p > 1 || values.some(v => !nonnegative(v))) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  return sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower);
}

export function summarizeFrameTimes(values: readonly number[]) {
  const valid = values.filter(nonnegative);
  return {
    sampleCount: valid.length,
    p50FrameMs: percentile(valid, .5),
    p95FrameMs: percentile(valid, .95),
    meanFrameMs: valid.length ? valid.reduce((mean, value) => mean + value / valid.length, 0) : null,
  };
}

export function measurementWindow(startMs: number, durations: BenchmarkDurations) {
  return { warmupEnd: startMs + durations.warmupMs, sampleEnd: startMs + durations.warmupMs + durations.sampleMs };
}

export function cameraMarkerAt(elapsedMs: number, durations: BenchmarkDurations): 'overview' | 'crossing' | 'railway' {
  if (!nonnegative(elapsedMs) || elapsedMs < durations.warmupMs + durations.sampleMs / 3) return 'overview';
  return elapsedMs < durations.warmupMs + durations.sampleMs * 2 / 3 ? 'crossing' : 'railway';
}

/** Samples complete rendered-frame intervals; boundary-straddling frames are excluded. */
export class FrameSampler {
  readonly startMs: number;
  readonly durations: BenchmarkDurations;
  private readonly samples: FrameMetrics[] = [];
  private lastEnd = -Infinity;

  constructor(startMs: number, durations: BenchmarkDurations) {
    if (!nonnegative(startMs) || !durations || !nonnegative(durations.warmupMs) || durations.warmupMs === 0 ||
      !nonnegative(durations.sampleMs) || durations.sampleMs === 0 ||
      !Number.isFinite(startMs + durations.warmupMs + durations.sampleMs)) throw new RangeError('Invalid benchmark timing');
    this.startMs = startMs;
    this.durations = Object.freeze({ ...durations });
  }

  add(previousMs: number, nowMs: number, metrics: FrameMetrics): boolean {
    const window = measurementWindow(this.startMs, this.durations);
    if (![previousMs, nowMs, metrics.frameMs, metrics.drawCalls, metrics.triangles, metrics.textureCount, metrics.shaderProgramCount].every(nonnegative) ||
      nowMs <= previousMs || previousMs < window.warmupEnd || nowMs > window.sampleEnd ||
      previousMs < this.lastEnd || metrics.frameMs !== nowMs - previousMs) return false;
    this.lastEnd = nowMs;
    this.samples.push({ ...metrics });
    return true;
  }

  summarize(mode: BenchmarkMode, index: number, mountMs: number, generatedGeometryBytes: number | null): LegMetrics {
    const median = (key: keyof FrameMetrics) => percentile(this.samples.map(sample => sample[key]), .5);
    return {
      mode, index, ...summarizeFrameTimes(this.samples.map(sample => sample.frameMs)),
      medianDrawCalls: median('drawCalls'), triangles: median('triangles'),
      textureCount: median('textureCount'), shaderProgramCount: median('shaderProgramCount'),
      mountMs, generatedGeometryBytes,
    };
  }
}

/** Per-metric median across retained legs; raw leg results remain in the report. */
export function aggregateMetrics(legs: readonly LegMetrics[]): Record<BenchmarkMode, LegMetrics | null> {
  const aggregate = (mode: BenchmarkMode): LegMetrics | null => {
    const entries = legs.filter(leg => leg.mode === mode);
    if (!entries.length) return null;
    const median = (key: keyof LegMetrics) => percentile(entries.map(leg => leg[key]).filter(nonnegative), .5);
    return {
      ...entries[0], sampleCount: Math.round(median('sampleCount') ?? 0),
      p50FrameMs: median('p50FrameMs'), p95FrameMs: median('p95FrameMs'), meanFrameMs: median('meanFrameMs'),
      medianDrawCalls: median('medianDrawCalls'), triangles: median('triangles'), textureCount: median('textureCount'),
      shaderProgramCount: median('shaderProgramCount'), mountMs: median('mountMs') ?? 0,
      generatedGeometryBytes: median('generatedGeometryBytes'),
    };
  };
  return { baseline: aggregate('baseline'), voxel: aggregate('voxel') };
}

function validLeg(leg: unknown, index: number): leg is LegMetrics {
  return record(leg) && leg.mode === LEG_ORDER[index] && leg.index === index &&
    Number.isInteger(leg.sampleCount) && (leg.sampleCount as number) > 0 &&
    measuredFields.every(key => nonnegative(leg[key])) && nonnegative(leg.mountMs) &&
    (leg.p50FrameMs as number) <= (leg.p95FrameMs as number);
}

export function evaluateThresholds(legs: readonly LegMetrics[], diagnostic = false): BenchmarkReport['conclusion'] {
  const inconclusive = (reason: string): BenchmarkReport['conclusion'] => ({
    status: 'inconclusive', drawCallReductionPct: null, p95ImprovementPct: null,
    secondaryRegressionPct: null, reasons: [reason],
  });
  if (diagnostic || !Array.isArray(legs) || legs.length !== 6 || !legs.every(validLeg)) {
    return inconclusive('Diagnostic, incomplete, or incorrectly ordered evidence is inconclusive.');
  }
  const { baseline, voxel } = aggregateMetrics(legs);
  const bDraw = baseline!.medianDrawCalls!;
  const b95 = baseline!.p95FrameMs!;
  if (bDraw === 0 || b95 === 0) return inconclusive('Zero Baseline denominators are inconclusive.');
  const draw = (1 - voxel!.medianDrawCalls! / bDraw) * 100;
  const p95 = (1 - voxel!.p95FrameMs! / b95) * 100;
  if (!Number.isFinite(draw) || !Number.isFinite(p95)) return inconclusive('Metric ratios exceed the finite numeric range.');
  const reasons: string[] = [];
  if (draw < 50) reasons.push('Median draw-call reduction is below 50%.');
  if (p95 < 20) reasons.push('p95 frame-time improvement is below 20%.');
  return {
    status: reasons.length ? 'revise' : 'inconclusive', drawCallReductionPct: draw,
    p95ImprovementPct: p95, secondaryRegressionPct: null,
    reasons: reasons.length ? reasons : ['Primary thresholds pass; secondary profile and Visual Acceptance evidence are missing.'],
  };
}

/** Validate downloaded/untrusted JSON without throwing or allowing a forged conclusion. */
export function validateBenchmarkReport(value: unknown): value is BenchmarkReport {
  if (!record(value) || value.schema !== BENCHMARK_SCHEMA || typeof value.diagnostic !== 'boolean' ||
    !Number.isInteger(value.seed) || !nonnegative(value.seed)) return false;
  const durations = value.durations;
  const expectedDuration = value.diagnostic ? DIAGNOSTIC_DURATIONS : STANDARD_DURATIONS;
  if (!record(durations) || durations.warmupMs !== expectedDuration.warmupMs || durations.sampleMs !== expectedDuration.sampleMs ||
    !Array.isArray(value.legs) || value.legs.length !== 6 || !value.legs.every(validLeg)) return false;
  const profile = value.referenceProfile;
  const profileFields = ['profileName', 'userAgent', 'platform', 'hardware', 'renderer', 'timestamp', 'sourceCommit', 'hardwarePowerContext'];
  if (!record(profile) || !profileFields.every(key => nonempty(profile[key])) ||
    !Number.isFinite(Date.parse(profile.timestamp as string)) || typeof profile.dirtyBuild !== 'boolean' ||
    !record(profile.viewport) || profile.viewport.width !== 1600 || profile.viewport.height !== 900 || profile.dpr !== 1) return false;
  const gpu = value.gpuTimer;
  if (!record(gpu) || !['unsupported', 'not-measured'].includes(gpu.status as string) || gpu.values !== null) return false;
  const conclusion = value.conclusion;
  const expected = evaluateThresholds(value.legs as LegMetrics[], value.diagnostic);
  return record(conclusion) && conclusion.status === expected.status &&
    conclusion.drawCallReductionPct === expected.drawCallReductionPct &&
    conclusion.p95ImprovementPct === expected.p95ImprovementPct && conclusion.secondaryRegressionPct === null &&
    Array.isArray(conclusion.reasons) && conclusion.reasons.length === expected.reasons.length &&
    conclusion.reasons.every((reason, index) => reason === expected.reasons[index]);
}

export function downloadReport(report: BenchmarkReport, filename = 'sakura-crossing-benchmark.json'): void {
  if (!validateBenchmarkReport(report)) throw new Error('Cannot download invalid benchmark evidence');
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
