import containersUrl from "@/assets/model/containers.glb";
import {
  CONTAINER_COLORS,
  MAX_PER_COLOR,
  type ContainerColorKey,
} from "@/constants/container";
import { SHIP_SCALE } from "@/constants/model";
import { createSeaTrafficShips } from "@/constants/seaTraffic";
import { SHIP_CARGO, SHIP_CARGO_COLOR_CYCLE } from "@/constants/shipCargo";
import { buildContainerPrototypes } from "@/domain/containerPrototype";
import { composeShipContainerMatrix } from "@/domain/shipCargo";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DynamicDrawUsage, type InstancedMesh } from "three";
import Ship, { type ShipInstance } from "./Ship";

type CargoSlot = {
  shipIndex: number;
  bay: number;
  row: number;
  tier: number;
  color: ContainerColorKey;
  colorIndex: number;
};

function buildSeaCargoSlots(shipCount: number): CargoSlot[] {
  // 원거리용으로 단수를 조금 낮춰 부하 완화
  const bays = SHIP_CARGO.bays;
  const rows = SHIP_CARGO.rows;
  const tiers = Math.min(SHIP_CARGO.tiers, 4);
  const slots: CargoSlot[] = [];
  const colorCounts = Object.fromEntries(
    CONTAINER_COLORS.map((c) => [c.key, 0]),
  ) as Record<ContainerColorKey, number>;
  let colorCycle = 0;

  for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
    for (let bay = 0; bay < bays; bay++) {
      for (let row = 0; row < rows; row++) {
        for (let tier = 1; tier <= tiers; tier++) {
          const color =
            SHIP_CARGO_COLOR_CYCLE[colorCycle % SHIP_CARGO_COLOR_CYCLE.length];
          colorCycle++;
          const colorIndex = colorCounts[color];
          if (colorIndex >= MAX_PER_COLOR) continue;
          colorCounts[color] = colorIndex + 1;
          slots.push({
            shipIndex,
            bay,
            row,
            tier,
            color,
            colorIndex,
          });
        }
      }
    }
  }
  return slots;
}

/** +Z 먼 바다를 가로지르는 화물 적재 선박들 */
export default function SeaTraffic() {
  const traffic = useMemo(() => createSeaTrafficShips(7), []);
  const posesRef = useRef<ShipInstance[]>(
    traffic.map((ship) => ({
      position: [ship.x, ship.y, ship.z],
      rotation: [0, ship.yaw, 0],
      scale: ship.scale,
    })),
  );
  const trafficRef = useRef(traffic);

  const { scene } = useGLTF(containersUrl);
  const prototypes = useMemo(() => buildContainerPrototypes(scene), [scene]);
  const slots = useMemo(
    () => buildSeaCargoSlots(traffic.length),
    [traffic.length],
  );
  const meshRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>>(
    {},
  );
  const [meshesReady, setMeshesReady] = useState(false);

  const countsByColor = useMemo(() => {
    const counts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;
    for (const slot of slots) {
      counts[slot.color] = Math.max(counts[slot.color], slot.colorIndex + 1);
    }
    return counts;
  }, [slots]);

  function tryMarkReady() {
    if (meshesReady) return;
    if (CONTAINER_COLORS.every((c) => meshRefs.current[c.key])) {
      setMeshesReady(true);
    }
  }

  function writeCargo() {
    const poses = posesRef.current;
    for (const slot of slots) {
      const ship = poses[slot.shipIndex];
      const mesh = meshRefs.current[slot.color];
      if (!ship || !mesh) continue;
      mesh.setMatrixAt(
        slot.colorIndex,
        composeShipContainerMatrix(
          ship,
          slot.bay,
          slot.row,
          slot.tier,
          1,
          1,
          0,
        ),
      );
    }
    for (const { key } of CONTAINER_COLORS) {
      const mesh = meshRefs.current[key];
      if (!mesh) continue;
      mesh.count = countsByColor[key];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  useLayoutEffect(() => {
    if (!meshesReady) return;
    writeCargo();
  }, [meshesReady, slots, countsByColor]);

  useFrame((_, delta) => {
    const poses = posesRef.current;
    const ships = trafficRef.current;
    for (let i = 0; i < ships.length; i++) {
      const spec = ships[i];
      const pose = poses[i];
      if (!spec || !pose) continue;

      let x = pose.position[0] + spec.dir * spec.speed * delta;
      if (spec.dir > 0 && x > spec.xMax) x = spec.xMin;
      if (spec.dir < 0 && x < spec.xMin) x = spec.xMax;

      pose.position[0] = x;
      pose.position[1] = spec.y;
      pose.position[2] = spec.z;
      if (!pose.rotation) pose.rotation = [0, spec.yaw, 0];
      else pose.rotation[1] = spec.yaw;
      pose.scale = spec.scale ?? SHIP_SCALE;
    }
    if (meshesReady) writeCargo();
  });

  return (
    <group position={[0, 0, -1030]}>
      <Ship posesRef={posesRef} />
      {CONTAINER_COLORS.map((c) => (
        <instancedMesh
          key={c.key}
          ref={(node) => {
            if (!node) return;
            node.instanceMatrix.setUsage(DynamicDrawUsage);
            meshRefs.current[c.key] = node;
            tryMarkReady();
          }}
          args={[
            prototypes[c.key].geometry,
            prototypes[c.key].material,
            Math.max(countsByColor[c.key], 1),
          ]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

useGLTF.preload(containersUrl);
