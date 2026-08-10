import { CONTAINER_D, CONTAINER_H, CONTAINER_W } from "@/constants/container";
import { SHIP_SCALE } from "@/constants/model";
import { SHIP_CARGO } from "@/constants/shipCargo";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

/**
 * 선박 인스턴스 pose × 로컬 슬롯 → 월드 행렬.
 * - bay: 선박 길이(로컬 X), row: 폭(로컬 Z), tier: 1-based
 * - dropProgress: 0=드롭 시작(위), 1=안착
 * - appearScale: 등장 스케일 (0~1)
 * - dropHeight: 월드 단위 드롭 높이 (선박별 프로파일)
 */
export function composeShipContainerMatrix(
  ship: ShipInstance,
  bayIndex: number,
  rowIndex: number,
  tierIndex: number,
  dropProgress = 1,
  appearScale = 1,
  dropHeight = 4,
) {
  const pitch = SHIP_CARGO.pitchScale;
  const [ox, oy, oz] = SHIP_CARGO.originLocal;
  const dropLocal = dropHeight / SHIP_SCALE;

  const localX =
    ox + bayIndex * CONTAINER_D * pitch + (CONTAINER_D * pitch) / 2;
  const localZ =
    oz + rowIndex * CONTAINER_W * pitch + (CONTAINER_W * pitch) / 2;
  const baseY =
    oy + (tierIndex - 1) * CONTAINER_H * pitch + (CONTAINER_H * pitch) / 2;
  const drop = (1 - dropProgress) * dropLocal;
  const localY = baseY + drop;

  _localPos.set(localX, localY, localZ);

  const scale = ship.scale ?? 1;
  if (typeof scale === "number") {
    _shipScale.setScalar(scale);
  } else {
    _shipScale.set(...scale);
  }

  _shipQuat.setFromEuler(_euler.set(...(ship.rotation ?? [0, 0, 0]), "XYZ"));
  _shipMatrix.compose(_shipPos.set(...ship.position), _shipQuat, _shipScale);

  const invScale = 1 / (typeof scale === "number" ? scale : scale[0]);
  const s = Math.max(appearScale, 0.0001) * invScale;
  _containerScale.set(s, s, s);

  _slotQuat.setFromAxisAngle(_yawAxis, SHIP_CARGO.yawLocal);
  _slotMatrix.compose(_localPos, _slotQuat, _containerScale);
  return _worldMatrix.multiplyMatrices(_shipMatrix, _slotMatrix).clone();
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
