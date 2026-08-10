import containersUrl from "@/assets/model/containers.glb";
import {
  CONTAINER_COLORS,
  MAX_PER_COLOR,
  type ContainerColorKey,
} from "@/constants/container";
import { SHIP_INSTANCES, SHIP_SCALE } from "@/constants/model";
import {
  SHIP_CARGO,
  SHIP_CARGO_ANIM,
  SHIP_CARGO_COLOR_CYCLE,
  cargoSlotOrder,
  getShipDepartSigns,
  getShipLoadProfile,
  yawLerpTarget,
  yawToward,
} from "@/constants/shipCargo";
import { buildContainerPrototypes } from "@/domain/containerPrototype";
import { composeShipContainerMatrix } from "@/domain/shipCargo";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import { useGLTF } from "@react-three/drei";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DynamicDrawUsage, type InstancedMesh, Matrix4 } from "three";

type CargoSlot = {
  shipIndex: number;
  bay: number;
  row: number;
  tier: number;
  color: ContainerColorKey;
  colorIndex: number;
  localOrder: number;
  dropHeight: number;
};

function buildCargoSlots(shipCount: number): CargoSlot[] {
  const { bays, rows, tiers } = SHIP_CARGO;
  const slots: CargoSlot[] = [];
  const colorCounts = Object.fromEntries(
    CONTAINER_COLORS.map((c) => [c.key, 0]),
  ) as Record<ContainerColorKey, number>;
  let colorCycle = 0;

  for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
    const profile = getShipLoadProfile(shipIndex);
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
            localOrder: cargoSlotOrder(bay, row, tier, profile.order),
            dropHeight: profile.dropHeight,
          });
        }
      }
    }
  }

  return slots;
}

const HIDDEN = new Matrix4().makeScale(0, 0, 0);

export default function ShipCargo({
  posesRef,
}: {
  posesRef: RefObject<ShipInstance[]>;
}) {
  const { scene } = useGLTF(containersUrl);
  const meshRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>>(
    {},
  );
  const [meshesReady, setMeshesReady] = useState(false);

  const prototypes = useMemo(() => buildContainerPrototypes(scene), [scene]);
  const shipCount = SHIP_INSTANCES.length;
  const slots = useMemo(() => buildCargoSlots(shipCount), [shipCount]);

  const countsByColor = useMemo(() => {
    const counts = Object.fromEntries(
      CONTAINER_COLORS.map((c) => [c.key, 0]),
    ) as Record<ContainerColorKey, number>;
    for (const slot of slots) {
      counts[slot.color] = Math.max(counts[slot.color], slot.colorIndex + 1);
    }
    return counts;
  }, [slots]);

  const slotsByShip = useMemo(() => {
    const groups: CargoSlot[][] = Array.from({ length: shipCount }, () => []);
    for (const slot of slots) {
      groups[slot.shipIndex]?.push(slot);
    }
    return groups;
  }, [slots, shipCount]);

  function tryMarkReady() {
    if (meshesReady) return;
    if (CONTAINER_COLORS.every((c) => meshRefs.current[c.key])) {
      setMeshesReady(true);
    }
  }

  useEffect(() => {
    if (!meshesReady || slots.length === 0) return;
    const poses = posesRef.current;
    if (!poses) return;

    for (const { key } of CONTAINER_COLORS) {
      const mesh = meshRefs.current[key];
      if (!mesh) continue;
      const count = countsByColor[key];
      for (let i = 0; i < count; i++) {
        mesh.setMatrixAt(i, HIDDEN);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }

    const dirty = new Set<ContainerColorKey>();

    const flush = () => {
      for (const key of dirty) {
        const mesh = meshRefs.current[key];
        if (mesh) mesh.instanceMatrix.needsUpdate = true;
      }
      dirty.clear();
    };

    const writeSlot = (slot: CargoSlot, t: number) => {
      const ship = poses[slot.shipIndex];
      const mesh = meshRefs.current[slot.color];
      if (!ship || !mesh) return;
      mesh.setMatrixAt(
        slot.colorIndex,
        composeShipContainerMatrix(
          ship,
          slot.bay,
          slot.row,
          slot.tier,
          t,
          t,
          slot.dropHeight,
        ),
      );
      dirty.add(slot.color);
    };

    const hideShipCargo = (shipIndex: number) => {
      for (const slot of slotsByShip[shipIndex] ?? []) {
        const mesh = meshRefs.current[slot.color];
        if (!mesh) continue;
        mesh.setMatrixAt(slot.colorIndex, HIDDEN);
        dirty.add(slot.color);
      }
      flush();
    };

    const rewriteShipCargo = (shipIndex: number) => {
      for (const slot of slotsByShip[shipIndex] ?? []) {
        writeSlot(slot, 1);
      }
    };

    const applyTravel = (
      ship: ShipInstance,
      travel: { x: number; y: number; z: number },
    ) => {
      ship.position[0] = travel.x;
      ship.position[1] = travel.y;
      ship.position[2] = travel.z;
    };

    const ensureRotation = (ship: ShipInstance, yaw: number) => {
      if (!ship.rotation) {
        ship.rotation = [0, yaw, 0];
      } else {
        ship.rotation[1] = yaw;
      }
    };

    const timelines = new Set<gsap.core.Timeline>();
    let cancelled = false;

    const runCycle = (shipIndex: number, isFirst: boolean) => {
      if (cancelled) return;

      const profile = getShipLoadProfile(shipIndex);
      const berth = SHIP_INSTANCES[shipIndex];
      const ship = poses[shipIndex];
      const shipSlots = slotsByShip[shipIndex] ?? [];
      if (!berth || !ship || shipSlots.length === 0) return;

      const [bx, by, bz] = berth.position;
      const { sx, sz } = getShipDepartSigns(bx);
      const dist = profile.departDistance;
      // 출항 끝 far. 입항은 같은 바깥 X, 출항 끝 Z의 부두 기준 반대 Z
      const departFarX = bx + sx * dist;
      const departFarZ = bz + sz * dist;
      const arriveFarX = departFarX;
      const arriveFarZ = bz - (departFarZ - bz); // = bz - sz * dist
      const berthYaw = berth.rotation?.[1] ?? Math.PI / 2;
      const departYaw = yawToward(departFarX - bx, departFarZ - bz);
      const arriveYaw = yawToward(bx - arriveFarX, bz - arriveFarZ);

      const tl = gsap.timeline({
        onUpdate: flush,
        onComplete: () => {
          timelines.delete(tl);
          if (!cancelled) runCycle(shipIndex, false);
        },
      });
      timelines.add(tl);

      const travel = { x: ship.position[0], y: by, z: ship.position[2] };
      const facing = { yaw: berthYaw };

      const applyFacing = (rewriteCargo: boolean) => {
        ensureRotation(ship, facing.yaw);
        if (rewriteCargo) rewriteShipCargo(shipIndex);
      };

      if (isFirst) {
        // 첫 사이클: 이미 부두에 정박한 상태로 적재
        ship.scale = SHIP_SCALE;
        travel.x = bx;
        travel.z = bz;
        facing.yaw = berthYaw;
        applyTravel(ship, travel);
        applyFacing(false);
        hideShipCargo(shipIndex);
        if (profile.delay > 0) tl.to({}, { duration: profile.delay });
      } else {
        // 출항 후 잠깐 숨김 → 같은 편 바깥, 출항 Z의 반대 Z에서 입항
        ship.scale = SHIP_CARGO_ANIM.hiddenScale;
        hideShipCargo(shipIndex);
        tl.to({}, { duration: 0.45 });

        tl.call(() => {
          ship.scale = SHIP_SCALE;
          travel.x = arriveFarX;
          travel.y = by;
          travel.z = arriveFarZ;
          facing.yaw = arriveYaw;
          applyTravel(ship, travel);
          applyFacing(false);
        });

        const arriveStart = tl.duration();
        // arriveYaw → berthYaw 최단 경로 (빌드 시점에 상수로 확정)
        const dockYaw = yawLerpTarget(arriveYaw, berthYaw);
        tl.to(
          travel,
          {
            x: bx,
            z: bz,
            duration: profile.arriveDuration,
            ease: profile.arriveEase,
            onUpdate: () => applyTravel(ship, travel),
          },
          arriveStart,
        );
        tl.to(
          facing,
          {
            yaw: dockYaw,
            duration: profile.arriveDuration,
            ease: "power1.inOut",
            onUpdate: () => applyFacing(false),
          },
          arriveStart,
        );
        // 누적각 리셋 → 다음 출항이 한 바퀴 도는 것 방지
        tl.call(() => {
          facing.yaw = berthYaw;
          applyFacing(false);
        });
      }

      // 적재
      const loadAt = tl.duration();
      for (const slot of shipSlots) {
        const state = { t: 0 };
        tl.to(
          state,
          {
            t: 1,
            duration: profile.duration,
            ease: profile.ease,
            onUpdate: () => writeSlot(slot, state.t),
          },
          loadAt + slot.localOrder * profile.stagger,
        );
      }

      const maxOrder = Math.max(...shipSlots.map((s) => s.localOrder));
      const loadEnd = loadAt + maxOrder * profile.stagger + profile.duration;
      const departAt = loadEnd + profile.departDelay;
      const departTargetYaw = yawLerpTarget(berthYaw, departYaw);

      // 출항: 이동과 동시에 최단 각으로 천천히 회전
      tl.call(
        () => {
          facing.yaw = berthYaw;
        },
        undefined,
        departAt,
      );

      tl.to(
        travel,
        {
          x: departFarX,
          z: departFarZ,
          duration: profile.departDuration,
          ease: SHIP_CARGO_ANIM.departEase,
          onUpdate: () => {
            applyTravel(ship, travel);
            rewriteShipCargo(shipIndex);
          },
        },
        departAt,
      );
      tl.to(
        facing,
        {
          yaw: departTargetYaw,
          duration: profile.departDuration,
          ease: "power1.inOut",
          onUpdate: () => applyFacing(true),
        },
        departAt,
      );

      // 출항 완료 → 사라짐
      tl.call(() => {
        ship.scale = SHIP_CARGO_ANIM.hiddenScale;
        hideShipCargo(shipIndex);
      });
    };

    for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
      runCycle(shipIndex, true);
    }

    return () => {
      cancelled = true;
      for (const tl of timelines) tl.kill();
      timelines.clear();
    };
  }, [meshesReady, slots, countsByColor, slotsByShip, shipCount, posesRef]);

  if (slots.length === 0) return null;

  return (
    <group>
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
