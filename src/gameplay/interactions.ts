import type { Interaction, SceneEntity, SharedSceneSpecification } from '../scene-spec';
import type { PlayerState } from './player';
import type { ActivationResult, CrossingSimulation } from '../simulation';

export interface ResolvedInteraction {
  readonly entityId: string;
  readonly interactionId: string;
  readonly id: string;
  readonly label: string;
  readonly range: number;
  readonly distance: number;
  readonly entity: SceneEntity;
  readonly interaction: Interaction;
}

export interface NoInteractionResult {
  readonly activated: false;
  readonly interactionId: null;
  readonly entityId: null;
  readonly label: null;
  readonly reason: 'out-of-range';
}

/** Resolve the nearest scene-owned interaction using authored player x/z. */
export function resolveInteraction(spec: SharedSceneSpecification, player: Pick<PlayerState, 'x' | 'z'>): ResolvedInteraction | null {
  let nearest: ResolvedInteraction | null = null;
  for (const entity of spec.entities) {
    if (entity.interactions.length === 0) continue;
    const dx = player.x - entity.transform.position[0];
    const dz = player.z - entity.transform.position[2];
    const distance = Math.hypot(dx, dz);
    for (const interaction of entity.interactions) {
      if (distance > interaction.range) continue;
      const candidate: ResolvedInteraction = { entityId: entity.id, interactionId: interaction.id, id: interaction.id, label: interaction.label, range: interaction.range, distance, entity, interaction };
      if (!nearest || distance < nearest.distance || (distance === nearest.distance && candidate.interactionId < nearest.interactionId)) nearest = candidate;
    }
  }
  return nearest;
}

export const findNearestInteraction = resolveInteraction;
export const getCurrentInteraction = resolveInteraction;

export function noInteractionResult(): NoInteractionResult {
  return { activated: false, interactionId: null, entityId: null, label: null, reason: 'out-of-range' };
}

/** Dispatch only a resolver result, making out-of-range activation explicit. */
export function dispatchInteraction(simulation: CrossingSimulation, target: ResolvedInteraction | null | undefined): ActivationResult | NoInteractionResult {
  if (!target) return noInteractionResult();
  const result = simulation.activate(target.interactionId);
  return { ...result, entityId: target.entityId, label: target.label };
}

/** Resolve and dispatch in one public operation for keyboard and browser paths. */
export function activateCurrentInteraction(simulation: CrossingSimulation, spec: SharedSceneSpecification, player: Pick<PlayerState, 'x' | 'z'>): ActivationResult | NoInteractionResult {
  return dispatchInteraction(simulation, resolveInteraction(spec, player));
}
