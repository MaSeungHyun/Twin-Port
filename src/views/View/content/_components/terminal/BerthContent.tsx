import { shipStatusLabel } from "@/domain/portTwinMock";
import { usePortSim } from "@/hooks/usePortSim";
import { useContentViewStore } from "@/stores/contentView";

export default function BerthContent() {
  const sim = usePortSim();
  const openShipDetail = useContentViewStore((s) => s.openShipDetail);
  const setActiveView = useContentViewStore((s) => s.setActiveView);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-dt-text">
      {sim.ships.map((ship) => {
        const occupied = ship.status !== "arriving" && ship.status !== "departed";

        return (
          <article key={ship.key} className="rounded-[10px] bg-white/4 p-3">
            <div className="flex justify-between gap-2 text-[14px]">
              <h3 className="font-medium">{ship.berth}</h3>
              <span className="text-dt-info">{ship.berthState}</span>
            </div>
            <p className="mt-2 text-[12px] text-dt-text-3">{occupied ? "현재 선박" : "배정 선박"}</p>
            <button
              type="button"
              onClick={() => openShipDetail(ship.key)}
              className="mt-1 text-left text-[14px] font-medium text-dt-text hover:text-dt-point-bright"
            >
              {ship.name}
            </button>
            <p className="text-[12px] text-dt-text-2">{shipStatusLabel(ship.status)}</p>
            <p className="mt-2 text-[12px] text-dt-text-3">다음 기항 접안 계획 {ship.nextBerthing}</p>
          </article>
        );
      })}

      <button
        type="button"
        onClick={() => setActiveView("schedule")}
        className="h-10 shrink-0 rounded-lg bg-white/4 text-[14px] font-medium text-dt-text shadow-[inset_0_0_0_2px_#ffffff1f] hover:bg-white/8"
      >
        입출항 스케줄 보기
      </button>
    </div>
  );
}
