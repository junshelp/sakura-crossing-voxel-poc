import { describe, expect, it, vi } from 'vitest';
import { createContinuousInfrastructure } from '../../src/world/infrastructure';

describe('shared Continuous Infrastructure', () => {
  it('exposes one inspectable planet, road/footway set, and closed two-rail loop', () => {
    const infrastructure = createContinuousInfrastructure();
    const names = infrastructure.root.children.map((child) => child.name);
    expect(names).toEqual(expect.arrayContaining(['planet-surface', 'road-tracer', 'footway-tracer', 'equatorial-rail-east', 'equatorial-rail-west', 'utility-wire-main', 'utility-wire-secondary']));
    expect(infrastructure.root.name).toBe('continuous-infrastructure');
    expect(infrastructure.root.getObjectByName('equatorial-rail-east')?.userData.railLoop).toEqual({ closed: true, railCount: 2, radius: 160, gauge: 1.5, laneOffsetAxis: 'north-south-surface-arc' });
    expect(infrastructure.root.getObjectByName('equatorial-rail-east')?.userData.closed).toBe(true);
    infrastructure.dispose();
    expect(infrastructure.root.children).toHaveLength(0);
  });

  it('provides a disposal boundary for every generated resource', () => {
    const infrastructure = createContinuousInfrastructure();
    const mesh = infrastructure.root.getObjectByName('planet-surface')! as any;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose'); const materialDispose = vi.spyOn(mesh.material, 'dispose');
    infrastructure.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce();
  });
});
