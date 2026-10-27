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
import { useOccupancyStore } from "@/stores/occupancy";
import { getActiveShipKey, useViewportStore } from "@/stores/viewport";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { applyBuoyancy, makeBuoyState, updateBuoyancy, type BuoyState } from "../OceanTsl/buoyancy";
import { Box3 as BuoyBox3, Vector3 } from "three";
import { buildShipProfile, oceanState, SHIP_BINS } from "../OceanTsl/oceanApi";
const PROF_LEVELS = 32;
import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  Box3,
  type BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
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
const WATERWAY_MIN_SCALE = 0.4;
const WATERWAY_HOLD = 0.22;
const WATERWAY_GROW = 2.2;
const WATERWAY_SHRINK = 3.4;

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
  return Math.min(1, moved / dt / WATERWAY_FULL_SPEED);
}

function followWaterway(current: number, target: number, dt: number) {
  if (target <= 0 && current < 0.01) return 0;
  if (target >= WATERWAY_MIN_SCALE && current <= 0)
    current = WATERWAY_MIN_SCALE;
  const rate = target >= current ? WATERWAY_GROW : WATERWAY_SHRINK;
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
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const occupancyRefs = useRef<(InstancedMesh | null)[]>([]);
  const outlineRefs = useRef<(Mesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const lastPos = useRef<([number, number] | undefined)[]>([]);
  const buoy = useRef<BuoyState[]>([]);
  const buoyAxis = useRef<"x" | "z" | null>(null);
  const profTable = useRef<null | { ys: number[]; profs: ReturnType<typeof buildShipProfile>[]; axis: 0 | 1; last: number; logged: boolean }>(null);
  const waterwayOn = useRef<number[]>([]);
  const waterwayHold = useRef<number[]>([]);
  const waterwaySpeed = useRef<number[]>([]);

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
      const source =
        occupancyRefs.current[partIndex] ?? meshRefs.current[partIndex];
      if (!source) {
        outline.visible = false;
        return;
      }
      source.getMatrixAt(outlineIndex, outline.matrix);
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
        lastPos.current[index] = next;
        return;
      }

      const ratio = straightSpeedRatio(
        instance,
        lastPos.current[index],
        next,
        step,
      );

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
        ? WATERWAY_MIN_SCALE + (1 - WATERWAY_MIN_SCALE) * speed
        : 0;

      waterwayOn.current[index] = followWaterway(
        waterwayOn.current[index] ?? 0,
        target,
        step,
      );
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
    const tbl = profTable.current, inst0 = list[0];
    if (tbl && inst0) {
      const sc0 = instanceScale(inst0);
      const shipY = (inst0.position[1] ?? 0) + (buoy.current[0]?.heave ?? 0);
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

    parts.forEach((part, partIndex) => {
      const instanced = meshRefs.current[partIndex];
      const occupancy = occupancyRefs.current[partIndex];
      if (!instanced && !occupancy) return;

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
        instanced?.setMatrixAt(index, matrix);
        occupancy?.setMatrixAt(index, matrix);
      });

      if (instanced) {
        instanced.count = list.length;
        instanced.instanceMatrix.needsUpdate = true;
      }
      if (occupancy) {
        occupancy.count = list.length;
        occupancy.instanceMatrix.needsUpdate = true;
      }
    });

    applyHoverOutline(list);
  }

  useFrame((_, delta) => {
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
          const instanced = meshRefs.current[index];
          if (instanced) instanced.visible = true;
          const occupancy = occupancyRefs.current[index];
          if (occupancy) occupancy.visible = false;
          setWaterwayOccupancyEmissive(part.material, look);
          return;
        }

        const instanced = meshRefs.current[index];
        const occupancy = occupancyRefs.current[index];
        if (instanced) instanced.visible = !look;
        if (occupancy) occupancy.visible = look;
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
  }, [parts]);

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
      {parts.map((part, index) => (
        <group key={index}>
          <instancedMesh
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
            args={[part.geometry, part.material, count]}
            castShadow
            receiveShadow
            frustumCulled={false}
            visible={!DEBUG_SHIP_OCCUPANCY_MATERIAL}
            onPointerOver={
              part.waterway
                ? undefined
                : (event) =>
                    handleShipPointerOver(event, instanceHoverId(event))
            }
            onPointerOut={
              part.waterway
                ? undefined
                : (event) =>
                    handleShipPointerOut(event, instanceHoverId(event))
            }
            onClick={part.waterway ? undefined : handleShipClick}
          />
          {part.waterway ? null : (
            <instancedMesh
              ref={(node) => {
                occupancyRefs.current[index] = node;
              }}
              args={[part.geometry, occupancyMaterial, count]}
              visible={DEBUG_SHIP_OCCUPANCY_MATERIAL}
              frustumCulled={false}
              castShadow
              receiveShadow
              onPointerOver={(event) =>
                handleShipPointerOver(event, instanceHoverId(event))
              }
              onPointerOut={(event) =>
                handleShipPointerOut(event, instanceHoverId(event))
              }
              onClick={handleShipClick}
            />
          )}
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
