import { loadMark } from "@/debug/loadTiming";
import { compileInClippingGroups } from "@/domain/compileObject";
import { setOutlineWarmer } from "@/domain/outlineWarm";
import { afterNextFrame } from "@/domain/yieldToMain";
import { useRendererStore } from "@/stores/renderer";
import { useShipDebugStore } from "@/stores/shipDebug";
import { useViewportStore } from "@/stores/viewport";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  DepthTexture,
  FloatType,
  HalfFloatType,
  LinearSRGBColorSpace,
  NoToneMapping,
  SRGBColorSpace,
  Vector2,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type ToneMapping,
} from "three";
import { NodeMaterial, QuadMesh, RenderTarget } from "three/webgpu";
import {
  abs,
  float,
  Fn,
  max,
  min,
  mix,
  mrt,
  normalView,
  output,
  perspectiveDepthToViewZ,
  renderOutput,
  select,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

/**
 * 외곽선 모드 (WebGPU 전용). 와이어 버튼이 이 모드를 켠다.
 * 씬을 별도 렌더 타깃(색·노멀+유지 마스크·깊이)에 그린 뒤, 깊이·노멀 경계만 선으로 화면에 합성한다.
 * 선택·호버·고장 외곽선 프록시(userData.outlineKeep)가 덮은 픽셀은 원래 색을 그대로 보인다.
 * 이 렌더 타깃 문맥의 셰이더는 로딩 예열(SceneWarmup)에서 객체마다 같이 컴파일하고(setOutlineWarmer),
 * 관제 시작 뒤 백그라운드 예열은 그 뒤에 생긴 객체만 보충한다. 전환은 렌더 경로만 바꾼다.
 */

/** DESIGN_SPEC 토큰: bg #0A1219, info-bright #8CC4FF (화면 sRGB 값 그대로 출력) */
const BG = vec3(0x0a / 255, 0x12 / 255, 0x19 / 255);
const LINE = vec3(0x8c / 255, 0xc4 / 255, 0xff / 255);
const LINE_ALPHA_NEAR = 0.6;
const LINE_ALPHA_FAR = 0.4;
const FADE_NEAR_M = 400;
const FADE_FAR_M = 4000;
/** 1/깊이의 2차 차분 / 1/깊이. 평면에서는 0이라 실루엣·볼록 모서리만 남는다. */
const DEPTH_EDGE = 0.02;
/** 이웃 노멀과의 1 - cos. 약 35° 이상 꺾인 모서리 */
const NORMAL_EDGE = 0.18;
const OUTLINE_WARM_DELAY_MS = 2500;
const OUTLINE_WARM_SLICE_MS = 8;
/** 반사·바다처럼 늦게 생기는 숨김 대상을 다시 찾는 간격 */
const HIDDEN_REFRESH_FRAMES = 60;

let warmStarted = false;

export function outlineHidden(o: Object3D) {
  return o.userData?.noWireframe === true || o.userData?.outlineHidden === true;
}

type OutlineRig = {
  rt: RenderTarget;
  mrtNode: ReturnType<typeof mrt>;
  quad: QuadMesh;
  texel: { value: Vector2 };
  near: { value: number };
  far: { value: number };
};

function createRig(toneMapping: ToneMapping): OutlineRig {
  const rt = new RenderTarget(1, 1, { count: 2, type: HalfFloatType, depthBuffer: true });
  rt.textures[0]!.name = "output";
  rt.textures[1]!.name = "normal";
  rt.depthTexture = new DepthTexture(1, 1);
  rt.depthTexture.type = FloatType;

  const keep = uniform(0).onObjectUpdate(({ object }) => (object?.userData?.outlineKeep === true ? 1 : 0));
  const mrtNode = mrt({ output, normal: vec4(normalView, keep) });

  const texel = uniform(new Vector2(1, 1));
  const near = uniform(1);
  const far = uniform(50000);
  const colorTex = texture(rt.textures[0]!);
  const normalTex = texture(rt.textures[1]!);
  const depthTex = texture(rt.depthTexture);

  const composite = Fn(() => {
    const p = uv();
    const at = (dx: number, dy: number) => p.add(texel.mul(vec2(dx, dy)));
    const invZ = (dx: number, dy: number) =>
      float(1).div(perspectiveDepthToViewZ(depthTex.sample(at(dx, dy)).r, near, far).negate());
    const d0 = depthTex.sample(p).r;
    const wc = invZ(0, 0);
    const wl = invZ(-1, 0), wr = invZ(1, 0), wu = invZ(0, -1), wd = invZ(0, 1);
    // 가까운 쪽 픽셀만(2차 차분이 음수) 표시해 실루엣이 1px 이 되게 한다.
    const lap = min(wl.add(wr).sub(wc.mul(2)), wu.add(wd).sub(wc.mul(2))).div(wc);
    const depthEdge = smoothstep(DEPTH_EDGE, DEPTH_EDGE * 2, lap.negate());
    const nc = normalTex.sample(p);
    const nr = normalTex.sample(at(1, 0)).xyz;
    const nd = normalTex.sample(at(0, 1)).xyz;
    const bend = max(float(1).sub(nc.xyz.dot(nr)), float(1).sub(nc.xyz.dot(nd)));
    const normalEdge = smoothstep(NORMAL_EDGE, NORMAL_EDGE * 1.6, bend);
    const z = float(1).div(wc);
    const alpha = mix(float(LINE_ALPHA_NEAR), float(LINE_ALPHA_FAR), smoothstep(FADE_NEAR_M, FADE_FAR_M, z));
    const hasSurface = d0.lessThan(1);
    const edge = select(hasSurface, max(depthEdge, normalEdge), float(0));
    const lines = mix(BG, LINE, edge.mul(alpha));
    const original = renderOutput(colorTex.sample(p), toneMapping, SRGBColorSpace).rgb;
    const keepMask = select(hasSurface, abs(nc.w).min(1), float(0));
    return vec4(mix(lines, original, keepMask), 1);
  });

  const material = new NodeMaterial();
  material.name = "OutlineComposite";
  material.fragmentNode = composite();
  const quad = new QuadMesh(material);
  quad.name = "Outline Composite";
  return { rt, mrtNode, quad, texel, near, far };
}

type OutlineRenderer = {
  setRenderTarget: (rt: RenderTarget | null) => void;
  getRenderTarget: () => RenderTarget | null;
  setMRT: (mrt: unknown) => void;
  getMRT: () => unknown;
  render: (scene: Object3D, camera: Camera) => void;
  getDrawingBufferSize: (v: Vector2) => Vector2;
  toneMapping: ToneMapping;
  outputColorSpace: string;
  compileAsync: (o: Object3D, c: Camera, s?: Object3D) => Promise<unknown>;
};

type NodeBuilderLike = { buildAsync: () => Promise<unknown> };
type NodeBuilderFactory = {
  _createNodeBuilder: (renderObject: { context: { mrt: unknown } }, material: Material) => NodeBuilderLike;
};

/**
 * compileAsync 는 둘째 렌더 항목부터 노드 빌드를 양보 뒤에 시작하므로, 그때 렌더러의 렌더 타깃·MRT 는 이미 화면용이다.
 * 렌더 타깃·MRT 를 읽는 단계(재질 setup, 프래그먼트 출력 setup)는 buildAsync 의 첫 양보 전에 끝나므로,
 * 외곽선 문맥(MRT 가 rig.mrtNode) 빌드는 그 동기 구간에만 외곽선 타깃을 걸어 준다.
 */
function bindOutlineBuilders(gl: OutlineRenderer, rig: OutlineRig) {
  const nodes = (gl as unknown as { _nodes?: NodeBuilderFactory })._nodes;
  if (!nodes) return () => {};
  const original = nodes._createNodeBuilder;
  nodes._createNodeBuilder = function (this: NodeBuilderFactory, renderObject, material) {
    const builder = original.call(this, renderObject, material);
    if (renderObject.context.mrt === rig.mrtNode) {
      const buildAsync = builder.buildAsync;
      builder.buildAsync = () => {
        const prevTarget = gl.getRenderTarget();
        const prevMrt = gl.getMRT();
        gl.setRenderTarget(rig.rt);
        gl.setMRT(rig.mrtNode);
        try {
          return buildAsync.call(builder);
        } finally {
          gl.setMRT(prevMrt);
          gl.setRenderTarget(prevTarget);
        }
      };
    }
    return builder;
  };
  return () => {
    nodes._createNodeBuilder = original;
  };
}

type Hidden = { objects: Object3D[]; materials: Material[] };

/**
 * 숨길 객체와 외곽선 렌더에서 뺄 재질.
 * - colorWrite=false: MRT 에서 둘째 타깃의 쓰기 마스크가 남아 파이프라인 생성이 실패한다.
 * - 깊이를 쓰지 않는 투명 재질(글로·라벨 판 등): 노멀 채널에만 찍혀 허공에 사각 테두리가 생긴다.
 * 유지 마스크용 채움(outlineKeep)은 투명·깊이 안 씀이어도 그린다.
 */
function collectHidden(scene: Object3D, out: Hidden) {
  out.objects.length = 0;
  const materials = new Set<Material>();
  scene.traverse((o) => {
    if (outlineHidden(o) && !(o.parent && hasHiddenAncestor(o.parent))) out.objects.push(o);
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh.userData.outlineKeep === true) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!m) continue;
      if (m.colorWrite === false || (m.transparent && m.depthWrite === false)) materials.add(m);
    }
  });
  out.materials = [...materials];
}

function hasHiddenAncestor(o: Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (outlineHidden(p)) return true;
  return false;
}

/** 씬 렌더를 외곽선 렌더 타깃 문맥으로 돌린다. 숨김·배경 제거는 이 호출 안에서만 유지된다. */
function withOutlineTarget<T>(gl: OutlineRenderer, rig: OutlineRig, scene: Scene, hidden: Hidden, run: () => T): T {
  const prevTarget = gl.getRenderTarget();
  const prevMrt = gl.getMRT();
  const background = scene.background;
  const states = hidden.objects.map((o) => o.visible);
  const materialStates = hidden.materials.map((m) => m.visible);
  for (const o of hidden.objects) o.visible = false;
  for (const m of hidden.materials) m.visible = false;
  scene.background = null;
  gl.setRenderTarget(rig.rt);
  gl.setMRT(rig.mrtNode);
  try {
    return run();
  } finally {
    gl.setMRT(prevMrt);
    gl.setRenderTarget(prevTarget);
    scene.background = background;
    hidden.objects.forEach((o, i) => (o.visible = states[i]!));
    hidden.materials.forEach((m, i) => (m.visible = materialStates[i]!));
  }
}

function renderComposite(gl: OutlineRenderer, rig: OutlineRig) {
  const toneMapping = gl.toneMapping;
  const colorSpace = gl.outputColorSpace;
  gl.toneMapping = NoToneMapping;
  gl.outputColorSpace = LinearSRGBColorSpace;
  try {
    rig.quad.render(gl as never);
  } finally {
    gl.toneMapping = toneMapping;
    gl.outputColorSpace = colorSpace;
  }
}

/** 외곽선 문맥의 셰이더를 객체 하나씩, 프레임을 넘기며 미리 만든다. 숨은 외곽선 프록시도 잠깐 켜서 포함한다. */
async function warmOutline(gl: OutlineRenderer, rig: OutlineRig, scene: Scene, camera: Camera) {
  const t0 = performance.now();
  const hidden: Hidden = { objects: [], materials: [] };
  collectHidden(scene, hidden);
  const targets: Object3D[] = [];
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || hasHiddenAncestor(mesh)) return;
    if (mesh.userData.outlineKeep === true && mesh.parent?.userData.hoverOutlineInit === true) return;
    targets.push(mesh);
  });
  let compiled = 0;
  let sliceStart = performance.now();
  for (const mesh of targets) {
    if (!mesh.parent) continue;
    const proxy = mesh.userData.hoverOutlineInit === true;
    const shown = mesh.visible;
    const instanced = mesh as Mesh & { isInstancedMesh?: boolean; count?: number };
    const emptyInstances = instanced.isInstancedMesh === true && instanced.count === 0;
    if (!proxy && (!shown || !visibleChain(mesh))) continue;
    // 투영은 compileAsync 의 동기 구간에서 끝나므로, 켠 상태는 호출 직후 되돌린다(화면 렌더에 새지 않게).
    if (proxy) mesh.visible = true;
    if (emptyInstances) instanced.count = 1;
    let pending: Promise<unknown>;
    try {
      pending = withOutlineTarget(gl, rig, scene, hidden, () => compileInClippingGroups(gl, mesh, camera, scene));
    } finally {
      if (proxy) mesh.visible = shown;
      if (emptyInstances) instanced.count = 0;
    }
    try {
      await pending;
      compiled += 1;
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[outline] 예열 실패", mesh.name, e);
    }
    if (performance.now() - sliceStart > OUTLINE_WARM_SLICE_MS) {
      await afterNextFrame();
      sliceStart = performance.now();
    }
  }
  await compileComposite(gl, rig);
  loadMark("outline warm done", `${compiled}/${targets.length}개 ${(performance.now() - t0).toFixed(0)}ms`);
}

/** 합성 쿼드는 화면 출력(톤매핑 없음·선형) 상태로 컴파일한다. renderComposite 와 같은 상태 */
async function compileComposite(gl: OutlineRenderer, rig: OutlineRig) {
  const toneMapping = gl.toneMapping;
  const colorSpace = gl.outputColorSpace;
  gl.toneMapping = NoToneMapping;
  gl.outputColorSpace = LinearSRGBColorSpace;
  try {
    await gl.compileAsync(rig.quad, (rig.quad as unknown as { camera: Camera }).camera, rig.quad);
  } finally {
    gl.toneMapping = toneMapping;
    gl.outputColorSpace = colorSpace;
  }
}

function visibleChain(o: Object3D) {
  for (let p: Object3D | null = o.parent; p; p = p.parent) if (!p.visible && !outlineHidden(p)) return false;
  return true;
}

export default function OutlineMode() {
  const gl = useThree((s) => s.gl) as unknown as OutlineRenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controlStarted = useShipDebugStore((s) => s.controlStarted);
  const webgpu = useRendererStore((s) => s.active === "webgpu");
  const rig = useMemo(() => (webgpu ? createRig(gl.toneMapping) : null), [webgpu, gl]);
  const hidden = useMemo<Hidden>(() => ({ objects: [], materials: [] }), []);
  const size = useMemo(() => new Vector2(), []);

  useEffect(() => {
    if (!rig || !controlStarted || warmStarted) return;
    const timer = window.setTimeout(() => {
      warmStarted = true;
      void warmOutline(gl, rig, scene, camera);
    }, OUTLINE_WARM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [rig, controlStarted, gl, scene, camera]);

  useEffect(() => (rig ? bindOutlineBuilders(gl, rig) : undefined), [gl, rig]);

  // [wire] 첫 와이어 전환이 느렸던 원인: 외곽선 문맥(MRT) 셰이더를 관제 시작 2.5초 뒤부터 조금씩 만들어서,
  // 그 전에 누르거나 예열이 덜 끝나면 화면에 보이는 객체 전부를 그 프레임에 빌드했다.
  // 로딩 예열이 객체마다 이 문맥 변형도 함께 컴파일하도록 등록한다(로더 뒤, 화면 변화 없음).
  useEffect(() => {
    if (!rig) return;
    const warmHidden: Hidden = { objects: [], materials: [] };
    let collected = false;
    return setOutlineWarmer({
      object: (object, cam, sc) => {
        if (!collected) {
          collectHidden(sc, warmHidden);
          collected = true;
        }
        if (hasHiddenAncestor(object)) return undefined;
        if (object.userData.outlineKeep === true && object.parent?.userData.hoverOutlineInit === true) return undefined;
        return withOutlineTarget(gl, rig, sc as Scene, warmHidden, () => compileInClippingGroups(gl, object, cam, sc));
      },
      composite: () => compileComposite(gl, rig),
    });
  }, [gl, rig]);

  useEffect(
    () => () => {
      rig?.rt.dispose();
      (rig?.quad.material as NodeMaterial | undefined)?.dispose();
    },
    [rig],
  );

  const hiddenAge = useMemo(() => ({ frames: 0 }), []);
  // 양수 우선순위: R3F 자동 렌더를 끄고 여기서 두 경로 중 하나로 그린다.
  useFrame(({ scene: s, camera: c }) => {
    const on = rig !== null && useViewportStore.getState().renderMode === "wire";
    if (!on) {
      gl.render(s, c);
      hiddenAge.frames = HIDDEN_REFRESH_FRAMES;
      return;
    }
    gl.getDrawingBufferSize(size);
    if (rig.rt.width !== size.x || rig.rt.height !== size.y) rig.rt.setSize(size.x, size.y);
    rig.texel.value.set(1 / size.x, 1 / size.y);
    const pc = c as PerspectiveCamera;
    rig.near.value = pc.near;
    rig.far.value = pc.far;
    if (++hiddenAge.frames >= HIDDEN_REFRESH_FRAMES) {
      collectHidden(s, hidden);
      hiddenAge.frames = 0;
    }
    withOutlineTarget(gl, rig, s as Scene, hidden, () => gl.render(s, c));
    renderComposite(gl, rig);
  }, 1);

  return null;
}
