import heightMapUrl from "@/assets/image/terrain/heightMap.png";
import terrainLowUrl from "@/assets/image/terrain/low/forest_leaves_02_diffuse_1k.jpg";
import terrainMidUrl from "@/assets/image/terrain/mid/rocky_terrain_02_diff_1k.jpg";
import terrainHighUrl from "@/assets/image/terrain/high/rocks_ground_04_diff_1k.jpg";
import terrainLowNormalUrl from "@/assets/image/terrain/low/forest_leaves_02_nor_gl_1k.png";
import terrainMidNormalUrl from "@/assets/image/terrain/mid/rocky_terrain_02_nor_gl_1k.png";
import terrainHighNormalUrl from "@/assets/image/terrain/high/rocks_ground_04_nor_gl_1k.png";
import {
  TERRAIN_COLOR_GRASS,
  TERRAIN_COLOR_GRASS_START,
  TERRAIN_COLOR_ROCK,
  TERRAIN_COLOR_ROCK_START,
  TERRAIN_COLOR_SAND,
  TERRAIN_COLOR_SNOW,
  TERRAIN_COLOR_SNOW_START,
  TERRAIN_DEPTH,
  TERRAIN_MAX_HEIGHT,
  TERRAIN_POSITION,
  TERRAIN_ROTATION_Y,
  TERRAIN_SCALE,
  TERRAIN_SEGMENTS,
  TERRAIN_USE_NORMAL_MAP,
  TERRAIN_USE_TEXTURE,
  TERRAIN_WIDTH,
} from "@/constants/terrain";
import { useTerrainSurfaceMaterial } from "@/domain/terrainMaterial";
import {
  bakeTerrainColorMap,
  bakeTerrainNormalMap,
  configureTerrainBakeTexture,
  readTextureImageData,
  terrainHeightmapUv,
} from "@/domain/terrainSurface";
import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  Color,
  PlaneGeometry,
  TextureLoader,
  type Texture,
} from "three";

const SAND = new Color(TERRAIN_COLOR_SAND);
const GRASS = new Color(TERRAIN_COLOR_GRASS);
const ROCK = new Color(TERRAIN_COLOR_ROCK);
const SNOW = new Color(TERRAIN_COLOR_SNOW);
const tmp = new Color();

function sampleHeight(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  u: number,
  v: number,
) {
  const x = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
  const y = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))));
  return data[(y * width + x) * 4]! / 255;
}

function hash2(x: number, z: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** sand → grass → rock → snow (three.js procedural terrain 색 계층) */
function heightColor(h: number, out: Color) {
  if (h < TERRAIN_COLOR_GRASS_START) {
    return out.copy(SAND).lerp(GRASS, h / TERRAIN_COLOR_GRASS_START);
  }
  if (h < TERRAIN_COLOR_ROCK_START) {
    const t =
      (h - TERRAIN_COLOR_GRASS_START) /
      (TERRAIN_COLOR_ROCK_START - TERRAIN_COLOR_GRASS_START);
    return out.copy(GRASS).lerp(ROCK, t);
  }
  if (h < TERRAIN_COLOR_SNOW_START) {
    const t =
      (h - TERRAIN_COLOR_ROCK_START) /
      (TERRAIN_COLOR_SNOW_START - TERRAIN_COLOR_ROCK_START);
    return out.copy(ROCK).lerp(SNOW, t);
  }
  return out.copy(SNOW);
}

function readHeightmap(texture: Texture) {
  // 지형 형상용 — 원본 해상도 유지
  return readTextureImageData(texture, 0);
}

function buildTerrainGeometry(heightMap: Texture) {
  const heightImage = readHeightmap(heightMap);
  if (!heightImage) {
    return new PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH);
  }

  const geometry = new PlaneGeometry(
    TERRAIN_WIDTH,
    TERRAIN_DEPTH,
    TERRAIN_SEGMENTS,
    TERRAIN_SEGMENTS,
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const { data, width, height } = heightImage;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const { u, v } = terrainHeightmapUv(x, z, TERRAIN_WIDTH, TERRAIN_DEPTH);
    const h = sampleHeight(data, width, height, u, v);

    positions.setY(i, h * TERRAIN_MAX_HEIGHT);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  // normalMap용 tangent — 없으면 기복이 거의 안 보임
  geometry.computeTangents();
  return geometry;
}

function buildColoredTerrainGeometry(heightMap: Texture) {
  const heightImage = readHeightmap(heightMap);
  if (!heightImage) {
    return new PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH);
  }

  const { data, width, height } = heightImage;
  const geometry = buildTerrainGeometry(heightMap);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const { u, v } = terrainHeightmapUv(x, z, TERRAIN_WIDTH, TERRAIN_DEPTH);
    const h = sampleHeight(data, width, height, u, v);

    const noise = hash2(x * 0.17, z * 0.23);
    heightColor(h, tmp);
    const shade = 0.92 + noise * 0.08;
    colors[i * 3] = tmp.r * shade;
    colors[i * 3 + 1] = tmp.g * shade;
    colors[i * 3 + 2] = tmp.b * shade;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

export default function Terrain({ visible = true }: { visible?: boolean }) {
  const maxAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );

  const [
    heightMap,
    lowMap,
    midMap,
    highMap,
    lowNormal,
    midNormal,
    highNormal,
  ] = useLoader(TextureLoader, [
    heightMapUrl,
    terrainLowUrl,
    terrainMidUrl,
    terrainHighUrl,
    terrainLowNormalUrl,
    terrainMidNormalUrl,
    terrainHighNormalUrl,
  ]);

  const geometry = useMemo(
    () =>
      TERRAIN_USE_TEXTURE
        ? buildTerrainGeometry(heightMap)
        : buildColoredTerrainGeometry(heightMap),
    [heightMap],
  );

  const colorMap = useMemo(() => {
    if (!TERRAIN_USE_TEXTURE) return undefined;

    const heightImage = readHeightmap(heightMap);
    const lowImage = readTextureImageData(lowMap);
    const midImage = readTextureImageData(midMap);
    const highImage = readTextureImageData(highMap);

    if (!heightImage || !lowImage || !midImage || !highImage) return undefined;

    const texture =
      bakeTerrainColorMap(heightImage, lowImage, midImage, highImage) ??
      undefined;
    if (texture) configureTerrainBakeTexture(texture, maxAnisotropy);
    return texture;
  }, [heightMap, lowMap, midMap, highMap, maxAnisotropy]);

  const normalMap = useMemo(() => {
    if (!TERRAIN_USE_TEXTURE || !TERRAIN_USE_NORMAL_MAP) return undefined;

    const heightImage = readHeightmap(heightMap);
    const lowN = readTextureImageData(lowNormal);
    const midN = readTextureImageData(midNormal);
    const highN = readTextureImageData(highNormal);

    if (!heightImage || !lowN || !midN || !highN) return undefined;

    const texture =
      bakeTerrainNormalMap(heightImage, lowN, midN, highN) ?? undefined;
    if (texture) configureTerrainBakeTexture(texture, maxAnisotropy);
    return texture;
  }, [heightMap, lowNormal, midNormal, highNormal, maxAnisotropy]);

  useEffect(() => {
    return () => {
      colorMap?.dispose();
      normalMap?.dispose();
    };
  }, [colorMap, normalMap]);

  const material = useTerrainSurfaceMaterial(colorMap, normalMap);

  return (
    <mesh
      geometry={geometry}
      position={TERRAIN_POSITION}
      rotation={[0, TERRAIN_ROTATION_Y, 0]}
      scale={TERRAIN_SCALE}
      receiveShadow
      castShadow
      frustumCulled={false}
      material={material}
      visible={visible}
    />
  );
}
