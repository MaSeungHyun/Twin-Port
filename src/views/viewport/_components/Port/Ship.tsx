import shipUrl from "@/assets/model/ship.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  DEBUG_SHIP_OCCUPANCY_MATERIAL,
  OCCUPANCY_SHIP_COLOR,
  getOccupancyShipMaterial,
} from "@/domain/occupancyLook/occupancyShipMaterial";
import {
  hoveredIndexOf,
  instanceHoverId,
  portHoverOut,
  portHoverOver,
} from "@/domain/hoverOutline";
import { resolveShipIndex } from "@/domain/cameraFocus";
import {
  activateShipFromViewport,
  pickShipKeyFromClick,
  setViewportPickCursor,
} from "@/domain/viewportPick";
import { SHIP_TWEEN, WATERWAY_FULL_SPEED } from "@/constants/tween";
import {
  OCEAN_WAKE_FALL_SEC,
  OCEAN_WAKE_RISE_SEC,
  OCEAN_WAKE_SPEED_HI,
  OCEAN_WAKE_SPEED_LO,
  OCEAN_WAKE_TELEPORT_RATIO,
  OCEAN_WAKE_RAMP_SEC,
  OCEAN_WAKE_STRAIGHT_BASE,
  OCEAN_STIR_SIDE_GAIN,
  OCEAN_STIR_TURN_GAIN,
  OCEAN_WAKE_CURVE_MAX,
  OCEAN_WAKE_CURVE_SMOOTH_SEC,
} from "@/constants/ocean";
import { useOccupancyStore } from "@/stores/occupancy";
import { getActiveShipKey, useViewportStore } from "@/stores/viewport";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { applyBuoyancy, makeBuoyState, updateBuoyancy, type BuoyState } from "../OceanTsl/buoyancy";
import { Box3 as BuoyBox3, Vector3 } from "three";
import { buildShipProfile, oceanState, SHIP_BINS } from "../OceanTsl/oceanApi";
const PROF_LEVELS = 32;
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { SHIP_LOD_CHECK_EVERY, SHIP_LOD_ENABLED } from "@/constants/shipLod";
import { buildShipLodGeometries, shipLodLevel } from "@/domain/shipLod";
import {
  Box3,
  type BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BoxGeometry,
  Object3D,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import HoverOutlineMesh from "./HoverOutlineMesh";
import { useShipDebugStore } from "@/stores/shipDebug";

export type ShipInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

type ShipPart = {
  geometry: BufferGeometry;
  material: Material | Material[];
  localMatrix: Matrix4;
  waterway: boolean;
};

/** [perf] 선박 포인터 히트 프록시: 고폴리 선체 대신 박스 1개로 레이캐스트 */
const HIT_PROXY_GEOMETRY = new BoxGeometry(1, 1, 1);
// material.visible=false → 렌더/그림자 생략, Mesh.raycast 는 material.visible 을 보지 않으므로 히트 유지
const HIT_PROXY_MATERIAL = new MeshBasicMaterial({ visible: false });
const NO_RAYCAST = () => null;

const WATERWAY_OCCUPANCY_EMISSIVE = new Color(OCCUPANCY_SHIP_COLOR);
const WATERWAY_OCCUPANCY_EMISSIVE_INTENSITY = 1.15;

function isWaterwayObject(object: Object3D) {
  let node: Object3D | null = object;
  while (node) {
    if (/waterway/i.test(node.name)) return true;
    node = node.parent;
  }
  const mesh = object as Mesh;
  return mesh.isMesh && /waterway/i.test(mesh.geometry?.name ?? "");
}

function clonePartMaterial(source: Material | Material[]) {
  return Array.isArray(source)
    ? source.map((mat) => mat.clone())
    : source.clone();
}

function setWaterwayOccupancyEmissive(
  material: Material | Material[],
  look: boolean,
) {
  const list = Array.isArray(material) ? material : [material];
  for (const mat of list) {
    if (!(mat instanceof MeshStandardMaterial)) continue;
    if (look) {
      mat.emissive.copy(WATERWAY_OCCUPANCY_EMISSIVE);
      mat.emissiveIntensity = WATERWAY_OCCUPANCY_EMISSIVE_INTENSITY;
    } else {
      mat.emissive.set(0, 0, 0);
      mat.emissiveIntensity = 0;
    }
  }
}

function instanceScale(instance: ShipInstance) {
  const scale = instance.scale ?? 1;
  return typeof scale === "number" ? scale : scale[0];
}

const WATERWAY_MIN_MOVE = 0.025;
const WATERWAY_HOLD = 0.22;

function straightSpeedRatio(
  instance: ShipInstance,
  prev: [number, number] | undefined,
  next: [number, number],
  dt: number,
) {
  if (instanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2) return 0;
  if (!prev || dt <= 1e-4) return 0;
  const dx = next[0] - prev[0];
  const dz = next[1] - prev[1];
  const moved = Math.hypot(dx, dz);
  if (moved < WATERWAY_MIN_MOVE) return 0;
  const yaw = instance.rotation?.[1] ?? 0;
  const along = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
  if (Math.abs(along) < moved * 0.75) return 0;
  const ratio = moved / dt / WATERWAY_FULL_SPEED;
  // 순간이동(정박지 리셋, 숨김 후 재등장)은 속도로 치지 않음
  if (ratio > OCEAN_WAKE_TELEPORT_RATIO) return -1;
  return Math.min(1, ratio);
}

function wakeSmoothstep(x: number) {
  const t = Math.min(1, Math.max(0, (x - OCEAN_WAKE_SPEED_LO) / (OCEAN_WAKE_SPEED_HI - OCEAN_WAKE_SPEED_LO)));
  return t * t * (3 - 2 * t);
}

function followWaterway(current: number, target: number, dt: number) {
  // 즉시 켜지지 않고 RISE/FALL 시간상수로 서서히 (항적 메시 스케일 + 바다 셰이더 세기 공통)
  if (target <= 0 && current < 0.005) return 0;
  const rate = target >= current ? 1 / OCEAN_WAKE_RISE_SEC : 1 / OCEAN_WAKE_FALL_SEC;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

type ShipProps = {
  /** 정적 인스턴스 (posesRef 없을 때) */
  instances?: ShipInstance[];
  /** 애니메이션용 가변 pose (매 프레임 반영) */
  posesRef?: RefObject<ShipInstance[]>;
};

export default function Ship({ instances, posesRef }: ShipProps) {
  const occupancyMaterial = useMemo(() => getOccupancyShipMaterial(), []);
  const { scene } = useGLTF(shipUrl);
  // [shipLod] [partIndex][lodLevel]
  const meshRefs = useRef<(InstancedMesh | null)[][]>([]);
  const occupancyRefs = useRef<(InstancedMesh | null)[][]>([]);
  /** [shipLod] 인스턴스별 현재 LOD 단계 */
  const shipLevels = useRef<number[]>([]);
  const lodFrame = useRef(0);
  /** [shipLod] part별 인스턴스 월드 행렬 (외곽선용: LOD 슬롯과 무관한 인스턴스 인덱스 기준) */
  const partMatrices = useRef<Float32Array[]>([]);
  const outlineRefs = useRef<(Mesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const lastPos = useRef<([number, number] | undefined)[]>([]);
  /** 최근 이동 방향(단위벡터)과 스무딩된 경로 곡률 (로컬 X/Z 성분, 1/m) */
  const lastDir = useRef<([number, number] | undefined)[]>([]);
  const curv = useRef<[number, number][]>([]);
  const buoy = useRef<BuoyState[]>([]);
  const buoyAxis = useRef<"x" | "z" | null>(null);
  const profTable = useRef<null | { ys: number[]; profs: ReturnType<typeof buildShipProfile>[]; axis: 0 | 1; last: number; logged: boolean }>(null);
  const waterwayOn = useRef<number[]>([]);
  const waterwayHold = useRef<number[]>([]);
  const waterwaySpeed = useRef<number[]>([]);
  const stirOn = useRef<number[]>([]);
  const trailLen = useRef<number[]>([]);
  const stirSign = useRef<number[]>([]);
  const turnOn = useRef<number[]>([]);
  const lastYaw = useRef<(number | undefined)[]>([]);

  const parts = useMemo<ShipPart[]>(() => {
    scene.updateMatrixWorld(true);
    enableGlbShadows(scene);
    const collected: ShipPart[] = [];

    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const waterway = isWaterwayObject(mesh);
      collected.push({
        geometry: mesh.geometry,
        material: waterway ? clonePartMaterial(mesh.material) : mesh.material,
        localMatrix: mesh.matrixWorld.clone(),
        waterway,
      });
    });

    // ship.glb는 busan 월드 위치(노드 translation + scale 0.01)가 구워져 있음.
    // 선체(비-waterway) 실측 bounds 기준으로 XZ 중심=원점, 선저(minY)=0 으로 재정렬. 스케일 변경 없음.
    const hullBox = new Box3();
    const partBox = new Box3();
    for (const part of collected) {
      if (part.waterway) continue;
      part.geometry.computeBoundingBox();
      if (!part.geometry.boundingBox) continue;
      partBox.copy(part.geometry.boundingBox).applyMatrix4(part.localMatrix);
      hullBox.union(partBox);
    }
    if (!hullBox.isEmpty()) {
      const recenter = new Matrix4().makeTranslation(
        -(hullBox.min.x + hullBox.max.x) / 2,
        -hullBox.min.y,
        -(hullBox.min.z + hullBox.max.z) / 2,
      );
      for (const part of collected) part.localMatrix.premultiply(recenter);
    }

    return collected;
  }, [scene]);

  // [perf] 재정렬된 선체 bounds → 단위 박스를 선체 크기로 맞추는 로컬 행렬
  const hitLocal = useMemo(() => {
    const box = new Box3();
    const pb = new Box3();
    for (const part of parts) {
      if (part.waterway || !part.geometry.boundingBox) continue;
      pb.copy(part.geometry.boundingBox).applyMatrix4(part.localMatrix);
      box.union(pb);
    }
    if (box.isEmpty()) return new Matrix4();
    const c = new Vector3();
    const sz = new Vector3();
    box.getCenter(c);
    box.getSize(sz);
    return new Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new Matrix4().makeScale(sz.x, sz.y, sz.z));
  }, [parts]);
  const hitRef = useRef<InstancedMesh | null>(null);
  const hitMatrix = useMemo(() => new Matrix4(), []);

  const applyHoverOutline = useCallback((list: ShipInstance[]) => {
    const hoverIndex = hoveredIndexOf("ship");
    const activeKey = getActiveShipKey(useViewportStore.getState());
    const focusIndex = activeKey ? resolveShipIndex(activeKey) : null;
    const outlineIndex =
      focusIndex != null && focusIndex >= 0
        ? focusIndex
        : hoverIndex >= 0
          ? hoverIndex
          : -1;
    const target = outlineIndex >= 0 ? list[outlineIndex] : undefined;
    const showOutline =
      target != null && instanceScale(target) > SHIP_TWEEN.hiddenScale * 2;

    parts.forEach((part, partIndex) => {
      const outline = outlineRefs.current[partIndex];
      if (!outline) return;
      if (!showOutline || part.waterway) {
        outline.visible = false;
        return;
      }
      const mats = partMatrices.current[partIndex];
      if (!mats || mats.length < (outlineIndex + 1) * 16) {
        outline.visible = false;
        return;
      }
      outline.matrix.fromArray(mats, outlineIndex * 16);
      outline.matrixWorldNeedsUpdate = true;
      outline.visible = true;
    });
  }, [parts]);

  function writeMatrices(list: ShipInstance[], dt: number) {
    if (list.length === 0) return;

    if (waterwayOn.current.length !== list.length) {
      waterwayOn.current = new Array(list.length).fill(0);
      waterwayHold.current = new Array(list.length).fill(0);
      waterwaySpeed.current = new Array(list.length).fill(0);
      lastPos.current = new Array(list.length);
    }

    const step = Math.min(Math.max(dt, 1 / 120), 0.05);

    list.forEach((instance, index) => {
      const next: [number, number] = [
        instance.position[0],
        instance.position[2],
      ];
      if (instanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2) {
        waterwayHold.current[index] = 0;
        waterwaySpeed.current[index] = 0;
        waterwayOn.current[index] = 0;
        stirOn.current[index] = 0;
        turnOn.current[index] = 0;
        lastYaw.current[index] = instance.rotation?.[1] ?? 0;
        lastPos.current[index] = next;
        return;
      }

      const ratio = straightSpeedRatio(
        instance,
        lastPos.current[index],
        next,
        step,
      );

      if (ratio < 0) {
        waterwayHold.current[index] = 0;
        waterwaySpeed.current[index] = 0;
        waterwayOn.current[index] = 0;
        stirOn.current[index] = 0;
        turnOn.current[index] = 0;
        lastYaw.current[index] = instance.rotation?.[1] ?? 0;
        lastPos.current[index] = next;
        return;
      }
      if (ratio > 0) {
        waterwayHold.current[index] = WATERWAY_HOLD;
        const prevSpeed = waterwaySpeed.current[index] ?? 0;
        waterwaySpeed.current[index] =
          prevSpeed + (ratio - prevSpeed) * (1 - Math.exp(-5 * step));
      } else {
        waterwayHold.current[index] = Math.max(
          0,
          (waterwayHold.current[index] ?? 0) - step,
        );
      }

      const holding = (waterwayHold.current[index] ?? 0) > 0;
      const speed = waterwaySpeed.current[index] ?? 0;
      const target = holding
        ? wakeSmoothstep(speed)
        : 0;

      waterwayOn.current[index] = followWaterway(
        waterwayOn.current[index] ?? 0,
        target,
        step,
      );

      // [wake] 직진(출항) 단계: 시작 순간부터 RAMP_SEC 동안 선형으로 키움, 선미/뱃머리 길이는 이동 거리만큼만

      {

        const sh = instance as typeof instance & { straightAt?: number; straightFrom?: [number, number] };

        if (sh.straightAt != null && sh.straightFrom) {

          const prog = Math.min(1, (performance.now() / 1000 - sh.straightAt) / OCEAN_WAKE_RAMP_SEC);

          const rawSp = Math.min(1, waterwaySpeed.current[index] ?? 0);
          // ease-in 초반에도 직진 시작부터 신호가 생기되, 실제 선속도보다 앞서지 않음
          const motionGate = Math.min(1, rawSp / 0.2);
          const sp = wakeSmoothstep(rawSp);
          waterwayOn.current[index] = Math.max(
            prog * motionGate * (OCEAN_WAKE_STRAIGHT_BASE + (1 - OCEAN_WAKE_STRAIGHT_BASE) * sp),
            0,
          );

          trailLen.current[index] = Math.hypot(next[0] - sh.straightFrom[0], next[1] - sh.straightFrom[1]);

        } else trailLen.current[index] = 1e5; // 직진 외(입항 등)는 길이 제한 없음 (속도 기반)

      }
      {
        // 선체 옆 물결: 옆걸음(로컬 Z 횡속도, 부호 = 이동하는 쪽)과 제자리 회전(각속도)을 분리. 직진(로컬 X)은 0
          const prevP = lastPos.current[index], prevYaw = lastYaw.current[index], yaw = instance.rotation?.[1] ?? 0;
          let sideT = 0, turnT = 0;
          if (prevP && prevYaw != null) {
            const dx = next[0] - prevP[0], dz = next[1] - prevP[1];
            const lat = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / step / WATERWAY_FULL_SPEED; // +로컬 Z(우현)
            const dy = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw));
            if (Math.abs(lat) <= OCEAN_WAKE_TELEPORT_RATIO) {
              sideT = wakeSmoothstep(Math.min(1, Math.abs(lat) * OCEAN_STIR_SIDE_GAIN));
              if (Math.abs(lat) > 0.005) stirSign.current[index] = Math.sign(lat);
              turnT = wakeSmoothstep(Math.min(1, (Math.abs(dy) / step) * OCEAN_STIR_TURN_GAIN));
            }
          }
          stirOn.current[index] = followWaterway(stirOn.current[index] ?? 0, sideT, step);
          turnOn.current[index] = followWaterway(turnOn.current[index] ?? 0, turnT, step);
          lastYaw.current[index] = yaw;
          // 경로 곡률: 이동 방향 변화 / 이동 거리 → 로컬 축 성분. 순간이동/정지 시 0 으로 감쇠
          let kx = 0, kz = 0;
          if (prevP) {
            const dx = next[0] - prevP[0], dz = next[1] - prevP[1], ds = Math.hypot(dx, dz);
            if (ds > 1e-3 && ds / step / WATERWAY_FULL_SPEED <= OCEAN_WAKE_TELEPORT_RATIO) {
              const ux = dx / ds, uz = dz / ds, pd = lastDir.current[index];
              if (pd) {
                const mx = (ux - pd[0]) / ds, mz = (uz - pd[1]) / ds;
                kx = mx * Math.cos(yaw) - mz * Math.sin(yaw);
                kz = mx * Math.sin(yaw) + mz * Math.cos(yaw);
                const m = Math.hypot(kx, kz);
                if (m > OCEAN_WAKE_CURVE_MAX) { kx *= OCEAN_WAKE_CURVE_MAX / m; kz *= OCEAN_WAKE_CURVE_MAX / m; }
              }
              lastDir.current[index] = [ux, uz];
            } else if (ds > 1e-3) lastDir.current[index] = undefined;
          }
          const c = curv.current[index] ?? [0, 0];
          const a = 1 - Math.exp(-step / OCEAN_WAKE_CURVE_SMOOTH_SEC);
          curv.current[index] = [c[0] + (kx - c[0]) * a, c[1] + (kz - c[1]) * a];
      }
      lastPos.current[index] = next;
    });

    // 부력: base pose(tween/기즈모) 위에 heave/pitch/roll 합성
    if (!buoyAxis.current) {
      const bb = new BuoyBox3();
      parts.forEach((p) => { p.geometry.computeBoundingBox(); bb.union(p.geometry.boundingBox!.clone().applyMatrix4(p.localMatrix)); });
      buoyAxis.current = bb.max.x - bb.min.x >= bb.max.z - bb.min.z ? "x" : "z";
    }
    list.forEach((instance, index) => {
      const st = (buoy.current[index] ??= makeBuoyState());
      updateBuoyancy(st, instance, buoyAxis.current!, step);
    });
    // [twin-port] 선체 거품: 보이는 모든 배 위치를 바다에 전달 (숨김 스케일은 제외)
    oceanState.ships.length = 0;
    list.forEach((instance, k) => {
      if (instanceScale(instance) > SHIP_TWEEN.hiddenScale * 2)
        oceanState.ships.push({ x: instance.position[0] ?? 0, z: instance.position[2] ?? 0, yaw: instance.rotation?.[1] ?? 0, speed: waterwayOn.current[k] ?? 0, stir: (stirOn.current[k] ?? 0) * (stirSign.current[k] ?? 1), turn: turnOn.current[k] ?? 0, trail: trailLen.current[k] ?? 1e5, kx: curv.current[k]?.[0] ?? 0, kz: curv.current[k]?.[1] ?? 0 });
    });
    // [twin-port] 수선면 윤곽: 로드 시 여러 흘수(32단)에서 선체를 잘라 표로 만들고,
    // 매 프레임 현재 선박 높이(기즈모 y + 부력 heave)/스케일로 로컬 수면 높이를 구해 두 단면 사이를 보간.
    // (이전 버그: 첫 프레임 1회만 생성 → 트윈 중 위치로 null → 사각형 폴백이 고착)
    if (!profTable.current && parts.length) {
      const v = new Vector3(), tris: Float32Array[] = [];
      let y0 = Infinity, y1 = -Infinity;
      for (const p of parts) {
        if (p.waterway) continue;
        const pos = p.geometry.getAttribute("position"); if (!pos) continue;
        const idx = p.geometry.getIndex(), n = idx ? idx.count : pos.count, out = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(p.localMatrix); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        tris.push(out);
      }
      const axis = buoyAxis.current === "x" ? 0 : 1;
      const ys: number[] = [], profs: ReturnType<typeof buildShipProfile>[] = [];
      const top = y0 + Math.min(y1 - y0, 25);
      for (let k = 0; k < PROF_LEVELS; k++) { const y = y0 + 0.05 + ((top - y0 - 0.1) * k) / (PROF_LEVELS - 1); ys.push(y); profs.push(buildShipProfile(tris, y, axis)); }
      profTable.current = { ys, profs, axis, last: NaN, logged: false };
    }
    // 윤곽 기준 배: 보이는 첫 배 (0번이 출항 후 숨겨진 동안에도 다른 배의 컷아웃/거품 유지)
    const vis = Math.max(0, list.findIndex((it) => instanceScale(it) > SHIP_TWEEN.hiddenScale * 2));
    const tbl = profTable.current, inst0 = list[vis];
    if (tbl && inst0) {
      const sc0 = instanceScale(inst0);
      const shipY = (inst0.position[1] ?? 0) + (buoy.current[vis]?.heave ?? 0);
      const wlY = (oceanState.level - shipY) / (sc0 || 1);
      if (sc0 <= SHIP_TWEEN.hiddenScale * 2) oceanState.shipProfile = null;
      else if (Math.abs(wlY - tbl.last) > 1e-3 || !oceanState.shipProfile) {
        tbl.last = wlY;
        const { ys, profs } = tbl, n = ys.length;
        let pf: NonNullable<ReturnType<typeof buildShipProfile>> | null = null;
        if (wlY >= ys[0]! && wlY <= ys[n - 1]!) {
          const t = ((wlY - ys[0]!) / (ys[n - 1]! - ys[0]!)) * (n - 1), k = Math.min(n - 2, Math.floor(t)), f = t - k;
          const A = profs[k], B = profs[k + 1];
          const a = A ?? B, b = B ?? A;
          if (a && b) {
            const lo = new Float32Array(SHIP_BINS), hi = new Float32Array(SHIP_BINS);
            for (let i = 0; i < SHIP_BINS; i++) { lo[i] = a.lo[i]! + (b.lo[i]! - a.lo[i]!) * f; hi[i] = a.hi[i]! + (b.hi[i]! - a.hi[i]!) * f; }
            // 스케일 반영 (선박 로컬 → 월드 m)
            for (let i = 0; i < SHIP_BINS; i++) { lo[i]! *= sc0; hi[i]! *= sc0; }
            pf = { axis: tbl.axis, a0: (a.a0 + (b.a0 - a.a0) * f) * sc0, a1: (a.a1 + (b.a1 - a.a1) * f) * sc0, lo, hi, ver: 1 };
          }
        }
        oceanState.shipProfile = pf;
        if (!tbl.logged) { // [twin-port] 임시 진단 로그 (1회)
          tbl.logged = true;
          console.info("[Ship] 수선면 윤곽", pf ? { axis: pf.axis ? "z" : "x", a0: +pf.a0.toFixed(1), a1: +pf.a1.toFixed(1), midHalfW: +((pf.hi[32]! - pf.lo[32]!) / 2).toFixed(1), bowHalfW: +((pf.hi[63]! - pf.lo[63]!) / 2).toFixed(1), sternHalfW: +((pf.hi[0]! - pf.lo[0]!) / 2).toFixed(1), wlY: +wlY.toFixed(2), shipY, scale: sc0, slices: profs.filter(Boolean).length + "/" + n } : { 결과: "윤곽 없음(수면이 선체 높이 범위 밖) → 컷아웃 없음", wlY, shipY, scale: sc0 });
        }
      }
    }

    const hitPartIndex = parts.findIndex((part) => !part.waterway);
    parts.forEach((part, partIndex) => {
      const instancedLv = meshRefs.current[partIndex] ?? [];
      const occupancyLv = occupancyRefs.current[partIndex] ?? [];
      const nLv = Math.max(instancedLv.length, occupancyLv.length);
      if (nLv === 0) return;
      const slots = new Array<number>(nLv).fill(0);
      let mats = partMatrices.current[partIndex];
      if (!mats || mats.length !== list.length * 16) {
        mats = partMatrices.current[partIndex] = new Float32Array(list.length * 16);
      }
      const hit = partIndex === hitPartIndex ? hitRef.current : null;

      list.forEach((instance, index) => {
        dummy.position.set(...instance.position);
        dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));
        const bs = buoy.current[index];
        if (bs) applyBuoyancy(dummy, bs);

        const scale = instance.scale ?? 1;
        const extra = part.waterway ? waterwayOn.current[index]! : 1;
        if (typeof scale === "number") {
          dummy.scale.setScalar(scale * extra);
        } else {
          dummy.scale.set(scale[0] * extra, scale[1] * extra, scale[2] * extra);
        }

        dummy.updateMatrix();
        matrix.multiplyMatrices(dummy.matrix, part.localMatrix);
        matrix.toArray(mats, index * 16);
        const lv = Math.min(shipLevels.current[index] ?? 0, nLv - 1);
        const slot = slots[lv]!;
        slots[lv] = slot + 1;
        instancedLv[lv]?.setMatrixAt(slot, matrix);
        occupancyLv[lv]?.setMatrixAt(slot, matrix);
        if (hit) {
          hitMatrix.multiplyMatrices(dummy.matrix, hitLocal);
          hit.setMatrixAt(index, hitMatrix);
        }
      });

      if (hit) {
        hit.count = list.length;
        hit.instanceMatrix.needsUpdate = true;
        hit.boundingSphere = null; // 위치 변경 반영 (인스턴스 수 적음 → 저렴)
      }

      for (let lv = 0; lv < nLv; lv++) {
        const c = slots[lv] ?? 0;
        const a = instancedLv[lv];
        if (a) {
          a.count = c;
          a.instanceMatrix.needsUpdate = true;
        }
        const b = occupancyLv[lv];
        if (b) {
          b.count = c;
          b.instanceMatrix.needsUpdate = true;
        }
      }
    });

    applyHoverOutline(list);
  }

  // [shipLod] 비-waterway 파트 LOD geometry 비동기 생성
  const [lodGeoms, setLodGeoms] = useState<BufferGeometry[][] | null>(null);
  useEffect(() => {
    setLodGeoms(null);
    if (!SHIP_LOD_ENABLED) return;
    let cancelled = false;
    buildShipLodGeometries(parts.map((p) => (p.waterway ? null : p.geometry)))
      .then(({ levels, trianglesPerLevel }) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.info("[shipLod] tris per level (1척)", trianglesPerLevel.map(Math.round));
        }
        setLodGeoms(levels);
      })
      .catch((e) => console.warn("[shipLod] 생성 실패, 원본 유지", e));
    return () => {
      cancelled = true;
    };
  }, [parts]);

  useFrame(({ camera }, delta) => {
    {
      const list = posesRef?.current ?? instances;
      if (list && lodGeoms && ++lodFrame.current % SHIP_LOD_CHECK_EVERY === 0) {
        const e = camera.matrixWorld.elements;
        list.forEach((inst, i) => {
          const dx = inst.position[0] - e[12]!, dy = inst.position[1] - e[13]!, dz = inst.position[2] - e[14]!;
          shipLevels.current[i] = shipLodLevel(Math.hypot(dx, dy, dz), shipLevels.current[i] ?? 0);
        });
      }
    }
    const list = posesRef?.current ?? instances;
    if (!list || list.length === 0) return;
    // 디버그 기즈모 pose가 있으면 tween 대신 고정 적용 (0번 선박)
    const override = useShipDebugStore.getState().override;
    if (override && list[0]) {
      list[0].position = [...override.position];
      list[0].rotation = [...override.rotation];
    }
    writeMatrices(list, delta);
  });

  useLayoutEffect(() => {
    const apply = (look: boolean) => {
      parts.forEach((part, index) => {
        if (part.waterway) {
          meshRefs.current[index]?.forEach((m) => { if (m) m.visible = true; });
          occupancyRefs.current[index]?.forEach((m) => { if (m) m.visible = false; });
          setWaterwayOccupancyEmissive(part.material, look);
          return;
        }

        meshRefs.current[index]?.forEach((m) => { if (m) m.visible = !look; });
        occupancyRefs.current[index]?.forEach((m) => { if (m) m.visible = look; });
      });
    };

    const look =
      DEBUG_SHIP_OCCUPANCY_MATERIAL ||
      useOccupancyStore.getState().occupancyLook;
    apply(look);
    return useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(DEBUG_SHIP_OCCUPANCY_MATERIAL || state.occupancyLook);
    });
  }, [parts, lodGeoms]);

  const count = instances?.length ?? 0;
  if (count === 0) return null;

  function handleShipPointerOver(
    event: ThreeEvent<PointerEvent>,
    id: string | null,
  ) {
    if (id == null) return;
    event.stopPropagation();
    setViewportPickCursor(true);
    portHoverOver(event, "ship", id);
  }

  function handleShipPointerOut(
    event: ThreeEvent<PointerEvent>,
    id: string | null,
  ) {
    if (id == null) return;
    event.stopPropagation();
    setViewportPickCursor(false);
    portHoverOut(event, "ship", id);
  }

  function handleShipClick(event: ThreeEvent<PointerEvent>) {
    if (event.delta > 4) return; // [twin-port] 드래그(궤도 회전) 후 놓은 경우는 선택 안 함
    const list = posesRef?.current ?? instances;
    if (!list) return;
    const key = pickShipKeyFromClick(event, list);
    if (!key) return;
    event.stopPropagation();
    // 현재 1척만 렌더 → 인덱스 0 선택 (기즈모 표시)
    useShipDebugStore.getState().select(0);
    activateShipFromViewport(key);
  }

  return (
    <group>
      <instancedMesh
        ref={hitRef}
        args={[HIT_PROXY_GEOMETRY, HIT_PROXY_MATERIAL, count]}
        frustumCulled={false}
        onPointerOver={(event) => handleShipPointerOver(event, instanceHoverId(event))}
        onPointerOut={(event) => handleShipPointerOut(event, instanceHoverId(event))}
        onClick={handleShipClick}
      />
      {parts.map((part, index) => (
        <group key={index}>
          {(lodGeoms?.[index]?.length ? lodGeoms[index]! : [part.geometry]).map((geo, lv) => (
          <instancedMesh
            key={`n${lv}`}
            ref={(node) => {
              (meshRefs.current[index] ??= [])[lv] = node;
            }}
            args={[geo, part.material, count]}
            castShadow
            receiveShadow
            frustumCulled={false}
            visible={!DEBUG_SHIP_OCCUPANCY_MATERIAL}
            raycast={NO_RAYCAST} // [perf] 히트는 HIT_PROXY 가 담당
          />
          ))}
          {part.waterway ? null : (lodGeoms?.[index]?.length ? lodGeoms[index]! : [part.geometry]).map((geo, lv) => (
            <instancedMesh
              key={`o${lv}`}
              ref={(node) => {
                (occupancyRefs.current[index] ??= [])[lv] = node;
              }}
              args={[geo, occupancyMaterial, count]}
              visible={DEBUG_SHIP_OCCUPANCY_MATERIAL}
              frustumCulled={false}
              castShadow
              receiveShadow
              raycast={NO_RAYCAST}
            />
          ))}
          {part.waterway ? null : (
            <HoverOutlineMesh
              geometry={part.geometry}
              meshRef={(node) => {
                outlineRefs.current[index] = node;
              }}
            />
          )}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(shipUrl);
