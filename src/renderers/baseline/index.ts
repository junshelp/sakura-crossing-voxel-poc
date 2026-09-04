import * as THREE from 'three';
import type { RendererAdapter, SceneEntity, SharedSceneSpecification } from '../../scene-spec';
import { seatRigidObject } from '../../world';

type MaterialRole = 'ground' | 'accent' | 'marker' | 'rail' | 'wood' | 'roof' | 'leaf' | 'petal' | 'metal' | 'glass' | 'emissive';

const PALETTE: Record<MaterialRole, number> = {
  ground: 0x6f7880, accent: 0xd94f72, marker: 0xf5c04a, rail: 0xd4d5d8,
  wood: 0x70452f, roof: 0x2b4162, leaf: 0x4c8c59, petal: 0xf3a7ba,
  metal: 0x68737d, glass: 0x87c7d8, emissive: 0xffd34d,
};

function dimensions(entity: SceneEntity): readonly [number, number, number] { return entity.transform.scale; }

/** Conventional procedural renderer for the shared semantic scene. */
export class BaselineAdapter implements RendererAdapter {
  readonly name = 'baseline' as const;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Map<MaterialRole, THREE.MeshStandardMaterial>();
  private readonly pointMaterials = new Map<MaterialRole, THREE.PointsMaterial>();
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();
  private disposed = false;

  private material(role: MaterialRole): THREE.MeshStandardMaterial {
    let material = this.materials.get(role);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: PALETTE[role], roughness: role === 'glass' ? 0.22 : 0.78, metalness: role === 'metal' ? 0.5 : 0, transparent: role === 'glass', opacity: role === 'glass' ? 0.8 : 1, emissive: role === 'emissive' ? PALETTE.emissive : 0x000000, emissiveIntensity: role === 'emissive' ? 1.4 : 0 });
      this.materials.set(role, material);
    }
    return material;
  }

  private own<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    const cached = this.geometryCache.get(key);
    if (cached) return cached as T;
    const geometry = factory();
    this.geometryCache.set(key, geometry);
    this.geometries.add(geometry);
    return geometry;
  }

  private box(size: readonly [number, number, number]): THREE.BufferGeometry {
    const key = `box:${size.join(',')}`;
    return this.own(key, () => new THREE.BoxGeometry(...size));
  }

  private cylinder(radius: number, height: number, radialSegments = 8): THREE.BufferGeometry {
    return this.own(`cylinder:${radius}:${height}:${radialSegments}`, () => new THREE.CylinderGeometry(radius, radius, height, radialSegments));
  }

  private sphere(radius: number, widthSegments = 8, heightSegments = 6): THREE.BufferGeometry {
    return this.own(`sphere:${radius}:${widthSegments}:${heightSegments}`, () => new THREE.SphereGeometry(radius, widthSegments, heightSegments));
  }

  private torus(radius: number, tube: number): THREE.BufferGeometry {
    return this.own(`torus:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 12));
  }

  private pointMaterial(role: MaterialRole): THREE.PointsMaterial {
    let material = this.pointMaterials.get(role);
    if (!material) {
      material = new THREE.PointsMaterial({ color: PALETTE[role], size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.9 });
      this.pointMaterials.set(role, material);
    }
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, role: MaterialRole, name: string, parent: THREE.Object3D): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material(role));
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  private entityRoot(entity: SceneEntity, host: THREE.Object3D): THREE.Group {
    const group = new THREE.Group();
    group.name = entity.id;
    group.userData.semanticKind = entity.kind;
    const [x, y, z] = entity.transform.position;
    // Procedural children are authored upward from their footprint, while the
    // shared transform stores an entity center. Seat the footprint on the skin.
    seatRigidObject(group, { flatX: x, flatZ: z, localHeight: y - entity.transform.scale[1] / 2, localRotation: new THREE.Euler(...entity.transform.rotation) });
    host.add(group);
    return group;
  }

  private addCrossing(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host);
    const [width, height, depth] = dimensions(entity);
    this.mesh(this.box([width, 0.2, depth]), 'metal', 'crossing-deck', group).position.y = 0.1;
    for (const side of [-1, 1] as const) {
      const suffix = side < 0 ? 'west' : 'east';
      const post = this.mesh(this.cylinder(0.14, height, 8), 'metal', `crossing-post-${suffix}`, group);
      post.position.set(side * (width / 2 - 0.35), height / 2, 0);
      const pivot = new THREE.Group(); pivot.name = `crossing-barrier-${suffix}-pivot`; pivot.position.set(side * (width / 2 - 0.4), height * 0.8, 0); group.add(pivot);
      this.mesh(this.box([width * 0.42, 0.12, 0.14]), 'accent', `crossing-barrier-${suffix}-arm`, pivot).position.x = -side * width * 0.2;
      const warning = new THREE.Group(); warning.name = `crossing-warning-light-${suffix}`; warning.position.set(side * (width / 2 - 0.35), height * 0.86, depth / 2); group.add(warning);
      this.mesh(this.sphere(0.18), 'emissive', `${warning.name}-lens`, warning);
    }
    const signal = this.mesh(this.box([0.35, 0.7, 0.2]), 'metal', 'crossing-signal', group); signal.position.set(0, height * 0.75, depth / 2);
  }

  private addTrain(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host);
    const [width, height, depth] = dimensions(entity);
    for (const [index, x] of [['a', -width * 0.25], ['b', width * 0.25]] as const) {
      const car = new THREE.Group(); car.name = `train-car-${index}`; car.position.x = x; group.add(car);
      this.mesh(this.box([width * 0.43, height * 0.6, depth * 0.82]), 'metal', `${car.name}-body`, car).position.y = height * 0.35;
      this.mesh(this.box([width * 0.39, height * 0.16, depth * 0.86]), 'accent', `${car.name}-roof`, car).position.y = height * 0.7;
      for (const windowX of [-0.28, 0, 0.28]) { const window = this.mesh(this.box([width * 0.06, height * 0.18, 0.04]), 'glass', `${car.name}-window-${windowX}`, car); window.position.set(windowX * width, height * 0.43, depth * 0.42); }
      const pivot = new THREE.Object3D(); pivot.name = `${car.name}-pivot`; car.add(pivot);
    }
  }

  private addBuilding(entity: SceneEntity, host: THREE.Object3D, variant: 'shop' | 'blue-roof' | 'tile-roof'): void {
    const group = this.entityRoot(entity, host);
    const [width, height, depth] = dimensions(entity);
    this.mesh(this.box([width, height * 0.72, depth]), 'wood', `${entity.id}-body`, group).position.y = height * 0.36;
    const roofRole: MaterialRole = variant === 'tile-roof' ? 'accent' : 'roof';
    const roof = this.mesh(this.box([width * 1.08, height * 0.18, depth * 1.08]), roofRole, `${entity.id}-roof`, group); roof.position.y = height * 0.82;
    for (const side of [-1, 1] as const) { const window = this.mesh(this.box([width * 0.18, height * 0.2, 0.08]), 'glass', `${entity.id}-window-${side}`, group); window.position.set(side * width * 0.25, height * 0.45, depth / 2 + 0.04); }
    const door = this.mesh(this.box([width * 0.16, height * 0.4, 0.1]), variant === 'shop' ? 'accent' : 'metal', `${entity.id}-door`, group); door.position.set(0, height * 0.2, depth / 2 + 0.05);
  }

  private addMachine(entity: SceneEntity, host: THREE.Object3D, relay: boolean): void {
    const group = this.entityRoot(entity, host);
    const [width, height, depth] = dimensions(entity);
    this.mesh(this.box([width, height, depth]), relay ? 'metal' : 'accent', `${entity.id}-body`, group).position.y = height / 2;
    const panel = this.mesh(this.box([width * 0.7, height * 0.38, 0.04]), relay ? 'metal' : 'glass', `${entity.id}-panel`, group); panel.position.set(0, height * 0.62, depth / 2 + 0.03);
    const light = this.mesh(this.sphere(0.09), 'emissive', `${entity.id}-status-light`, group); light.position.set(width * 0.3, height * 0.2, depth / 2 + 0.04);
  }

  private addPole(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const [width, height] = dimensions(entity);
    this.mesh(this.cylinder(width * 0.4, height, 8), 'wood', `${entity.id}-shaft`, group).position.y = height / 2;
    const arm = this.mesh(this.box([width * 4, width * 0.25, width * 0.25]), 'wood', `${entity.id}-crossarm`, group); arm.position.y = height * 0.88;
  }

  private addFence(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const [width, height, depth] = dimensions(entity);
    const count = Math.max(2, Math.floor(width / 4));
    for (let i = 0; i <= count; i += 1) { const post = this.mesh(this.cylinder(0.08, height, 6), 'wood', `fence-post-${i}`, group); post.position.set(-width / 2 + (width * i) / count, height / 2, 0); }
    this.mesh(this.box([width, 0.1, depth]), 'wood', `${entity.id}-rail`, group).position.y = height * 0.65;
  }

  private addTree(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const [, height] = dimensions(entity);
    this.mesh(this.cylinder(0.24, height, 7), 'wood', `${entity.id}-trunk`, group).position.y = height / 2;
    for (const [index, position] of [[0, [0, height * 0.78, 0]], [1, [-0.65, height * 0.7, 0.2]], [2, [0.6, height * 0.68, -0.15]]] as const) { const crown = this.mesh(this.sphere(1.1, 7, 5), index === 0 ? 'petal' : 'leaf', `${entity.id}-crown-${index}`, group); crown.position.set(position[0], position[1], position[2]); }
    for (let i = 0; i < 4; i += 1) { const petal = this.mesh(this.sphere(0.1, 5, 4), 'petal', `${entity.id}-petal-${i}`, group); petal.position.set((i - 1.5) * 0.45, height * (0.5 + (i % 2) * 0.08), (i % 2 ? 0.5 : -0.45)); }
  }

  private addPetals(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const positions: number[] = [];
    for (let i = 0; i < 24; i += 1) { const x = ((i * 17) % 47) - 23; const z = ((i * 29) % 47) - 23; positions.push(x, 2.5 + (i % 5) * 0.45, z); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); this.geometries.add(geometry);
    const points = new THREE.Points(geometry, this.pointMaterial('petal')); points.name = `${entity.id}-drift`; group.add(points);
  }

  private addBicycle(entity: SceneEntity, host: THREE.Object3D): void {
    const group = this.entityRoot(entity, host); const [width, height] = dimensions(entity);
    for (const x of [-width * 0.32, width * 0.32]) { const wheel = this.mesh(this.torus(width * 0.18, 0.06), 'metal', `bicycle-wheel-${x}`, group); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, width * 0.18, 0); }
    const frame = this.mesh(this.box([width * 0.55, 0.06, 0.06]), 'accent', `${entity.id}-frame`, group); frame.position.y = width * 0.32;
    const seat = this.mesh(this.box([width * 0.18, 0.08, 0.14]), 'metal', `${entity.id}-seat`, group); seat.position.set(-width * 0.12, height * 0.48, 0);
  }

  private addEntity(entity: SceneEntity, host: THREE.Object3D): void {
    switch (entity.kind) {
      case 'crossing': this.addCrossing(entity, host); break;
      case 'train': this.addTrain(entity, host); break;
      case 'shop': this.addBuilding(entity, host, 'shop'); break;
      case 'house': this.addBuilding(entity, host, entity.visual.variant === 'tile-roof' ? 'tile-roof' : 'blue-roof'); break;
      case 'vending-machine': this.addMachine(entity, host, false); break;
      case 'relay-box': this.addMachine(entity, host, true); break;
      case 'utility-pole': this.addPole(entity, host); break;
      case 'fence': this.addFence(entity, host); break;
      case 'cherry-tree': this.addTree(entity, host); break;
      case 'petal': this.addPetals(entity, host); break;
      case 'bicycle': this.addBicycle(entity, host); break;
      case 'marker': { const group = this.entityRoot(entity, host); this.mesh(this.sphere(0.15), 'marker', `${entity.id}-origin`, group); break; }
      default: break;
    }
  }

  mount(spec: SharedSceneSpecification, host: THREE.Object3D): void {
    if (this.disposed) throw new Error('Cannot mount a disposed BaselineAdapter');
    for (const entity of spec.entities) {
      if (entity.kind === 'ground' || entity.kind === 'road' || entity.kind === 'footway' || entity.kind === 'rail' || entity.kind === 'wire') continue;
      this.addEntity(entity, host);
    }
    host.userData.baselineEntityIds = spec.entities.filter((entity) => !['ground', 'road', 'footway', 'rail', 'wire'].includes(entity.kind)).map((entity) => entity.id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.pointMaterials.values()) material.dispose();
    this.geometries.clear(); this.materials.clear(); this.pointMaterials.clear(); this.geometryCache.clear();
  }
}
