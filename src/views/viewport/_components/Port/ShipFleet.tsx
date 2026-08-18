import { SHIP_INSTANCES } from "@/constants/model";
import { SHIP_TWEEN } from "@/constants/tween";
import { useYardStore } from "@/stores/yard";
import { useLayoutEffect, useMemo, useRef } from "react";
import Ship, { type ShipInstance } from "./Ship";
import ShipCargo from "./ShipCargo";

function cloneShipPoses(list: readonly ShipInstance[]): ShipInstance[] {
  return list.map((ship) => ({
    position: [ship.position[0], ship.position[1], ship.position[2]],
    rotation: ship.rotation
      ? ([...ship.rotation] as [number, number, number])
      : undefined,
    scale: ship.scale,
  }));
}

/** 선체 + 화물 적재/출항을 같은 pose로 묶음 */
export default function ShipFleet() {
  const modelShips = useYardStore((s) => s.ships);
  const berths = modelShips.length > 0 ? modelShips : SHIP_INSTANCES;
  const poses = useMemo(() => cloneShipPoses(berths), [berths]);
  const posesRef = useRef<ShipInstance[]>(poses);
  useLayoutEffect(() => {
    posesRef.current = poses;
  }, [poses]);

  if (berths.length === 0) return null;

  return (
    <>
      <Ship key={berths.length} instances={poses} posesRef={posesRef} />
      {SHIP_TWEEN.enabled ? (
        <ShipCargo
          key={`cargo-${berths.length}`}
          posesRef={posesRef}
          berths={berths}
        />
      ) : null}
    </>
  );
}
