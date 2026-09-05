import * as THREE from 'three';
import { seatRigidObject } from '../world';
import type { CrossingSnapshot } from '../simulation';

/** Apply shared simulation state to compatible named adapter nodes. */
export function applySimulationSnapshot(host: THREE.Object3D, snapshot: CrossingSnapshot): void {
  const train = host.getObjectByName('train-two-car');
  if (train) {
    seatRigidObject(train, { flatX: snapshot.trainOffset, flatZ: 0, localHeight: 0, localRotation: new THREE.Euler() });
  }
  for (const suffix of ['west', 'east']) {
    const pivot = host.getObjectByName(`crossing-barrier-${suffix}-pivot`);
    if (pivot) pivot.rotation.z = suffix === 'west'
      ? Math.PI / 2 * (1 - snapshot.barrierClosure)
      : -Math.PI / 2 * (1 - snapshot.barrierClosure);
    const warning = host.getObjectByName(`crossing-warning-light-${suffix}`);
    if (warning) warning.visible = snapshot.warningActive;
  }
  const drink = host.getObjectByName('vending-machine-main-dispensed-drink');
  if (drink) drink.visible = snapshot.dispensedDrink;
}
