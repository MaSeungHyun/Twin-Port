import { SHIP_PLACEMENTS } from "@/constants/model";
import type { QuayBerth } from "@/domain/extractQuayBerths";
import {
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";

export type ShipCubeLocator = {
  position: [number, number, number];
  rotation: [number, number, number];
};

function isInstanced(object: Object3D): object is InstancedMesh {
  return (object as InstancedMesh).isInstancedMesh === true;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function namesOf(object: Object3D) {
  const geometryName = isMesh(object) ? (object.geometry?.name ?? "") : "";
  return [object.name, object.parent?.name ?? "", geometryName];
}

/** Ship 로케이터. 최적화 후 이름이 빠져도 mesh `Cube`(Ground의 Cube.002 제외)로 찾는다. */
function isShipCube(object: Object3D) {
  const names = namesOf(object);
  if (names.some((name) => /^ground$/i.test(name) || /cube\.002/i.test(name))) {
    return false;
  }
  if (names.some((name) => /^ship/i.test(name))) return true;
  return names.some((name) => /^cube$/i.test(name));
}

function poseFromWorld(world: Matrix4): ShipCubeLocator {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  world.decompose(position, quaternion, scale);
  const euler = new Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    position: [position.x, position.y, position.z],
    rotation: [euler.x, euler.y, euler.z],
  };
}

export function extractShipCubes(root: Object3D): ShipCubeLocator[] {
  root.updateMatrixWorld(true);

  const locators: ShipCubeLocator[] = [];
  const world = new Matrix4();
  const instance = new Matrix4();

  root.traverse((child) => {
    if (!isMesh(child) || !isShipCube(child)) return;

    if (isInstanced(child)) {
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, instance);
        world.multiplyMatrices(child.matrixWorld, instance);
        locators.push(poseFromWorld(world));
      }
      return;
    }

    locators.push(poseFromWorld(child.matrixWorld));
  });

  return locators;
}

function outwardFromYaw(yaw: number): [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}

export function fallbackBerths(): QuayBerth[] {
  return shipsFromPlacements();
}

/** SHIP_PLACEMENTS 월드 좌표로 배치. Cube / tween 불필요. */
export function shipsFromPlacements(): QuayBerth[] {
  return SHIP_PLACEMENTS.map((ship) => {
    const yaw = (ship.yawDeg * Math.PI) / 180;
    return {
      kind: "unknown" as const,
      craneCount: 0,
      locatorIndex: ship.locators[0],
      outward: outwardFromYaw(yaw),
      position: [...ship.position] as [number, number, number],
      rotation: [0, yaw, 0] as [number, number, number],
      scale: ship.scale,
    };
  });
}
