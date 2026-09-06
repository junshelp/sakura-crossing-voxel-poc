import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SCHEMA, DIAGNOSTIC_DURATIONS, STANDARD_DURATIONS, LEG_ORDER,
  FrameSampler, aggregateMetrics, cameraMarkerAt, evaluateThresholds, percentile,
  validateBenchmarkReport, type BenchmarkReport, type LegMetrics,
} from '../../src/benchmark';

function legs(voxelDraw = 40, voxelP95 = 7): LegMetrics[] {
  return LEG_ORDER.map((mode, index) => ({
    mode, index, sampleCount: 100,
    p50FrameMs: mode === 'baseline' ? 10 : voxelP95,
    p95FrameMs: mode === 'baseline' ? 10 : voxelP95,
    meanFrameMs: mode === 'baseline' ? 10 : voxelP95,
    medianDrawCalls: mode === 'baseline' ? 100 : voxelDraw,
    triangles: 20, textureCount: 1, shaderProgramCount: 2, mountMs: 3, generatedGeometryBytes: 128,
  }));
}
function report(diagnostic = false, voxelDraw = 40, voxelP95 = 7): BenchmarkReport {
  const measured = legs(voxelDraw, voxelP95);
  return {
    schema: BENCHMARK_SCHEMA, diagnostic, seed: 20260904,
    durations: diagnostic ? DIAGNOSTIC_DURATIONS : STANDARD_DURATIONS,
    legs: measured,
    referenceProfile: {
      profileName: 'test', userAgent: 'test-browser', platform: 'test-platform',
      hardware: 'unknown', renderer: 'unknown', hardwarePowerContext: 'unknown',
      viewport: { width: 1600, height: 900 }, dpr: 1, timestamp: '2026-09-05T00:00:00.000Z',
      sourceCommit: 'unknown', dirtyBuild: true,
    },
    gpuTimer: { status: 'not-measured', values: null },
    conclusion: evaluateThresholds(measured, diagnostic),
  };
}
const metrics = (frameMs: number, drawCalls = 100) => ({ frameMs, drawCalls, triangles: 50, textureCount: 1, shaderProgramCount: 2 });

describe('root adversarial benchmark verification', () => {
  it('uses independently calculated interpolated percentiles and preserves source samples', () => {
    const values = [40, 10, 30, 20];
    expect(percentile(values, .95)).toBeCloseTo(38.5);
    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 1)).toBe(40);
    expect(percentile([16], .95)).toBe(16);
    expect(values).toEqual([40, 10, 30, 20]);
    for (const p of [-1, 1.1, NaN, Infinity]) expect(percentile(values, p)).toBeNull();
  });

  it('rejects contaminated, duplicate, overlapping, reversed and mismatched frame intervals', () => {
    const sampler = new FrameSampler(100, DIAGNOSTIC_DURATIONS); // sample [300,900]
    expect(sampler.add(290, 310, metrics(20))).toBe(false);
    expect(sampler.add(300, 316, metrics(1))).toBe(false);
    expect(sampler.add(300, 316, metrics(16))).toBe(true);
    expect(sampler.add(300, 316, metrics(16))).toBe(false);
    expect(sampler.add(310, 326, metrics(16))).toBe(false);
    expect(sampler.add(316, 340, metrics(24, 50))).toBe(true);
    expect(sampler.add(340, 330, metrics(10))).toBe(false);
    expect(sampler.add(340, 350, { ...metrics(10), drawCalls: NaN })).toBe(false);
    expect(sampler.add(880, 900, metrics(20, 30))).toBe(true);
    expect(sampler.add(900, 901, metrics(1))).toBe(false);
    const result = sampler.summarize('baseline', 0, 4, 128);
    expect(result).toMatchObject({ sampleCount: 3, p50FrameMs: 20, meanFrameMs: 20, medianDrawCalls: 50, mountMs: 4, generatedGeometryBytes: 128 });
    expect(result.p95FrameMs).toBeCloseTo(23.6);
  });

  it('rejects invalid timing and snapshots durations against external mutation', () => {
    for (const start of [-1, NaN, Infinity]) expect(() => new FrameSampler(start, STANDARD_DURATIONS)).toThrow();
    for (const durations of [{ warmupMs: 0, sampleMs: 10 }, { warmupMs: 10, sampleMs: -1 }, { warmupMs: 10, sampleMs: Infinity }]) {
      expect(() => new FrameSampler(0, durations)).toThrow();
    }
    const durations: { warmupMs: number; sampleMs: number } = { ...DIAGNOSTIC_DURATIONS };
    const sampler = new FrameSampler(0, durations);
    durations.warmupMs = 1000;
    expect(sampler.add(200, 216, metrics(16))).toBe(true);
    expect(new FrameSampler(0, STANDARD_DURATIONS).summarize('baseline', 0, 0, 0)).toMatchObject({ sampleCount: 0, p95FrameMs: null });
  });

  it('uses equal thirds after warmup in standard and diagnostic schedules', () => {
    for (const durations of [STANDARD_DURATIONS, DIAGNOSTIC_DURATIONS]) {
      const first = durations.warmupMs + durations.sampleMs / 3;
      const second = durations.warmupMs + durations.sampleMs * 2 / 3;
      expect(cameraMarkerAt(durations.warmupMs - 1, durations)).toBe('overview');
      expect(cameraMarkerAt(first - .001, durations)).toBe('overview');
      expect(cameraMarkerAt(first, durations)).toBe('crossing');
      expect(cameraMarkerAt(second - .001, durations)).toBe('crossing');
      expect(cameraMarkerAt(second, durations)).toBe('railway');
    }
  });

  it('reports failures and negative regressions while withholding incomplete product approval', () => {
    expect(evaluateThresholds(legs(40, 7))).toMatchObject({ status: 'inconclusive', drawCallReductionPct: 60 });
    expect(evaluateThresholds(legs(60, 9)).status).toBe('revise');
    const regression = report(false, 120, 12);
    expect(regression.conclusion.status).toBe('revise');
    expect(regression.conclusion.p95ImprovementPct).toBeCloseTo(-20);
    expect(validateBenchmarkReport(regression)).toBe(true);
    expect(validateBenchmarkReport(report(true))).toBe(true);
    const zeroBaseline = legs().map(leg => leg.mode === 'baseline' ? { ...leg, medianDrawCalls: 0 } : leg);
    expect(evaluateThresholds(zeroBaseline).status).toBe('inconclusive');
    expect(evaluateThresholds(legs().map(leg => ({ ...leg, index: 0 }))).status).toBe('inconclusive');
    expect(evaluateThresholds(legs().map(leg => ({ ...leg, mode: 'baseline' }))).status).toBe('inconclusive');
    expect(aggregateMetrics(legs()).voxel?.medianDrawCalls).toBe(40);
  });

  it('returns false without throwing for malformed JSON shapes', () => {
    const good = report();
    for (const malformed of [null, undefined, [], true, '', 0, {},
      { ...good, legs: [null, ...good.legs.slice(1)] },
      { ...good, referenceProfile: {} },
      { ...good, referenceProfile: { viewport: { width: 1600, height: 900 }, dpr: 1 } },
      { ...good, conclusion: { reasons: null } },
    ]) {
      expect(() => validateBenchmarkReport(malformed)).not.toThrow();
      expect(validateBenchmarkReport(malformed)).toBe(false);
    }
  });

  it('requires every profile and GPU field and rejects invalid timestamps or render dimensions', () => {
    for (const key of Object.keys(report().referenceProfile)) {
      const value = report() as unknown as { referenceProfile: Record<string, unknown> };
      delete value.referenceProfile[key];
      expect(validateBenchmarkReport(value), key).toBe(false);
    }
    const good = report();
    for (const patch of [{ timestamp: 'not-a-date' }, { userAgent: '' }, { dirtyBuild: 'yes' }, { dpr: 2 }, { viewport: { width: 800, height: 600 } }]) {
      expect(validateBenchmarkReport({ ...good, referenceProfile: { ...good.referenceProfile, ...patch } })).toBe(false);
    }
    for (const gpu of [undefined, null, {}, { status: 'supported', values: null }, { status: 'not-measured', values: 0 }]) {
      expect(validateBenchmarkReport({ ...good, gpuTimer: gpu })).toBe(false);
    }
  });

  it('rejects missing metrics and forged durations, modes or conclusions', () => {
    const good = report();
    for (const key of ['p50FrameMs', 'p95FrameMs', 'meanFrameMs', 'medianDrawCalls', 'triangles', 'textureCount', 'shaderProgramCount', 'generatedGeometryBytes', 'mountMs']) {
      for (const value of [null, undefined, -1, NaN, Infinity]) {
        const badLeg = { ...good.legs[0], [key]: value };
        expect(validateBenchmarkReport({ ...good, legs: [badLeg, ...good.legs.slice(1)] }), `${key}/${value}`).toBe(false);
      }
    }
    expect(validateBenchmarkReport({ ...good, durations: DIAGNOSTIC_DURATIONS })).toBe(false);
    expect(validateBenchmarkReport({ ...good, legs: good.legs.slice(1) })).toBe(false);
    expect(validateBenchmarkReport({ ...good, seed: 1.5 })).toBe(false);
    for (const diagnostic of [true, false]) {
      const value = report(diagnostic);
      expect(validateBenchmarkReport({ ...value, conclusion: { ...value.conclusion, status: 'continue' } })).toBe(false);
      expect(validateBenchmarkReport({ ...value, conclusion: { ...value.conclusion, p95ImprovementPct: 99 } })).toBe(false);
    }
  });
});
