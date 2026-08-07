import asphaltDiff from "@/assets/image/port/asphalt_02_diff_1k.jpg";
import asphaltNormal from "@/assets/image/port/asphalt_02_nor_gl_1k.png";
import asphaltRough from "@/assets/image/port/asphalt_02_rough_1k.jpg";
import { GROUND_X, GROUND_Y, GROUND_Z, TILE_SIZE } from "@/constants/ground";
import { createGroundSurfaceMaterial } from "@/domain/groundMaterial";
import { resolveGroundRepeat } from "@/domain/groundTexture";
import { useLoader } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type Vector3Tuple,
} from "three";

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  /** diffuse — 미지정 시 asphalt_02 */
  texture?: string;
  /** normal — asphalt 기본일 때만 자동 */
  normalMap?: string;
  /** roughness — asphalt 기본일 때만 자동 */
  roughnessMap?: string;
  /** UV repeat — 미지정 시 scale·회전·tileSize로 자동 계산 */
  repeat?: [number, number];
  /** 텍스처 UV 회전 (라디안) */
  textureRotation?: number;
  /** repeat 자동 계산 시 1타일 월드 크기 */
  tileSize?: number;
};

function configureGroundMap(
  source: Texture,
  repeatU: number,
  repeatV: number,
  textureRotation: number,
  colorSpace?: typeof SRGBColorSpace,
) {
  const cloned = source.clone();
  cloned.wrapS = cloned.wrapT = RepeatWrapping;
  cloned.repeat.set(repeatU, repeatV);
  cloned.center.set(0.5, 0.5);
  cloned.rotation = textureRotation;
  if (colorSpace) cloned.colorSpace = colorSpace;
  cloned.needsUpdate = true;
  return cloned;
}

export default function Ground({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  texture = asphaltDiff,
  normalMap,
  roughnessMap,
  repeat,
  textureRotation = 0,
  tileSize = TILE_SIZE,
}: GroundProps) {
  const meshRef = useRef<Mesh>(null);

  const resolvedNormal =
    normalMap ?? (texture === asphaltDiff ? asphaltNormal : undefined);
  const resolvedRough =
    roughnessMap ?? (texture === asphaltDiff ? asphaltRough : undefined);

  const urls = [texture, resolvedNormal, resolvedRough].filter(
    (url): url is string => Boolean(url),
  );
  const loaded = useLoader(TextureLoader, urls);

  const [map, normal, rough] = useMemo(() => {
    const [repeatU, repeatV] = resolveGroundRepeat(
      scale,
      rotation[1] ?? 0,
      textureRotation,
      tileSize,
      repeat,
    );

    const diffTex = loaded[0]!;
    const normalTex = resolvedNormal ? loaded[1] : undefined;
    const roughTex = resolvedRough
      ? loaded[resolvedNormal ? 2 : 1]
      : undefined;

    return [
      configureGroundMap(
        diffTex,
        repeatU,
        repeatV,
        textureRotation,
        SRGBColorSpace,
      ),
      normalTex
        ? configureGroundMap(normalTex, repeatU, repeatV, textureRotation)
        : undefined,
      roughTex
        ? configureGroundMap(roughTex, repeatU, repeatV, textureRotation)
        : undefined,
    ] as const;
  }, [
    loaded,
    resolvedNormal,
    resolvedRough,
    repeat,
    rotation,
    scale,
    textureRotation,
    tileSize,
  ]);

  const material = useMemo(
    () =>
      createGroundSurfaceMaterial({
        map,
        normalMap: normal,
        roughnessMap: rough,
      }),
    [map, normal, rough],
  );

  useLayoutEffect(() => {
    const geometry = meshRef.current?.geometry;
    if (!geometry || !normal) return;
    if (!geometry.getAttribute("tangent")) {
      geometry.computeTangents();
    }
  }, [normal]);

  useLayoutEffect(() => {
    return () => {
      map.dispose();
      normal?.dispose();
      rough?.dispose();
      material.dispose();
    };
  }, [map, normal, rough, material]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      material={material}
    >
      <boxGeometry args={[GROUND_X, GROUND_Y, GROUND_Z]} />
    </mesh>
  );
}
