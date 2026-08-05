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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  DynamicDrawUsage,
  type InstancedMesh,
  MeshStandardMaterial,
} from "three";

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
  const meshRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>>(
    {},
  );
  const [meshesReady, setMeshesReady] = useState(false);
  const containers = mockContainers as Container[];

  const corrugation = useMemo(() => makeCorrugationTexture(), []);
  const geometry = useMemo(
    () => new BoxGeometry(CONTAINER_W, CONTAINER_H, CONTAINER_D),
    [],
  );
  const materials = useMemo(
    () =>
      Object.fromEntries(
        CONTAINER_COLORS.map((c) => [
          c.key,
          new MeshStandardMaterial({
            map: corrugation,
            color: c.hex,
            roughness: 0.75,
            metalness: 0.1,
          }),
        ]),
      ) as Record<ContainerColorKey, MeshStandardMaterial>,
    [corrugation],
  );

  useEffect(() => {
    if (!meshesReady) return;

    const counts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;

    CONTAINER_COLORS.forEach((c) => {
      const mesh = meshRefs.current[c.key];
      if (mesh) mesh.count = 0;
    });

    for (const container of containers) {
      if (container.status !== "stored") continue;
      if (!isCompany(container.company)) continue;

      const colorKey = COMPANY_COLOR[container.company];
      const mesh = meshRefs.current[colorKey];
      const idx = counts[colorKey];
      if (!mesh || idx >= MAX_PER_COLOR) continue;

      const matrix = slotToMatrix(container);
      if (!matrix) continue;

      mesh.setMatrixAt(idx, matrix);
      counts[colorKey] = idx + 1;
      mesh.count = idx + 1;
    }

    CONTAINER_COLORS.forEach((c) => {
      const mesh = meshRefs.current[c.key];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  }, [containers, meshesReady]);

  return (
    <group position={[5, 0, 0]} visible={visible}>
      {CONTAINER_COLORS.map((c) => (
        <instancedMesh
          key={c.key}
          ref={(node) => {
            if (!node) return;
            node.instanceMatrix.setUsage(DynamicDrawUsage);
            meshRefs.current[c.key] = node;
            if (
              !meshesReady &&
              CONTAINER_COLORS.every((item) => meshRefs.current[item.key])
            ) {
              setMeshesReady(true);
            }
          }}
          args={[geometry, materials[c.key], MAX_PER_COLOR]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
