import * as THREE from 'three';
import { equatorialRailwayPosition, PLANET_CENTER, PLANET_RADIUS, projectFlatPoint } from './planet';

export interface ContinuousInfrastructureHandle {
  readonly root: THREE.Group;
  dispose(): void;
}

function addTube(root: THREE.Group, name: string, points: THREE.Vector3[], radius: number, color: number, closed = false): void {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, Math.max(points.length * 2, 32), radius, 6, closed);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.continuousInfrastructure = true;
  if (closed) mesh.userData.closed = true;
  root.add(mesh);
}

function flatPath(count: number, point: (t: number) => { x: number; y: number; z: number }): THREE.Vector3[] {
  return Array.from({ length: count }, (_, index) => projectFlatPoint(point(index / (count - 1))));
}

/** Build shared planet, roads, rails, and wires once outside either adapter. */
export function createContinuousInfrastructure(): ContinuousInfrastructureHandle {
  const root = new THREE.Group();
  root.name = 'continuous-infrastructure';

  const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 64, 32);
  const planetMaterial = new THREE.MeshBasicMaterial({ color: 0x17384a, wireframe: true, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  planet.name = 'planet-surface';
  planet.position.copy(PLANET_CENTER);
  planet.userData.continuousInfrastructure = true;
  root.add(planet);

  const road = flatPath(65, (t) => ({ x: -29 + 58 * t, y: 0.12, z: 7 + Math.sin(t * Math.PI * 2) * 2 }));
  addTube(root, 'road-tracer', road, 1.45, 0x6f7880);
  const footway = flatPath(65, (t) => ({ x: -29 + 58 * t, y: 0.3, z: 10 + Math.sin(t * Math.PI * 2) * 2 }));
  addTube(root, 'footway-tracer', footway, 0.5, 0xd6cdb8);

  const railPoints = (laneOffset: number) => Array.from({ length: 96 }, (_, index) => equatorialRailwayPosition((index / 96) * Math.PI * 2, laneOffset));
  addTube(root, 'equatorial-rail-east', railPoints(0.75), 0.14, 0xd4d5d8, true);
  addTube(root, 'equatorial-rail-west', railPoints(-0.75), 0.14, 0xd4d5d8, true);
  const railway = root.getObjectByName('equatorial-rail-east');
  if (railway) railway.userData.railLoop = { closed: true, railCount: 2, radius: PLANET_RADIUS, gauge: 1.5, laneOffsetAxis: 'north-south-surface-arc' };

  const wires = flatPath(65, (t) => ({ x: -25 + 50 * t, y: 7, z: -3 }));
  addTube(root, 'utility-wire-main', wires, 0.055, 0x20252b);
  addTube(root, 'utility-wire-secondary', wires.map((point) => point.clone().add(new THREE.Vector3(0, 0.35, 0))), 0.045, 0x20252b);

  return {
    root,
    dispose(): void {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else if (material) material.dispose();
      });
      root.clear();
    },
  };
}
