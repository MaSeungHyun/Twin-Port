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
import { CAMERA_PULLBACK_EVENT, CAMERA_PULLBACK_SHIP_INDEX } from "@/constants/cameraIntro";
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
import { useFrame, useThree } from "@react-three/fiber";
import { useObjectStore } from "@/stores/object";
import {
  makeReflectionInstanced,
  reflectionBoxOf,
  reflectionCameraOk,
  syncReflectionInstanced,
} from "./WaterReflection";
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
  // [reflection] 선적 컨테이너 반사 (색상 InstancedMesh 마다 instanceMatrix 공유 박스 1 draw + depth 1 draw)
  const reflections = useRef(new Map<InstancedMesh, InstancedMesh>());
  const reflectionVisible = useObjectStore((s) => s.reflectionVisible);
  const camera = useThree((s) => s.camera);
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
    const reflOn = reflectionVisible && reflectionCameraOk(camera.position.y);
    for (const [source, refl] of reflections.current) {
      if (!source.parent) {
        reflections.current.delete(source);
        continue;
      }
      syncReflectionInstanced(refl, source, reflOn && source.visible);
    }
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
    let pullbackSent = false;
    /** [pullback] 지정 배가 실제로 출항(게이트 통과)하는 첫 순간 1회 → 카메라 서서히 빠짐 */
    const onDepart = (m: ShipMotion) => {
      if (pullbackSent || m.index !== CAMERA_PULLBACK_SHIP_INDEX) return;
      pullbackSent = true;
      window.dispatchEvent(new CustomEvent(CAMERA_PULLBACK_EVENT));
    };

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
      /** [yield] 출항 예측용 구간 길이(초)와 회전 목표 */
      sd: number;
      td: number;
      dd: number;
      turnTo: number;
      /** [yield] 출항 게이트를 통과해 항로 위에 있을 때만 값 (tl 기준 게이트 시각) */
      gate: { tl: gsap.core.Timeline; t: number } | null;
      waiting: boolean;
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
      const hasSide =
        tween.sidestepX !== 0 ||
        tween.sidestepY !== 0 ||
        tween.sidestepZ !== 0 ||
        tween.sidestepYawDeg != null;

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
        sd: hasSide ? tween.sidestepDuration : 0,
        td: tween.turnDeg !== 0 ? tween.turnDuration : 0,
        dd: tween.departDuration,
        turnTo: yawLerpTarget(berthYaw, travelYaw),
        gate: null,
        waiting: false,
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

    // ---- [yield] 실시간 충돌 대기 ----
    const easeSide = gsap.parseEase(SHIP_TWEEN.sidestepEase);
    const easeTurn = gsap.parseEase(SHIP_TWEEN.turnEase);
    const easeCache = new Map<string, (p: number) => number>();
    const easeOf = (name: string) => {
      let e = easeCache.get(name);
      if (!e) easeCache.set(name, (e = gsap.parseEase(name)));
      return e;
    };
    /** 게이트 후 s초 시점의 XZ 위치/선수 yaw. 항로 끝(숨김) 이후면 false */
    const routeAt = (m: ShipMotion, s: number, out: { x: number; z: number; yaw: number }) => {
      if (s < 0) s = 0;
      if (s < m.sd) {
        const k = easeSide(s / m.sd);
        out.x = m.bx + (m.sideX - m.bx) * k;
        out.z = m.bz + (m.sideZ - m.bz) * k;
        out.yaw = m.berthYaw;
        return true;
      }
      s -= m.sd;
      if (s < m.td) {
        out.x = m.sideX;
        out.z = m.sideZ;
        out.yaw = m.berthYaw + (m.turnTo - m.berthYaw) * easeTurn(s / m.td);
        return true;
      }
      s -= m.td;
      if (s <= m.dd) {
        const k = easeOf(m.tween.departEase)(m.dd > 0 ? s / m.dd : 1);
        out.x = m.sideX + (m.departFarX - m.sideX) * k;
        out.z = m.sideZ + (m.departFarZ - m.sideZ) * k;
        out.yaw = m.turnTo;
        return true;
      }
      return false;
    };
    const pA = { x: 0, z: 0, yaw: 0 };
    const pB = { x: 0, z: 0, yaw: 0 };
    const segPt = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const k = l2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
      return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
    };
    /** 두 선체(캡슐) 사이 최소 거리: 중심축 선분 거리 − 반폭 합 */
    const hullGap = (a: typeof pA, sa: number, b: typeof pB, sb: number) => {
      const la = SHIP_TWEEN.hullLength * 0.5 * sa, lb = SHIP_TWEEN.hullLength * 0.5 * sb;
      const ca = Math.cos(a.yaw), na = -Math.sin(a.yaw);
      const cb = Math.cos(b.yaw), nb = -Math.sin(b.yaw);
      const a0x = a.x - ca * la, a0z = a.z - na * la, a1x = a.x + ca * la, a1z = a.z + na * la;
      const b0x = b.x - cb * lb, b0z = b.z - nb * lb, b1x = b.x + cb * lb, b1z = b.z + nb * lb;
      const cr = (ox: number, oz: number, px: number, pz: number, qx: number, qz: number) =>
        (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
      const d1 = cr(b0x, b0z, b1x, b1z, a0x, a0z), d2 = cr(b0x, b0z, b1x, b1z, a1x, a1z);
      const d3 = cr(a0x, a0z, a1x, a1z, b0x, b0z), d4 = cr(a0x, a0z, a1x, a1z, b1x, b1z);
      const axis =
        d1 * d2 < 0 && d3 * d4 < 0
          ? 0
          : Math.min(
              segPt(a0x, a0z, b0x, b0z, b1x, b1z),
              segPt(a1x, a1z, b0x, b0z, b1x, b1z),
              segPt(b0x, b0z, a0x, a0z, a1x, a1z),
              segPt(b1x, b1z, a0x, a0z, a1x, a1z),
            );
      return axis - SHIP_TWEEN.hullWidth * 0.5 * (sa + sb);
    };
    /** 지금 출발하면 이미 항로 위에 있는 배와 겹치는지 (항로 전체 구간 예측) */
    const wouldCollide = (m: ShipMotion) => {
      const total = m.sd + m.td + m.dd;
      const step = SHIP_TWEEN.yieldSampleStep;
      for (const o of motions) {
        if (o === m || !o.gate) continue;
        const elapsed = o.gate.tl.time() - o.gate.t;
        const oEnd = o.sd + o.td + o.dd;
        if (elapsed > oEnd) continue;
        const span = Math.min(total, oEnd - elapsed);
        for (let s = 0; s <= span + 1e-6; s += step) {
          if (!routeAt(m, s, pA) || !routeAt(o, elapsed + s, pB)) break;
          if (hullGap(pA, m.scale, pB, o.scale) < SHIP_TWEEN.safetyMargin) return true;
        }
      }
      return false;
    };
    /** 게이트: 막히면 타임라인 정지(정박지에서 흔들림만 유지) → 주기적으로 재확인 → 비면 출발 */
    const passGate = (m: ShipMotion, tl: gsap.core.Timeline, gateT: number) => {
      if (cancelled || m.gate?.tl === tl || m.waiting) return;
      if (!SHIP_TWEEN.yieldEnabled || !wouldCollide(m)) {
        m.gate = { tl, t: gateT };
        onDepart(m);
        return;
      }
      m.waiting = true;
      tl.pause();
      const recheck = () => {
        if (cancelled || !timelines.has(tl)) return;
        if (wouldCollide(m)) {
          delayTweens.push(gsap.delayedCall(SHIP_TWEEN.yieldRecheck, recheck));
          return;
        }
        m.waiting = false;
        m.gate = { tl, t: gateT };
        onDepart(m);
        tl.resume();
      };
      delayTweens.push(gsap.delayedCall(SHIP_TWEEN.yieldRecheck, recheck));
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
      m.gate = null;
      m.waiting = false;

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

      // [yield] 출항 게이트 (사이드스텝 시작 직전)
      const gateT = t;
      tl.call(() => passGate(m, tl, gateT), undefined, gateT);

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
          m.gate = null;
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
                  if (!reflections.current.has(node)) {
                    const refl = makeReflectionInstanced(
                      reflectionBoxOf(prototypes[c.key].geometry),
                      node,
                    );
                    refl.visible = false;
                    node.add(refl);
                    reflections.current.set(node, refl);
                  }
                  tryMarkReady();
                }}
                args={[
                  prototypes[c.key].geometry,
                  occupancyLook ? occupancyContainerMaterial : prototypes[c.key].material,
                  count,
                ]}
                frustumCulled={false}
                // [shadow] 선박 적재 컨테이너는 선박과 함께 그림자 생성
                castShadow
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
