import { SHIP_INSTANCES } from "@/constants/model";
import { SHIP_TWEEN } from "@/constants/tween";
import { bindShipPoses } from "@/domain/shipWake";
import { useOccupancyStore } from "@/stores/occupancy";
import { useYardStore } from "@/stores/yard";
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Group } from "three";
import Ship, { type ShipInstance } from "./Ship";
import ShipCargo from "./ShipCargo";
import ShipGizmo from "./ShipGizmo";
import ShipMaterialPanel from "./ShipMaterialPanel";

/** 디버그: 기준 선박(SHIP_PLACEMENTS[0])만 렌더. 나머지 데이터는 유지 — null이면 전체 */
const SHIP_RENDER_LIMIT: number | null = null;

/** 선박 화물 컨테이너 렌더 on/off */
const SHIP_TWEEN_CARGO_ENABLED = true;

function cloneShipPoses(list: readonly ShipInstance[]): ShipInstance[] {
  return list.map((ship) => ({
    position: [ship.position[0], ship.position[1], ship.position[2]],
    rotation: ship.rotation
      ? ([...ship.rotation] as [number, number, number])
      : undefined,
    scale: ship.scale,
  }));
}

function OccupancyHiddenCargo({
  posesRef,
  berths,
}: {
  posesRef: RefObject<ShipInstance[]>;
  berths: readonly ShipInstance[];
}) {
  const groupRef = useRef<Group>(null);

  useLayoutEffect(() => {
    const apply = (look: boolean) => {
      if (groupRef.current) groupRef.current.visible = !look;
    };
    apply(useOccupancyStore.getState().occupancyLook);
    return useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(state.occupancyLook);
    });
  }, []);

  return (
    <group ref={groupRef}>
      <ShipCargo posesRef={posesRef} berths={berths} />
    </group>
  );
}

/** 선체 + 화물 적재/출항을 같은 pose로 묶음 */
export default function ShipFleet() {
  const modelShips = useYardStore((s) => s.ships);
  const berths = useMemo(() => {
    const all = modelShips.length > 0 ? modelShips : SHIP_INSTANCES;
    return SHIP_RENDER_LIMIT == null ? all : all.slice(0, SHIP_RENDER_LIMIT);
  }, [modelShips]);
  const poses = useMemo(() => cloneShipPoses(berths), [berths]);
  const posesRef = useRef(poses);

  useLayoutEffect(() => {
    // 척수가 바뀔 때만 교체. occupancy 리렌더로 새 clone을 넣으면 출항 위치가 리셋됨
    if (posesRef.current.length !== poses.length) {
      posesRef.current = poses;
    }
    bindShipPoses(posesRef.current);
    return () => bindShipPoses(null);
  }, [poses]);

  if (berths.length === 0) return null;

  return (
    <>
      <Ship key={berths.length} instances={poses} posesRef={posesRef} />
      <ShipGizmo posesRef={posesRef} />
      <ShipMaterialPanel />
      {/* 컨테이너(화물): ship.glb 실측 갑판(SHIP_DECK) 기준 */}
      {SHIP_TWEEN_CARGO_ENABLED && SHIP_TWEEN.enabled ? (
        <OccupancyHiddenCargo
          key={`cargo-${berths.length}`}
          posesRef={posesRef}
          berths={berths}
        />
      ) : null}
    </>
  );
}
