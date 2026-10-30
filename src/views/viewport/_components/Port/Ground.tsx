import { loadSpan } from "@/debug/loadTiming";
import { bindQuayCraneModel } from "@/domain/cameraFocus";
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
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Vector3Tuple,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import HoverOutlineMesh from "./HoverOutlineMesh";
import { QuayCraneReflection, SceneWarmup } from "./WaterReflection";
import { parseCraneNameIndex, parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { rememberQuayHoverIndex } from "@/domain/hoverTooltip";
import { getFailedIndices } from "@/stores/useFailureStore";
import { bakePortShoreOnce } from "../OceanTsl/portShore";

/** opacity만으로는 안 보임 — Three.js는 transparent=true 여야 알파가 블렌딩됨 */
function enableGroundAlpha(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;

    const source = child.material;
    const list = Array.isArray(source) ? source : [source];

    const next = list.map((mat) => {
      if (!(mat instanceof Material)) return mat;

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

function applyOccupancyGroundLook(
  cache: OccupancyMeshCache,
  clones: Mesh[],
  enabled: boolean,
) {
  for (const mesh of cache.ground) {
    rememberOriginalVisible(mesh);
    mesh.visible = enabled ? false : mesh.userData.occupancyOriginalVisible;
  }
  for (const clone of clones) {
    clone.visible = enabled;
  }
  for (const mesh of cache.others) {
    rememberOriginalVisible(mesh);
    mesh.visible = enabled ? false : mesh.userData.occupancyOriginalVisible;
  }
}

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
};

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
    const endClone = loadSpan("ground clone+material setup");
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);
    enableGlbShadows(cloned);
    // [shadow] 그림자 생성은 크레인만 (건물/지면/수목/Cube/위성지형은 받기만). LOD 는 같은 Mesh 의 geometry 교체라 유지됨
    cloned.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      let node: Object3D | null = o;
      let crane = /crane|kran/i.test(o.geometry?.name ?? "");
      while (!crane && node) {
        if (/crane|kran/i.test(node.name)) crane = true;
        node = node.parent;
      }
      o.castShadow = crane;
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
    cloned.traverse((o) => {
      if (!(o instanceof Mesh) || !isSatMesh(o)) return;
      const mk = (m: Material) => { const c = m.clone(); c.transparent = true; c.opacity = 1; c.needsUpdate = true; return c; };
      o.material = Array.isArray(o.material) ? o.material.map(mk) : mk(o.material as Material);
    });
    applyGroundPointerFilter(cloned);
    endClone();
    return cloned;
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
    if (t === satLast.current) return;
    satLast.current = t;
    const a = 1 - t;
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
      .catch((e) => console.warn("[craneLod] 생성 실패, 원본 유지", e));
    return () => {
      cancelled = true;
      if (craneLods.current) resetCraneLods(craneLods.current);
      craneLods.current = null;
    };
  }, [model]);
  useFrame(({ camera: cam }) => {
    const set = craneLods.current;
    if (!set) return;
    if (++craneLodFrame.current % CRANE_LOD_CHECK_EVERY !== 0) return;
    const e = cam.matrixWorld.elements;
    const last = craneLodCam.current;
    if (last.length && Math.abs(last[12]! - e[12]!) + Math.abs(last[13]! - e[13]!) + Math.abs(last[14]! - e[14]!) < 0.5) return;
    craneLodCam.current = [e[12]!, e[13]!, e[14]!];
    updateCraneLods(set, cam);
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
    bindQuayCraneModel(model);
    return () => bindQuayCraneModel(null);
  }, [model]);

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
      apply(true);
      warmupOccupancyPrograms(gl as never, threeScene, camera);
      gl.compile(threeScene, camera);
      occupancyWarmed.current = true;
    }
    apply(useOccupancyStore.getState().occupancyLook);

    const unsub = useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(state.occupancyLook);
    });

    return () => {
      unsub();
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
          const root = findQuayCraneRoot(event.object);
          if (!root) return;
          event.stopPropagation();
          setViewportPickCursor(true);
          const id =
            event.instanceId != null
              ? `${root.uuid}:${event.instanceId}`
              : root.uuid;
          rememberQuayHoverIndex(id, parseQuayCraneGlbIndex(event.object));
          portHoverOver(event, "quayCrane", id);
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => {
          const root = findQuayCraneRoot(event.object);
          if (!root) return;
          event.stopPropagation();
          setViewportPickCursor(false);
          const id =
            event.instanceId != null
              ? `${root.uuid}:${event.instanceId}`
              : root.uuid;
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
    const failed = getFailedIndices("quayCrane");
    targets.forEach((target, i) => {
      const outline = outlineRefs.current[i];
      if (!outline) return;
      const idx = targetIndex[i];
      const show = idx != null && failed.includes(idx);
      outline.visible = show;
      if (!show) return;
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
      const glbIndex = getActiveCraneGlbIndex(useViewportStore.getState());
      targets.forEach((target, index) => {
        const outline = outlineRefs.current[index];
        if (!outline) return;
        const showByHover =
          hoverId != null && quayTargetMatches(target, hoverId);
        const showByCrane =
          glbIndex != null &&
          quayTargetMatchesGlbIndex(target.source, glbIndex);
        const show = showByHover || showByCrane;
        const wasVisible = outline.visible;
        outline.visible = show;
        if (!show || (wasVisible && show)) return;
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
