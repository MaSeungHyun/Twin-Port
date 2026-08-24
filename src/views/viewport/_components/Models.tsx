import { useObjectStore } from "@/stores/object";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Ground from "./Port/Ground";
import OverHeadCrane from "./Port/OverHeadCrane";
import ShipFleet from "./Port/ShipFleet";
import Terrain from "./Terrain";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const tracking = useViewportStore((s) => Boolean(s.selectedContainerId));

  return (
    <>
      <ContainerYard visible={containerVisible} />
      <BlockFootprints />
      <BlockOccupancyView visible={occupancyLook && !tracking} />
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

function TerrainLayer() {
  const terrainVisible = useObjectStore((s) => s.terrainVisible);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  return <Terrain visible={terrainVisible && !occupancyLook} />;
}

function Models() {
  return (
    <>
      <TerrainLayer />
      <ShipFleet />
      <OverheadCraneLayer />

      <YardLayer />
      <Ground />
    </>
  );
}

export default Models;
