import containersUrl from "@/assets/model/containers.glb";
import {
  COMPANY_COLOR,
  CONTAINER_COLORS,
  MAX_PER_COLOR,
  type ContainerColorKey,
  type ContainerCompany,
} from "@/constants/container";
import { getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { composeContainerMatrix } from "@/domain/container";
import {
  applyUnifiedContainerColor,
  buildContainerPrototypes,
  buildUnifiedContainerGeometry,
  buildUnifiedContainerMaterial,
  CONTAINER_COLOR_ATTR,
} from "@/domain/containerPrototype";
import { ensureContainerBlockMesh, ensureUnifiedContainerBlockMesh } from "@/domain/containerInstancePool";
import { getBlockFadeLevel, getFadeMaterial, useAreaDepthFadeVersion } from "@/domain/areaDepthFade";
import { beginSceneWarmTask } from "./WaterReflection";
import { useYardStore } from "@/stores/yard";
import type { Container } from "@/types/container";
import { occupancyStage, subscribeOccupancyHeavy } from "@/domain/occupancyLook/occupancySync";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useGLTF } from "@react-three/drei";
import { extendKtx2, whenKtx2Ready } from "@/domain/gltfLoaders";
import { useFrame } from "@react-three/fiber";
import {
  CONTAINER_LOD_CHECK_EVERY,
  CONTAINER_LOD_ENABLED,
  CONTAINER_LOD_FAR_DISTANCE,
  CONTAINER_LOD_HYSTERESIS,
  CONTAINER_LOD_MOVE_EPS,
} from "@/constants/containerLod";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Color,
  DynamicDrawUsage,
  Group,
  type InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

/** 블록 1개·색 1개의 인스턴스 상한. 슬롯 최대(20×6×4)보다 넉넉하다. */
const BLOCK_INSTANCE_CAP = 1024;

type BlockMeshKind = "solid" | "fade0" | "fade1" | "column" | "col0" | "col1";

/** [containerLod] 블록 1개의 원거리 표현 */
type BlockLod = {
  center: Vector3;
  /** 스택 기둥 (row×bay 칸마다 1개): 맨 위 컨테이너 색 + 1단 바닥~최상단 꼭대기 행렬 */
  columns: { colorKey: ContainerColorKey; matrix: Matrix4 }[];
};

const _lodCam = new Vector3();

/** InstancedMesh를 모서리 라인(gl.LINES)으로 그리기 위한 플래그 */
function enableInstancedEdges(mesh: InstancedMesh) {
  Object.assign(mesh, {
    isMesh: false,
    isLine: true,
    isLineSegments: true,
  });
}

function isCompany(value: string): value is ContainerCompany {
  return value in COMPANY_COLOR;
}

function slotToMatrix(
  container: Container,
  blockByCode: Record<string, BlockDefinition>,
  deckY: number,
  tierOverride?: number,
) {
  const block = blockByCode[container.location.block];
  if (!block) return null;

  const row = Number(container.location.slot.row) - 1;
  const bay = Number(container.location.slot.bay) - 1;
  const tier = tierOverride ?? Number(container.location.slot.tier);

  const grid = getBlockSlotGrid(block);
  return composeContainerMatrix(
    row,
    bay,
    tier,
    deckY,
    block.origin,
    block.yaw ?? 0,
    grid.rowPitch,
    grid.bayPitch,
    grid.padX,
    grid.padZ,
  );
}

export default function ContainerYard({
  visible = true,
}: {
  visible?: boolean;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const yardOffset = useYardStore((s) => s.yardOffset);
  const containers = useYardStore((s) => s.containers);
  const { scene } = useGLTF(containersUrl, false, true, extendKtx2);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const restoreStage = useSyncExternalStore(subscribeOccupancyHeavy, occupancyStage, () => 99);

  const blockRoot = useMemo(() => new Group(), []);
  const blockMeshes = useRef(new Map<string, InstancedMesh>());
  const highlightRefs = useRef<
    Partial<Record<ContainerColorKey, InstancedMesh>>
  >({});
  const wireframeRefs = useRef<
    Partial<Record<ContainerColorKey, InstancedMesh>>
  >({});
  const [meshesReady, setMeshesReady] = useState(false);
  const releaseYardWarm = useRef<(() => void) | null>(null);
  useEffect(() => {
    releaseYardWarm.current = beginSceneWarmTask();
    return () => {
      releaseYardWarm.current?.();
      releaseYardWarm.current = null;
    };
  }, []);
  // [areafade] 구역 Depth: 포커스 밖 블록 컨테이너는 반투명 메시로 [레벨1(구역 밖), 레벨2(그룹 밖)]
  const fadeVersion = useAreaDepthFadeVersion();

  const matchedIds = useMemo(() => {
    if (!selectedContainerId) return null;
    return new Set([selectedContainerId]);
  }, [selectedContainerId]);

  const blockByCode = useMemo(
    () =>
      Object.fromEntries(blocks.map((block) => [block.code, block])) as Record<
        string,
        BlockDefinition
      >,
    [blocks],
  );

  const prototypes = useMemo(() => buildContainerPrototypes(scene), [scene]);
  // 카메라 이동은 적재 데이터 변경이 아니다. 17,000여 개 슬롯의 행렬을 매번 재계산하지 않는다.
  const placements = useMemo(() => containers.flatMap((container) => {
    if (container.status !== "stored" || !isCompany(container.company)) return [];
    const matrix = slotToMatrix(container, blockByCode, deckY);
    return matrix ? [{ container, matrix, colorKey: COMPANY_COLOR[container.company] }] : [];
  }), [containers, blockByCode, deckY]);
  const blockColors = useMemo(() => {
    const pairs = new Map<string, { code: string; colorKey: ContainerColorKey }>();
    for (const { container, colorKey } of placements) {
      const code = container.location.block;
      pairs.set(`${code}|${colorKey}`, { code, colorKey });
    }
    return [...pairs.values()];
  }, [placements]);
  const fadeMaterials = useMemo(
    () =>
      ([1, 2] as const).map(
        (level) =>
          Object.fromEntries(
            CONTAINER_COLORS.map((c) => [c.key, getFadeMaterial(prototypes[c.key].material, level)]),
          ) as Record<ContainerColorKey, Material>,
      ),
    [prototypes],
  );

  // [perf] 블록마다 색별 메시 4개 → 통합 메시 1개 (색은 인스턴스 attribute). 정점 대응 실패 시 null → 기존 색별 경로.
  const unified = useMemo(() => {
    const geometry = buildUnifiedContainerGeometry(prototypes);
    if (!geometry) {
      console.warn("[ContainerYard] 통합 컨테이너 geometry 생성 실패 → 색별 메시 사용");
      return null;
    }
    const material = buildUnifiedContainerMaterial(prototypes);
    const materials = [
      material,
      applyUnifiedContainerColor(getFadeMaterial(material, 1)),
      applyUnifiedContainerColor(getFadeMaterial(material, 2)),
    ] as const;
    return { geometry, materials };
  }, [prototypes]);
  const colorIndex = useMemo(
    () => Object.fromEntries(CONTAINER_COLORS.map((c, i) => [c.key, i])) as Record<ContainerColorKey, number>,
    [],
  );

  // [containerLod] 블록별 스택 기둥 + 블록 중심 미리 계산
  const blockLods = useMemo(() => {
    const stacks = new Map<
      string,
      { container: Container; top: number; colorKey: ContainerColorKey }
    >();
    for (const container of containers) {
      if (container.status !== "stored") continue;
      if (!isCompany(container.company)) continue;
      if (!blockByCode[container.location.block]) continue;
      const { row, bay, tier } = container.location.slot;
      const key = `${container.location.block}|${row}|${bay}`;
      const t = Number(tier);
      const st = stacks.get(key);
      if (!st || t > st.top) {
        stacks.set(key, { container, top: t, colorKey: COMPANY_COLOR[container.company] });
      }
    }
    const out = new Map<string, BlockLod>();
    const p0 = new Vector3();
    const p1 = new Vector3();
    const q = new Quaternion();
    const sc = new Vector3();
    for (const st of stacks.values()) {
      const bottom = slotToMatrix(st.container, blockByCode, deckY, 1);
      const top = slotToMatrix(st.container, blockByCode, deckY, st.top);
      if (!bottom || !top) continue;
      bottom.decompose(p0, q, sc);
      top.decompose(p1, q, sc);
      // 중심 = 1단·최상단 중심의 중간, 높이 = 단수 배 (빈 단이 있어도 최상단까지 채움)
      p0.add(p1).multiplyScalar(0.5);
      sc.y *= Math.max(1, st.top);
      const code = st.container.location.block;
      let b = out.get(code);
      if (!b) {
        b = { center: new Vector3(), columns: [] };
        out.set(code, b);
      }
      b.columns.push({ colorKey: st.colorKey, matrix: new Matrix4().compose(p0, q, sc) });
      b.center.add(p0);
    }
    for (const b of out.values()) {
      b.center.divideScalar(Math.max(1, b.columns.length));
      b.center.x += yardOffset[0];
      b.center.y += yardOffset[1];
      b.center.z += yardOffset[2];
    }
    return out;
  }, [containers, blockByCode, deckY, yardOffset]);

  // 멀리 있어 기둥으로 대체된 블록 코드 (정렬된 문자열 키로 변경 감지)
  const [farKey, setFarKey] = useState("");
  const farBlocks = useMemo(
    () => new Set(farKey ? farKey.split(",") : []),
    [farKey],
  );
  const lodFrame = useRef(0);
  const lodLastCam = useRef<Vector3 | null>(null);
  useEffect(() => {
    lodLastCam.current = null; // 데이터/선택 바뀌면 즉시 재검사
  }, [blockLods, matchedIds]);

  useFrame(({ camera }) => {
    if (!CONTAINER_LOD_ENABLED || matchedIds) return; // 선택 중엔 전부 원본
    if (++lodFrame.current % CONTAINER_LOD_CHECK_EVERY !== 0) return;
    camera.getWorldPosition(_lodCam);
    const last = lodLastCam.current;
    if (last && last.distanceTo(_lodCam) < CONTAINER_LOD_MOVE_EPS) return;
    lodLastCam.current = (last ?? new Vector3()).copy(_lodCam);
    const near = CONTAINER_LOD_FAR_DISTANCE * (1 - CONTAINER_LOD_HYSTERESIS);
    const next: string[] = [];
    for (const [code, b] of blockLods) {
      const d = b.center.distanceTo(_lodCam);
      if (d >= CONTAINER_LOD_FAR_DISTANCE || (farBlocks.has(code) && d >= near)) {
        next.push(code);
      }
    }
    const key = next.sort().join(",");
    if (key !== farKey) setFarKey(key);
  });

  const wireframeMaterials = useMemo(
    () =>
      Object.fromEntries(
        CONTAINER_COLORS.map((c) => [
          c.key,
          new LineBasicMaterial({
            color: new Color(c.hex).multiplyScalar(0.35),
            linewidth: 1,
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
            toneMapped: false,
          }),
        ]),
      ) as Record<ContainerColorKey, LineBasicMaterial>,
    [],
  );

  // [perf] 언마운트(또는 원본 교체) 시 이 컴포넌트가 만든 geometry/material 해제. 텍스처(map)는 GLTF 캐시 소유라 두고, 블록 메시는 아래 정리 effect 가 뗀다.
  useEffect(
    () => () => {
      for (const proto of Object.values(prototypes)) {
        proto.geometry.dispose();
        proto.edgeGeometry.dispose();
        proto.material.dispose();
        proto.highlightMaterial.dispose();
      }
      for (const level of fadeMaterials) for (const m of Object.values(level)) m.dispose();
      for (const m of Object.values(wireframeMaterials)) m.dispose();
      if (unified) {
        unified.geometry.dispose();
        for (const m of unified.materials) m.dispose();
      }
    },
    [prototypes, fadeMaterials, wireframeMaterials, unified],
  );

  useFrame(({ clock }) => {
    if (!matchedIds) return;
    const pulse = 0.4 + (Math.sin(clock.elapsedTime * 4) * 0.5 + 0.5) * 1.8;
    CONTAINER_COLORS.forEach((c) => {
      prototypes[c.key].highlightMaterial.emissiveIntensity = pulse;
    });
  });

  // setMatrixAt은 캐시된 원본 행렬을 읽어 GPU 버퍼로 복사하며 placements를 변경하지 않는다.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (!meshesReady) return;

    const materialFor = (kind: BlockMeshKind, color: ContainerColorKey) => {
      const proto = prototypes[color];
      if (kind === "solid" || kind === "column") return proto.material;
      if (kind === "fade0" || kind === "col0") return fadeMaterials[0]![color];
      return fadeMaterials[1]![color];
    };
    const ensureBlockMesh = (code: string, kind: BlockMeshKind, color: ContainerColorKey) => {
      if (unified) {
        const mesh = ensureUnifiedContainerBlockMesh(blockMeshes.current, blockRoot, code, unified.geometry,
          unified.materials, BLOCK_INSTANCE_CAP);
        const m = unified.materials;
        mesh.material = kind === "solid" || kind === "column" ? m[0] : kind === "fade0" || kind === "col0" ? m[1] : m[2];
        return mesh;
      }
      const proto = prototypes[color];
      const mesh = ensureContainerBlockMesh(blockMeshes.current, blockRoot, code, color,
        proto.geometry, [proto.material, fadeMaterials[0]![color], fadeMaterials[1]![color]], BLOCK_INSTANCE_CAP);
      mesh.material = materialFor(kind, color);
      return mesh;
    };
    // 처음부터 원거리여도 하단에만 있는 색까지 실제 블록·색 전체를 예열한다.
    for (const { code, colorKey } of blockColors) {
      ensureBlockMesh(code, "solid", colorKey);
    }
    const pushBlock = (code: string, kind: BlockMeshKind, color: ContainerColorKey, m: Matrix4) => {
      const mesh = ensureBlockMesh(code, kind, color);
      const i = mesh.count;
      if (i >= BLOCK_INSTANCE_CAP) return;
      mesh.setMatrixAt(i, m);
      if (unified) {
        (mesh.geometry.getAttribute(CONTAINER_COLOR_ATTR) as InstancedBufferAttribute).array[i] = colorIndex[color];
      }
      mesh.count = i + 1;
      mesh.visible = true;
    };

    const highlightCounts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;
    const wireCounts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;

    for (const mesh of blockMeshes.current.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
    CONTAINER_COLORS.forEach((c) => {
      const highlight = highlightRefs.current[c.key];
      const wire = wireframeRefs.current[c.key];
      if (highlight) highlight.count = 0;
      if (wire) wire.count = 0;
    });

    // [containerLod] 선택 중이 아니면 먼 블록은 스택 기둥으로. 블록마다 메시라 화면 밖은 프러스텀에서 빠진다.
    const useLod = CONTAINER_LOD_ENABLED && !matchedIds;
    if (useLod) {
      for (const code of farBlocks) {
        const b = blockLods.get(code);
        if (!b) continue;
        const lvl = getBlockFadeLevel(code);
        const columnKind: BlockMeshKind = lvl === 1 ? "col0" : lvl === 2 ? "col1" : "column";
        for (const col of b.columns) pushBlock(code, columnKind, col.colorKey, col.matrix);
      }
    }

    for (const { container, matrix, colorKey } of placements) {
      if (useLod && farBlocks.has(container.location.block)) continue;
      const matched = matchedIds?.has(container.id) ?? false;

      if (matchedIds && matched) {
        const mesh = highlightRefs.current[colorKey];
        const idx = highlightCounts[colorKey];
        if (!mesh || idx >= MAX_PER_COLOR) continue;
        mesh.setMatrixAt(idx, matrix);
        highlightCounts[colorKey] = idx + 1;
        mesh.count = idx + 1;
        continue;
      }

      if (matchedIds) {
        const mesh = wireframeRefs.current[colorKey];
        const idx = wireCounts[colorKey];
        if (!mesh || idx >= MAX_PER_COLOR) continue;
        mesh.setMatrixAt(idx, matrix);
        wireCounts[colorKey] = idx + 1;
        mesh.count = idx + 1;
        continue;
      }

      const lvl = getBlockFadeLevel(container.location.block);
      let kind: BlockMeshKind = "solid";
      if (lvl === 1) kind = "fade0";
      else if (lvl === 2) kind = "fade1";
      // eslint-disable-next-line react-hooks/immutability -- setMatrixAt copies from matrix; it never mutates the cached source.
      pushBlock(container.location.block, kind, colorKey, matrix);
    }

    CONTAINER_COLORS.forEach((c) => {
      const highlight = highlightRefs.current[c.key];
      const wire = wireframeRefs.current[c.key];
      if (highlight) highlight.instanceMatrix.needsUpdate = true;
      if (wire) wire.instanceMatrix.needsUpdate = true;
    });
    for (const mesh of blockMeshes.current.values()) {
      if (mesh.count === 0) continue;
      mesh.instanceMatrix.needsUpdate = true;
      const colors = mesh.geometry.getAttribute(CONTAINER_COLOR_ATTR) as InstancedBufferAttribute | undefined;
      if (colors) colors.needsUpdate = true;
      mesh.boundingSphere = null;
    }
    releaseYardWarm.current?.();
    releaseYardWarm.current = null;
  }, [placements, blockColors, meshesReady, matchedIds, farBlocks, blockLods, fadeVersion, prototypes, fadeMaterials, blockRoot, unified, colorIndex]);

  useEffect(() => {
    const meshes = blockMeshes.current;
    return () => {
      for (const mesh of meshes.values()) {
        mesh.removeFromParent();
        mesh.dispose();
        // 통합 메시는 블록마다 geometry 를 따로 만든다 (색 인덱스 버퍼 소유)
        if (mesh.userData.unifiedBase) mesh.geometry.dispose();
      }
      meshes.clear();
    };
  }, []);

  function tryMarkReady() {
    if (meshesReady) return;
    const highlightsReady = CONTAINER_COLORS.every(
      (item) => highlightRefs.current[item.key],
    );
    const wiresReady = CONTAINER_COLORS.every(
      (item) => wireframeRefs.current[item.key],
    );
    if (highlightsReady && wiresReady) setMeshesReady(true);
  }

  return (
    <group position={[...yardOffset]} visible={visible}>
      <group visible={!occupancyLook && restoreStage >= 2}>
        <primitive object={blockRoot} />
        {CONTAINER_COLORS.map((c) => (
          <instancedMesh
            key={`wire-${c.key}`}
            ref={(node) => {
              if (!node) return;
              node.instanceMatrix.setUsage(DynamicDrawUsage);
              enableInstancedEdges(node);
              wireframeRefs.current[c.key] = node;
              tryMarkReady();
            }}
            args={[
              prototypes[c.key].edgeGeometry,
              wireframeMaterials[c.key],
              MAX_PER_COLOR,
            ]}
            frustumCulled={false}
            visible={!!matchedIds} // 모서리선은 컨테이너 선택 시에만 (비선택 시 렌더 안 함)
            raycast={() => null}
          />
        ))}
      </group>
      {CONTAINER_COLORS.map((c) => (
        <instancedMesh
          key={`highlight-${c.key}`}
          ref={(node) => {
            if (!node) return;
            node.instanceMatrix.setUsage(DynamicDrawUsage);
            highlightRefs.current[c.key] = node;
            tryMarkReady();
          }}
          args={[
            prototypes[c.key].geometry,
            prototypes[c.key].highlightMaterial,
            MAX_PER_COLOR,
          ]}
          frustumCulled={false}
          renderOrder={10}
          castShadow={false} // 야드 컨테이너: 그림자 받기만
          receiveShadow
          raycast={() => null}
        />
      ))}
    </group>
  );
}

whenKtx2Ready(() => useGLTF.preload(containersUrl, false, true, extendKtx2)); // [perf] KTX2: detectSupport 이후
