import { SHIP_INSTANCES } from "@/constants/model";
import { useRef } from "react";
import Ship, { type ShipInstance } from "./Ship";
import ShipCargo from "./ShipCargo";

function cloneShipPoses(): ShipInstance[] {
  return SHIP_INSTANCES.map((ship) => ({
    position: [ship.position[0], ship.position[1], ship.position[2]],
    rotation: ship.rotation
      ? ([...ship.rotation] as [number, number, number])
      : undefined,
    scale: ship.scale,
  }));
}

/** 선체 + 화물 적재/출항을 같은 pose로 묶음 */
export default function ShipFleet() {
  const posesRef = useRef<ShipInstance[]>(cloneShipPoses());

  return (
    <>
      <Ship posesRef={posesRef} />
      <ShipCargo posesRef={posesRef} />
    </>
  );
}
