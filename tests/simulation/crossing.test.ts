import { describe, expect, it } from 'vitest';
import {
  CrossingSimulation,
  TRAIN_APPROACH_OFFSET,
  TRAIN_CLEARING_START,
  TRAIN_CLOSING_START,
  TRAIN_INITIAL_OFFSET,
  TRAIN_LOOP_LENGTH,
  TRAIN_OPEN_START,
  TRAIN_PASSING_START,
  TRAIN_SPEED,
  crossingPhaseForOffset,
} from '../../src/simulation';

describe('deterministic crossing simulation', () => {
  it('uses exact public boundaries and visits every relay sequence phase', () => {
    expect(crossingPhaseForOffset(TRAIN_CLOSING_START)).toBe('closing');
    expect(crossingPhaseForOffset(TRAIN_PASSING_START)).toBe('passing');
    expect(crossingPhaseForOffset(TRAIN_CLEARING_START)).toBe('clearing');
    expect(crossingPhaseForOffset(TRAIN_OPEN_START)).toBe('open');
    const simulation = new CrossingSimulation();
    expect(simulation.snapshot.trainOffset).toBe(TRAIN_INITIAL_OFFSET);
    simulation.activate('call-train');
    expect(simulation.snapshot.trainOffset).toBe(TRAIN_APPROACH_OFFSET);
    const phases = [simulation.snapshot.crossingPhase];
    for (const boundary of [TRAIN_CLOSING_START, TRAIN_PASSING_START, TRAIN_CLEARING_START, TRAIN_OPEN_START]) {
      simulation.step((boundary - simulation.snapshot.trainOffset) / TRAIN_SPEED);
      phases.push(simulation.snapshot.crossingPhase);
    }
    expect(phases).toEqual(['approach', 'closing', 'passing', 'clearing', 'open']);
  });

  it('wraps large finite time and ignores invalid or negative time', () => {
    const simulation = new CrossingSimulation(TRAIN_INITIAL_OFFSET);
    const before = simulation.snapshot;
    simulation.step(-1); expect(simulation.snapshot).toBe(before);
    simulation.step(Number.NaN); expect(simulation.snapshot).toBe(before);
    simulation.step(Number.POSITIVE_INFINITY); expect(simulation.snapshot).toBe(before);
    simulation.step(Number.MAX_VALUE);
    expect(simulation.snapshot.trainOffset).toBeGreaterThanOrEqual(-TRAIN_LOOP_LENGTH / 2);
    expect(simulation.snapshot.trainOffset).toBeLessThan(TRAIN_LOOP_LENGTH / 2);
    expect(Number.isFinite(simulation.snapshot.trainOffset)).toBe(true);
  });

  it('derives fractional closure and persists an idempotent drink activation', () => {
    const simulation = new CrossingSimulation(); simulation.activate('call-train');
    simulation.step((TRAIN_CLOSING_START - TRAIN_APPROACH_OFFSET) / TRAIN_SPEED + 0.5 / TRAIN_SPEED);
    expect(simulation.snapshot.crossingPhase).toBe('closing');
    expect(simulation.snapshot.barrierClosure).toBeGreaterThan(0);
    expect(simulation.snapshot.barrierClosure).toBeLessThan(1);
    expect(simulation.activate('dispense-drink').activated).toBe(true);
    const first = simulation.snapshot; simulation.activate('dispense-drink');
    expect(simulation.snapshot.dispensedDrink).toBe(true);
    expect(simulation.snapshot.trainOffset).toBe(first.trainOffset);
    expect(simulation.activate('not-approved').reason).toBe('unknown-interaction');
  });

  it('clamps closure around epsilon-expanded phase boundaries', () => {
    const beforeClosing = new CrossingSimulation(TRAIN_CLOSING_START - 5e-10).snapshot;
    const beforeClearing = new CrossingSimulation(TRAIN_CLEARING_START - 5e-10).snapshot;
    expect(beforeClosing.barrierClosure).toBeGreaterThanOrEqual(0);
    expect(beforeClosing.barrierClosure).toBeLessThanOrEqual(1);
    expect(beforeClearing.barrierClosure).toBeGreaterThanOrEqual(0);
    expect(beforeClearing.barrierClosure).toBeLessThanOrEqual(1);
  });
});
