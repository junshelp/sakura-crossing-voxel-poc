import * as THREE from 'three';

export const PLANET_RADIUS = 160;
export const PLANET_CIRCUMFERENCE = 2 * Math.PI * PLANET_RADIUS;
export const PLANET_CENTER = Object.freeze(new THREE.Vector3(0, -PLANET_RADIUS, 0));

export interface FlatPoint { readonly x: number; readonly y?: number; readonly z: number }
export interface SurfaceBasis { readonly east: THREE.Vector3; readonly up: THREE.Vector3; readonly north: THREE.Vector3 }

/** Wrap an authored east-west coordinate to the shortest equivalent longitude. */
export function wrapPlanetX(x: number): number {
  const wrapped = ((x + PLANET_CIRCUMFERENCE / 2) % PLANET_CIRCUMFERENCE + PLANET_CIRCUMFERENCE) % PLANET_CIRCUMFERENCE - PLANET_CIRCUMFERENCE / 2;
  return Math.abs(wrapped) < 1e-9 ? 0 : wrapped;
}
export const wrapFlatX = wrapPlanetX;
export const wrapLongitude = wrapPlanetX;

/** Return the right-handed orthonormal east/up/north frame at a flat coordinate. */
export function surfaceBasis(flatX: number, flatZ: number): SurfaceBasis {
  const longitude = wrapPlanetX(flatX) / PLANET_RADIUS;
  const latitude = flatZ / PLANET_RADIUS;
  const sinLongitude = Math.sin(longitude); const cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude); const cosLatitude = Math.cos(latitude);
  const east = new THREE.Vector3(cosLongitude, -sinLongitude, 0);
  const up = new THREE.Vector3(sinLongitude * cosLatitude, cosLongitude * cosLatitude, sinLatitude);
  const north = new THREE.Vector3(-sinLongitude * sinLatitude, -cosLongitude * sinLatitude, cosLatitude);
  return { east, up, north };
}
export const getSurfaceBasis = surfaceBasis;

/** Map authored x/east and z/north coordinates to the sphere, with y as local height. */
export function surfacePosition(flatX: number, flatZ: number, localHeight = 0): THREE.Vector3 {
  const longitude = wrapPlanetX(flatX) / PLANET_RADIUS;
  const latitude = flatZ / PLANET_RADIUS;
  const position = new THREE.Vector3(
    PLANET_RADIUS * Math.sin(longitude) * Math.cos(latitude),
    PLANET_RADIUS * Math.cos(longitude) * Math.cos(latitude) - PLANET_RADIUS,
    PLANET_RADIUS * Math.sin(latitude),
  );
  return position.add(surfaceBasis(flatX, flatZ).up.multiplyScalar(localHeight));
}
export const flatToSphere = surfacePosition;

export function projectFlatPoint(point: FlatPoint): THREE.Vector3 { return surfacePosition(point.x, point.z, point.y ?? 0); }

/** Return a point on the closed east/west railway loop through the top-origin crossing. */
export function equatorialRailwayPosition(angle: number, laneOffset = 0): THREE.Vector3 {
  return surfacePosition(angle * PLANET_RADIUS, laneOffset);
}
export const railwayPosition = equatorialRailwayPosition;

/**
 * Project a static geometry in-place from flat x/y/z into planet coordinates.
 * Callers must segment long geometry before projection; this boundary never
 * silently subdivides W002 voxel buffers.
 */
export function projectFlatGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('Flat geometry requires a position attribute');
  const point = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.set(position.getX(index), position.getY(index), position.getZ(index));
    const projected = projectFlatPoint(point);
    position.setXYZ(index, projected.x, projected.y, projected.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
export const projectGeometry = projectFlatGeometry;

export interface RigidSeatOptions { readonly flatX: number; readonly flatZ: number; readonly localHeight?: number; readonly localRotation?: THREE.Quaternion | THREE.Euler; }

/** Seat an Object3D while preserving its local rotation and scale/child pivots. */
export function seatRigidObject(object: THREE.Object3D, options: RigidSeatOptions): THREE.Object3D {
  const basis = surfaceBasis(options.flatX, options.flatZ);
  const basisMatrix = new THREE.Matrix4().makeBasis(basis.east, basis.up, basis.north);
  const basisRotation = new THREE.Quaternion().setFromRotationMatrix(basisMatrix);
  const localRotation = options.localRotation instanceof THREE.Euler ? new THREE.Quaternion().setFromEuler(options.localRotation) : (options.localRotation?.clone() ?? object.quaternion.clone());
  object.position.copy(surfacePosition(options.flatX, options.flatZ, options.localHeight ?? 0));
  object.quaternion.copy(basisRotation).multiply(localRotation);
  return object;
}
export const seatObjectOnPlanet = seatRigidObject;
