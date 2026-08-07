import {
  TERRAIN_BAKE_SIZE,
  TERRAIN_DEPTH,
  TERRAIN_HIGH_TEXTURE_DETAIL_TILE_SIZE,
  TERRAIN_HIGH_TEXTURE_TILE_SIZE,
  TERRAIN_LOW_BLEND_END,
  TERRAIN_LOW_BLEND_START,
  TERRAIN_LOW_TEXTURE_DETAIL_TILE_SIZE,
  TERRAIN_LOW_TEXTURE_TILE_SIZE,
  TERRAIN_MID_BLEND_END,
  TERRAIN_MID_BLEND_START,
  TERRAIN_MID_TEXTURE_DETAIL_TILE_SIZE,
  TERRAIN_MID_TEXTURE_TILE_SIZE,
  TERRAIN_NOISE_ITERATIONS,
  TERRAIN_NORMAL_BAKE_SIZE,
  TERRAIN_POSITION_FREQUENCY,
  TERRAIN_SOURCE_MAX_SIZE,
  TERRAIN_STRENGTH,
  TERRAIN_TEXTURE_ANISOTROPY,
  TERRAIN_TEXTURE_USE_MIPMAPS,
  TERRAIN_WARP_FREQUENCY,
  TERRAIN_WARP_STRENGTH,
  TERRAIN_WIDTH,
} from "@/constants/terrain";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  type Texture,
} from "three";

export type TextureImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** diffuse/jpg — bake용으로 maxSize까지 축소해 읽기 */
export function readTextureImageData(
  texture: Texture,
  maxSize = TERRAIN_SOURCE_MAX_SIZE,
): TextureImageData | null {
  const image = texture.image as CanvasImageSource & {
    width?: number;
    height?: number;
  };

  if (!image || !image.width || !image.height) return null;

  const scale =
    maxSize > 0
      ? Math.min(1, maxSize / Math.max(image.width, image.height))
      : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { data, width, height };
}

/** EXR DataTexture → bake용 8bit 이미지 (필요 시 축소) */
export function readExrTextureImageData(
  texture: Texture,
  maxSize = TERRAIN_SOURCE_MAX_SIZE,
): TextureImageData | null {
  const image = texture.image as {
    data?: Float32Array | Uint16Array | Uint8Array;
    width?: number;
    height?: number;
  };

  if (!image?.data || !image.width || !image.height) return null;

  const srcW = image.width;
  const srcH = image.height;
  const src = image.data;
  const channels = Math.max(1, Math.floor(src.length / (srcW * srcH)));

  const scale =
    maxSize > 0 ? Math.min(1, maxSize / Math.max(srcW, srcH)) : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const data = new Uint8ClampedArray(width * height * 4);

  const sample = (x: number, y: number) => {
    const px = Math.min(srcW - 1, Math.max(0, x));
    const py = Math.min(srcH - 1, Math.max(0, y));
    const i = (py * srcW + px) * channels;
    const r = Number(src[i] ?? 0);
    const g = Number(src[i + 1] ?? r);
    const b = Number(src[i + 2] ?? r);
    // EXR normal은 대개 0~1. 가끔 -1~1이면 remap
    const toByte = (v: number) => {
      const n = v < 0 ? (v + 1) * 0.5 : v > 1 ? v / Math.max(v, 1) : v;
      return Math.min(255, Math.max(0, Math.round(n * 255)));
    };
    return [toByte(r), toByte(g), toByte(b)] as const;
  };

  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y / Math.max(1, height - 1)) * (srcH - 1));
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x / Math.max(1, width - 1)) * (srcW - 1));
      const [r, g, b] = sample(sx, sy);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  return { data, width, height };
}

function hash2(x: number, z: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** value noise — 격자 보간 */
function valueNoise2(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);

  const n00 = hash2(x0, z0);
  const n10 = hash2(x0 + 1, z0);
  const n01 = hash2(x0, z0 + 1);
  const n11 = hash2(x0 + 1, z0 + 1);

  const a = n00 * (1 - sx) + n10 * sx;
  const b = n01 * (1 - sx) + n11 * sx;
  return a * (1 - sz) + b * sz;
}

/** fbm — 옥타브 누적 (-1~1 근처) */
function fbm2(x: number, z: number, iterations = TERRAIN_NOISE_ITERATIONS) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;

  const count = Math.max(1, Math.floor(iterations));
  for (let i = 0; i < count; i++) {
    sum += (valueNoise2(x * freq, z * freq) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return norm > 0 ? sum / norm : 0;
}

/** 텍스처 샘플용 domain warp — 타일 격자 깨기 */
function warpTerrainSamplePos(x: number, z: number) {
  const f = TERRAIN_POSITION_FREQUENCY;
  const wf = TERRAIN_WARP_FREQUENCY;
  const ws = TERRAIN_WARP_STRENGTH;

  const wx = fbm2(x * f * wf, z * f * wf) * ws;
  const wz = fbm2(x * f * wf + 19.1, z * f * wf + 7.3) * ws;

  return { x: x + wx, z: z + wz };
}

/** 최종 색에 미세 명암·톤 노이즈 */
function applyTextureColorNoise(
  r: number,
  g: number,
  b: number,
  x: number,
  z: number,
) {
  const f = TERRAIN_POSITION_FREQUENCY;
  const n = fbm2(x * f * 1.7 + 3.1, z * f * 1.7 + 11.4);
  const shade = 1 + n * TERRAIN_STRENGTH;
  const tint = fbm2(x * f * 0.6 + 41.2, z * f * 0.6 + 8.7) * TERRAIN_STRENGTH * 0.35;

  return [
    Math.min(1, Math.max(0, r * shade + tint * 0.15)),
    Math.min(1, Math.max(0, g * shade + tint * 0.05)),
    Math.min(1, Math.max(0, b * shade - tint * 0.08)),
  ] as const;
}

function wrapRepeat(value: number) {
  return value - Math.floor(value);
}

function wrapClamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** bilinear — 타일 경계도 repeat/clamp에 맞게 샘플 */
function samplePixelBilinear(
  image: TextureImageData,
  u: number,
  v: number,
  repeat: "clamp" | "repeat",
) {
  const w = image.width;
  const h = image.height;

  const fu = repeat === "repeat" ? wrapRepeat(u) : wrapClamp(u);
  const fv = repeat === "repeat" ? wrapRepeat(v) : wrapClamp(v);

  const x = fu * (w - 1);
  const y = (1 - fv) * (h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const at = (px: number, py: number) => {
    const i = (py * w + px) * 4;
    return [
      image.data[i]! / 255,
      image.data[i + 1]! / 255,
      image.data[i + 2]! / 255,
    ] as const;
  };

  const c00 = at(x0, y0);
  const c10 = at(x1, y0);
  const c01 = at(x0, y1);
  const c11 = at(x1, y1);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return [
    lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty),
    lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty),
    lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty),
  ] as const;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function terrainHeightmapUv(
  x: number,
  z: number,
  width: number,
  depth: number,
) {
  return {
    u: x / width + 0.5,
    v: 1 - (z / depth + 0.5),
  };
}

function terrainTiledUvLayer(
  x: number,
  z: number,
  tileSize: number,
  rot: number,
  offsetU: number,
  offsetV: number,
) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rx = x * cos - z * sin;
  const rz = x * sin + z * cos;
  const scale = 1 / tileSize;

  return {
    u: (rx * 0.91 + rz * 0.24) * scale + offsetU,
    v: (rz * 0.87 - rx * 0.17) * scale + offsetV,
  };
}

function terrainBandTiledUv(
  x: number,
  z: number,
  tileSize: number,
  detailTileSize: number,
  seed: number,
) {
  const n = hash2(x * (0.033 + seed * 0.008), z * (0.029 + seed * 0.007));

  const macro = terrainTiledUvLayer(
    x,
    z,
    tileSize,
    0.18 + seed * 0.13 + n * 0.1,
    seed * 0.35,
    seed * 0.22,
  );
  const detail = terrainTiledUvLayer(
    x + 19.7 + seed * 7.6,
    z + 11.2 + seed * 3.4,
    detailTileSize,
    -0.22 + seed * 0.07 + n * 0.08,
    hash2(x, z) * 0.15,
    hash2(z, x) * 0.15,
  );

  return {
    u: macro.u * 0.62 + detail.u * 0.38,
    v: macro.v * 0.62 + detail.v * 0.38,
  };
}

function terrainLowTiledUv(x: number, z: number) {
  return terrainBandTiledUv(
    x,
    z,
    TERRAIN_LOW_TEXTURE_TILE_SIZE,
    TERRAIN_LOW_TEXTURE_DETAIL_TILE_SIZE,
    0,
  );
}

function terrainMidTiledUv(x: number, z: number) {
  return terrainBandTiledUv(
    x,
    z,
    TERRAIN_MID_TEXTURE_TILE_SIZE,
    TERRAIN_MID_TEXTURE_DETAIL_TILE_SIZE,
    1,
  );
}

export function terrainTiledUv(x: number, z: number) {
  return terrainBandTiledUv(
    x,
    z,
    TERRAIN_HIGH_TEXTURE_TILE_SIZE,
    TERRAIN_HIGH_TEXTURE_DETAIL_TILE_SIZE,
    2,
  );
}

function sampleBandNatural(
  image: TextureImageData,
  x: number,
  z: number,
  uvFn: (x: number, z: number) => { u: number; v: number },
  secondaryScale: number,
) {
  const warped = warpTerrainSamplePos(x, z);
  const primary = uvFn(warped.x, warped.z);
  const secondary = uvFn(warped.x * 1.09 + 23.5, warped.z * 0.94 + 17.8);

  const a = samplePixelBilinear(image, primary.u, primary.v, "repeat");
  const b = samplePixelBilinear(
    image,
    secondary.u * secondaryScale,
    secondary.v * secondaryScale,
    "repeat",
  );
  const mix = 0.27 + hash2(x * 0.08, z * 0.06) * 0.17;

  return [
    a[0] * (1 - mix) + b[0] * mix,
    a[1] * (1 - mix) + b[1] * mix,
    a[2] * (1 - mix) + b[2] * mix,
  ] as const;
}

/** high — terrain.png dual-scale 타일 */
function sampleHighNatural(image: TextureImageData, x: number, z: number) {
  return sampleBandNatural(image, x, z, terrainTiledUv, 1.18);
}

/** mid — mid 전용 텍스처 dual-scale 타일 */
function sampleMidNatural(image: TextureImageData, x: number, z: number) {
  return sampleBandNatural(image, x, z, terrainMidTiledUv, 1.16);
}

/** low — low 전용 텍스처 dual-scale 타일 */
function sampleLowNatural(image: TextureImageData, x: number, z: number) {
  return sampleBandNatural(image, x, z, terrainLowTiledUv, 1.14);
}

export function blendTerrainTextureColor(
  height: number,
  lowImage: TextureImageData,
  midImage: TextureImageData,
  highImage: TextureImageData,
  x: number,
  z: number,
) {
  const [lr, lg, lb] = sampleLowNatural(lowImage, x, z);
  const [mr, mg, mb] = sampleMidNatural(midImage, x, z);
  const [hr, hg, hb] = sampleHighNatural(highImage, x, z);

  const midWeight = terrainMidBlendWeight(height, x, z);
  const highWeight = terrainHighBlendWeight(height, x, z);

  const wLow = 1 - midWeight;
  const wMid = midWeight * (1 - highWeight);
  const wHigh = highWeight;

  return applyTextureColorNoise(
    lr * wLow + mr * wMid + hr * wHigh,
    lg * wLow + mg * wMid + hg * wHigh,
    lb * wLow + mb * wMid + hb * wHigh,
    x,
    z,
  );
}

function normalizeNormal(nx: number, ny: number, nz: number) {
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len] as const;
}

function rgbToNormal(r: number, g: number, b: number) {
  return normalizeNormal(r * 2 - 1, g * 2 - 1, b * 2 - 1);
}

function normalToRgb(nx: number, ny: number, nz: number) {
  return [
    (nx + 1) * 0.5,
    (ny + 1) * 0.5,
    (nz + 1) * 0.5,
  ] as const;
}

function sampleNormalBilinear(
  image: TextureImageData,
  u: number,
  v: number,
) {
  const [r, g, b] = samplePixelBilinear(image, u, v, "repeat");
  return rgbToNormal(r, g, b);
}

function sampleBandNormalNatural(
  image: TextureImageData,
  x: number,
  z: number,
  uvFn: (x: number, z: number) => { u: number; v: number },
) {
  const warped = warpTerrainSamplePos(x, z);
  const primary = uvFn(warped.x, warped.z);
  const secondary = uvFn(warped.x * 1.09 + 23.5, warped.z * 0.94 + 17.8);

  const a = sampleNormalBilinear(image, primary.u, primary.v);
  const b = sampleNormalBilinear(
    image,
    secondary.u * 1.18,
    secondary.v * 1.18,
  );
  const mix = 0.28 + hash2(x * 0.08, z * 0.06) * 0.18;

  return normalizeNormal(
    a[0] * (1 - mix) + b[0] * mix,
    a[1] * (1 - mix) + b[1] * mix,
    a[2] * (1 - mix) + b[2] * mix,
  );
}

function terrainMidBlendWeight(height: number, x: number, z: number) {
  const heightJitter =
    fbm2(
      x * TERRAIN_POSITION_FREQUENCY * 0.8,
      z * TERRAIN_POSITION_FREQUENCY * 0.8,
    ) * 0.08;
  return smoothstep(
    TERRAIN_LOW_BLEND_START,
    TERRAIN_LOW_BLEND_END,
    height + heightJitter,
  );
}

function terrainHighBlendWeight(height: number, x: number, z: number) {
  const heightJitter =
    fbm2(
      x * TERRAIN_POSITION_FREQUENCY * 0.8 + 5.2,
      z * TERRAIN_POSITION_FREQUENCY * 0.8 + 2.7,
    ) * 0.08;
  return smoothstep(
    TERRAIN_MID_BLEND_START,
    TERRAIN_MID_BLEND_END,
    height + heightJitter,
  );
}

export function blendTerrainNormal(
  height: number,
  lowNormalImage: TextureImageData,
  midNormalImage: TextureImageData,
  highNormalImage: TextureImageData,
  x: number,
  z: number,
) {
  const [lnx, lny, lnz] = sampleBandNormalNatural(
    lowNormalImage,
    x,
    z,
    terrainLowTiledUv,
  );
  const [mnx, mny, mnz] = sampleBandNormalNatural(
    midNormalImage,
    x,
    z,
    terrainMidTiledUv,
  );
  const [hnx, hny, hnz] = sampleBandNormalNatural(
    highNormalImage,
    x,
    z,
    terrainTiledUv,
  );

  const midWeight = terrainMidBlendWeight(height, x, z);
  const highWeight = terrainHighBlendWeight(height, x, z);
  const wLow = 1 - midWeight;
  const wMid = midWeight * (1 - highWeight);
  const wHigh = highWeight;

  return normalizeNormal(
    lnx * wLow + mnx * wMid + hnx * wHigh,
    lny * wLow + mny * wMid + hny * wHigh,
    lnz * wLow + mnz * wMid + hnz * wHigh,
  );
}

function getTerrainBakeSize(size = TERRAIN_BAKE_SIZE) {
  const bakeWidth = size;
  const bakeHeight = Math.max(
    1,
    Math.round(size * (TERRAIN_DEPTH / TERRAIN_WIDTH)),
  );
  return { bakeWidth, bakeHeight };
}

function createBakeCanvas(size = TERRAIN_BAKE_SIZE) {
  const { bakeWidth, bakeHeight } = getTerrainBakeSize(size);
  const canvas = document.createElement("canvas");
  canvas.width = bakeWidth;
  canvas.height = bakeHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  return {
    canvas,
    ctx,
    bakeWidth,
    bakeHeight,
    imageData: ctx.createImageData(bakeWidth, bakeHeight),
  };
}

/** bake 텍스처 필터 — anisotropy / mip 설정 */
export function configureTerrainBakeTexture(
  texture: Texture,
  maxAnisotropy: number,
) {
  texture.generateMipmaps = TERRAIN_TEXTURE_USE_MIPMAPS;
  texture.minFilter = TERRAIN_TEXTURE_USE_MIPMAPS
    ? LinearMipmapLinearFilter
    : LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy =
    TERRAIN_TEXTURE_ANISOTROPY > 0
      ? Math.min(TERRAIN_TEXTURE_ANISOTROPY, maxAnisotropy)
      : maxAnisotropy;
  texture.needsUpdate = true;
}

function sampleHeightFromImage(
  image: TextureImageData,
  x: number,
  z: number,
  width: number,
  depth: number,
) {
  const { u, v } = terrainHeightmapUv(x, z, width, depth);
  const px = Math.min(
    image.width - 1,
    Math.max(0, Math.floor(u * (image.width - 1))),
  );
  const py = Math.min(
    image.height - 1,
    Math.max(0, Math.floor(v * (image.height - 1))),
  );
  return image.data[(py * image.width + px) * 4]! / 255;
}

/** low/mid/high blend를 고해상도 color map으로 bake — GPU per-pixel 샘플링 */
export function bakeTerrainColorMap(
  heightImage: TextureImageData,
  lowImage: TextureImageData,
  midImage: TextureImageData,
  highImage: TextureImageData,
) {
  const bake = createBakeCanvas();
  if (!bake) return null;

  const { ctx, bakeWidth, bakeHeight, imageData } = bake;
  const pixels = imageData.data;

  for (let py = 0; py < bakeHeight; py++) {
    const v = py / Math.max(1, bakeHeight - 1);
    const z = (v - 0.5) * TERRAIN_DEPTH;

    for (let px = 0; px < bakeWidth; px++) {
      const u = px / Math.max(1, bakeWidth - 1);
      const x = (u - 0.5) * TERRAIN_WIDTH;

      const height = sampleHeightFromImage(
        heightImage,
        x,
        z,
        TERRAIN_WIDTH,
        TERRAIN_DEPTH,
      );
      const [r, g, b] = blendTerrainTextureColor(
        height,
        lowImage,
        midImage,
        highImage,
        x,
        z,
      );

      const i = (py * bakeWidth + px) * 4;
      pixels[i] = Math.round(r * 255);
      pixels[i + 1] = Math.round(g * 255);
      pixels[i + 2] = Math.round(b * 255);
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(bake.canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** low/mid/high normal을 높이 blend 후 bake (낮은 해상도 권장) */
export function bakeTerrainNormalMap(
  heightImage: TextureImageData,
  lowNormalImage: TextureImageData,
  midNormalImage: TextureImageData,
  highNormalImage: TextureImageData,
) {
  const bake = createBakeCanvas(TERRAIN_NORMAL_BAKE_SIZE);
  if (!bake) return null;

  const { ctx, bakeWidth, bakeHeight, imageData } = bake;
  const pixels = imageData.data;

  for (let py = 0; py < bakeHeight; py++) {
    const v = py / Math.max(1, bakeHeight - 1);
    const z = (v - 0.5) * TERRAIN_DEPTH;

    for (let px = 0; px < bakeWidth; px++) {
      const u = px / Math.max(1, bakeWidth - 1);
      const x = (u - 0.5) * TERRAIN_WIDTH;

      const height = sampleHeightFromImage(
        heightImage,
        x,
        z,
        TERRAIN_WIDTH,
        TERRAIN_DEPTH,
      );
      const [nx, ny, nz] = blendTerrainNormal(
        height,
        lowNormalImage,
        midNormalImage,
        highNormalImage,
        x,
        z,
      );
      const [r, g, b] = normalToRgb(nx, ny, nz);

      const i = (py * bakeWidth + px) * 4;
      pixels[i] = Math.round(r * 255);
      pixels[i + 1] = Math.round(g * 255);
      pixels[i + 2] = Math.round(b * 255);
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(bake.canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
