import { CRANE_INSTANCES, SHIP_INSTANCES } from "@/constants/model";
import { useObjectStore } from "@/stores/object";
import { useViewportStore } from "@/stores/viewport";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Crane from "./Port/Crane";
import Ground from "./Port/Ground";
import OverHeadCrane from "./Port/OverHeadCrane";
import Ship from "./Port/Ship";
import Terrain from "./Terrain";

function Models() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const terrainVisible = useObjectStore((s) => s.terrainVisible);
  const containerVisible = useObjectStore((s) => s.containerVisible);

  return (
    <>
      <Terrain visible={terrainVisible} />
      <Ground />

      <Ship instances={SHIP_INSTANCES} />
      <Crane instances={CRANE_INSTANCES} />
      <OverHeadCrane />

      <ContainerYard visible={!occupancyMode && containerVisible} />
      <BlockFootprints visible={!occupancyMode} />
      {occupancyMode ? <BlockOccupancyView /> : null}
    </>
  );
}

export default Models;
