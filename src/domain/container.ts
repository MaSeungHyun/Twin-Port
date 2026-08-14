import { CONTAINER_D, CONTAINER_H, CONTAINER_W } from "@/constants/container";
import type { Vec3 } from "@/constants/geometry";
import {
  CanvasTexture,
  Matrix4,
  Quaternion,
  RepeatWrapping,
  Vector3,
} from "three";

export function makeCorrugationTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }

  ctx.fillStyle = "#b8b8b8";
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? "#8f8f8f" : "#cfcfcf";
    ctx.fillRect(0, y, 64, 3);
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

export function cellKey(bay: number, row: number) {
  return `${bay}_${row}`;
}

/**
 * Block 로컬 슬롯 → 월드 행렬
 * - rowIndex / bayIndex: 0-based
 * - tierIndex: 1-based
 * - origin: Block 원점
 */
export function composeContainerMatrix(
  rowIndex: number,
  bayIndex: number,
  tierIndex: number,
  deckY: number,
  origin: Vec3,
  yaw = 0,
  rowPitch = CONTAINER_W,
  bayPitch = CONTAINER_D,
  padX = 0,
  padZ = 0,
) {
  const heading = yaw;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sx = (rowPitch / CONTAINER_W) * 0.99;
  const sz = (bayPitch / CONTAINER_D) * 0.99;
  const sy = 0.99;
  const tierH = CONTAINER_H * sy;
  const lx = padX + rowIndex * rowPitch + rowPitch / 2;
  const ly = deckY + origin[1] + (tierIndex - 1) * tierH + tierH / 2;
  const lz = padZ + bayIndex * bayPitch + bayPitch / 2;
  _pos.set(origin[0] + lx * c + lz * s, ly, origin[2] + -lx * s + lz * c);
  _quat.setFromAxisAngle(_axis, heading);
  _scale.set(sx, sy, sz);
  return new Matrix4().compose(_pos, _quat, _scale);
}

/** ContainerYard group offset과 동일한 월드 좌표 */
export const CONTAINER_YARD_OFFSET: Vec3 = [5, 0, 0];

export function getContainerWorldPosition(
  blockOrigin: Vec3,
  rowIndex: number,
  bayIndex: number,
  tierIndex: number,
  deckY: number,
  yardOffset: Vec3 = CONTAINER_YARD_OFFSET,
  yaw = 0,
  rowPitch = CONTAINER_W,
  bayPitch = CONTAINER_D,
  padX = 0,
  padZ = 0,
) {
  const matrix = composeContainerMatrix(
    rowIndex,
    bayIndex,
    tierIndex,
    deckY,
    blockOrigin,
    yaw,
    rowPitch,
    bayPitch,
    padX,
    padZ,
  );
  const position = new Vector3().setFromMatrixPosition(matrix);
  position.x += yardOffset[0];
  position.y += yardOffset[1];
  position.z += yardOffset[2];
  return position;
}

/** B03-045-06-04 형식 */
export function formatSlotAddress(
  blockCode: string,
  bay: number,
  row: number,
  tier: number,
) {
  return `${blockCode}-${String(bay).padStart(3, "0")}-${String(row).padStart(2, "0")}-${String(tier).padStart(2, "0")}`;
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3(1, 1, 1);
const _axis = new Vector3(0, 1, 0);
