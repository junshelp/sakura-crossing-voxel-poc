import { describe, expect, it } from 'vitest';
import { SAMPLE_SCENE } from '../../src/scene-spec';
import { applyLook, createPlayerState, DEFAULT_EYE_HEIGHT, MAX_PITCH, movePlayer, PLAYER_RADIUS, playerStateFromMarker } from '../../src/gameplay';

describe('renderer-independent player movement', () => {
  it('moves forward and strafes from authored x/z state', () => {
    const state = createPlayerState(0, 20); const forward = movePlayer(state, { forward: 1, strafe: 0 }, 1, SAMPLE_SCENE, 2);
    expect(forward.z).toBeLessThan(state.z);
    const strafe = movePlayer(state, { forward: 0, strafe: 1 }, 1, SAMPLE_SCENE, 2);
    expect(strafe.x).toBeGreaterThan(state.x);
  });

  it('clamps pitch and keeps the player inside the spec footprint', () => {
    const state = createPlayerState(0, 0); applyLook(state, 0, 10); expect(state.pitch).toBe(MAX_PITCH);
    applyLook(state, 0, -20); expect(state.pitch).toBe(-MAX_PITCH);
    const moved = movePlayer(createPlayerState(29, 29), { forward: 1, strafe: 1 }, 5, SAMPLE_SCENE, 20);
    expect(moved.x).toBeLessThanOrEqual(SAMPLE_SCENE.flatBounds.maxX - PLAYER_RADIUS);
    expect(moved.z).toBeGreaterThanOrEqual(SAMPLE_SCENE.flatBounds.minZ + PLAYER_RADIUS);
  });

  it('rejects a building/pole crossing while allowing diagonal sliding', () => {
    const buildingStart = createPlayerState(-24, 15); const building = movePlayer({ ...buildingStart, yaw: Math.PI / 2 }, { forward: 1, strafe: 0 }, 2, SAMPLE_SCENE, 5);
    expect(building.x).toBeLessThan(-21.5); expect(building.z).toBe(15);
    const poleStart = { ...createPlayerState(-27, -3), yaw: Math.PI / 2 }; const slide = movePlayer(poleStart, { forward: 1, strafe: 1 }, 1, SAMPLE_SCENE, 5);
    expect(slide.x).toBeGreaterThan(poleStart.x); expect(slide.z).toBeGreaterThan(poleStart.z);
  });

  it('treats the ground support collider as non-blocking and derives marker state', () => {
    const groundWalk = movePlayer(createPlayerState(27, 24), { forward: 1, strafe: 0 }, 1, SAMPLE_SCENE, 3);
    expect(groundWalk.z).toBeLessThan(24);
    const marker = playerStateFromMarker(SAMPLE_SCENE.benchmarkCameraMarkers.crossing);
    expect(marker.x).toBe(10); expect(marker.z).toBe(16); expect(Number.isFinite(marker.yaw)).toBe(true); expect(Number.isFinite(marker.pitch)).toBe(true);
  });

  it('allows normal-height first movement from every fixed marker and traverses the offset footway', () => {
    for (const marker of Object.values(SAMPLE_SCENE.benchmarkCameraMarkers)) {
      const state = { ...playerStateFromMarker(marker), eyeHeight: DEFAULT_EYE_HEIGHT };
      const moved = movePlayer(state, { forward: 1, strafe: 0 }, 0.12, SAMPLE_SCENE);
      expect(Math.hypot(moved.x - state.x, moved.z - state.z), marker.position.toString()).toBeGreaterThan(0.01);
    }
    let walker = { ...createPlayerState(4.5, 22), yaw: 0 };
    for (let i = 0; i < 70; i += 1) walker = movePlayer(walker, { forward: 1, strafe: 0 }, 0.1, SAMPLE_SCENE);
    expect(walker.z).toBeLessThan(-10);
    expect(walker.x).toBeCloseTo(4.5, 1);
  });
});
