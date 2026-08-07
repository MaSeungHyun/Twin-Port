import { useMemo } from "react";
import { MeshStandardMaterial, Vector2, type Texture } from "three";
import { TERRAIN_NORMAL_SCALE } from "@/constants/terrain";

export function createTerrainSurfaceMaterial(
  colorMap?: Texture,
  normalMap?: Texture,
) {
  return new MeshStandardMaterial({
    map: colorMap,
    normalMap,
    normalScale: new Vector2(TERRAIN_NORMAL_SCALE, TERRAIN_NORMAL_SCALE),
    vertexColors: !colorMap,
    roughness: 0.82,
    metalness: 0.02,
  });
}

export function useTerrainSurfaceMaterial(
  colorMap?: Texture,
  normalMap?: Texture,
) {
  return useMemo(
    () => createTerrainSurfaceMaterial(colorMap, normalMap),
    [colorMap, normalMap],
  );
}
