import {
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  type Texture,
} from "three";
import {
  OCEAN_HEIGHT_SCALE,
  OCEAN_SHORE_FOAM,
  OCEAN_SHORE_REFLECT,
  OCEAN_SHORE_WET,
  OCEAN_SHORE_WIDTH,
  OCEAN_SIM_EXTENT,
} from "@/constants/ocean";

function emptyLandTexture() {
  const texture = new DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.needsUpdate = true;
  return texture;
}

const emptyLand = emptyLandTexture();
const emptyHeight = emptyLandTexture();

/** Water·Ground가 같은 유니폼 객체를 공유해 매 프레임 값이 같이 갱신됨 */
export const waterSimUniforms = {
  tHeight: { value: emptyHeight as Texture },
  tLand: { value: emptyLand as Texture },
  uSimExtent: { value: OCEAN_SIM_EXTENT },
  uHeightScale: { value: OCEAN_HEIGHT_SCALE },
  uShoreFoam: { value: OCEAN_SHORE_FOAM },
  uShoreWet: { value: OCEAN_SHORE_WET },
  uShoreReflect: { value: OCEAN_SHORE_REFLECT },
  uShoreWidth: { value: OCEAN_SHORE_WIDTH },
  uLandTexel: { value: new Vector2(1, 1) },
};

export function bindHeightTexture(texture: Texture | null) {
  waterSimUniforms.tHeight.value = texture ?? emptyHeight;
}

export function bindLandTexture(texture: Texture, size = 1) {
  waterSimUniforms.tLand.value = texture;
  waterSimUniforms.uLandTexel.value.set(1 / size, 1 / size);
}

export function resetLandTexture() {
  waterSimUniforms.tLand.value = emptyLand;
  waterSimUniforms.uLandTexel.value.set(1, 1);
}
