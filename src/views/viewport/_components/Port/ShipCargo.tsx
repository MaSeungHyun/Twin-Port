import containersUrl from "@/assets/model/containers.glb";
import {
  CONTAINER_COLORS,
  MAX_PER_COLOR,
  type ContainerColorKey,
} from "@/constants/container";
import { SHIP_SCALE } from "@/constants/model";
import {
  bowOffset,
  cargoSlotOrder,
  shipCargoGrid,
  shipLocalOffset,
  yawLerpTarget,
} from "@/constants/shipCargo";
import {
  SHIP_TWEEN,
  getShipTween,
  sidestepWorldDelta,
  type ShipTweenConfig,
} from "@/constants/tween";
import { buildContainerPrototypes } from "@/domain/containerPrototype";
import type { QuayBerth } from "@/domain/extractQuayBerths";
import { composeCargoSlotLocal, shipWorldScale } from "@/domain/shipCargo";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import { useViewportStore } from "@/stores/viewport";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DynamicDrawUsage,
  type InstancedMesh,
  Matrix4,
  type Object3D,
} from "three";

type CargoSlot = {
  shipIndex: number;
  bay: number;
  row: number;
  tier: number;
  color: ContainerColorKey;
  colorIndex: number;
  localOrder: number;
  dropHeight: number;
  originLocal: [number, number, number];
  restLocal: Matrix4;
};

type ColorCounts = Record<ContainerColorKey, number>;

const _slotLocal = new Matrix4();

function emptyColorCounts(): ColorCounts {
  return Object.fromEntries(CONTAINER_COLORS.map((c) => [c.key, 0])) as ColorCounts;
}

function locatorIndexOf(
  berth: ShipInstance | QuayBerth | undefined,
  fallback: number,
) {
  if (
    berth &&
    "locatorIndex" in berth &&
    typeof berth.locatorIndex === "number"
  ) {
    return berth.locatorIndex;
  }
  return fallback;
}

function buildCargoSlots(
  berths: readonly ShipInstance[] | readonly QuayBerth[],
): CargoSlot[] {
  const slots: CargoSlot[] = [];
  const colorKeys = CONTAINER_COLORS.map((c) => c.key);

  for (let shipIndex = 0; shipIndex < berths.length; shipIndex++) {
    const tween = getShipTween(locatorIndexOf(berths[shipIndex], shipIndex));
    const shipScale = shipWorldScale(berths[shipIndex]!);
    const grid = shipCargoGrid(shipScale);
    const colorCounts = emptyColorCounts();

    for (let bay = 0; bay < grid.bays; bay++) {
      for (let row = 0; row < grid.rows; row++) {
        for (let tier = 1; tier <= grid.tiers; tier++) {
          const color = colorKeys[Math.floor(Math.random() * colorKeys.length)]!;
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
            localOrder: cargoSlotOrder(bay, row, tier, tween.loadOrder, grid),
            dropHeight: tween.dropHeight,
            originLocal: grid.originLocal,
            restLocal: composeCargoSlotLocal(
              shipScale,
              bay,
              row,
              tier,
              1,
              1,
              tween.dropHeight,
              new Matrix4(),
              grid.originLocal,
            ),
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
  berths,
}: {
  posesRef: RefObject<ShipInstance[]>;
  berths: readonly ShipInstance[] | readonly QuayBerth[];
}) {
  const occupancyLook = useViewportStore((s) => s.occupancyLook);
  const { scene } = useGLTF(containersUrl);
  const groupRefs = useRef<(Object3D | null)[]>([]);
  const meshRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>[]>(
    [],
  );
  const [meshesReady, setMeshesReady] = useState(false);

  const prototypes = useMemo(() => buildContainerPrototypes(scene), [scene]);
  const shipCount = berths.length;
  const slots = useMemo(() => buildCargoSlots(berths), [berths]);

  const countsByShipColor = useMemo(() => {
    const counts = Array.from({ length: shipCount }, emptyColorCounts);
    for (const slot of slots) {
      const shipCounts = counts[slot.shipIndex];
      if (!shipCounts) continue;
      shipCounts[slot.color] = Math.max(
        shipCounts[slot.color],
        slot.colorIndex + 1,
      );
    }
    return counts;
  }, [slots, shipCount]);

  const slotsByShip = useMemo(() => {
    const groups: CargoSlot[][] = Array.from({ length: shipCount }, () => []);
    for (const slot of slots) {
      groups[slot.shipIndex]?.push(slot);
    }
    return groups;
  }, [slots, shipCount]);

  function tryMarkReady() {
    if (meshesReady) return;
    for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
      const shipCounts = countsByShipColor[shipIndex];
      if (!shipCounts) continue;
      for (const { key } of CONTAINER_COLORS) {
        if (shipCounts[key] > 0 && !meshRefs.current[shipIndex]?.[key]) return;
      }
    }
    setMeshesReady(true);
  }

  useFrame(() => {
    const poses = posesRef.current;
    if (!poses) return;
    for (let i = 0; i < shipCount; i++) {
      const group = groupRefs.current[i];
      const pose = poses[i];
      if (!group || !pose) continue;
      group.position.set(pose.position[0], pose.position[1], pose.position[2]);
      group.rotation.set(...(pose.rotation ?? [0, 0, 0]));
      const scale = pose.scale ?? 1;
      if (typeof scale === "number") group.scale.setScalar(scale);
      else group.scale.set(...scale);
    }
  });

  useEffect(() => {
    if (!meshesReady || slots.length === 0) return;
    const poses = posesRef.current;
    if (!poses) return;

    for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
      const shipCounts = countsByShipColor[shipIndex];
      if (!shipCounts) continue;
      for (const { key } of CONTAINER_COLORS) {
        const mesh = meshRefs.current[shipIndex]?.[key];
        if (!mesh) continue;
        const count = shipCounts[key];
        for (let i = 0; i < count; i++) mesh.setMatrixAt(i, HIDDEN);
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    const dirty = new Set<InstancedMesh>();

    const flush = () => {
      for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
      dirty.clear();
    };

    const meshOf = (slot: CargoSlot) =>
      meshRefs.current[slot.shipIndex]?.[slot.color];

    const writeSlot = (slot: CargoSlot, t: number) => {
      const mesh = meshOf(slot);
      if (!mesh) return;
      if (t >= 1) {
        mesh.setMatrixAt(slot.colorIndex, slot.restLocal);
      } else {
        const ship = poses[slot.shipIndex];
        if (!ship) return;
        composeCargoSlotLocal(
          shipWorldScale(ship),
          slot.bay,
          slot.row,
          slot.tier,
          t,
          t,
          slot.dropHeight,
          _slotLocal,
          slot.originLocal,
        );
        mesh.setMatrixAt(slot.colorIndex, _slotLocal);
      }
      dirty.add(mesh);
    };

    const hideShipCargo = (shipIndex: number) => {
      for (const slot of slotsByShip[shipIndex] ?? []) {
        const mesh = meshOf(slot);
        if (!mesh) continue;
        mesh.setMatrixAt(slot.colorIndex, HIDDEN);
        dirty.add(mesh);
      }
      flush();
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
      if (!ship.rotation) ship.rotation = [0, yaw, 0];
      else ship.rotation[1] = yaw;
    };

    const timelines = new Set<gsap.core.Timeline>();
    const delayTweens: gsap.core.Tween[] = [];
    let cancelled = false;

    type ShipMotion = {
      index: number;
      ship: ShipInstance;
      slots: CargoSlot[];
      tween: ShipTweenConfig;
      scale: number;
      bx: number;
      by: number;
      bz: number;
      sideX: number;
      sideY: number;
      sideZ: number;
      departFarX: number;
      departFarY: number;
      departFarZ: number;
      berthYaw: number;
      travelYaw: number;
      travel: { x: number; y: number; z: number };
      facing: { yaw: number };
    };

    const motions: ShipMotion[] = [];
    for (let shipIndex = 0; shipIndex < shipCount; shipIndex++) {
      const berth = berths[shipIndex];
      const ship = poses[shipIndex];
      const shipSlots = slotsByShip[shipIndex] ?? [];
      if (!berth || !ship || shipSlots.length === 0) continue;

      const tween = getShipTween(locatorIndexOf(berth, shipIndex));
      const [bx, by, bz] = berth.position;
      const berthYaw = berth.rotation?.[1] ?? Math.PI / 2;
      const travelYaw = berthYaw + (tween.turnDeg * Math.PI / 180);
      const side = sidestepWorldDelta(tween, berthYaw);
      const bow = bowOffset(travelYaw, tween.departDistance);
      const scale = typeof ship.scale === "number" ? ship.scale : SHIP_SCALE;

      motions.push({
        index: shipIndex,
        ship,
        slots: shipSlots,
        tween,
        scale,
        bx,
        by,
        bz,
        sideX: bx + side.x,
        sideY: by + side.y,
        sideZ: bz + side.z,
        departFarX: bx + side.x + bow.x,
        departFarY: by + side.y + bow.y,
        departFarZ: bz + side.z + bow.z,
        berthYaw,
        travelYaw,
        travel: { x: bx, y: by, z: bz },
        facing: { yaw: berthYaw },
      });
    }

    const placeAtBerth = (m: ShipMotion) => {
      m.ship.scale = m.scale;
      m.travel.x = m.bx;
      m.travel.y = m.by;
      m.travel.z = m.bz;
      m.facing.yaw = m.berthYaw;
      applyTravel(m.ship, m.travel);
      ensureRotation(m.ship, m.berthYaw);
    };

    const moveTravel = (
      m: ShipMotion,
      x: number,
      y: number,
      z: number,
      duration: number,
      ease: string,
      at: number,
      tl: gsap.core.Timeline,
    ) => {
      tl.to(
        m.travel,
        {
          x,
          y,
          z,
          duration,
          ease,
          onUpdate: () => applyTravel(m.ship, m.travel),
        },
        at,
      );
    };

    const runShip = (m: ShipMotion) => {
      if (cancelled) return;

      const tl = gsap.timeline({
        onUpdate: flush,
        onComplete: () => {
          timelines.delete(tl);
          if (!cancelled) runShip(m);
        },
      });
      timelines.add(tl);

      placeAtBerth(m);
      hideShipCargo(m.index);

      const tween = m.tween;
      const hasSidestep =
        tween.sidestepX !== 0 ||
        tween.sidestepY !== 0 ||
        tween.sidestepZ !== 0 ||
        tween.sidestepYawDeg != null;
      const turnDuration = tween.turnDeg !== 0 ? tween.turnDuration : 0;

      let t = SHIP_TWEEN.loadStart;
      const maxOrder = Math.max(...m.slots.map((s) => s.localOrder), 0);
      const loadSpan = maxOrder * tween.stagger + tween.loadDuration;
      const easeFn = gsap.parseEase(tween.loadEase);
      const loadState = { t: 0 };
      const settled = new Uint8Array(m.slots.length);
      tl.to(
        loadState,
        {
          t: 1,
          duration: loadSpan,
          ease: "none",
          onUpdate: () => {
            const elapsed = loadState.t * loadSpan;
            for (let i = 0; i < m.slots.length; i++) {
              if (settled[i]) continue;
              const slot = m.slots[i]!;
              const raw =
                (elapsed - slot.localOrder * tween.stagger) / tween.loadDuration;
              if (raw <= 0) continue;
              if (raw >= 1) {
                writeSlot(slot, 1);
                settled[i] = 1;
                continue;
              }
              writeSlot(slot, easeFn(raw));
            }
          },
        },
        t,
      );
      t += loadSpan + tween.departDelay;

      if (hasSidestep) {
        moveTravel(
          m,
          m.sideX,
          m.sideY,
          m.sideZ,
          tween.sidestepDuration,
          SHIP_TWEEN.sidestepEase,
          t,
          tl,
        );
        t += tween.sidestepDuration;
      }

      if (turnDuration > 0) {
        tl.to(
          m.facing,
          {
            yaw: yawLerpTarget(m.berthYaw, m.travelYaw),
            duration: turnDuration,
            ease: SHIP_TWEEN.turnEase,
            onUpdate: () => ensureRotation(m.ship, m.facing.yaw),
          },
          t,
        );
        t += turnDuration;
      }

      moveTravel(
        m,
        m.departFarX,
        m.departFarY,
        m.departFarZ,
        tween.departDuration,
        tween.departEase,
        t,
        tl,
      );
      t += tween.departDuration;

      tl.call(
        () => {
          m.ship.scale = SHIP_TWEEN.hiddenScale;
          hideShipCargo(m.index);
        },
        undefined,
        t,
      );
      t += SHIP_TWEEN.hideGap;

      tl.call(
        () => {
          const from = shipLocalOffset(
            m.berthYaw,
            SHIP_TWEEN.arriveFromX,
            SHIP_TWEEN.arriveFromY,
            SHIP_TWEEN.arriveFromZ,
          );
          m.ship.scale = m.scale;
          m.travel.x = m.bx + from.x;
          m.travel.y = m.by + from.y;
          m.travel.z = m.bz + from.z;
          m.facing.yaw = m.berthYaw;
          applyTravel(m.ship, m.travel);
          ensureRotation(m.ship, m.berthYaw);
          hideShipCargo(m.index);
        },
        undefined,
        t,
      );

      moveTravel(
        m,
        m.bx,
        m.by,
        m.bz,
        tween.arriveDuration,
        tween.arriveEase,
        t,
        tl,
      );
      t += tween.arriveDuration;

      tl.call(
        () => {
          m.facing.yaw = m.berthYaw;
          ensureRotation(m.ship, m.berthYaw);
        },
        undefined,
        t,
      );
    };

    for (const m of motions) {
      placeAtBerth(m);
      hideShipCargo(m.index);
      delayTweens.push(gsap.delayedCall(m.tween.delay, () => runShip(m)));
    }

    return () => {
      cancelled = true;
      for (const tween of delayTweens) tween.kill();
      for (const tl of timelines) tl.kill();
      timelines.clear();
    };
  }, [
    meshesReady,
    slots,
    countsByShipColor,
    slotsByShip,
    shipCount,
    posesRef,
    berths,
  ]);

  if (slots.length === 0) return null;

  return (
    <group visible={!occupancyLook}>
      {Array.from({ length: shipCount }, (_, shipIndex) => (
        <group
          key={shipIndex}
          ref={(node) => {
            groupRefs.current[shipIndex] = node;
          }}
        >
          {CONTAINER_COLORS.map((c) => {
            const count = countsByShipColor[shipIndex]?.[c.key] ?? 0;
            if (count === 0) return null;
            return (
              <instancedMesh
                key={c.key}
                ref={(node) => {
                  if (!node) return;
                  if (!meshRefs.current[shipIndex]) meshRefs.current[shipIndex] = {};
                  meshRefs.current[shipIndex]![c.key] = node;
                  node.instanceMatrix.setUsage(DynamicDrawUsage);
                  tryMarkReady();
                }}
                args={[prototypes[c.key].geometry, prototypes[c.key].material, count]}
                frustumCulled={false}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(containersUrl);
