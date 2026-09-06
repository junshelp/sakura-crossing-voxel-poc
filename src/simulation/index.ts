import { PLANET_CIRCUMFERENCE } from '../world/planet';

/** Length of the closed equatorial railway in authored metres. */
export const TRAIN_LOOP_LENGTH = PLANET_CIRCUMFERENCE;
/** Constant deterministic train speed in authored metres per second. */
export const TRAIN_SPEED = 12;
/** Initial signed offset used when a session is first created. */
export const TRAIN_INITIAL_OFFSET = -120;
/** Relay target: the first point in the approach window. */
export const TRAIN_APPROACH_OFFSET = -48;
export const TRAIN_APPROACH_START = -48;
export const TRAIN_CLOSING_START = -20;
export const TRAIN_PASSING_START = -8;
export const TRAIN_CLEARING_START = 12;
export const TRAIN_OPEN_START = 32;

export type CrossingPhase = 'open' | 'approach' | 'closing' | 'passing' | 'clearing';

export interface CrossingSnapshot {
  readonly trainOffset: number;
  /** Wrapped progression along the loop, in [0, TRAIN_LOOP_LENGTH). */
  readonly trainProgression: number;
  readonly speed: number;
  readonly crossingPhase: CrossingPhase;
  /** Derived barrier closure fraction: 0 open, 1 fully closed. */
  readonly barrierClosure: number;
  readonly barrierClosed: boolean;
  readonly warningActive: boolean;
  readonly dispensedDrink: boolean;
}

export interface ActivationResult {
  readonly activated: boolean;
  readonly interactionId: string | null;
  readonly entityId: string | null;
  readonly label: string | null;
  readonly reason: 'activated' | 'out-of-range' | 'unknown-interaction' | 'invalid-target';
}

/** Normalize any finite railway offset to the signed interval [-L/2, L/2). */
export function normalizeTrainOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  let wrapped = offset % TRAIN_LOOP_LENGTH;
  if (wrapped >= TRAIN_LOOP_LENGTH / 2) wrapped -= TRAIN_LOOP_LENGTH;
  if (wrapped < -TRAIN_LOOP_LENGTH / 2) wrapped += TRAIN_LOOP_LENGTH;
  return Math.abs(wrapped) < 1e-10 ? 0 : wrapped;
}

export function crossingPhaseForOffset(offset: number): CrossingPhase {
  const value = normalizeTrainOffset(offset);
  const epsilon = 1e-9;
  if (value >= TRAIN_APPROACH_START - epsilon && value < TRAIN_CLOSING_START - epsilon) return 'approach';
  if (value >= TRAIN_CLOSING_START - epsilon && value < TRAIN_PASSING_START - epsilon) return 'closing';
  if (value >= TRAIN_PASSING_START - epsilon && value < TRAIN_CLEARING_START - epsilon) return 'passing';
  if (value >= TRAIN_CLEARING_START - epsilon && value < TRAIN_OPEN_START - epsilon) return 'clearing';
  return 'open';
}

function snapshotFor(offset: number, progression: number, dispensedDrink: boolean): CrossingSnapshot {
  const trainOffset = normalizeTrainOffset(offset);
  const crossingPhase = crossingPhaseForOffset(trainOffset);
  const rawClosure = crossingPhase === 'closing'
    ? (trainOffset - TRAIN_CLOSING_START) / (TRAIN_PASSING_START - TRAIN_CLOSING_START)
    : crossingPhase === 'passing' ? 1
      : crossingPhase === 'clearing' ? 1 - (trainOffset - TRAIN_CLEARING_START) / (TRAIN_OPEN_START - TRAIN_CLEARING_START)
        : 0;
  const barrierClosure = Math.max(0, Math.min(1, rawClosure));
  return Object.freeze({
    trainOffset,
    trainProgression: ((progression % TRAIN_LOOP_LENGTH) + TRAIN_LOOP_LENGTH) % TRAIN_LOOP_LENGTH,
    speed: TRAIN_SPEED,
    crossingPhase,
    barrierClosure,
    barrierClosed: barrierClosure === 1,
    warningActive: crossingPhase !== 'open',
    dispensedDrink,
  });
}

/** One shared deterministic crossing state machine for both renderer modes. */
export class CrossingSimulation {
  private current: CrossingSnapshot;

  constructor(initialOffset = TRAIN_INITIAL_OFFSET) {
    const offset = normalizeTrainOffset(initialOffset);
    this.current = snapshotFor(offset, offset - (-TRAIN_LOOP_LENGTH / 2), false);
  }

  get snapshot(): CrossingSnapshot { return this.current; }

  /** Restore a previously captured deterministic state for benchmark replay. */
  restore(snapshot: CrossingSnapshot): CrossingSnapshot {
    assertFiniteCrossingSnapshot(snapshot);
    this.current = snapshotFor(snapshot.trainOffset, snapshot.trainProgression, snapshot.dispensedDrink);
    return this.current;
  }

  /** Advance by finite non-negative seconds. Invalid time is a safe no-op. */
  step(dt: number): CrossingSnapshot {
    if (!Number.isFinite(dt) || dt < 0) return this.current;
    if (dt === 0) return this.current;
    const rawDistance = TRAIN_SPEED * dt;
    // Reduce very large finite deltas before multiplication can overflow.
    const distance = Number.isFinite(rawDistance) ? rawDistance : (dt % (TRAIN_LOOP_LENGTH / TRAIN_SPEED)) * TRAIN_SPEED;
    const nextProgression = this.current.trainProgression + distance;
    this.current = snapshotFor(this.current.trainOffset + distance, nextProgression, this.current.dispensedDrink);
    return this.current;
  }

  /** Activate an approved scene-owned interaction by its stable id. */
  activate(interactionId: string): ActivationResult {
    if (interactionId === 'call-train') {
      this.current = snapshotFor(TRAIN_APPROACH_OFFSET, TRAIN_APPROACH_OFFSET + TRAIN_LOOP_LENGTH / 2, this.current.dispensedDrink);
      return { activated: true, interactionId, entityId: null, label: null, reason: 'activated' };
    }
    if (interactionId === 'dispense-drink') {
      if (!this.current.dispensedDrink) this.current = snapshotFor(this.current.trainOffset, this.current.trainProgression, true);
      return { activated: true, interactionId, entityId: null, label: null, reason: 'activated' };
    }
    return { activated: false, interactionId: interactionId || null, entityId: null, label: null, reason: 'unknown-interaction' };
  }
}

export function createCrossingSimulation(initialOffset = TRAIN_INITIAL_OFFSET): CrossingSimulation {
  return new CrossingSimulation(initialOffset);
}

/** Public invariant helper used by tests and interaction code. */
export function assertFiniteCrossingSnapshot(snapshot: CrossingSnapshot): void {
  if (!Number.isFinite(snapshot.trainOffset) || !Number.isFinite(snapshot.trainProgression) || !Number.isFinite(snapshot.speed)) throw new Error('Crossing simulation state must remain finite');
}
