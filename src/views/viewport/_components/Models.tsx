import { CRANE_INSTANCES } from "@/constants/model";
import { useObjectStore } from "@/stores/object";
import { useViewportStore } from "@/stores/viewport";
import { useState } from "react";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Crane from "./Port/Crane";
import Ground from "./Port/Ground";
import OverHeadCrane from "./Port/OverHeadCrane";
import SeaTraffic from "./Port/SeaTraffic";
import ShipFleet from "./Port/ShipFleet";
import Terrain from "./Terrain";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const [occupancyMounted, setOccupancyMounted] = useState(false);

  if (occupancyMode && !occupancyMounted) {
    setOccupancyMounted(true);
  }

  return (
    <>
      <ContainerYard visible={!occupancyMode && containerVisible} />
      <BlockFootprints visible={!occupancyMode} />
      {occupancyMounted ? <BlockOccupancyView visible={occupancyMode} /> : null}
    </>
  );
}

function Models() {
  const terrainVisible = useObjectStore((s) => s.terrainVisible);

  return (
    <>
      <Terrain visible={terrainVisible} />
      <Ground />

      <ShipFleet />
      {/* <SeaTraffic /> */}
      <Crane instances={CRANE_INSTANCES} />
      <OverHeadCrane />

      <YardLayer />
    </>
  );
}

export default Models;
