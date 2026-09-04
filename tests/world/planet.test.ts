import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { equatorialRailwayPosition, PLANET_CENTER, PLANET_CIRCUMFERENCE, PLANET_RADIUS, projectFlatGeometry, projectFlatPoint, seatRigidObject, surfaceBasis, surfacePosition, wrapPlanetX } from '../../src/world/planet';

const closeVector = (actual: THREE.Vector3, expected: THREE.Vector3, tolerance = 1e-8) => expect(actual.distanceTo(expected)).toBeLessThan(tolerance);

describe('planet coordinate system', () => {
  it('maps the flat origin to the top of the radius-160 sphere', () => {
    closeVector(surfacePosition(0, 0), new THREE.Vector3(0, 0, 0));
    closeVector(PLANET_CENTER, new THREE.Vector3(0, -160, 0));
    expect(surfacePosition(0, 0).distanceTo(PLANET_CENTER)).toBeCloseTo(PLANET_RADIUS);
    expect(PLANET_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * PLANET_RADIUS);
  });

  it('wraps circumference and keeps both separated equatorial rails closed at radius R', () => {
    expect(wrapPlanetX(0)).toBe(0);
    expect(wrapPlanetX(PLANET_CIRCUMFERENCE)).toBeCloseTo(0);
    expect(wrapPlanetX(-PLANET_CIRCUMFERENCE)).toBeCloseTo(0);
    expect(wrapPlanetX(PLANET_CIRCUMFERENCE / 2 + 2)).toBeCloseTo(-PLANET_CIRCUMFERENCE / 2 + 2);
    for (const lane of [-0.75, 0.75]) {
      closeVector(equatorialRailwayPosition(0, lane), equatorialRailwayPosition(Math.PI * 2, lane));
      expect(equatorialRailwayPosition(Math.PI / 3, lane).distanceTo(PLANET_CENTER)).toBeCloseTo(PLANET_RADIUS);
    }
    const northRail = equatorialRailwayPosition(Math.PI / 3, 0.75);
    const southRail = equatorialRailwayPosition(Math.PI / 3, -0.75);
    expect(northRail.distanceTo(southRail)).toBeCloseTo(2 * PLANET_RADIUS * Math.sin(0.75 / PLANET_RADIUS), 6);
    expect(northRail.distanceTo(southRail)).toBeGreaterThan(1.49);
  });

  it('maps representative latitude and local height along the surface up vector', () => {
    const basis = surfaceBasis(17, 26);
    expect(basis.east.length()).toBeCloseTo(1); expect(basis.up.length()).toBeCloseTo(1); expect(basis.north.length()).toBeCloseTo(1);
    expect(basis.east.dot(basis.up)).toBeCloseTo(0); expect(basis.east.dot(basis.north)).toBeCloseTo(0); expect(basis.up.dot(basis.north)).toBeCloseTo(0);
    closeVector(basis.east.clone().cross(basis.up), basis.north);
    const base = surfacePosition(17, 26); const raised = surfacePosition(17, 26, 3);
    closeVector(raised.clone().sub(base), basis.up.clone().multiplyScalar(3));
    expect(base.distanceTo(PLANET_CENTER)).toBeCloseTo(PLANET_RADIUS);
  });

  it('projects static geometry without dropping custom attributes or bounds', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 0, 1], 3));
    geometry.setAttribute('customValue', new THREE.Float32BufferAttribute([2, 4, 8], 1));
    geometry.setIndex([0, 1, 2]);
    const projected = projectFlatGeometry(geometry);
    expect(projected.getAttribute('customValue').array).toEqual(new Float32Array([2, 4, 8]));
    expect(projected.boundingBox).not.toBeNull(); expect(projected.boundingSphere).not.toBeNull();
    for (const value of projected.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    expect(geometry.getAttribute('position').getX(0)).toBe(-1);
  });

  it('seats a rigid object with basis composition and preserves scale and child pivot', () => {
    const object = new THREE.Group();
    object.quaternion.setFromEuler(new THREE.Euler(0.1, 0.2, 0.3)); object.scale.set(2, 3, 4);
    const child = new THREE.Object3D(); child.position.set(1, 2, 3); object.add(child);
    const localRotation = object.quaternion.clone(); const localScale = object.scale.clone(); const childPosition = child.position.clone();
    seatRigidObject(object, { flatX: 17, flatZ: 26, localHeight: 1 });
    const basis = surfaceBasis(17, 26); const basisRotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.east, basis.up, basis.north));
    expect(object.quaternion.angleTo(basisRotation.multiply(localRotation))).toBeLessThan(1e-6);
    closeVector(object.position, projectFlatPoint({ x: 17, y: 1, z: 26 }));
    closeVector(object.scale, localScale); closeVector(child.position, childPosition);
  });
});
