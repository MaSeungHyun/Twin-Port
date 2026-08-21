import { useObjectStore } from "@/stores/object";
import { useViewportStore } from "@/stores/viewport";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Ground from "./Port/Ground";
import OverHeadCrane from "./Port/OverHeadCrane";
import ShipFleet from "./Port/ShipFleet";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const occupancyMode = useViewportStore((s) => s.occupancyMode);

  return (
    <>
      <ContainerYard visible={containerVisible} />
      <BlockFootprints />
      <BlockOccupancyView visible={occupancyMode} />
    </>
  );
}

function Models() {
  // const terrainVisible = useObjectStore((s) => s.terrainVisible);

  return (
    <>
      {/* <Terrain visible={terrainVisible} /> */}
      {/* <Ground /> */}

      {/* <SeaTraffic /> */}
      {/* <Crane /> */}

      <ShipFleet />
      <OverHeadCrane />

      <YardLayer />
      <Ground />
    </>
  );
}

export default Models;
