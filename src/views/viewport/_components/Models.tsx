import Ground from "./Port/Ground";
import ContainerYard from "./Port/ContainerYard";
import Ship from "./Port/Ship";
import Crane from "./Port/Crane";
import OverHeadCrane from "./Port/OverHeadCrane";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import { useViewportStore } from "@/stores/viewport";

const SHIP_SCALE = 0.5;
const CRANE_SCALE = 0.5;

const SHIP_Y = 0.3;

const SHIP_INSTANCES = [
  { position: [65, SHIP_Y, 80] as [number, number, number], scale: SHIP_SCALE },
  {
    position: [65, SHIP_Y, 20] as [number, number, number],
    scale: SHIP_SCALE,
  },
  {
    position: [65, SHIP_Y, -50] as [number, number, number],
    scale: SHIP_SCALE,
  },
];

const CRANE_INSTANCES = [
  { position: [50, 0, 70] as [number, number, number], scale: CRANE_SCALE },
  { position: [50, 0, 80] as [number, number, number], scale: CRANE_SCALE },
  { position: [50, 0, 90] as [number, number, number], scale: CRANE_SCALE },

  { position: [50, 0, 20] as [number, number, number], scale: CRANE_SCALE },
  { position: [50, 0, 10] as [number, number, number], scale: CRANE_SCALE },
  { position: [50, 0, 30] as [number, number, number], scale: CRANE_SCALE },

  {
    position: [50, 0, -50] as [number, number, number],
    scale: CRANE_SCALE,
  },
  {
    position: [50, 0, -60] as [number, number, number],
    scale: CRANE_SCALE,
  },
  {
    position: [50, 0, -70] as [number, number, number],
    scale: CRANE_SCALE,
  },
];

function Models() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);

  return (
    <>
      <Ship instances={SHIP_INSTANCES} />
      <Crane instances={CRANE_INSTANCES} />
      <OverHeadCrane />
      <Ground />
      <ContainerYard visible={!occupancyMode} />
      {occupancyMode ? <BlockOccupancyView /> : null}
    </>
  );
}

export default Models;
