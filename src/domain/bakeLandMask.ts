import {
  Box3,
  Color,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from "three";
import {
  OCEAN_LAND_DILATE,
  OCEAN_LAND_MAX_Y,
  OCEAN_LAND_MIN_Y,
} from "@/constants/ocean";
import { SIM_QUAD_VERT } from "./heightfieldShaders";

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

const DILATE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tInput;
uniform vec2 delta;
varying vec2 coord;

void main() {
  float land = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      land = max(land, texture2D(tInput, coord + vec2(float(x), float(y)) * delta).r);
    }
  }
  gl_FragColor = vec4(land);
}
`;

function namesOf(mesh: Mesh) {
  return [mesh.name, mesh.parent?.name ?? "", mesh.geometry?.name ?? ""];
}

function skipLandBake(mesh: Mesh) {
  if (mesh.name.endsWith("-occupancy")) return true;
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

/** 수면보다 아래에 있는 메시만 제외. 갑판·야드는 육지로 유지 */
function isUnderwaterSlab(mesh: Mesh) {
  _box.setFromObject(mesh);
  if (_box.isEmpty()) return true;
  if (_box.max.y < OCEAN_LAND_MIN_Y) return true;
  if (_box.min.y > OCEAN_LAND_MAX_Y) return true;
  return false;
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
 * 해저만 빼고, 야드 갑판은 남겨 파동이 Ground 너머로 새지 않게 한다.
 */
export function bakeLandMask(
  renderer: WebGLRenderer,
  root: Object3D,
  size: number,
  extent: number,
) {
  const baked = makeTarget(size);
  const dilated = makeTarget(size);
  const dummyCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeMaterial = new ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    uniforms: {
      uExtent: { value: extent },
      uMinY: { value: OCEAN_LAND_MIN_Y },
      uMaxY: { value: OCEAN_LAND_MAX_Y },
    },
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  });
  const dilateMaterial = new ShaderMaterial({
    vertexShader: SIM_QUAD_VERT,
    fragmentShader: DILATE_FRAG,
    uniforms: {
      tInput: { value: null },
      delta: { value: new Vector2(1 / size, 1 / size) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), dilateMaterial);
  const dilateScene = new Scene();
  dilateScene.add(quad);

  const bakeScene = new Scene();
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  clone.traverse((child) => {
    if (!(child instanceof Mesh) || skipLandBake(child) || !child.visible) {
      if (child instanceof Mesh) child.visible = false;
      return;
    }
    if (isUnderwaterSlab(child)) {
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

    let read = baked;
    let write = dilated;
    const passes = Math.max(0, OCEAN_LAND_DILATE);
    for (let i = 0; i < passes; i++) {
      dilateMaterial.uniforms.tInput.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.clear();
      renderer.render(dilateScene, dummyCamera);
      const next = read;
      read = write;
      write = next;
    }

    if (read !== dilated) {
      dilated.dispose();
      return baked;
    }
    baked.dispose();
    return dilated;
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(viewport);
    renderer.autoClear = prevAutoClear;
    renderer.xr.enabled = prevXr;
    renderer.setClearColor(prevColor, prevAlpha);
    bakeScene.remove(clone);
    bakeMaterial.dispose();
    dilateMaterial.dispose();
    quad.geometry.dispose();
  }
}
