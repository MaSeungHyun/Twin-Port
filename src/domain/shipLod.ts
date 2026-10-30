import {
  SHIP_LOD_HYSTERESIS,
  SHIP_LOD_LEVELS,
  SHIP_LOD_MIN_TRIANGLES,
} from "@/constants/shipLod";
import { simplifiedGeometriesAsync, triangleCount } from "@/domain/craneLod";
import type { BufferGeometry } from "three";
import { loadSpan } from "@/debug/loadTiming";

/** 각 geometry → [원본, LOD1, LOD2, LOD3]. 단순화 실패 시 이전 단계 재사용 */
export async function buildShipLodGeometries(
  geometries: readonly (BufferGeometry | null)[],
): Promise<{ levels: BufferGeometry[][]; trianglesPerLevel: number[] }> {
  const endSpan = loadSpan("shipLod build");
  const trianglesPerLevel = new Array(SHIP_LOD_LEVELS.length + 1).fill(0);
  // [worker] 파트별 simplify 를 워커 풀에 병렬 요청
  const levels = await Promise.all(
    geometries.map(async (base) => {
      if (!base) return [];
      const out = [base];
      const tris = triangleCount(base);
      const simplified =
        tris >= SHIP_LOD_MIN_TRIANGLES
          ? await simplifiedGeometriesAsync(base, SHIP_LOD_LEVELS)
          : SHIP_LOD_LEVELS.map(() => null);
      let prev = base;
      for (const g of simplified) {
        prev = g ?? prev;
        out.push(prev);
      }
      return out;
    }),
  );
  for (const out of levels) out.forEach((g, i) => (trianglesPerLevel[i] += triangleCount(g)));
  endSpan(`${geometries.length} parts`);
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
