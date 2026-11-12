import { loadMark, loadSpan, startLoadHeartbeat } from "@/debug/loadTiming";
import { occupancyStage, syncOccupancyVisibility } from "@/domain/occupancyLook/occupancySync";
import { nextScreenRender, openRenderGate } from "@/domain/renderGate";
import { compileInClippingGroups } from "@/domain/compileObject";
import { getOutlineWarmer } from "@/domain/outlineWarm";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  DoubleSide,
  LessEqualDepth,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  type Object3D,
  Object3D as Dummy,
  Vector3,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Discard,
  Fn,
  If,
  abs,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  float,
  floor,
  ivec2,
  max,
  mix,
  modelWorldMatrix,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { simplifiedGeometriesAsync } from "@/domain/craneLod";
import { createTimeSlicer } from "@/domain/yieldToMain";
import { collectQuayHoverTargets } from "@/domain/hoverOutline";
import { getCraneFadeVariant } from "@/domain/craneDepthFade";
import { getAreaFadeVariants } from "@/domain/areaDepthFade";
import { useObjectStore } from "@/stores/object";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { SHIP_POSITION_Y } from "@/constants/model";
import { SHIP_TWEEN } from "@/constants/tween";
import { oceanState } from "../OceanTsl/oceanApi";
import { SHORE, shoreTex } from "../OceanTsl/scene/resources";
import type { ShipInstance } from "./Ship";

/**
 * [reflection] 수면 기준 Y 반전 복제본으로 만드는 가짜 반사 (반사 카메라 없음).
 * - 정점을 수면 기준으로 뒤집은 뒤, 시선 방향을 따라 수면(level + LIFT) 위로 끌어올려 그림
 *   → 화면상 위치는 반전 복제본과 같고, depth 는 수면이라 바다/부두/본체가 자연스럽게 가림
 * - 원본이 물 아래인 부분(반전 시 수면 위)은 discard
 * - 최저 LOD(단순화) + 위치만 + unlit + 그림자 없음
 */
/** 반사면 높이 = level + 최소 LIFT, 파고(hs) 비례로 올려 파도 마루가 뚫고 올라오지 않게 */
const REFLECTION_LIFT_MIN = 0; // 바다 depthWrite=false → 파도 가림 회피용 lift 불필요
const REFLECTION_LIFT_HS = 0;
const REFLECTION_LIFT_MAX = 8;
const REFLECTION_RATIO = 0.06;
const REFLECTION_ERROR = 0.04;
const REFLECTION_COLOR = new Color(0.03, 0.045, 0.06);
const REFLECTION_OPACITY = 0.8;
/** 원본 수면 위 높이(m)가 이 값이면 반사 완전히 사라짐 */
const REFLECTION_FADE_HEIGHT = 140;
const REFLECTION_RENDER_ORDER = 5;
/** depth 순서 기록: 원본 높이 0~ORDER_HEIGHT(m) → 카메라 쪽으로 SPAN~0 m */
const REFLECTION_ORDER_HEIGHT = 200;
const REFLECTION_ORDER_SPAN = 0.3; // 3m 당김은 선체 앞까지 튀어나와 배 위에 그려짐
/**
 * [hull] 반사 depth 를 수면보다 이 깊이(m)만큼 아래(시선 방향 뒤쪽)로 기록 (화면 위치 불변).
 * 흘수선 부근 선체가 반사보다 앞이 되어 선체 위에 반사가 안 그려지고, 선체-반사 depth 동률(z-fight → 반짝임)도 사라짐.
 * 최종 깊이 = SINK_MIN + hs × SINK_HS
 */
const REFLECTION_SINK_MIN = 1.5;
const REFLECTION_SINK_HS = 0.6;
/** [hull] 시선 방향 sink 거리 상한(m) — 저각에서 d/|dir.y| 가 폭주하지 않게 */
const REFLECTION_SINK_MAX_ALONG = 60;
/**
 * [x-ray] 같은 픽셀의 반사들은 모두 같은 수면점에 투영돼 depth 가 동일 → 앞/뒤 크레인 부재가 둘 다 LessEqual 통과(겹쳐 보임).
 * 실제 반전점까지의 거리(카메라→반전점 − 카메라→수면점)에 이 비율만큼 뒤로 밀어 진짜 앞뒤 순서를 depth 에 기록
 */
const REFLECTION_DEPTH_ORDER_K = 0.05;
/** [x-ray] 크레인 반사 단순화 비율 (0.06 은 격자 부재가 찢어져 윤곽선이 보였음) */
const REFLECTION_CRANE_RATIO = 0.15;
/** [sparkle] 정점 일렁임 / 알파 줄무늬 세기 (0 = 시간에 따라 흔들리지 않는 안정 반사) */
const REFLECTION_WOBBLE = 0;
const REFLECTION_RIPPLE = 0;
/** [grazing] 카메라가 반사면보다 이 높이(m) 이내면 반사면을 카메라 아래로 내림 (t 가 0 으로 잘려 정점이 카메라로 몰리던 문제) */
const REFLECTION_CAMERA_CLEARANCE = 0.5;
/** [grazing] 카메라가 수면 위 이 높이(m) 미만이면 반사 숨김 */
const REFLECTION_MIN_CAMERA_HEIGHT = 0.6;
/** [grazing] 시선의 수직 성분 |dir.y| 가 이 구간 아래면 반사 페이드아웃 (수평 시선 → 투영점이 무한히 멀어짐) */
// [pt283u] 시작 뷰(카메라 ~23 m, 거리 200~600 m → |dir.y| 0.04~0.11)가 [0.05,0.15] 에 걸려 반사가 거의 꺼졌음 → 진짜 수평(~1°)만
const REFLECTION_GRAZING_FADE: [number, number] = [0.008, 0.025];
/** [grazing] 카메라 수면 위 높이(m): FADE[0] 이하 반사 꺼짐 → FADE[1] 에서 완전 표시 */
// [warm] 관제 시작 전 슬롯1(수면 위 ~23 m)에서도 반사가 보이도록 [15,60] → [10,30]
// [pt283u] 평면 교차 t 를 [0,1] 로 묶고 반사면은 항상 카메라 아래라 붕괴 없음 → 수면에 거의 붙은 경우만 페이드
const REFLECTION_CAMERA_FADE: [number, number] = [1, 3];
/** [grazing] 투영점이 원본 xz 에서 (2×원본 높이 + 이 값) m 넘게 떨어지면 discard (늘어난 반사 제거) */
const REFLECTION_STRETCH_MARGIN = 20;
/**
 * [stretch] 정상 반사도 원본 xz 에서 (카메라 수평거리 × h / (카메라높이 + h)) 만큼 떨어져 맺힘 → 비율 2 는
 * 카메라 수평거리 > 카메라 높이 × ~2 (부감 ~27° 이하, 일반 사선 뷰) 에서 반사를 거의 다 버렸음.
 * 12 ≈ 부감 ~5° 이하에서만 discard (그 이하는 grazing 페이드 0.05~0.15 가 이미 지움)
 */
// [pt283u] 사실상 해제: 물리적 평면 반사(카메라→반전점 광선의 수면 교차)라 정상 거리이며, 수평 근처는 grazing 이 처리
const REFLECTION_STRETCH_RATIO = 1000;
const uCamFade = uniform(1);

const uLevel = uniform(oceanState.level);
const uOpacity = uniform(REFLECTION_OPACITY);
const uLift = uniform(REFLECTION_LIFT_MIN);
const uSink = uniform(REFLECTION_SINK_MIN);
/**
 * [reflection] 육지 마스크: portShore 가 구운 해안 거리장(shoreTex .y = 부호거리 m, 물 +)을 반사 히트점 xz 로 샘플.
 * 해안선에서 SHORE_MARGIN(m) 안쪽(육지 쪽)은 discard → 부두/안벽/에이프런 위에는 반사가 절대 안 그려짐
 * (depth 순서 오프셋/리프트와 무관하게 동작)
 */
const REFLECTION_SHORE_MARGIN = 1;
/** [sparkle] 파도 마루 위 반사 수직 여유(m, lift 에 더함) / 시선 방향 당김 최대(m) */
/** [sparkle] 카메라-반사 거리(m): START 까지 100%, END 에서 0 (얇은 크레인 격자 원거리 반짝임 완화) */
const REFLECTION_FAR_FADE_START = 350;
const REFLECTION_FAR_FADE_END = 900;
const REFLECTION_FAR_FADE_HEIGHT_K = 2;
/** 해안선에서 이 거리(m)까지 반사를 서서히 페이드 인 */
const REFLECTION_SHORE_FADE = 6;
const uShoreRect = uniform(new Vector3(SHORE.rect[0], SHORE.rect[1], SHORE.rect[2]));
const shoreNode = texture(shoreTex);

const materials = new Map<string, MeshBasicNodeMaterial>();

/**
 * [reflection] 2패스 (x-ray 제거, stencil 미사용)
 * - depth: colorWrite=false, depthWrite=true → 픽셀마다 가장 가까운 반사면 depth 만 남김
 * - color: depthFunc=LessEqual, depthWrite=false → 그 가장 가까운 면만 1회 그림 (균일 투명도)
 * 반사는 모두 수면(평면) 위로 투영되므로 depth 가 거의 같음 → 원본 높이(vHeight)가 낮을수록
 * 시선 방향으로 카메라 쪽에 조금 당겨(최대 REFLECTION_ORDER_SPAN m) 앞뒤 순서를 depth 에 기록
 */
function getReflectionMaterial(
  pass: "depth" | "color",
  shore: { margin: number; fade: number } = {
    margin: REFLECTION_SHORE_MARGIN,
    fade: REFLECTION_SHORE_FADE,
  },
) {
  const key = `${pass}:${shore.margin}:${shore.fade}`;
  const cached = materials.get(key);
  if (cached) return cached;
  const vHeight = varyingProperty("float", "vReflHeight");
  const vHit = varyingProperty("vec3", "vReflHit");
  const vGraze = varyingProperty("float", "vReflGraze");
  const vStretch = varyingProperty("float", "vReflStretch");
  const m = new MeshBasicNodeMaterial({
    side: DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: pass === "depth",
  });
  if (pass === "depth") {
    m.colorWrite = false;
  } else {
    m.depthFunc = LessEqualDepth;
  }
  m.fog = false;
  m.vertexNode = Fn(() => {
    const wp = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    vHeight.assign(wp.y.sub(uLevel));
    // [hull] 수면 아래 정점(선창 속 컨테이너 등)은 수면에 붙임: 그대로 반전하면 수면 위로 솟아 t=1 클램프 → 반사 삼각형이
    // 수면점↔선체 내부점 사이로 늘어나 선체 앞 depth 로 선체 위에 그려졌음
    const mirrored = vec3(wp.x, uLevel.mul(2).sub(max(wp.y, uLevel)), wp.z);
    const surf = uLevel.add(uLift);
    const denom = max(cameraPosition.y.sub(mirrored.y), 0.001);
    // 카메라 > surf >= level >= mirrored.y 이므로 t ∈ [0,1] → hit 는 항상 카메라와 반전점 사이(수평선 아래)
    const t = clamp(cameraPosition.y.sub(surf).div(denom), 0, 1);
    const hit = cameraPosition.add(mirrored.sub(cameraPosition).mul(t)).toVar();
    // 물결 일렁임: 원본 높이가 높을수록(반사가 길수록) 조금 더 흔들림
    // [sparkle] 먼 거리에선 흔들림이 서브픽셀 지터(반짝임)가 되므로 거리로 감쇠
    const camDist = cameraPosition.sub(wp).length();
    const farK = float(1).sub(smoothstep(float(150), float(600), camDist));
    // [sparkle] 시간에 따른 정점 일렁임이 반사 경계를 픽셀 단위로 흔들어 반짝임의 주원인 → WOBBLE=0
    const amp = clamp(vHeight.div(40), 0, 1).mul(0.9).mul(farK).mul(REFLECTION_WOBBLE);
    hit.x.addAssign(sin(hit.z.mul(0.18).add(time.mul(1.7))).mul(amp));
    hit.z.addAssign(sin(hit.x.mul(0.15).add(time.mul(1.3))).mul(amp.mul(0.6)));
    vHit.assign(hit);
    // 정점 단위 grazing 페이드 (원본 xz 기준 늘어남 비율도 함께)
    const vdir = normalize(cameraPosition.sub(hit));
    vGraze.assign(
      smoothstep(
        float(REFLECTION_GRAZING_FADE[0]),
        float(REFLECTION_GRAZING_FADE[1]),
        abs(vdir.y),
      ),
    );
    vStretch.assign(
      vec2(hit.x, hit.z).sub(vec2(wp.x, wp.z)).length().div(
        max(vHeight, 0).mul(REFLECTION_STRETCH_RATIO).add(REFLECTION_STRETCH_MARGIN),
      ),
    );
    // 앞뒤 순서용 depth 오프셋 (화면 위치는 그대로, 시선 방향으로만 이동)
    const near = float(1).sub(
      clamp(vHeight.div(REFLECTION_ORDER_HEIGHT), 0, 1),
    );
    const toCam = normalize(cameraPosition.sub(hit));
    // [sparkle] 옆에서 보면 파도 마루가 반사면(level+lift)을 넘나들며 depth 테스트로 반사가 깜빡임 →
    // 화면 위치는 그대로(시선 방향 이동) 두고, 수면 위 수직 여유(WAVE_CLEARANCE+lift)를 확보할 만큼 카메라 쪽으로 당김
    // 파도 회피용 카메라쪽 당김 제거(선체 덮음·저각 z-fight 원인). 순서용 미세 당김만 유지.
    const pull = near.mul(REFLECTION_ORDER_SPAN);
    // [hull] 수면 아래로 sink + [x-ray] 반전점 실제 거리로 앞뒤 순서 (둘 다 시선 방향 이동 → 화면 위치 불변)
    const sinkAlong = clamp(uSink.div(max(abs(toCam.y), 0.001)), 0, REFLECTION_SINK_MAX_ALONG);
    const mirrorExtra = max(
      cameraPosition.sub(mirrored).length().sub(cameraPosition.sub(hit).length()),
      0,
    ).mul(REFLECTION_DEPTH_ORDER_K);
    const placed = hit.add(toCam.mul(pull.sub(sinkAlong).sub(mirrorExtra)));
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(placed, 1));
  })();
  m.colorNode = vec3(
    REFLECTION_COLOR.r,
    REFLECTION_COLOR.g,
    REFLECTION_COLOR.b,
  );
  m.opacityNode = Fn(() => {
    If(vHeight.lessThan(0), () => {
      Discard();
    });
    // 육지 마스크 (해안 거리장 bilinear, 베이크 범위 밖 = 바다)
    const sd = float(1000).toVar();
    const uv = vec2(vHit.x, vHit.z).sub(uShoreRect.xy).div(uShoreRect.z).toVar();
    If(
      uv.x
        .greaterThanEqual(0)
        .and(uv.y.greaterThanEqual(0))
        .and(uv.x.lessThanEqual(1))
        .and(uv.y.lessThanEqual(1)),
      () => {
        const st = uv.mul(SHORE.N).sub(0.5);
        const i0 = floor(st).toVar();
        const fr = st.sub(i0).toVar();
        const ld = (dx: number, dy: number) =>
          shoreNode.load(
            ivec2(
              clamp(i0.add(vec2(dx, dy)), vec2(0, 0), vec2(SHORE.N - 1, SHORE.N - 1)),
            ),
          ).y;
        sd.assign(
          mix(mix(ld(0, 0), ld(1, 0), fr.x), mix(ld(0, 1), ld(1, 1), fr.x), fr.y),
        );
      },
    );
    If(sd.lessThan(shore.margin), () => {
      Discard();
    });
    const shoreFade = smoothstep(
      float(shore.margin),
      float(shore.margin + shore.fade),
      sd,
    );
    const fade = clamp(float(1).sub(vHeight.div(REFLECTION_FADE_HEIGHT)), 0, 1);
    const viewDir = normalize(cameraPosition.sub(vHit));
    // 프레넬 흉내: 내려다볼수록 약하게
    const fres = mix(float(1), float(0.55), abs(viewDir.y));
    // 불규칙 물결 줄무늬로 경계 깨기
    // [sparkle] 줄무늬는 먼 거리/낮은 각도에서 픽셀보다 촘촘해져 aliasing → 거리로 대비 감쇠
    const rippleK = float(1).sub(smoothstep(float(120), float(450), cameraPosition.sub(vHit).length()));
    const ripple = sin(
      vHit.z
        .mul(0.9)
        .add(sin(vHit.x.mul(0.37)).mul(2.3))
        .add(time.mul(2.1)),
    )
      .mul(float(REFLECTION_RIPPLE).mul(rippleK))
      .add(float(1).sub(float(REFLECTION_RIPPLE).mul(rippleK)));
    // [grazing] 수평에 가까운 시선은 투영점이 멀리 늘어나며 줄무늬(moire) 박스처럼 보임 → 페이드아웃
    const grazing = smoothstep(
      float(REFLECTION_GRAZING_FADE[0]),
      float(REFLECTION_GRAZING_FADE[1]),
      abs(viewDir.y),
    );
    const graze = grazing.mul(clamp(vGraze, 0, 1)).mul(uCamFade);
    If(graze.lessThanEqual(0.001).or(vStretch.greaterThan(1)), () => {
      Discard();
    });
    // 화면상 수평선 위(시선이 위를 향함)면 반사일 수 없음
    If(cameraPosition.y.sub(vHit.y).lessThanEqual(0), () => {
      Discard();
    });
    // 높은 부감(슬롯2 ~1.6 km 위)에선 전체가 멀어 다 꺼지지 않도록 카메라 수면 위 높이×FAR_FADE_HEIGHT_K 만큼 구간을 밀어줌
    const farShift = max(cameraPosition.y.sub(uLevel), 0).mul(REFLECTION_FAR_FADE_HEIGHT_K);
    const farFade = float(1).sub(
      smoothstep(
        farShift.add(REFLECTION_FAR_FADE_START),
        farShift.add(REFLECTION_FAR_FADE_END),
        cameraPosition.sub(vHit).length(),
      ),
    );
    return uOpacity.mul(fade).mul(fres).mul(ripple).mul(shoreFade).mul(graze).mul(farFade);
  })();
  materials.set(key, m);
  return m;
}

/** color 메시 + 자식 depth 프리패스 메시 (같은 geometry, 부모 행렬 공유) */
function makeReflectionMesh(
  geometry: BufferGeometry,
  shore?: { margin: number; fade: number },
) {
  const mesh = new Mesh(geometry, getReflectionMaterial("color", shore));
  mesh.userData.outlineHidden = true;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = REFLECTION_RENDER_ORDER + 1;
  mesh.raycast = () => {};
  const depth = new Mesh(geometry, getReflectionMaterial("depth", shore));
  depth.frustumCulled = false;
  depth.matrixAutoUpdate = false;
  depth.renderOrder = REFLECTION_RENDER_ORDER;
  depth.raycast = () => {};
  mesh.add(depth);
  return mesh;
}

const _clipA = new Vector3();
const _clipB = new Vector3();

function pushTri(out: number[], a: Vector3, b: Vector3, c: Vector3) {
  out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function pointAtY(p: Vector3, q: Vector3, y: number, target: Vector3) {
  const dy = q.y - p.y;
  const t = dy === 0 ? 0 : (y - p.y) / dy;
  target.copy(p).lerp(q, t);
}

/** 로컬 y 위쪽만 남긴다. 수선을 가로지르는 삼각형은 그 높이에서 잘라 반사면으로 퍼지지 않게 한다. */
function pushAboveY(out: number[], a: Vector3, b: Vector3, c: Vector3, y: number) {
  const above: Vector3[] = [];
  const below: Vector3[] = [];
  for (const p of [a, b, c]) (p.y >= y ? above : below).push(p);
  if (above.length === 3) {
    pushTri(out, a, b, c);
    return;
  }
  if (above.length === 0) return;
  if (above.length === 1) {
    const top = above[0]!;
    pointAtY(top, below[0]!, y, _clipA);
    pointAtY(top, below[1]!, y, _clipB);
    pushTri(out, top, _clipA, _clipB);
    return;
  }
  const bot = below[0]!;
  pointAtY(above[0]!, bot, y, _clipA);
  pointAtY(above[1]!, bot, y, _clipB);
  pushTri(out, above[0]!, above[1]!, _clipA);
  pushTri(out, above[1]!, _clipB, _clipA);
}

/** 위치만 남긴 비인덱스 geometry. matrix 적용 후 수면 아래(원본)인 삼각형은 제외 */
function appendTriangles(
  out: number[],
  source: BufferGeometry,
  matrix: Matrix4,
  cullBelow: number | null,
  cullAbove: number | null = null,
  maxNormalY: number | null = null,
  /** 한 점이라도 이 높이(로컬 y) 아래면 삼각형 전체 제외. 수면 아래 선체가 물 위에 납작하게 깔리는 것 방지 */
  cullAnyBelow: number | null = null,
) {
  const e1 = new Vector3(),
    e2 = new Vector3();
  const pos = source.getAttribute("position");
  if (!pos) return;
  const index = source.getIndex();
  const n = index ? index.count : pos.count;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (let i = 0; i + 2 < n; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, ib).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
    if (
      cullBelow != null &&
      a.y < cullBelow &&
      b.y < cullBelow &&
      c.y < cullBelow
    )
      continue;
    if (cullAnyBelow != null) {
      pushAboveY(out, a, b, c, cullAnyBelow);
      continue;
    }
    if (
      cullAbove != null &&
      a.y > cullAbove &&
      b.y > cullAbove &&
      c.y > cullAbove
    )
      continue;
    if (maxNormalY != null) {
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      e1.cross(e2);
      const len = e1.length();
      // 아랫면만 제외. 윗면(normal.y > 0)은 크레인과 같은 반사 메시에 넣는다.
      if (len === 0 || e1.y / len <= -maxNormalY) continue;
    }
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
}

function toGeometry(values: number[]) {
  const geo = new BufferGeometry();
  geo.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(values), 3),
  );
  return geo;
}

/** [worker] 반사용 최저 LOD (meshopt 워커) */
async function lowest(geo: BufferGeometry, ratio = REFLECTION_RATIO) {
  const [g] = await simplifiedGeometriesAsync(geo, [{ ratio, error: REFLECTION_ERROR }]);
  return g ?? geo;
}

/** [grazing] 카메라 높이 기준 반사 표시 가능 여부 */
export function reflectionCameraOk(cameraY: number) {
  return cameraY > oceanState.level + Math.max(REFLECTION_MIN_CAMERA_HEIGHT, REFLECTION_CAMERA_FADE[0]);
}

/** 카메라 조건 + occupancy 모드가 아닐 때. occupancy 에선 바다가 사라져 수면 아래 복제본이 그대로 보임 */
export function reflectionActive(cameraY: number) {
  return reflectionCameraOk(cameraY) && !useOccupancyStore.getState().occupancyLook && occupancyStage() >= 5;
}

function useLevelSync() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    uLevel.value = oceanState.level;
    uShoreRect.value.set(SHORE.rect[0], SHORE.rect[1], SHORE.rect[2]);
    const lift = Math.min(
      REFLECTION_LIFT_MAX,
      Math.max(
        REFLECTION_LIFT_MIN,
        REFLECTION_LIFT_MIN + oceanState.hs * REFLECTION_LIFT_HS,
      ),
    );
    // 반사면은 항상 카메라보다 아래 (낮은 카메라에서 정점이 카메라 위치로 붕괴 → 하늘로 솟은 박스 방지)
    const camAbove = camera.position.y - oceanState.level - REFLECTION_CAMERA_CLEARANCE;
    uLift.value = Math.max(0, Math.min(lift, camAbove));
    uSink.value = REFLECTION_SINK_MIN + oceanState.hs * REFLECTION_SINK_HS;
    const h = camera.position.y - oceanState.level;
    const k = Math.min(1, Math.max(0, (h - REFLECTION_CAMERA_FADE[0]) / (REFLECTION_CAMERA_FADE[1] - REFLECTION_CAMERA_FADE[0])));
    uCamFade.value = k * k * (3 - 2 * k);
  });
}

/**
 * [reflection] InstancedMesh(선적 컨테이너 등) 반사 ? 원본의 instanceMatrix 를 그대로 공유,
 * 단순 박스 geometry + 같은 반사 재질/depth 프리패스. 원본의 자식으로 붙여 부모(선박) 변환을 따라감
 */
export function makeReflectionInstanced(geometry: BufferGeometry, source: InstancedMesh) {
  const make = (pass: "depth" | "color") => {
    const m = new InstancedMesh(geometry, getReflectionMaterial(pass), 1);
    m.instanceMatrix = source.instanceMatrix;
    m.count = source.count;
    m.frustumCulled = false;
    m.raycast = () => {};
    m.renderOrder = REFLECTION_RENDER_ORDER + (pass === "color" ? 1 : 0);
    return m;
  };
  const color = make("color");
  color.name = `${source.name || "instanced"}-reflection`;
  color.userData.outlineHidden = true;
  color.add(make("depth"));
  return color;
}

/** 매 프레임: 표시 여부 + count 동기화 */
export function syncReflectionInstanced(reflection: InstancedMesh, source: InstancedMesh, on: boolean) {
  reflection.visible = on;
  if (!on) return;
  reflection.count = source.count;
  const depth = reflection.children[0] as InstancedMesh | undefined;
  if (depth) depth.count = source.count;
}

/** 선적 컨테이너 반사용 공유 박스 geometry (원본 bbox 크기, 12 tris) */
const boxCache = new WeakMap<BufferGeometry, BufferGeometry>();
export function reflectionBoxOf(source: BufferGeometry) {
  let box = boxCache.get(source);
  if (box) return box;
  if (!source.boundingBox) source.computeBoundingBox();
  const bb = source.boundingBox!;
  const size = bb.getSize(new Vector3());
  const center = bb.getCenter(new Vector3());
  box = new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
  boxCache.set(source, box);
  return box;
}

/**
 * [warm] 로딩 중 셰이더 예열. 반사 메시(크레인/지면/선박/적재 컨테이너)는 비동기(simplifier)로 늦게 만들어지고
 * 카메라 높이/관제 시작 전엔 visible=false 라 gl.compile 에서 빠져, 관제 시작 비행 중 첫 노출 때 파이프라인 컴파일로 끊겼음.
 * 반사 빌드가 모두 끝나면 씬의 숨김 오브젝트를 잠깐 visible 로 두고 compileAsync (동기 수집 직후 원복 → 화면 노출 없음).
 * IntroOverlay 는 useSceneWarmReady() 가 true 일 때만 '관제 시작' 버튼을 띄움.
 */
const WARM_LANES = 4;

/** three RenderObject.getMaterialCacheKey 와 같은 규칙으로 재질 값을 줄인다 (숫자는 on/off, 텍스처는 mapping). */
const protoGetterKeys = new WeakMap<object, string[]>();
function materialKeys(m: Material) {
  const ctor = m.constructor;
  let proto = protoGetterKeys.get(ctor);
  if (!proto) {
    proto = [];
    for (let p = Object.getPrototypeOf(m); p; p = Object.getPrototypeOf(p)) {
      const ds = Object.getOwnPropertyDescriptors(p);
      for (const k in ds) if (typeof ds[k]?.get === "function") proto.push(k);
    }
    protoGetterKeys.set(ctor, proto);
  }
  return [...Object.keys(m), ...proto];
}
function materialVariantKey(m: Material) {
  let key = typeof m.customProgramCacheKey === "function" ? m.customProgramCacheKey() : "";
  const values = m as unknown as Record<string, unknown>;
  for (const p of materialKeys(m)) {
    if (/^(is[A-Z]|_)|^(visible|version|uuid|name|opacity|userData)$/.test(p)) continue;
    const v = values[p];
    if (v === null || v === undefined) key += String(v);
    else if (typeof v === "number") key += p === "side" ? String(v) : v !== 0 ? "1" : "0";
    else if (typeof v === "object") {
      const tex = v as { isTexture?: boolean; mapping?: number; magFilter?: number; minFilter?: number; wrapS?: number; wrapT?: number; wrapR?: number };
      key += tex.isTexture ? `{${tex.mapping}:${tex.magFilter}:${tex.minFilter}:${tex.wrapS}:${tex.wrapT}:${tex.wrapR}}` : "{}";
    } else key += String(v);
    key += ",";
  }
  return key;
}

/** three RenderObject.getGeometryCacheKey 와 같은 정점 속성 구성 */
function geometryVariantKey(geometry: BufferGeometry) {
  let key = "";
  for (const name of Object.keys(geometry.attributes).sort()) {
    const a = geometry.attributes[name] as unknown as { data?: { stride?: number }; offset?: number; itemSize?: number; normalized?: boolean };
    key += `${name}:${a.data?.stride ?? ""}:${a.offset ?? ""}:${a.itemSize ?? ""}:${a.normalized ? "n" : ""},`;
  }
  const morphs = geometry.morphAttributes as Record<string, { id: number }[]>;
  for (const name of Object.keys(morphs).sort()) {
    key += `morph-${name}:${morphs[name]!.map((a) => a.id).join("/")},`;
  }
  if (geometry.index) key += "index,";
  return key;
}

/**
 * three 의 노드 빌드 캐시 키(RenderObject.getCacheKey)와 같은 경우에만 예열을 건너뛴다.
 * - InstancedMesh(또는 count>1)는 three 가 object.uuid 를 키에 넣어 객체마다 노드를 따로 빌드한다.
 *   예전 키는 인스턴싱 여부만 봐서 첫 객체만 예열되고, 나머지(야드 블록·크레인 인스턴스)는
 *   화면에 처음 들어올 때(관제 시작 비행·초반 카메라 이동) 메인 스레드에서 빌드됐다.
 * - 재질 값·정점 속성 세부(itemSize/normalized/stride)·receiveShadow 도 three 키와 맞춘다.
 */
function shaderVariantKey(object: Object3D, material: Material | Material[], geometry?: BufferGeometry | null) {
  const counted = object as Object3D & { isInstancedMesh?: boolean; count?: number };
  const perObject = Boolean(counted.isInstancedMesh) || (counted.count ?? 0) > 1;
  let clip = "";
  let node: Object3D | null = object.parent;
  while (node) {
    if ((node as { isClippingGroup?: boolean }).isClippingGroup) {
      clip = `clip:${node.id}`;
      break;
    }
    node = node.parent;
  }
  const list = Array.isArray(material) ? material : [material];
  const mats = list.map((m) => `${m.type}|${materialVariantKey(m)}`).join("~");
  const geo = geometry ? geometryVariantKey(geometry) : "";
  return `${perObject ? object.uuid : "M"}|${clip}|${object.receiveShadow ? 1 : 0}|${geo}|${mats}`;
}

async function compileShaderOnce(
  gl: unknown,
  object: Object3D,
  camera: unknown,
  scene: Object3D,
  seen: Set<string>,
) {
  const mesh = object as Mesh;
  const key = shaderVariantKey(object, mesh.material as Material | Material[], mesh.geometry);
  if (seen.has(key)) return;
  seen.add(key);
  await compileInClippingGroups(gl, object, camera, scene);
}

/** [wire] 같은 변형을 와이어(외곽선) 렌더 타깃 문맥으로도 컴파일. 첫 와이어 전환 때 셰이더 빌드를 없앤다 (WebGPU 전용) */
async function compileOutlineOnce(object: Object3D, camera: unknown, scene: Object3D, seen: Set<string>) {
  const warmer = getOutlineWarmer();
  const mesh = object as Mesh;
  if (!warmer || !mesh.isMesh) return;
  const key = shaderVariantKey(object, mesh.material as Material | Material[], mesh.geometry);
  if (seen.has(key)) return;
  seen.add(key);
  try {
    await warmer.object(object, camera, scene);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[warm] 와이어 예열 실패", object.name, e);
  }
}

/**
 * 로더 뒤 첫 화면 제출.
 * 객체를 숨겼다 조금씩 켜는 분할은 이 환경에서 총시간이 더 길어져(29s+),
 * 게이트를 연 뒤 R3F 첫 프레임 1회로 소화한다. (목표 ≤200ms 분할은 별도 재시도 필요)
 */
async function prerenderInSlices(
  scene: Object3D,
  _camera: Camera,
  gl: { render: (s: Object3D, c: Camera) => void; domElement: HTMLCanvasElement },
  setFrameloop: (mode: "always" | "demand" | "never") => void,
) {
  const canvas = gl.domElement;
  const opacity = canvas.style.opacity;
  canvas.style.opacity = "0";
  setFrameloop("always");
  openRenderGate("warm-done");
  const wall0 = performance.now();
  const ms = await nextScreenRender(20000);
  syncOccupancyVisibility(scene);
  canvas.style.opacity = opacity;
  const longest = Math.max(0, ms);
  loadMark(
    `첫 화면 조각 1개 최장 ${longest.toFixed(0)}ms, 벽시계 ${(performance.now() - wall0).toFixed(0)}ms`,
  );
  if (ms > 200) loadMark(`첫 화면 느린조각 frame0`, `${ms.toFixed(0)}ms`);
}

let warmPending = 0;
let warmDone = false;
let warmCompiling = false;
const warmListeners = new Set<() => void>();
const emitWarm = () => warmListeners.forEach((l) => l());
export function beginSceneWarmTask() {
  warmPending++;
  warmDone = false;
  emitWarm();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    warmPending--;
    emitWarm();
  };
}
export function useSceneWarmReady() {
  return useSyncExternalStore(
    (l) => {
      warmListeners.add(l);
      return () => warmListeners.delete(l);
    },
    () => warmDone && warmPending === 0,
  );
}
/** [loader] 로딩 화면 상태 문구용: build = 반사 메시 생성 중, compile = 셰이더 컴파일 중, idle = 예열 대기, done */
export type SceneWarmStage = "build" | "compile" | "idle" | "done";
export function useSceneWarmStage(): SceneWarmStage {
  return useSyncExternalStore(
    (l) => {
      warmListeners.add(l);
      return () => warmListeners.delete(l);
    },
    () =>
      warmPending > 0 ? "build" : warmCompiling ? "compile" : warmDone ? "done" : "idle",
  );
}

export function SceneWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const monitoringStarted = useViewportStore((s) => s.monitoringStarted);
  const idleFrames = useRef(0);
  const running = useRef(false);
  // 예열·관제 시작 커밋이 숨김 메시를 다시 켠 뒤에도 오큐펀시 룩은 스토어를 따른다.
  useLayoutEffect(() => {
    syncOccupancyVisibility(scene);
  }, [scene, monitoringStarted]);
  useFrame(() => {
    if (warmDone || running.current) return;
    if (warmPending > 0) {
      idleFrames.current = 0;
      return;
    }
    // 마운트 직후 다른 빌드 작업이 등록될 여유
    if (++idleFrames.current < 10) return;
    running.current = true;
    warmCompiling = true;
    emitWarm();
    // [load] 씬 1회 compileAsync(=수 초짜리 단일 long task) → 객체 단위로 나눠 컴파일, 사이마다 메인 스레드 양보.
    // 같은 material/geometry 조합은 three 노드 캐시로 1회만 빌드. targetScene=scene → 실제 조명/환경/안개 캐시 키와 동일
    const endWarm = loadSpan("warm compile (객체별)");
    const targets: Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.quaySource) return; // 인스턴스의 아웃라인 기준 원본은 직접 렌더하지 않는다.
      const t = o as Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
      if (t.isMesh || t.isPoints || t.isLine || t.isSprite) targets.push(o);
    });
    const done = () => {
      running.current = false;
      warmCompiling = false;
      warmDone = true;
      emitWarm();
    };
    let stopBeat = () => {};
    void (async () => {
      const slice = createTimeSlicer(12);
      const slow: string[] = [];
      let compileMs = 0;
      let compiled = 0;
      stopBeat = startLoadHeartbeat(() => `셰이더 ${compiled}/${targets.length}`);
      loadMark("warm compile 시작", `${targets.length}개`);
      try {
      // [occupancy] 숨긴 조상(블록 막대 그룹, 선박 occupancy 메시)까지 켠 채 컴파일하고, 전부 끝난 뒤에 되돌린다.
      // 객체마다 바로 숨기면 compileAsync 가 돌기 전에 visible=false 가 되어 전환 때 처음 컴파일된다.
      const restore: { o: Object3D; visible: boolean; culled?: boolean }[] = [];
      const reveal = (o: Object3D, withCull: boolean) => {
        if (restore.some((item) => item.o === o)) {
          if (withCull) (o as Mesh).frustumCulled = false;
          return;
        }
        restore.push({
          o,
          visible: o.visible,
          culled: withCull ? (o as Mesh).frustumCulled : undefined,
        });
        o.visible = true;
        if (withCull) (o as Mesh).frustumCulled = false;
      };
      for (const o of targets) {
        let node: Object3D | null = o;
        while (node) {
          reveal(node, node === o);
          node = node.parent;
        }
      }
      const bumped: InstancedMesh[] = [];
      const seen = new Set<string>();
      const outlineSeen = new Set<string>();
      const compileTarget = async (o: Object3D) => {
        if (!o.parent) return;
        const t0 = performance.now();
        const inst = o as InstancedMesh;
        const empty = Boolean(inst.isInstancedMesh) && inst.count === 0;
        if (empty) {
          inst.count = 1;
          bumped.push(inst);
        }
        try {
          await compileShaderOnce(gl, o, camera, scene, seen);
          await compileOutlineOnce(o, camera, scene, outlineSeen);
          // [depthfade] Depth 반투명 크레인 변형도 미리 컴파일 (런타임 첫 페이드 히치 방지)
          // [areafade] 구역 Depth 반투명 정적 메시(지면·건물·수목) 변형도 함께
          // [occupancy] userData.warmMaterials = 전환 때 갈아끼울 재질 (선적 컨테이너 등)
          const mesh = o as Mesh;
          const extras = mesh.isMesh ? (mesh.userData.warmMaterials as (Material | Material[])[] | undefined) ?? [] : [];
          const variants = mesh.isMesh ? [getCraneFadeVariant(mesh), ...getAreaFadeVariants(mesh), ...extras] : [];
          for (const variant of variants) {
            if (!variant || variant === mesh.material) continue;
            const orig = mesh.material;
            mesh.material = variant;
            try {
              await compileShaderOnce(gl, o, camera, scene, seen);
              await compileOutlineOnce(o, camera, scene, outlineSeen);
            } finally {
              mesh.material = orig;
            }
          }
          const geos = mesh.isMesh ? (mesh.userData.warmGeometries as BufferGeometry[] | undefined) : undefined;
          if (geos?.length) {
            const origGeo = mesh.geometry;
            for (const geo of geos) {
              if (!geo || geo === origGeo) continue;
              mesh.geometry = geo;
              try {
                // compileAsync는 첫 await 뒤에도 object.geometry를 읽는다.
                // 완료 전에 복구하면 원본만 예열되고 실제 LOD의 첫 렌더가 이동 중에 컴파일된다.
                await compileShaderOnce(gl, o, camera, scene, seen);
                await compileOutlineOnce(o, camera, scene, outlineSeen);
              } finally {
                mesh.geometry = origGeo;
              }
            }
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn("[warm] compile 실패", o.name, e);
        }
        const d = performance.now() - t0;
        compileMs += d;
        compiled += 1;
        if (compiled % 80 === 0) loadMark("warm compile 진행", `${compiled}/${targets.length} 합계 ${compileMs.toFixed(0)}ms`);
        if (d > 40) {
          const m = (o as Mesh).material as { type?: string; name?: string } | undefined;
          slow.push(`${o.name || o.type}[${m?.name || m?.type || "-"}] ${d.toFixed(0)}ms`);
        }
        if (d > 1) await slice();
      };
      // 서로 다른 객체는 제한적으로 병렬 처리하되 같은 객체의 변형은 반드시 순차 예열한다.
      let nextTarget = 0;
      await Promise.all(Array.from({ length: WARM_LANES }, async () => {
        while (nextTarget < targets.length) await compileTarget(targets[nextTarget++]!);
      }));
      const outlineWarmer = getOutlineWarmer();
      if (outlineWarmer) {
        await outlineWarmer.composite().catch((e: unknown) => {
          if (import.meta.env.DEV) console.warn("[warm] 와이어 합성 예열 실패", e);
        });
        loadMark("wire(외곽선) 예열", `${outlineSeen.size}개 변형`);
      }
      for (const mesh of bumped) if (mesh.count === 1) mesh.count = 0;
      for (const item of restore) {
        item.o.visible = item.visible;
        if (item.culled !== undefined) (item.o as Mesh).frustumCulled = item.culled;
      }
      // 스냅샷이 예열 도중 켜진 값을 기억해도, 스토어 기준으로 오큐펀시 전용 메시는 다시 숨긴다.
      syncOccupancyVisibility(scene);
      endWarm(`${targets.length} objects, 객체별 비동기 예열 시간 합계 ${compileMs.toFixed(0)}ms (최대 ${WARM_LANES}개 병렬)`);
      const pipelines = (gl as unknown as { _pipelines?: { programs?: { vertex?: { size?: number }; fragment?: { size?: number }; compute?: { size?: number } } } })._pipelines?.programs;
      const programs = (gl as unknown as { info?: { memory?: { programs?: number } } }).info?.memory?.programs;
      loadMark(
        `warm shaders 정점 ${pipelines?.vertex?.size ?? "?"} 프래그먼트 ${pipelines?.fragment?.size ?? "?"} 컴퓨트 ${pipelines?.compute?.size ?? "?"} 프로그램 ${programs ?? "?"}`,
      );
      if (import.meta.env.DEV && slow.length) console.info("[load] warm 느린 객체(>40ms)", slow);
      // 게이트 개방 → 첫 화면 렌더(그림자 패스 등 잔여 빌드)를 로더 뒤에서 조각으로 나눠 소화한 뒤 완료
      await prerenderInSlices(scene, camera, gl, setFrameloop);
      for (let frame = 1; frame <= 3; frame += 1) {
        const t0 = performance.now();
        await new Promise<void>((res) => requestAnimationFrame(() => res()));
        loadMark(`warm 뒤 프레임 ${frame}`, `${(performance.now() - t0).toFixed(0)}ms`);
      }
      loadMark("warm done → 로더 종료");
      } finally {
        stopBeat();
      }
    })().then(done, done);
  });
  return null;
}

/** 반사 uniform(수면 높이/리프트) 갱신만 ? 다른 반사 컴포넌트가 없어도 동작하도록 */
export function ReflectionUniformSync() {
  useLevelSync();
  return null;
}

/** 컨테이너(quay) 크레인 반사 ? busan.glb 크레인 메시를 월드 좌표로 구워 1 draw call */
export function QuayCraneReflection({ model }: { model: Object3D }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const visible = useObjectStore((s) => s.reflectionVisible);
  const meshRef = useRef<Mesh | null>(null);
  useLevelSync();

  useEffect(() => {
    let cancelled = false;
    let mesh: Mesh | null = null;
    const finishWarm = beginSceneWarmTask();
    const endSpan = loadSpan("reflection quay build");
    void (async () => {
      model.updateMatrixWorld(true);
      const values: number[] = [];
      const instMatrix = new Matrix4();
      const world = new Matrix4();
      const level = oceanState.level;
      const seen = new Set<Mesh>();
      const sources: Mesh[] = [];
      for (const target of collectQuayHoverTargets(model)) {
        const src = target.source;
        if (seen.has(src)) continue;
        seen.add(src);
        sources.push(src);
      }
      // [worker] 고유 geometry 단순화를 워커 풀에서 병렬 실행
      const cache = new Map<BufferGeometry, Promise<BufferGeometry>>();
      const lowOf = (g: BufferGeometry, ratio?: number) => {
        let p = cache.get(g);
        if (!p) cache.set(g, (p = lowest(g, ratio)));
        return p;
      };
      await Promise.all(sources.map((src) => lowOf(src.geometry, REFLECTION_CRANE_RATIO)));
      if (cancelled) return;
      // [loader] 삼각형 굽기는 메인 스레드 → 시간 분할로 스피너 유지
      const slice = createTimeSlicer();
      for (const src of sources) {
        const geo = await lowOf(src.geometry, REFLECTION_CRANE_RATIO);
        if ((src as InstancedMesh).isInstancedMesh) {
          const im = src as InstancedMesh;
          for (let i = 0; i < im.count; i++) {
            im.getMatrixAt(i, instMatrix);
            world.multiplyMatrices(im.matrixWorld, instMatrix);
            appendTriangles(values, geo, world, level);
            await slice();
          }
        } else {
          appendTriangles(values, geo, src.matrixWorld, level);
          await slice();
        }
        if (cancelled) return;
      }
      if (cancelled) return;
      if (values.length === 0) {
        finishWarm();
        return;
      }
      mesh = makeReflectionMesh(toGeometry(values));
      mesh.name = "quay-crane-reflection";
      mesh.visible = useObjectStore.getState().reflectionVisible;
      scene.add(mesh);
      meshRef.current = mesh;
      finishWarm();
      endSpan();
      if (import.meta.env.DEV) {
        console.info(`[reflection] quay cranes ${values.length / 9} tris`);
      }
    })();
    return () => {
      cancelled = true;
      finishWarm();
      if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      meshRef.current = null;
    };
  }, [model, scene]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = visible && reflectionActive(camera.position.y);
  });

  return null;
}

type ShipReflectionPart = {
  geometry: BufferGeometry;
  localMatrix: Matrix4;
  waterway: boolean;
};

/** 선박 반사 ? 비 waterway 파트를 최저 LOD 로 1개 geometry 로 합친 뒤 척마다 Mesh 1개 */
export function ShipReflection({
  parts,
  posesRef,
}: {
  parts: readonly ShipReflectionPart[];
  posesRef: RefObject<ShipInstance[]> | undefined;
}) {
  const visible = useObjectStore((s) => s.reflectionVisible);
  const camera = useThree((s) => s.camera);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let cancelled = false;
    let built: BufferGeometry | null = null;
    const finishWarm = beginSceneWarmTask();
    const endSpan = loadSpan("reflection ship build");
    void (async () => {
      const solid = parts.filter((p) => !p.waterway);
      const lows = await Promise.all(solid.map((p) => lowest(p.geometry)));
      if (cancelled) return;
      const values: number[] = [];
      const slice = createTimeSlicer();
      // 선저(로컬 y=0)부터 수선까지는 반사에서 뺀다. 수면 아래 정점을 수면에 붙이면 선저 색이 바다 위에 깔린다.
      const waterline = oceanState.level - SHIP_POSITION_Y;
      for (let i = 0; i < solid.length; i++) {
        appendTriangles(values, lows[i]!, solid[i]!.localMatrix, null, null, null, waterline);
        await slice();
        if (cancelled) return;
      }
      built = values.length ? toGeometry(values) : null;
      setGeometry(built);
      endSpan();
      // geometry 반영 + 반사 메시 생성 후 예열되도록 다음 프레임들까지 대기
      requestAnimationFrame(() => requestAnimationFrame(finishWarm));
    })();
    return () => {
      cancelled = true;
      finishWarm();
      built?.dispose();
    };
  }, [parts]);
  const meshes = useRef<Mesh[]>([]);
  const groupRef = useRef<Dummy | null>(null);
  const dummy = useMemo(() => new Dummy(), []);

  useFrame(() => {
    const group = groupRef.current;
    const list = posesRef?.current;
    if (!group || !geometry || !list) return;
    // [warm] 숨김 상태에서도 메시는 미리 생성 → 로딩 예열(SceneWarmup)에 포함, 관제 시작 시 신규 생성/컴파일 없음
    while (meshes.current.length < Math.max(1, list.length)) {
      const mesh = makeReflectionMesh(geometry);
      group.add(mesh);
      meshes.current.push(mesh);
    }
    const on = visible && reflectionActive(camera.position.y);
    group.visible = on;
    if (!on) return;
    meshes.current.forEach((mesh, i) => {
      const inst = list[i];
      if (!inst) {
        mesh.visible = false;
        return;
      }
      const s = inst.scale ?? 1;
      const sx = typeof s === "number" ? s : s[0];
      mesh.visible = sx > SHIP_TWEEN.hiddenScale * 2;
      if (!mesh.visible) return;
      dummy.position.set(...inst.position);
      dummy.rotation.set(...(inst.rotation ?? [0, 0, 0]));
      if (typeof s === "number") dummy.scale.setScalar(s);
      else dummy.scale.set(s[0], s[1], s[2]);
      dummy.updateMatrix();
      mesh.matrix.copy(dummy.matrix);
      mesh.matrixWorldNeedsUpdate = true;
    });
  });

  useEffect(
    () => () => {
      for (const m of meshes.current) m.removeFromParent();
      meshes.current = [];
    },
    [geometry],
  );

  if (!geometry) return null;
  return <group ref={groupRef} />;
}
