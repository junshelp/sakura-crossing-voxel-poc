import type { Camera } from 'three';
import * as THREE from 'three';
import type { BenchmarkCameraMarker, SharedSceneSpecification } from '../scene-spec';
import { projectFlatPoint, surfaceBasis } from '../world';

export const PLAYER_RADIUS = 0.65;
export const DEFAULT_EYE_HEIGHT = 1.7;
export const MAX_PITCH = Math.PI * 0.49;
export const WALK_SPEED = 5;

export interface PlayerState {
  x: number;
  z: number;
  eyeHeight: number;
  yaw: number;
  pitch: number;
}

export interface MovementInput {
  forward: number;
  strafe: number;
}

export function createPlayerState(x = 0, z = 18, eyeHeight = DEFAULT_EYE_HEIGHT): PlayerState {
  return { x, z, eyeHeight, yaw: 0, pitch: 0 };
}

export function clampPitch(pitch: number): number {
  return THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
}

export function applyLook(state: PlayerState, yawDelta: number, pitchDelta: number): void {
  state.yaw += yawDelta;
  state.pitch = clampPitch(state.pitch + pitchDelta);
}

function collidesAt(x: number, z: number, spec: SharedSceneSpecification, radius: number): boolean {
  for (const entity of spec.entities) {
    const collider = entity.collider;
    if (!collider || entity.kind === 'ground') continue;
    const [cx, , cz] = collider.center;
    const [sx, , sz] = collider.size;
    if (x >= cx - sx / 2 - radius && x <= cx + sx / 2 + radius && z >= cz - sz / 2 - radius && z <= cz + sz / 2 + radius) return true;
  }
  return false;
}

function withinFootprint(x: number, z: number, spec: SharedSceneSpecification, radius: number): boolean {
  return x >= spec.flatBounds.minX + radius && x <= spec.flatBounds.maxX - radius && z >= spec.flatBounds.minZ + radius && z <= spec.flatBounds.maxZ - radius;
}

/** Resolve a movement request in authored flat x/z space, allowing axis sliding. */
export function movePlayer(state: PlayerState, input: MovementInput, dt: number, spec: SharedSceneSpecification, speed = WALK_SPEED, radius = PLAYER_RADIUS): PlayerState {
  const forward = THREE.MathUtils.clamp(input.forward, -1, 1);
  const strafe = THREE.MathUtils.clamp(input.strafe, -1, 1);
  const length = Math.hypot(forward, strafe);
  const normalizedForward = length > 1 ? forward / length : forward;
  const normalizedStrafe = length > 1 ? strafe / length : strafe;
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);
  let x = state.x;
  let z = state.z;
  const safeDt = Math.max(0, dt);
  const steps = Math.max(1, Math.ceil(safeDt / 0.08));
  const stepDt = safeDt / steps;
  for (let step = 0; step < steps; step += 1) {
    const dx = (sinYaw * normalizedForward + cosYaw * normalizedStrafe) * speed * stepDt;
    const dz = (-cosYaw * normalizedForward + sinYaw * normalizedStrafe) * speed * stepDt;
    const candidateX = THREE.MathUtils.clamp(x + dx, spec.flatBounds.minX + radius, spec.flatBounds.maxX - radius);
    if (withinFootprint(candidateX, z, spec, radius) && !collidesAt(candidateX, z, spec, radius)) x = candidateX;
    const candidateZ = THREE.MathUtils.clamp(z + dz, spec.flatBounds.minZ + radius, spec.flatBounds.maxZ - radius);
    if (withinFootprint(x, candidateZ, spec, radius) && !collidesAt(x, candidateZ, spec, radius)) z = candidateZ;
  }
  return { ...state, x, z };
}

/** Apply authored player state to a perspective camera on the spherical surface. */
export function updateCameraFromPlayer(camera: Camera, state: PlayerState): void {
  const basis = surfaceBasis(state.x, state.z);
  const position = projectFlatPoint({ x: state.x, y: state.eyeHeight, z: state.z });
  const forward = basis.east.clone().multiplyScalar(Math.sin(state.yaw) * Math.cos(state.pitch))
    .addScaledVector(basis.north, -Math.cos(state.yaw) * Math.cos(state.pitch))
    .addScaledVector(basis.up, Math.sin(state.pitch));
  camera.position.copy(position);
  camera.up.copy(basis.up);
  camera.lookAt(position.clone().add(forward));
}

/** Convert a fixed authored camera marker into the same renderer-independent player state. */
export function playerStateFromMarker(marker: BenchmarkCameraMarker): PlayerState {
  // Fixed markers intentionally author their own eye height; walking preserves it
  // until another marker is selected, keeping marker screenshots deterministic.
  const state = createPlayerState(marker.position[0], marker.position[2], marker.position[1]);
  const eye = projectFlatPoint({ x: marker.position[0], y: marker.position[1], z: marker.position[2] });
  const target = projectFlatPoint({ x: marker.lookAt[0], y: marker.lookAt[1], z: marker.lookAt[2] });
  const direction = target.sub(eye).normalize();
  const basis = surfaceBasis(state.x, state.z);
  state.yaw = Math.atan2(direction.dot(basis.east), -direction.dot(basis.north));
  state.pitch = clampPitch(Math.asin(THREE.MathUtils.clamp(direction.dot(basis.up), -1, 1)));
  return state;
}
