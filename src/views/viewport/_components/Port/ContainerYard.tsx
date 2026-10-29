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
import { buildContainerPrototypes } from "@/domain/containerPrototype";
import { useYardStore } from "@/stores/yard";
import type { Container } from "@/types/container";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CONTAINER_LOD_CHECK_EVERY,
  CONTAINER_LOD_ENABLED,
  CONTAINER_LOD_FAR_DISTANCE,
  CONTAINER_LOD_HYSTERESIS,
  CONTAINER_LOD_MOVE_EPS,
} from "@/constants/containerLod";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  DynamicDrawUsage,
  type InstancedMesh,
  LineBasicMaterial,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

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
  const { scene } = useGLTF(containersUrl);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);

  const solidRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>>(
    {},
  );
  const highlightRefs = useRef<
    Partial<Record<ContainerColorKey, InstancedMesh>>
  >({});
  const wireframeRefs = useRef<
    Partial<Record<ContainerColorKey, InstancedMesh>>
  >({});
  const [meshesReady, setMeshesReady] = useState(false);

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
  const columnRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>>(
    {},
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

  useFrame(({ clock }) => {
    if (!matchedIds) return;
    const pulse = 0.4 + (Math.sin(clock.elapsedTime * 4) * 0.5 + 0.5) * 1.8;
    CONTAINER_COLORS.forEach((c) => {
      prototypes[c.key].highlightMaterial.emissiveIntensity = pulse;
    });
  });

  useEffect(() => {
    if (!meshesReady) return;

    const solidCounts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;
    const highlightCounts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;
    const wireCounts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;

    CONTAINER_COLORS.forEach((c) => {
      const solid = solidRefs.current[c.key];
      const highlight = highlightRefs.current[c.key];
      const wire = wireframeRefs.current[c.key];
      if (solid) solid.count = 0;
      if (highlight) highlight.count = 0;
      if (wire) wire.count = 0;
      const column = columnRefs.current[c.key];
      if (column) column.count = 0;
    });

    // [containerLod] 선택 중이 아니면 먼 블록은 스택 기둥으로
    const useLod = CONTAINER_LOD_ENABLED && !matchedIds;
    if (useLod) {
      const columnCounts = Object.fromEntries(
        CONTAINER_COLORS.map((c) => [c.key, 0]),
      ) as Record<ContainerColorKey, number>;
      for (const code of farBlocks) {
        const b = blockLods.get(code);
        if (!b) continue;
        for (const col of b.columns) {
          const mesh = columnRefs.current[col.colorKey];
          const idx = columnCounts[col.colorKey];
          if (!mesh || idx >= MAX_PER_COLOR) continue;
          mesh.setMatrixAt(idx, col.matrix);
          columnCounts[col.colorKey] = idx + 1;
          mesh.count = idx + 1;
        }
      }
    }

    for (const container of containers) {
      if (container.status !== "stored") continue;
      if (!isCompany(container.company)) continue;
      if (useLod && farBlocks.has(container.location.block)) continue;

      const matrix = slotToMatrix(container, blockByCode, deckY);
      if (!matrix) continue;

      const colorKey = COMPANY_COLOR[container.company];
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

      const mesh = solidRefs.current[colorKey];
      const idx = solidCounts[colorKey];
      if (!mesh || idx >= MAX_PER_COLOR) continue;
      mesh.setMatrixAt(idx, matrix);
      solidCounts[colorKey] = idx + 1;
      mesh.count = idx + 1;
    }

    CONTAINER_COLORS.forEach((c) => {
      const solid = solidRefs.current[c.key];
      const highlight = highlightRefs.current[c.key];
      const wire = wireframeRefs.current[c.key];
      if (solid) solid.instanceMatrix.needsUpdate = true;
      if (highlight) highlight.instanceMatrix.needsUpdate = true;
      if (wire) wire.instanceMatrix.needsUpdate = true;
      const column = columnRefs.current[c.key];
      if (column) column.instanceMatrix.needsUpdate = true;
    });
  }, [containers, meshesReady, matchedIds, blockByCode, deckY, farBlocks, blockLods]);

  function tryMarkReady() {
    if (meshesReady) return;
    const solidsReady = CONTAINER_COLORS.every(
      (item) => solidRefs.current[item.key],
    );
    const highlightsReady = CONTAINER_COLORS.every(
      (item) => highlightRefs.current[item.key],
    );
    const wiresReady = CONTAINER_COLORS.every(
      (item) => wireframeRefs.current[item.key],
    );
    const columnsReady = CONTAINER_COLORS.every(
      (item) => columnRefs.current[item.key],
    );
    if (solidsReady && highlightsReady && wiresReady && columnsReady) {
      setMeshesReady(true);
    }
  }

  return (
    <group position={[...yardOffset]} visible={visible}>
      <group visible={!occupancyLook}>
        {CONTAINER_COLORS.map((c) => (
          <instancedMesh
            key={`solid-${c.key}`}
            ref={(node) => {
              if (!node) return;
              node.instanceMatrix.setUsage(DynamicDrawUsage);
              solidRefs.current[c.key] = node;
              tryMarkReady();
            }}
            args={[
              prototypes[c.key].geometry,
              prototypes[c.key].material, // GLB 원본 텍스처 색 (occupancy 시 이 그룹은 숨김)
              MAX_PER_COLOR,
            ]}
            frustumCulled={false}
            renderOrder={10}
            castShadow={false} // 야드 컨테이너: 그림자 받기만
            receiveShadow
            raycast={() => null}
          />
        ))}
        {CONTAINER_COLORS.map((c) => (
          <instancedMesh
            key={`column-${c.key}`}
            ref={(node) => {
              if (!node) return;
              node.instanceMatrix.setUsage(DynamicDrawUsage);
              columnRefs.current[c.key] = node;
              tryMarkReady();
            }}
            args={[
              prototypes[c.key].geometry,
              prototypes[c.key].material, // 원거리 스택 기둥: 맨 위 컨테이너 색 텍스처
              MAX_PER_COLOR,
            ]}
            frustumCulled={false}
            renderOrder={10}
            castShadow={false}
            receiveShadow
            raycast={() => null}
          />
        ))}
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

useGLTF.preload(containersUrl);
