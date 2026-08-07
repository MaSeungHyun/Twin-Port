import {
  GROUND_X,
  GROUND_Z,
  TILE_SIZE,
} from "@/constants/ground";

const HALF_PI = Math.PI / 2;

function normalizeRadians(rad: number) {
  const tau = Math.PI * 2;
  return ((rad % tau) + tau) % tau;
}

function isQuarterTurn(rad: number) {
  const n = normalizeRadians(rad);
  return (
    Math.abs(n - HALF_PI) < 0.001 || Math.abs(n - HALF_PI * 3) < 0.001
  );
}

/** mesh Y 회전 반영한 바닥면(XZ) 실제 span */
export function getGroundFootprint(
  scale: [number, number, number],
  rotationY: number,
) {
  let spanX = GROUND_X * scale[0];
  let spanZ = GROUND_Z * scale[2];

  if (isQuarterTurn(rotationY)) {
    [spanX, spanZ] = [spanZ, spanX];
  }

  return { spanX, spanZ };
}

/** mesh·texture 회전에 맞춘 UV repeat */
export function resolveGroundRepeat(
  scale: [number, number, number],
  rotationY: number,
  textureRotation: number,
  tileSize: number,
  repeat?: [number, number],
): [number, number] {
  if (repeat) return repeat;

  const { spanX, spanZ } = getGroundFootprint(scale, rotationY);
  let repeatU = spanX / tileSize;
  let repeatV = spanZ / tileSize;

  if (isQuarterTurn(textureRotation)) {
    [repeatU, repeatV] = [repeatV, repeatU];
  }

  return [repeatU, repeatV];
}

export { TILE_SIZE };
