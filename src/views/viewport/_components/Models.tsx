// import { useObjectStore } from "@/stores/object";
import { useOccupancyStore } from "@/stores/occupancy";
import { isViewportTracking, useViewportStore } from "@/stores/viewport";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
// 컨테이너 위치 재작업 전까지 렌더 중지 (파일 유지)
// import ContainerYard from "./Port/ContainerYard";
import Ground from "./Port/Ground";
import ShipFleet from "./Port/ShipFleet";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  // const containerVisible = useObjectStore((s) => s.containerVisible);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const tracking = useViewportStore(isViewportTracking);

  return (
    <>
      {/* <ContainerYard visible={containerVisible} /> */}
      <BlockFootprints />
      <BlockOccupancyView visible={occupancyLook && !tracking} />
    </>
  );
}

function Models() {
  return (
    <>
      {/* <TerrainLayer /> */}
      <ShipFleet />
      {/* <OverHeadCrane /> */}

      <YardLayer />
      <Ground />
    </>
  );
}

export default Models;
