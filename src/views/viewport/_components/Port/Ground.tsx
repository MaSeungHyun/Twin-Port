import { loadSpan } from "@/debug/loadTiming";
import { bindQuayCraneModel } from "@/domain/cameraFocus";
import { bindCraneDepthFade, updateCraneDepthFade } from "@/domain/craneDepthFade";
import { bindAreaDepthFade, getAreaWholeFadeOpacity, updateAreaDepthFade } from "@/domain/areaDepthFade";
import groundUrl from "@/assets/model/BUSAN.glb";
import { extendKtx2, whenKtx2Ready } from "@/domain/gltfLoaders";
import { enableGlbShadows } from "@/domain/glb";
import {
  extractGroundBlocks,
  listObjectNames,
} from "@/domain/extractGroundBlocks";
import { shipsFromPlacements, extractShipPoints } from "@/domain/extractShipCubes";
import {
  extractQuayCranePlacements,
} from "@/domain/extractQuayBerths";
import {
  applyGlbViewCamera,
  extractGlbViewCamera,
} from "@/domain/extractGlbCamera";
import {
  GROUND_POSITION,
  GROUND_ROTATION,
} from "@/constants/ground";
import { registerOccupancySync } from "@/domain/occupancyLook/occupancySync";
import { getOccupancySurfaceMaterial } from "@/domain/occupancyLook/occupancySurfaceMaterial";
import { warmupOccupancyPrograms } from "@/domain/occupancyLook/warmupOccupancyPrograms";
import {
  applyGroundPointerFilter,
  collectQuayHoverTargets,
  findQuayCraneRoot,
  getPortHover,
  pinPortHover,
  portHoverOut,
  portHoverOver,
  quayTargetMatches,
  quayTargetMatchesGlbIndex,
  resolveQuayCraneHoverId,
  registerPortOutlineApplier,
  unpinPortHover,
  writeQuayOutlineMatrix,
} from "@/domain/hoverOutline";
import {
  activateCraneFromViewport,
  pickCraneGlbIndexFromClick,
  setViewportPickCursor,
} from "@/domain/viewportPick";
import { useViewportStore, isViewportTracking, getActiveCraneGlbIndex } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { useOccupancyStore } from "@/stores/occupancy";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { occupancyTransitionProgressRef } from "@/constants/occupancyTransition";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { buildCraneLods, resetCraneLods, updateCraneLods, type CraneLodSet } from "@/domain/craneLod";
import { CRANE_LOD_CHECK_EVERY, CRANE_LOD_LEVELS } from "@/constants/craneLod";
import {
  DoubleSide,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Vector3Tuple,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import HoverOutlineMesh, { setAlertOutlineVariant } from "./HoverOutlineMesh";
import { beginSceneWarmTask, QuayCraneReflection, SceneWarmup } from "./WaterReflection";
import { parseCraneNameIndex, parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { quayGlbIndexOfHover, rememberQuayHoverIndex } from "@/domain/hoverTooltip";
import { getActiveByKind } from "@/stores/useFailureStore";
import { bakePortShoreOnce } from "../OceanTsl/portShore";
import { instanceQuayCranes, quayDrawPointer, quayGlbIndexNear, quayHoverId, updateQuayCraneFade, updateQuayCraneLods } from "@/domain/quayCraneInstance";
import { mergeFadeIdenticalStatic } from "@/domain/mergeStaticGeometry";
import { instanceRepeatedGround, buildGroundLods, resetGroundLods, updateGroundLods, type GroundLodSet } from "@/domain/repeatMesh";
import { GROUND_LOD_CHECK_EVERY, GROUND_LOD_LEVELS } from "@/constants/groundLod";

/** 인스턴스 히트 → 원래 크레인. instanceId 가 없으면 맞은 점에서 가장 가까운 크레인. */
function quayHoverFromEvent(event: ThreeEvent<PointerEvent>) {
  const fromHit = event.intersections?.find((hit) => hit.object === event.object)?.instanceId;
  const drawn = quayDrawPointer(event.object, event.instanceId ?? fromHit);
  if (drawn) return drawn;
  const glbIndex = event.point ? quayGlbIndexNear(event.point) : null;
  if (glbIndex == null) return null;
  const id = quayHoverId(glbIndex);
  return id ? { id, glbIndex } : null;
}

/** opacity만으로는 안 보임 — Three.js는 transparent=true 여야 알파가 블렌딩됨 */
function enableGroundAlpha(root: Object3D) {
  // 같은 원본에 같은 보정(투명/컷아웃/폴리곤 오프셋)이면 복제본 하나를 모든 메시에 쓴다.
  // 보정은 재질 이름과 속성만 보므로 메시마다 결과가 다르지 않다.
  const shared = new Map<Material, Material>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;

    const source = child.material;
    const list = Array.isArray(source) ? source : [source];

    const next = list.map((mat) => {
      if (!(mat instanceof Material)) return mat;
      const cached = shared.get(mat);
      if (cached) return cached;

      const hasOpacity =
        "opacity" in mat && typeof mat.opacity === "number" && mat.opacity < 1;
      const hasAlphaMap = "alphaMap" in mat && Boolean(mat.alphaMap);
      if (!mat.transparent && !hasOpacity && !hasAlphaMap) return mat;

      const cloned = mat.clone();
      // [renderorder] busan.glb exports almost every material as BLEND (opacity 1). As transparent+depthWrite:false
      // they wrote no depth, so later passes (ocean/foam/overlays) painted over them while opaque meshes (Fence.001)
      // kept their depth -> fence looked drawn in front. Only real translucency stays blended; the rest -> opaque cutout.
      const realBlend = hasOpacity || hasAlphaMap || /glass/i.test(mat.name);
      if (realBlend) {
        cloned.transparent = true;
        cloned.depthWrite = false;
        // [perf] transparent+DoubleSide 는 back/front 2패스로 그려짐 → depthWrite 없는 유리류는 1패스로 충분
        cloned.forceSinglePass = true;
        if ("alphaTest" in cloned && cloned.alphaTest < 0.08) cloned.alphaTest = 0.08;
      } else {
        cloned.transparent = false;
        cloned.depthWrite = true;
        if ("alphaTest" in cloned && cloned.alphaTest < 0.5) cloned.alphaTest = 0.5;
      }
      // [lodzfight] WSE_11_LOD3.* (and siblings sharing these materials): Glass / window frame / sign / vent faces are
      // exactly coplanar with the Metal Tiles / PVC walls (356+ overlapping tris per mesh) -> view-angle z-fighting sparkle.
      // Pull these overlay layers toward the camera in depth so the wall never wins the tie.
      if (/glass|window\s*frame|wndow\s*frame|fire\s*exit|vent/i.test(mat.name)) {
        cloned.polygonOffset = true;
        cloned.polygonOffsetFactor = -2;
        cloned.polygonOffsetUnits = -4;
      }
      cloned.needsUpdate = true;
      shared.set(mat, cloned);
      return cloned;
    });

    child.material = Array.isArray(source) ? next : next[0]!;
  });
}

function namesOf(mesh: Mesh) {
  return [mesh.name, mesh.parent?.name ?? "", mesh.geometry?.name ?? ""];
}

function isGroundMesh(mesh: Mesh) {
  return namesOf(mesh).some(
    (name) => /^ground$/i.test(name) || /cube\.002/i.test(name),
  );
}

const SAT_RE = /^EXPORT_GOOGLE_SAT_WM\.?001$/;
function isSatMesh(mesh: Mesh) {
  return [mesh.name, mesh.parent?.name ?? ""].some((n) => SAT_RE.test(n));
}

function isCraneMesh(mesh: Mesh) {
  return namesOf(mesh).some((name) => /crane/i.test(name));
}

type OccupancyMeshCache = {
  ground: Mesh[];
  others: Mesh[];
};

function collectOccupancyMeshes(root: Object3D): OccupancyMeshCache {
  const ground: Mesh[] = [];
  const others: Mesh[] = [];
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (child.name.endsWith("-occupancy")) return;
    if (isCraneMesh(child)) return;
    if (isSatMesh(child)) return; // [satfade] 위성지형은 occupancy 전환 진행도로 페이드 (가시성 저장/복원 대상 아님)
    if (isGroundMesh(child)) ground.push(child);
    else others.push(child);
  });
  return { ground, others };
}

function rememberOriginalVisible(mesh: Mesh) {
  if (mesh.userData.occupancyOriginalVisible !== undefined) return;
  mesh.userData.occupancyOriginalVisible = mesh.visible;
}

function attachOccupancyClones(
  ground: Mesh[],
  occupancyMaterial: MeshStandardMaterial,
) {
  const clones: Mesh[] = [];
  for (const mesh of ground) {
    const clone = new Mesh(mesh.geometry, occupancyMaterial);
    clone.name = `${mesh.name || "ground"}-occupancy`;
    clone.userData.occupancyOnly = true;
    clone.visible = false;
    clone.castShadow = mesh.castShadow;
    clone.receiveShadow = mesh.receiveShadow;
    clone.frustumCulled = mesh.frustumCulled;
    clone.matrixAutoUpdate = mesh.matrixAutoUpdate;
    clone.position.copy(mesh.position);
    clone.quaternion.copy(mesh.quaternion);
    clone.scale.copy(mesh.scale);
    if (!mesh.matrixAutoUpdate) clone.matrix.copy(mesh.matrix);
    clone.raycast = () => null;
    mesh.parent?.add(clone);
    clones.push(clone);
  }
  return clones;
}

let groundReveal = 0;

function applyOccupancyGroundLook(
  cache: OccupancyMeshCache,
  clones: Mesh[],
  enabled: boolean,
) {
  const token = ++groundReveal;
  for (const mesh of cache.ground) {
    rememberOriginalVisible(mesh);
    mesh.visible = enabled ? false : mesh.userData.occupancyOriginalVisible;
  }
  for (const clone of clones) {
    clone.visible = enabled;
  }
  for (const mesh of cache.others) rememberOriginalVisible(mesh);
  if (enabled) {
    for (const mesh of cache.others) {
      mesh.userData.occupancyHidden = true;
      mesh.visible = false;
    }
    return;
  }
  // 로딩 복원은 한 번에. 오큐펀시를 풀 때만 나눠 켠다 — 한 프레임에 전부 켜면 파이프라인 바인딩이 수 초 멈춘다.
  const hidden = cache.others.filter((mesh) => mesh.userData.occupancyHidden === true);
  if (hidden.length === 0) {
    for (const mesh of cache.others) mesh.visible = mesh.userData.occupancyOriginalVisible;
    return;
  }
  const CHUNK = 60;
  let index = 0;
  const step = () => {
    if (token !== groundReveal) return;
    const end = Math.min(index + CHUNK, hidden.length);
    for (; index < end; index += 1) {
      const mesh = hidden[index]!;
      mesh.userData.occupancyHidden = false;
      mesh.visible = mesh.userData.occupancyOriginalVisible !== false;
    }
    if (index < hidden.length) requestAnimationFrame(step);
  };
  step();
}

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
};

/** [perf] 형제 GLB(선박·크레인)가 Suspense 로 멈추면 첫 렌더가 버려지고 useMemo 가 다시 돌아 clone·merge 가 두 번 실행됐다.
 * 커밋 전까지는 같은 scene 의 결과를 재사용하고, 커밋 뒤엔 지운다(다음 마운트는 새로 만든다). */
const pendingGroundModel = new WeakMap<Object3D, Object3D>();

export default function Ground({
  position = GROUND_POSITION,
  rotation = GROUND_ROTATION,
}: GroundProps) {
  const setModelBlocks = useYardStore((s) => s.setModelBlocks);
  const setModelShips = useYardStore((s) => s.setModelShips);
  const setQuayCranes = useYardStore((s) => s.setQuayCranes);
  const resetBlocks = useYardStore((s) => s.resetBlocks);
  const gl = useThree((state) => state.gl);
  const threeScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | OrbitControlsImpl
    | undefined;
  const { scene } = useGLTF(groundUrl, false, true, extendKtx2); // [perf] KTX2 + meshopt

  const occupancyMaterial = useMemo(() => getOccupancySurfaceMaterial(), []);
  const occupancyWarmed = useRef(false);

  const model = useMemo(() => {
    const pending = pendingGroundModel.get(scene);
    if (pending) return pending;
    const endClone = loadSpan("ground clone+material setup");
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);
    enableGlbShadows(cloned);
    // [shadow] 그림자 생성은 크레인과 안벽(Plane.002). 나머지 지면은 받기만.
    cloned.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      let node: Object3D | null = o;
      let crane = /crane|kran/i.test(o.geometry?.name ?? "");
      while (!crane && node) {
        if (/crane|kran/i.test(node.name)) crane = true;
        node = node.parent;
      }
      const quayWall = [o.name, o.parent?.name ?? ""].some((n) => /^Plane\.?002$/.test(n));
      // 안벽만 그림자를 낸다. 양면(M_Grid)이라 기본 shadowSide 로는 보이는 뒷면에 그림자가 안 앉는다.
      o.castShadow = crane || quayWall;
      if (!quayWall) return;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        if (!(m instanceof MeshStandardMaterial)) return m;
        const c = m.clone();
        c.shadowSide = DoubleSide;
        c.roughness = Math.min(c.roughness, 0.22);
        c.envMapIntensity = Math.max(c.envMapIntensity, 1.35);
        c.needsUpdate = true;
        return c;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    enableGroundAlpha(cloned);
    // [twin-port] 바다와 맞닿는 지면(Ground, 위성지형)은 깊이를 써서 투명 바다/거품을 가림
    cloned.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      // [satfade] 육지 가림(depthWrite): 파도 접촉면 Ground/Plane.002 + 위성지형(기존 렌더 유지)
      if (![o.name, o.parent?.name ?? ""].some((n) => /^(Ground|Plane\.?002|EXPORT_GOOGLE_SAT_WM\.?001)$/.test(n))) return;
      o.renderOrder = -1;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof Material) { m.depthWrite = true; m.needsUpdate = true; }
      }
    });
    // [satfade] 위성지형 머티리얼은 Plane/Plane.002 와 공유(M_Grid) → 전용 복제 후 transparent 1회 설정 (이후 opacity 만 트윈, 재컴파일 없음)
    // 위성 메시는 전부 같은 투명도로 같이 사라진다. 안벽(M_Grid)과는 분리하고, 위성끼리는 하나.
    let satShared: Material | Material[] | null = null;
    cloned.traverse((o) => {
      if (!(o instanceof Mesh) || !isSatMesh(o)) return;
      if (!satShared) {
        const mk = (m: Material) => {
          const c = m.clone();
          c.transparent = true;
          c.opacity = 1;
          c.userData.satFade = true;
          c.needsUpdate = true;
          return c;
        };
        satShared = Array.isArray(o.material) ? o.material.map(mk) : mk(o.material as Material);
      }
      o.material = satShared;
    });
    applyGroundPointerFilter(cloned);
    instanceRepeatedGround(cloned);
    mergeFadeIdenticalStatic(cloned);
    endClone();
    pendingGroundModel.set(scene, cloned);
    return cloned;
  }, [scene]);
  useEffect(() => {
    pendingGroundModel.delete(scene);
  }, [scene]);

  // [satfade] occupancy 전환 진행도(t)에 맞춰 위성지형 페이드 아웃/인
  const satMeshes = useMemo(() => {
    const out: Mesh[] = [];
    model.traverse((o) => { if (o instanceof Mesh && isSatMesh(o)) out.push(o); });
    return out;
  }, [model]);
  const satLast = useRef(-1);
  useFrame(() => {
    const t = occupancyTransitionProgressRef.current.t;
    // [satfade] occupancy 페이드 × 구역 Depth 불투명도 (위성지형은 통째로, 포커스 밖 0.1)
    const a = (1 - t) * getAreaWholeFadeOpacity();
    if (a === satLast.current) return;
    satLast.current = a;
    for (const m of satMeshes) {
      m.visible = a > 0.005;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) (mat as Material).opacity = a;
    }
  });

  // [craneLod] 안벽 크레인 거리 기반 LOD (원본 메시 객체 유지, geometry만 교체)
  const craneLods = useRef<CraneLodSet | null>(null);
  const craneLodFrame = useRef(0);
  const craneLodCam = useRef<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    const releaseWarm = beginSceneWarmTask();
    buildCraneLods(model)
      .then((set) => {
        if (cancelled) return;
        craneLods.current = set;
        craneLodCam.current = [];
        if (import.meta.env.DEV) {
          console.info(
            "[craneLod] " + set.entries.length + " meshes, tris per level",
            set.trianglesPerLevel.map(Math.round),
            "distances",
            CRANE_LOD_LEVELS.map((l) => l.distance),
          );
        }
      })
      .catch((e) => console.warn("[craneLod] 생성 실패, 원본 유지", e))
      .finally(releaseWarm);
    return () => {
      cancelled = true;
      if (craneLods.current) resetCraneLods(craneLods.current);
      craneLods.current = null;
    };
  }, [model]);
  useFrame(({ camera: cam }) => {
    if (++craneLodFrame.current % CRANE_LOD_CHECK_EVERY !== 0) return;
    const e = cam.matrixWorld.elements;
    const last = craneLodCam.current;
    if (last.length && Math.abs(last[12]! - e[12]!) + Math.abs(last[13]! - e[13]!) + Math.abs(last[14]! - e[14]!) < 0.5) return;
    craneLodCam.current = [e[12]!, e[13]!, e[14]!];
    const set = craneLods.current;
    if (set) updateCraneLods(set, cam);
    updateQuayCraneLods(cam);
  });

  // [groundLod] 펜스/도로/차선 청크 거리 LOD (반복 구간 geometry 공유, 청크만 교체)
  const groundLods = useRef<GroundLodSet | null>(null);
  const groundLodFrame = useRef(0);
  const groundLodCam = useRef<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    const releaseWarm = beginSceneWarmTask();
    buildGroundLods(model)
      .then((set) => {
        if (cancelled) return;
        groundLods.current = set;
        groundLodCam.current = [];
        updateGroundLods(set, camera);
        if (import.meta.env.DEV) {
          console.info(
            "[groundLod] " + set.entries.length + " meshes, tris per level",
            set.trianglesPerLevel.map(Math.round),
            "distances",
            GROUND_LOD_LEVELS.map((l) => l.distance),
          );
        }
      })
      .catch((e) => console.warn("[groundLod] 생성 실패, 원본 유지", e))
      .finally(releaseWarm);
    return () => {
      cancelled = true;
      if (groundLods.current) resetGroundLods(groundLods.current);
      groundLods.current = null;
    };
  }, [model]);
  useFrame(({ camera: cam }) => {
    const set = groundLods.current;
    if (!set) return;
    if (++groundLodFrame.current % GROUND_LOD_CHECK_EVERY !== 0) return;
    const e = cam.matrixWorld.elements;
    const last = groundLodCam.current;
    if (last.length && Math.abs(last[12]! - e[12]!) + Math.abs(last[13]! - e[13]!) + Math.abs(last[14]! - e[14]!) < 0.5) return;
    groundLodCam.current = [e[12]!, e[13]!, e[14]!];
    updateGroundLods(set, cam);
  });
  const occupancyMeshes = useMemo(() => collectOccupancyMeshes(model), [model]);

  useLayoutEffect(() => {
    const endExtract = loadSpan("ground extract (blocks/berths/quayCranes)");
    model.position.set(...position);
    model.rotation.set(...rotation);
    model.updateMatrixWorld(true);
    const blocks = extractGroundBlocks(model);
    const shipPoints = extractShipPoints(model);
    const berths = shipPoints.length > 0 ? shipPoints : shipsFromPlacements();
    const quayCranes = extractQuayCranePlacements(model);
    if (berths.length > 0) setModelShips(berths);
    if (quayCranes.length > 0) {
      setQuayCranes(quayCranes);
      if (import.meta.env.DEV) {
        console.info(
          `[Ground] ${quayCranes.length} quay cranes`,
          quayCranes.map(
            (crane, index) =>
              `${index}: ${crane.mesh} (#${crane.glbIndex}) @ ${crane.position.map((n) => n.toFixed(1)).join(",")}`,
          ),
        );
      }
    }
    if (blocks.length > 0) {
      if (import.meta.env.DEV) {
        console.info(
          `[Ground] ${blocks.length}개 블록 위치`,
          blocks.map(
            (b) => `${b.code}@${b.origin.map((n) => n.toFixed(1)).join(",")}`,
          ),
        );
      }
      setModelBlocks(blocks);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[Ground] Block / ContainerStack 오브젝트가 없습니다. 노드:",
        listObjectNames(model),
      );
    }
    // 지형 land/거리장은 CPU shore bake 로 일원화 (구 bakeLandMask GPU 패스 대체, TSL 오션 해안 거품이 사용)
    // ocean-tsl 해안 거품용 지형 거리장 (1회)
    endExtract();
    bakePortShoreOnce(model);
    return () => {
      resetBlocks();
    };
  }, [
    model,
    position,
    rotation,
    setModelBlocks,
    setModelShips,
    setQuayCranes,
    resetBlocks,
    gl,
  ]);

  useLayoutEffect(() => {
    // StrictMode는 useMemo 계산을 두 번 호출하고 한 모델을 버린다.
    // 전역 인스턴스 레지스트리는 커밋된 모델에만 연결해야 Depth가 실제 화면에 반영된다.
    const releaseQuay = beginSceneWarmTask();
    void instanceQuayCranes(model).finally(releaseQuay);
    bindQuayCraneModel(model);
    bindCraneDepthFade(model);
    bindAreaDepthFade(model);
    return () => {
      bindQuayCraneModel(null);
      bindCraneDepthFade(null);
      bindAreaDepthFade(null);
    };
  }, [model]);
  // [depthfade] Depth 포커스 밖 크레인 opacity 트윈
  useFrame((_, dt) => {
    updateCraneDepthFade(Math.min(dt, 0.1));
    updateQuayCraneFade(Math.min(dt, 0.1));
    updateAreaDepthFade(Math.min(dt, 0.1)); // [areafade]
  });

  useLayoutEffect(() => {
    model.updateMatrixWorld(true);
    const view = extractGlbViewCamera(model);
    if (!view) return;
    if (isViewportTracking(useViewportStore.getState())) return;
    applyGlbViewCamera(camera, view, controls ?? null);
  }, [model, position, rotation, camera, controls]);

  useLayoutEffect(() => {
    const clones = attachOccupancyClones(
      occupancyMeshes.ground,
      occupancyMaterial,
    );

    const apply = (look: boolean) => {
      applyOccupancyGroundLook(occupancyMeshes, clones, look);
    };

    if (!occupancyWarmed.current) {
      // 실제 메시 컴파일은 SceneWarmup 이 로딩 중 양쪽 룩을 모두 준비한다. 여기서 씬 전체를 동기 컴파일하면 전환 프레임이 멈춘다.
      warmupOccupancyPrograms(gl as never, threeScene, camera);
      occupancyWarmed.current = true;
    }
    apply(useOccupancyStore.getState().occupancyLook);

    const unsub = useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(state.occupancyLook);
    });
    const unregister = registerOccupancySync(apply);

    return () => {
      unsub();
      unregister();
      for (const clone of clones) {
        clone.removeFromParent();
      }
    };
  }, [occupancyMeshes, occupancyMaterial, gl, threeScene, camera]);

  return (
    <>
      <primitive
        object={model}
        position={position}
        rotation={rotation}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          const drawn = quayHoverFromEvent(event);
          const root = drawn ? null : findQuayCraneRoot(event.object);
          if (!drawn && !root) return;
          event.stopPropagation();
          setViewportPickCursor(true);
          const id = drawn ? drawn.id : root!.uuid;
          rememberQuayHoverIndex(id, drawn?.glbIndex ?? parseQuayCraneGlbIndex(event.object));
          portHoverOver(event, "quayCrane", id);
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => {
          const drawn = quayHoverFromEvent(event);
          const root = drawn ? null : findQuayCraneRoot(event.object);
          if (!drawn && !root) return;
          event.stopPropagation();
          setViewportPickCursor(false);
          const id = drawn ? drawn.id : root!.uuid;
          portHoverOut(event, "quayCrane", id);
        }}
        onClick={(event: ThreeEvent<PointerEvent>) => {
    if (event.delta > 4) return; // [twin-port] 드래그(궤도 회전) 후 놓은 경우는 선택 안 함
          const glbIndex = pickCraneGlbIndexFromClick(event);
          if (glbIndex == null) return;
          event.stopPropagation();
          activateCraneFromViewport(glbIndex);
        }}
      />
      <QuayCraneHoverOutlines model={model} />
      <QuayCraneTrackingHover model={model} />
      <QuayCraneFailureOutlines model={model} />
      <QuayCraneReflection model={model} />
      <SceneWarmup />
    </>
  );
}

/** [failure] 고장 크레인 — 해당 GLB index 의 모든 부품에 빨강 깜빡임 outline */
function QuayCraneFailureOutlines({ model }: { model: Object3D }) {
  const targets = useMemo(() => collectQuayHoverTargets(model), [model]);
  const targetIndex = useMemo(
    () =>
      targets.map((target) => {
        let node: Object3D | null = target.source;
        while (node) {
          const idx = parseCraneNameIndex(node.name);
          if (idx != null) return idx;
          node = node.parent;
        }
        return null;
      }),
    [targets],
  );
  const outlineRefs = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const active = new Map(getActiveByKind("quayCrane").map((item) => [item.index, item.state]));
    targets.forEach((target, i) => {
      const outline = outlineRefs.current[i];
      if (!outline) return;
      const idx = targetIndex[i];
      const state = idx == null ? undefined : active.get(idx);
      outline.visible = state != null;
      if (!state) return;
      setAlertOutlineVariant(outline, state);
      outline.matrixAutoUpdate = false;
      outline.matrix.copy(target.source.matrixWorld);
      outline.matrixWorldNeedsUpdate = true;
    });
  });

  return (
    <>
      {targets.map((target, index) => (
        <HoverOutlineMesh
          key={`fail-${target.rootId}-${index}`}
          variant="failure"
          geometry={target.geometry}
          meshRef={(node) => {
            outlineRefs.current[index] = node;
          }}
        />
      ))}
    </>
  );
}

/** tracking 시 hover outline과 동일한 port hover pin */
function QuayCraneTrackingHover({ model }: { model: Object3D }) {
  useLayoutEffect(() => {
    const sync = () => {
      const glbIndex = useViewportStore.getState().selectedCraneIndex;
      if (glbIndex == null) {
        unpinPortHover("quayCrane");
        return;
      }
      const id = resolveQuayCraneHoverId(model, glbIndex);
      if (id) pinPortHover({ kind: "quayCrane", id });
      else unpinPortHover("quayCrane");
    };

    sync();
    const unsubViewport = useViewportStore.subscribe((state, prev) => {
      if (state.selectedCraneIndex === prev.selectedCraneIndex) return;
      sync();
    });
    const unsubCranes = useYardStore.subscribe((state, prev) => {
      if (state.quayCranes === prev.quayCranes) return;
      sync();
    });
    return () => {
      unsubViewport();
      unsubCranes();
      unpinPortHover("quayCrane");
    };
  }, [model]);

  return null;
}

function QuayCraneHoverOutlines({ model }: { model: Object3D }) {
  const targets = useMemo(() => collectQuayHoverTargets(model), [model]);
  const outlineRefs = useRef<(Mesh | null)[]>([]);

  useLayoutEffect(() => {
    const apply = () => {
      const hover = getPortHover();
      const hoverId = hover?.kind === "quayCrane" ? hover.id : null;
      const hoverGlb = hoverId != null ? quayGlbIndexOfHover(hoverId) : null;
      const glbIndex = getActiveCraneGlbIndex(useViewportStore.getState());
      targets.forEach((target, index) => {
        const outline = outlineRefs.current[index];
        if (!outline) return;
        const sourceGlb = parseQuayCraneGlbIndex(target.source);
        const showByHover =
          (hoverId != null && quayTargetMatches(target, hoverId)) ||
          (hoverGlb != null && sourceGlb === hoverGlb);
        const showByCrane =
          glbIndex != null &&
          quayTargetMatchesGlbIndex(target.source, glbIndex);
        const show = showByHover || showByCrane;
        outline.visible = show;
        if (!show) return;
        target.source.updateWorldMatrix(true, false);
        writeQuayOutlineMatrix(target, outline, hoverId);
      });
    };

    apply();
    const unsubOutline = registerPortOutlineApplier(apply);
    const unsubViewport = useViewportStore.subscribe((state, prev) => {
      if (
        state.selectedCraneIndex === prev.selectedCraneIndex &&
        state.focusedCraneGlbIndex === prev.focusedCraneGlbIndex &&
        state.outlineSuppressed === prev.outlineSuppressed
      ) {
        return;
      }
      apply();
    });
    return () => {
      unsubOutline();
      unsubViewport();
    };
  }, [targets, model]);

  return (
    <>
      {targets.map((target, index) => (
        <HoverOutlineMesh
          key={`${target.rootId}-${index}`}
          geometry={target.geometry}
          meshRef={(node) => {
            outlineRefs.current[index] = node;
          }}
        />
      ))}
    </>
  );
}

// [perf] KTX2 은 renderer detectSupport 이후에만 파싱 가능 → 준비 후 preload
whenKtx2Ready(() => useGLTF.preload(groundUrl, false, true, extendKtx2));
