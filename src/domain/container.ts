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
) {
  const baseY = (tierIndex - 1) * CONTAINER_H;
  _pos.set(
    origin[0] + rowIndex * CONTAINER_W + CONTAINER_W / 2,
    deckY + origin[1] + baseY + CONTAINER_H / 2,
    origin[2] + bayIndex * CONTAINER_D + CONTAINER_D / 2,
  );
  _quat.setFromAxisAngle(_axis, yaw);
  return new Matrix4().compose(_pos, _quat, _scale);
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
