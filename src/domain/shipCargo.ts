import { CONTAINER_D, CONTAINER_H, CONTAINER_W } from "@/constants/container";
import { SHIP_SCALE } from "@/constants/model";
import { SHIP_CARGO } from "@/constants/shipCargo";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

export function shipWorldScale(ship: Pick<ShipInstance, "scale">) {
  const scale = ship.scale ?? SHIP_SCALE;
  return typeof scale === "number" ? scale : scale[0];
}

/** 선박 월드 행렬. target에 기록하고 그대로 반환(clone 없음). */
export function composeShipWorldMatrix(ship: ShipInstance, target: Matrix4) {
  const scale = ship.scale ?? SHIP_SCALE;
  if (typeof scale === "number") {
    _shipScale.setScalar(scale);
  } else {
    _shipScale.set(...scale);
  }
  _shipQuat.setFromEuler(_euler.set(...(ship.rotation ?? [0, 0, 0]), "XYZ"));
  return target.compose(_shipPos.set(...ship.position), _shipQuat, _shipScale);
}

/**
 * 선박 로컬 슬롯 행렬. 안착(t=1) 결과는 재사용 가능.
 */
export function composeCargoSlotLocal(
  shipScale: number,
  bayIndex: number,
  rowIndex: number,
  tierIndex: number,
  dropProgress: number,
  appearScale: number,
  dropHeight: number,
  target: Matrix4,
  originLocal: readonly [number, number, number] = SHIP_CARGO.originLocal,
) {
  const pitch = 1 / shipScale;
  const [ox, oy, oz] = originLocal;
  const dropLocal = dropHeight / shipScale;

  const localX =
    ox + bayIndex * CONTAINER_D * pitch + (CONTAINER_D * pitch) / 2;
  const localZ =
    oz + rowIndex * CONTAINER_W * pitch + (CONTAINER_W * pitch) / 2;
  const baseY =
    oy + (tierIndex - 1) * CONTAINER_H * pitch + (CONTAINER_H * pitch) / 2;
  const drop = (1 - dropProgress) * dropLocal;

  _localPos.set(localX, baseY + drop, localZ);
  const s = Math.max(appearScale, 0.0001) / shipScale;
  _containerScale.set(s, s, s);
  _slotQuat.setFromAxisAngle(_yawAxis, SHIP_CARGO.yawLocal);
  return target.compose(_localPos, _slotQuat, _containerScale);
}

/**
 * 선박 인스턴스 pose × 로컬 슬롯 → 월드 행렬.
 * 반환값은 재사용 버퍼이므로 바로 setMatrixAt에 넘긴다.
 */
export function composeShipContainerMatrix(
  ship: ShipInstance,
  bayIndex: number,
  rowIndex: number,
  tierIndex: number,
  dropProgress = 1,
  appearScale = 1,
  dropHeight = 4,
  target: Matrix4 = _worldMatrix,
) {
  composeShipWorldMatrix(ship, _shipMatrix);
  composeCargoSlotLocal(
    shipWorldScale(ship),
    bayIndex,
    rowIndex,
    tierIndex,
    dropProgress,
    appearScale,
    dropHeight,
    _slotMatrix,
  );
  return target.multiplyMatrices(_shipMatrix, _slotMatrix);
}

const _localPos = new Vector3();
const _shipPos = new Vector3();
const _shipScale = new Vector3(1, 1, 1);
const _shipQuat = new Quaternion();
const _slotQuat = new Quaternion();
const _yawAxis = new Vector3(0, 1, 0);
const _containerScale = new Vector3(1, 1, 1);
const _euler = new Euler();
const _shipMatrix = new Matrix4();
const _slotMatrix = new Matrix4();
const _worldMatrix = new Matrix4();
