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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  DynamicDrawUsage,
  type InstancedMesh,
  LineBasicMaterial,
} from "three";

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
) {
  const block = blockByCode[container.location.block];
  if (!block) return null;

  const row = Number(container.location.slot.row) - 1;
  const bay = Number(container.location.slot.bay) - 1;
  const tier = Number(container.location.slot.tier);

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

  const prototypes = useMemo(
    () => buildContainerPrototypes(scene),
    [scene],
  );

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
    });

    for (const container of containers) {
      if (container.status !== "stored") continue;
      if (!isCompany(container.company)) continue;

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
    });
  }, [containers, meshesReady, matchedIds, blockByCode, deckY]);

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
    if (solidsReady && highlightsReady && wiresReady) {
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
              prototypes[c.key].material,
              MAX_PER_COLOR,
            ]}
            frustumCulled={false}
            castShadow
            receiveShadow
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
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

useGLTF.preload(containersUrl);
