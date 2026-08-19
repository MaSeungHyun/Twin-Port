import {
  Box3,
  Color,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { OCEAN_LAND_MAX_Y, OCEAN_LAND_MIN_Y } from "@/constants/ocean";

const BAKE_VERT = /* glsl */ `
uniform float uExtent;
uniform float uMinY;
uniform float uMaxY;
varying float vKeep;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vKeep = step(uMinY, world.y) * step(world.y, uMaxY);
  vec2 clip = vec2(world.x / uExtent, world.z / uExtent);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

const BAKE_FRAG = /* glsl */ `
varying float vKeep;

void main() {
  if (vKeep < 0.5) discard;
  gl_FragColor = vec4(1.0);
}
`;

function namesOf(mesh: Mesh) {
  return [mesh.name, mesh.parent?.name ?? "", mesh.geometry?.name ?? ""];
}

function skipLandBake(mesh: Mesh) {
  const names = namesOf(mesh);
  if (names.some((name) => /water|sea|ocean/i.test(name))) return true;
  if (names.some((name) => /^ship/i.test(name))) return true;
  if (
    names.some((name) => /^cube$/i.test(name)) &&
    !names.some((name) => /cube\.002/i.test(name))
  ) {
    return true;
  }
  return false;
}

const _box = new Box3();
const _size = new Vector3();

/** 수면 아래 깔린 넓은 바닥·수면 평면은 항만 수역을 육지로 덮지 않게 제외 */
function isHarborFloor(mesh: Mesh) {
  _box.setFromObject(mesh);
  if (_box.isEmpty()) return true;
  if (_box.max.y < OCEAN_LAND_MIN_Y) return true;
  if (_box.min.y > OCEAN_LAND_MAX_Y) return true;
  _box.getSize(_size);
  const xzArea = _size.x * _size.z;
  return _size.y < 0.55 && xzArea > 600;
}

function makeTarget(size: number) {
  const target = new WebGLRenderTarget(size, size, {
    type: UnsignedByteType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = NoColorSpace;
  return target;
}

/**
 * 수면 높이의 안벽·갑판만 육지로 구움.
 * 해저·넓은 바닥을 넣으면 항만 한가운데 물결이 전부 꺼진다.
 */
export function bakeLandMask(
  renderer: WebGLRenderer,
  root: Object3D,
  size: number,
  extent: number,
) {
  const baked = makeTarget(size);
  const dummyCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeMaterial = new ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    uniforms: {
      uExtent: { value: extent },
      uMinY: { value: OCEAN_LAND_MIN_Y },
      uMaxY: { value: OCEAN_LAND_MAX_Y },
    },
    depthTest: false,
    depthWrite: false,
  });

  const bakeScene = new Scene();
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  clone.traverse((child) => {
    if (!(child instanceof Mesh) || skipLandBake(child) || !child.visible) {
      if (child instanceof Mesh) child.visible = false;
      return;
    }
    if (isHarborFloor(child)) {
      child.visible = false;
      return;
    }
    child.material = bakeMaterial;
    child.frustumCulled = false;
  });
  bakeScene.add(clone);

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  const prevXr = renderer.xr.enabled;
  const viewport = new Vector4();
  renderer.getViewport(viewport);
  const prevColor = new Color();
  renderer.getClearColor(prevColor);
  const prevAlpha = renderer.getClearAlpha();

  try {
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    renderer.setViewport(0, 0, size, size);
    renderer.setRenderTarget(baked);
    renderer.clear();
    renderer.render(bakeScene, dummyCamera);
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(viewport);
    renderer.autoClear = prevAutoClear;
    renderer.xr.enabled = prevXr;
    renderer.setClearColor(prevColor, prevAlpha);
    bakeScene.remove(clone);
    bakeMaterial.dispose();
  }

  return baked;
}
