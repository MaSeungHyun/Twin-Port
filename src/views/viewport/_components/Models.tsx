import { useObjectStore } from "@/stores/object";
import { useOccupancyStore } from "@/stores/occupancy";
import { isViewportTracking, useViewportStore } from "@/stores/viewport";
import BlockFootprints from "./Port/Block";
import BlockOccupancyView from "./Port/BlockOccupancyView";
import ContainerYard from "./Port/ContainerYard";
import Ground from "./Port/Ground";
import ShipFleet from "./Port/ShipFleet";
import OverHeadCrane from "./Port/OverHeadCrane";

/** occupancy/container 가시성만 구독 — Ship/Crane 등과 리렌더 분리 */
function YardLayer() {
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const tracking = useViewportStore(isViewportTracking);
  const trackedBlock = useViewportStore((s) => s.trackedBlockCode);
  // 점유율 모드 전체 막대는 그대로(블록 위치추적 중에도 유지). 일반 뷰에서 블록 위치추적이면 그 블록 막대만
  const showAll = occupancyLook && (!tracking || trackedBlock != null);

  return (
    <>
      <ContainerYard visible={containerVisible} />
      <BlockFootprints />
      <BlockOccupancyView visible={showAll || trackedBlock != null} onlyBlockCode={showAll ? null : trackedBlock} />
    </>
  );
}

function Models() {
  return (
    <>
      {/* <TerrainLayer /> */}
      <ShipFleet />
      <OverHeadCrane />

      <YardLayer />
      <Ground />
    </>
  );
}

export default Models;
