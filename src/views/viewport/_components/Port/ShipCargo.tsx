import containersUrl from "@/assets/model/containers.glb";
import {
  CONTAINER_COLORS,
  MAX_PER_COLOR,
  type ContainerColorKey,
} from "@/constants/container";
import {
  bowOffset,
  cargoSlotOrder,
  shipCargoGrid,
  yawLerpTarget,
  SHIP_CARGO_TIER_INTERVAL,
} from "@/constants/shipCargo";
import {
  SHIP_TWEEN,
  getShipTween,
  sidestepWorldDelta,
  type ShipTweenConfig,
} from "@/constants/tween";
import { useControls } from "@/debug/controls";
import { useShipDebugStore } from "@/stores/shipDebug";
import { buildContainerPrototypes } from "@/domain/containerPrototype";
import type { QuayBerth } from "@/domain/extractQuayBerths";
import { getOccupancyContainerMaterial } from "@/domain/occupancyLook/occupancyContainerMaterial";
import { useOccupancyStore } from "@/stores/occupancy";
import { portHoverOut, portHoverOver } from "@/domain/hoverOutline";
import {
  activateShipFromViewport,
  resolveShipKeyFromInstanceIndex,
  setViewportPickCursor,
} from "@/domain/viewportPick";
import { composeCargoSlotLocal, shipWorldScale } from "@/domain/shipCargo";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import { useGLTF } from "@react-three/drei";
import { extendKtx2 } from "@/domain/gltfLoaders";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DynamicDrawUsage,
  type InstancedMesh,
  Matrix4,
  type Object3D,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";

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
  const { scene } = useGLTF(containersUrl, false, true, extendKtx2);
  const groupRefs = useRef<(Object3D | null)[]>([]);
  const meshRefs = useRef<Partial<Record<ContainerColorKey, InstancedMesh>>[]>(
    [],
  );
  const [meshesReady, setMeshesReady] = useState(false);
  // 관제 시작 전에는 루프 없음. 이동은 관제 시작 && 디버그 토글 on 일 때만
  const controlStarted = useShipDebugStore((s) => s.controlStarted);
  const shipMotionSetting = useShipDebugStore((s) => s.shipMotion);
  const motionOn = controlStarted && shipMotionSetting;
  useControls("Ship Motion", {
    shipMotion: {
      value: SHIP_TWEEN.shipMotion,
      label: "이동 애니메이션",
      hint: "끄면 배는 정박 위치에 고정되고 컨테이너 적재 반복만 실행 (관제 시작 후에만 동작)",
      onChange: (v: boolean) => useShipDebugStore.getState().setShipMotion(v),
    },
  });

  const prototypes = useMemo(() => buildContainerPrototypes(scene), [scene]);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const occupancyContainerMaterial = useMemo(
    () => getOccupancyContainerMaterial(),
    [],
  );
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

  const fleetKey = useMemo(
    () =>
      berths
        .map(
          (berth, index) =>
            `${locatorIndexOf(berth, index)}:${berth.position.join(",")}`,
        )
        .join("|"),
    [berths],
  );

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
      const scale = typeof ship.scale === "number" ? ship.scale : 1;

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
      (m.ship as typeof m.ship & { straightAt?: number }).straightAt = undefined;
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
      // 적재: 애니메이션 없이 아래 단(tier 1)부터 한 층씩 통째로 표시
      const tiers = [...new Set(m.slots.map((s) => s.tier))].sort((x, y) => x - y);
      tiers.forEach((tier, k) => {
        tl.call(
          () => {
            for (const slot of m.slots) if (slot.tier === tier) writeSlot(slot, 1);
            flush();
          },
          undefined,
          t + k * SHIP_CARGO_TIER_INTERVAL,
        );
      });
      const loadSpan = tiers.length * SHIP_CARGO_TIER_INTERVAL;
      if (!motionOn) {
        // 데모: 선박 고정, 적재 완료 후 유지 → onComplete에서 비우고 재적재
        t += loadSpan + SHIP_TWEEN.loadedHold;
        tl.call(() => {}, undefined, t);
        return;
      }
      // 적재 완료 → 유지 → 출항 (화물 실은 채로 이동)
      t += loadSpan + SHIP_TWEEN.loadedHold + tween.departDelay;

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

      // [wake] 직진 시작 표시 → Ship.tsx 가 이 시점부터 항적을 바로 키움 (ease-in 초반 속도≈0 지연 제거)
      tl.call(
        () => {
          const sh = m.ship as typeof m.ship & { straightAt?: number; straightFrom?: [number, number] };
          sh.straightAt = performance.now() / 1000;
          sh.straightFrom = [m.ship.position[0], m.ship.position[2]];
        },
        undefined,
        t,
      );
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
          (m.ship as typeof m.ship & { straightAt?: number }).straightAt = undefined;
          hideShipCargo(m.index);
        },
        undefined,
        t,
      );
      t += SHIP_TWEEN.hideGap;

      tl.call(
        () => {
          // 빈 배로 사이드스텝 지점에서 다시 나타나 안벽으로 입항
          m.ship.scale = m.scale;
          m.travel.x = m.sideX;
          m.travel.y = m.sideY;
          m.travel.z = m.sideZ;
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
      // 모든 배가 같은 주기로 돌아야 delay로 맞춘 충돌 회피가 매 루프 유지됨
      tl.call(() => {}, undefined, Math.max(t, SHIP_TWEEN.cycle));
    };

    for (const m of motions) {
      placeAtBerth(m);
      hideShipCargo(m.index);
      // delay는 관제 시작(이 effect 실행) 시점 기준. 이동 off면 delay 없이 적재 루프만
      if (controlStarted)
        delayTweens.push(gsap.delayedCall(motionOn ? m.tween.delay : 0, () => runShip(m)));
    }

    return () => {
      cancelled = true;
      for (const tween of delayTweens) tween.kill();
      for (const tl of timelines) tl.kill();
      timelines.clear();
    };
    // 부두 구성이 같을 때는 occupancy 리렌더로 사이클을 다시 시작하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fleetKey가 슬롯/부두 변경을 대표
  }, [meshesReady, fleetKey, controlStarted, motionOn]);

  if (slots.length === 0) return null;

  return (
    <group>
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
                args={[
                  prototypes[c.key].geometry,
                  occupancyLook ? occupancyContainerMaterial : prototypes[c.key].material,
                  count,
                ]}
                frustumCulled={false}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setViewportPickCursor(true);
                  portHoverOver(event, "ship", String(shipIndex));
                }}
                onPointerOut={(event) => {
                  event.stopPropagation();
                  setViewportPickCursor(false);
                  portHoverOut(event, "ship", String(shipIndex));
                }}
                onClick={(event: ThreeEvent<PointerEvent>) => {
    if (event.delta > 4) return; // [twin-port] 드래그(궤도 회전) 후 놓은 경우는 선택 안 함
                  const key = resolveShipKeyFromInstanceIndex(shipIndex);
                  if (!key) return;
                  event.stopPropagation();
                  activateShipFromViewport(key);
                }}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(containersUrl, false, true, extendKtx2);
