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
  const colorKeys = CONTAINER_COLORS.map((c) => c.key);

  for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
    const profile = getShipLoadProfile(shipIndex);
    for (let bay = 0; bay < bays; bay++) {
      for (let row = 0; row < rows; row++) {
        for (let tier = 1; tier <= tiers; tier++) {
          const color =
            colorKeys[Math.floor(Math.random() * colorKeys.length)];

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

    type ShipMotion = {
      index: number;
      ship: ShipInstance;
      slots: CargoSlot[];
      profile: ReturnType<typeof getShipLoadProfile>;
      bx: number;
      by: number;
      bz: number;
      departFarX: number;
      departFarZ: number;
      arriveFarX: number;
      arriveFarZ: number;
      berthYaw: number;
      departYaw: number;
      arriveYaw: number;
      travel: { x: number; y: number; z: number };
      facing: { yaw: number };
    };

    const motions: ShipMotion[] = [];
    for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
      const berth = SHIP_INSTANCES[shipIndex];
      const ship = poses[shipIndex];
      const shipSlots = slotsByShip[shipIndex] ?? [];
      if (!berth || !ship || shipSlots.length === 0) continue;

      const [bx, by, bz] = berth.position;
      const { sx, sz } = getShipDepartSigns(bx);
      const profile = getShipLoadProfile(shipIndex);
      const dist = profile.departDistance;
      const departFarX = bx + sx * dist;
      const departFarZ = bz + sz * dist;
      const arriveFarX = departFarX;
      const arriveFarZ = bz - (departFarZ - bz);
      const berthYaw = berth.rotation?.[1] ?? Math.PI / 2;

      motions.push({
        index: shipIndex,
        ship,
        slots: shipSlots,
        profile,
        bx,
        by,
        bz,
        departFarX,
        departFarZ,
        arriveFarX,
        arriveFarZ,
        berthYaw,
        departYaw: yawToward(departFarX - bx, departFarZ - bz),
        arriveYaw: yawToward(bx - arriveFarX, bz - arriveFarZ),
        travel: { x: bx, y: by, z: bz },
        facing: { yaw: berthYaw },
      });
    }

    const applyFacing = (m: ShipMotion, rewriteCargo: boolean) => {
      ensureRotation(m.ship, m.facing.yaw);
      if (rewriteCargo) rewriteShipCargo(m.index);
    };

    const placeAtBerth = (m: ShipMotion) => {
      m.ship.scale = SHIP_SCALE;
      m.travel.x = m.bx;
      m.travel.y = m.by;
      m.travel.z = m.bz;
      m.facing.yaw = m.berthYaw;
      applyTravel(m.ship, m.travel);
      applyFacing(m, false);
    };

    /** 단계 안: 완료 대기는 없고, 시작만 간격 두어 덜 동시적으로 */
    const schedulePhaseStarts = (
      phaseAt: number,
      minGap: number,
      maxGap: number,
    ) => {
      const order = [...motions];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let t = phaseAt;
      return order.map((m) => {
        const start = t;
        t += minGap + Math.random() * (maxGap - minGap);
        return { m, start };
      });
    };

    /**
     * 전체: 적재 → 출항 → 입항 (단계만 구분).
     * 단계 안에서는 시작 시각을 랜덤으로 흩뿌리며, 서로 완료를 기다리지 않음.
     */
    const runPhases = () => {
      if (cancelled) return;

      const tl = gsap.timeline({
        onUpdate: flush,
        onComplete: () => {
          timelines.delete(tl);
          if (!cancelled) runPhases();
        },
      });
      timelines.add(tl);

      for (const m of motions) {
        placeAtBerth(m);
        hideShipCargo(m.index);
      }

      // —— 1) 적재 ——
      let loadEnd = 0;
      for (const { m, start } of schedulePhaseStarts(0.2, 2.2, 4.2)) {
        const maxOrder = Math.max(...m.slots.map((s) => s.localOrder), 0);
        for (const slot of m.slots) {
          const state = { t: 0 };
          tl.to(
            state,
            {
              t: 1,
              duration: m.profile.duration,
              ease: m.profile.ease,
              onUpdate: () => writeSlot(slot, state.t),
            },
            start + slot.localOrder * m.profile.stagger,
          );
        }
        loadEnd = Math.max(
          loadEnd,
          start + maxOrder * m.profile.stagger + m.profile.duration,
        );
      }

      // —— 2) 출항 (적재 단계 끝난 뒤) ——
      let departEnd = loadEnd + 0.35;
      for (const { m, start } of schedulePhaseStarts(
        loadEnd + 0.35,
        2.8,
        5.2,
      )) {
        const departTargetYaw = yawLerpTarget(m.berthYaw, m.departYaw);

        tl.call(
          () => {
            m.facing.yaw = m.berthYaw;
            applyFacing(m, true);
          },
          undefined,
          start,
        );
        tl.to(
          m.travel,
          {
            x: m.departFarX,
            z: m.departFarZ,
            duration: m.profile.departDuration,
            ease: SHIP_CARGO_ANIM.departEase,
            onUpdate: () => {
              applyTravel(m.ship, m.travel);
              rewriteShipCargo(m.index);
            },
          },
          start,
        );
        tl.to(
          m.facing,
          {
            yaw: departTargetYaw,
            duration: m.profile.departDuration,
            ease: "power1.inOut",
            onUpdate: () => applyFacing(m, true),
          },
          start,
        );
        tl.call(
          () => {
            m.ship.scale = SHIP_CARGO_ANIM.hiddenScale;
            hideShipCargo(m.index);
          },
          undefined,
          start + m.profile.departDuration,
        );

        departEnd = Math.max(departEnd, start + m.profile.departDuration);
      }

      // —— 3) 입항 (출항 단계 끝난 뒤) ——
      for (const { m, start } of schedulePhaseStarts(
        departEnd + 0.35,
        2.8,
        5.2,
      )) {
        const dockYaw = yawLerpTarget(m.arriveYaw, m.berthYaw);

        tl.call(
          () => {
            m.ship.scale = SHIP_SCALE;
            m.travel.x = m.arriveFarX;
            m.travel.y = m.by;
            m.travel.z = m.arriveFarZ;
            m.facing.yaw = m.arriveYaw;
            applyTravel(m.ship, m.travel);
            applyFacing(m, false);
            hideShipCargo(m.index);
          },
          undefined,
          start,
        );
        tl.to(
          m.travel,
          {
            x: m.bx,
            z: m.bz,
            duration: m.profile.arriveDuration,
            ease: m.profile.arriveEase,
            onUpdate: () => applyTravel(m.ship, m.travel),
          },
          start,
        );
        tl.to(
          m.facing,
          {
            yaw: dockYaw,
            duration: m.profile.arriveDuration,
            ease: "power1.inOut",
            onUpdate: () => applyFacing(m, false),
          },
          start,
        );
        tl.call(
          () => {
            m.facing.yaw = m.berthYaw;
            applyFacing(m, false);
          },
          undefined,
          start + m.profile.arriveDuration,
        );
      }
    };

    runPhases();

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
