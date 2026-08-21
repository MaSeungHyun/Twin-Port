import { useObjectStore } from "@/stores/object";
import { useOccupancyStore } from "@/stores/occupancy";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Ground from "./Port/Ground";
import OverHeadCrane from "./Port/OverHeadCrane";
import ShipFleet from "./Port/ShipFleet";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);

  return (
    <>
      <ContainerYard visible={containerVisible && !occupancyLook} />
      <BlockFootprints />
      <BlockOccupancyView visible={occupancyLook} />
    </>
  );
}

function OverheadCraneLayer() {
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  return (
    <group visible={!occupancyLook}>
      <OverHeadCrane />
    </group>
  );
}

function Models() {
  return (
    <>
      <ShipFleet />
      <OverheadCraneLayer />

      <YardLayer />
      <Ground />
    </>
  );
}

export default Models;
