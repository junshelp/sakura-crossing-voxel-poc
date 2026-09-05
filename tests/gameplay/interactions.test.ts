import { describe, expect, it } from 'vitest';
import { SAMPLE_SCENE } from '../../src/scene-spec';
import { activateCurrentInteraction, dispatchInteraction, resolveInteraction } from '../../src/gameplay';
import { CrossingSimulation } from '../../src/simulation';

describe('scene-owned interactions', () => {
  it('resolves nearest target and preserves scene labels/ranges', () => {
    const target = resolveInteraction(SAMPLE_SCENE, { x: -10, z: -7.5 });
    expect(target?.entityId).toBe('vending-machine-main');
    expect(target?.interactionId).toBe('dispense-drink');
    expect(target?.label).toBe('Dispense drink');
    expect(target?.range).toBe(2);
  });

  it('returns an explicit out-of-range no-op and dispatches relay through the same resolver', () => {
    const simulation = new CrossingSimulation();
    const noOp = dispatchInteraction(simulation, resolveInteraction(SAMPLE_SCENE, { x: 0, z: 18 }));
    expect(noOp).toMatchObject({ activated: false, reason: 'out-of-range', interactionId: null });
    const activated = activateCurrentInteraction(simulation, SAMPLE_SCENE, { x: 10, z: -2 });
    expect(activated).toMatchObject({ activated: true, interactionId: 'call-train', entityId: 'relay-box-main', label: 'Call train' });
    expect(simulation.snapshot.crossingPhase).toBe('approach');
  });
});
