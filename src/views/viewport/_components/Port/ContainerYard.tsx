import {
  COMPANY_COLOR,
  CONTAINER_COLORS,
  CONTAINER_D,
  CONTAINER_H,
  CONTAINER_W,
  DECK_Y,
  MAX_PER_COLOR,
  type ContainerColorKey,
  type ContainerCompany,
} from "@/constants/container";
import { BLOCK_BY_CODE } from "@/constants/block";
import {
  composeContainerMatrix,
  makeCorrugationTexture,
} from "@/domain/container";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useViewportStore } from "@/stores/viewport";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  type InstancedMesh,
  LineBasicMaterial,
  MeshStandardMaterial,
} from "three";

const HIGHLIGHT_EMISSIVE = new Color(0x22c55e);

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

function slotToMatrix(container: Container) {
  const block = BLOCK_BY_CODE[container.location.block];
  if (!block) return null;

  const row = Number(container.location.slot.row) - 1;
  const bay = Number(container.location.slot.bay) - 1;
  const tier = Number(container.location.slot.tier);

  return composeContainerMatrix(row, bay, tier, DECK_Y, block.origin, 0);
}

export default function ContainerYard({
  visible = true,
}: {
  visible?: boolean;
}) {
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);

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
  const containers = mockContainers as Container[];

  const matchedIds = useMemo(() => {
    if (!selectedContainerId) return null;
    return new Set([selectedContainerId]);
  }, [selectedContainerId]);

  const texture = useMemo(() => makeCorrugationTexture(), []);

  const geometry = useMemo(
    () => new BoxGeometry(CONTAINER_W, CONTAINER_H, CONTAINER_D),
    [],
  );
  // wireframe 대신 외곽 모서리만 — 확대해도 화면 픽셀 폭(≈1px) 유지
  const edgeGeometry = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  const materials = useMemo(
    () =>
      Object.fromEntries(
        CONTAINER_COLORS.map((c) => [
          c.key,
          new MeshStandardMaterial({
            map: texture,
            color: c.hex,
            roughness: 0.6,
            metalness: 0.8,
          }),
        ]),
      ) as Record<ContainerColorKey, MeshStandardMaterial>,
    [texture],
  );
  const highlightMaterials = useMemo(
    () =>
      Object.fromEntries(
        CONTAINER_COLORS.map((c) => [
          c.key,
          new MeshStandardMaterial({
            map: texture,
            color: c.hex,
            roughness: 0.45,
            metalness: 0.35,
            emissive: HIGHLIGHT_EMISSIVE,
            emissiveIntensity: 1.2,
          }),
        ]),
      ) as Record<ContainerColorKey, MeshStandardMaterial>,
    [texture],
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
    // 0.4 ~ 2.2 사이로 맥동
    const pulse = 0.4 + (Math.sin(clock.elapsedTime * 4) * 0.5 + 0.5) * 1.8;
    CONTAINER_COLORS.forEach((c) => {
      highlightMaterials[c.key].emissiveIntensity = pulse;
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

      const matrix = slotToMatrix(container);
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
  }, [containers, meshesReady, matchedIds]);

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
    <group position={[5, 0, 0]} visible={visible}>
      {CONTAINER_COLORS.map((c) => (
        <instancedMesh
          key={`solid-${c.key}`}
          ref={(node) => {
            if (!node) return;
            node.instanceMatrix.setUsage(DynamicDrawUsage);
            solidRefs.current[c.key] = node;
            tryMarkReady();
          }}
          args={[geometry, materials[c.key], MAX_PER_COLOR]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}
      {CONTAINER_COLORS.map((c) => (
        <instancedMesh
          key={`highlight-${c.key}`}
          ref={(node) => {
            if (!node) return;
            node.instanceMatrix.setUsage(DynamicDrawUsage);
            highlightRefs.current[c.key] = node;
            tryMarkReady();
          }}
          args={[geometry, highlightMaterials[c.key], MAX_PER_COLOR]}
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
          args={[edgeGeometry, wireframeMaterials[c.key], MAX_PER_COLOR]}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
