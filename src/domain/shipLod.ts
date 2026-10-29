import {
  SHIP_LOD_HYSTERESIS,
  SHIP_LOD_LEVELS,
  SHIP_LOD_MIN_TRIANGLES,
} from "@/constants/shipLod";
import { simplifiedGeometry, triangleCount } from "@/domain/craneLod";
import { MeshoptSimplifier } from "meshoptimizer";
import type { BufferGeometry } from "three";

/** 각 geometry → [원본, LOD1, LOD2, LOD3]. 단순화 실패 시 이전 단계 재사용 */
export async function buildShipLodGeometries(
  geometries: readonly (BufferGeometry | null)[],
): Promise<{ levels: BufferGeometry[][]; trianglesPerLevel: number[] }> {
  await MeshoptSimplifier.ready;
  const trianglesPerLevel = new Array(SHIP_LOD_LEVELS.length + 1).fill(0);
  const levels = geometries.map((base) => {
    if (!base) return [];
    const out = [base];
    let prev = base;
    const tris = triangleCount(base);
    for (const level of SHIP_LOD_LEVELS) {
      if (tris >= SHIP_LOD_MIN_TRIANGLES) {
        prev = simplifiedGeometry(base, level.ratio, level.error) ?? prev;
      }
      out.push(prev);
    }
    out.forEach((g, i) => (trianglesPerLevel[i] += triangleCount(g)));
    return out;
  });
  return { levels, trianglesPerLevel };
}

/** 거리 → LOD 단계 (현재 단계 기준 히스테리시스) */
export function shipLodLevel(distance: number, current: number) {
  let level = 0;
  for (let i = 0; i < SHIP_LOD_LEVELS.length; i++) {
    const edge =
      SHIP_LOD_LEVELS[i]!.distance *
      (i + 1 <= current ? 1 - SHIP_LOD_HYSTERESIS : 1);
    if (distance >= edge) level = i + 1;
  }
  return level;
}
