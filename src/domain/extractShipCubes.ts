import {
  SHIP_PLACEMENTS,
  SHIP_POINT_YAW_OFFSET_DEG,
  SHIP_POSITION_Y,
} from "@/constants/model";
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
      scale: 1,
    };
  });
}

// GLTFLoader(sanitizeNodeName)가 '.'을 제거 → "Ship_Point.000"은 "Ship_Point000"이 됨. 원본은 userData.name
const SHIP_POINT_RE = /^ship[_ ]?point[._ ]?(\d+)?$/i;

/** GLB Ship_Point.NNN Empty → 선박 배치 (suffix 순). Empty 는 숨김 처리. */
export function extractShipPoints(root: Object3D): QuayBerth[] {
  root.updateMatrixWorld(true);
  const found: { index: number; node: Object3D }[] = [];
  root.traverse((child) => {
    const m =
      SHIP_POINT_RE.exec(String(child.userData?.name ?? "")) ??
      SHIP_POINT_RE.exec(child.name);
    if (!m) return;
    found.push({ index: m[1] ? Number(m[1]) : 0, node: child });
  });
  found.sort((a, b) => a.index - b.index);
  const pos = new Vector3();
  const quat = new Quaternion();
  const fwd = new Vector3();
  const offset = (SHIP_POINT_YAW_OFFSET_DEG * Math.PI) / 180;
  // GLB 접미사(000,002,005…)는 빈 번호가 있음 → 정렬 순서대로 0..N-1로 당겨서 locatorIndex로 씀
  return found.map(({ node }, index) => {
    node.visible = false;
    node.getWorldPosition(pos);
    node.getWorldQuaternion(quat);
    fwd.set(0, 1, 0).applyQuaternion(quat);
    const yaw = Math.atan2(-fwd.z, fwd.x) + offset;
    return {
      kind: "unknown" as const,
      craneCount: 0,
      locatorIndex: index,
      outward: outwardFromYaw(yaw),
      position: [pos.x, SHIP_POSITION_Y, pos.z] as [number, number, number],
      rotation: [0, yaw, 0] as [number, number, number],
      scale: 1,
    };
  });
}
