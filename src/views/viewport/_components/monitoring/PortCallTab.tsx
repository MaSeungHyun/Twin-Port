import { useState } from "react";
import Button from "@/components/Button";
import { PORT_CALL_SCENARIOS } from "@/constants/portCall";
import { shipStatusLabel } from "@/domain/portTwinMock";
import { usePortSim } from "@/hooks/usePortSim";
import { usePortCallStore } from "@/stores/usePortCallStore";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";

type PortCallTabProps = {
  title?: string;
};

export default function PortCallTab({ title = "선박·선석 운영" }: PortCallTabProps) {
  const sim = usePortSim();
  const scenario = usePortCallStore((s) => s.scenario);
  const setScenario = usePortCallStore((s) => s.setScenario);
  const advance = usePortCallStore((s) => s.advance);
  const reset = usePortCallStore((s) => s.reset);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const ship = sim.ships.find((item) => item.index === selectedIndex) ?? sim.ships[0];
  const delayed = sim.ships.filter((item) => item.delayMinutes > 0);

  function openShip() {
    if (!ship) return;

    useContentViewStore.getState().openShipDetail(ship.key);
    useViewportStore.getState().setMonitorMode(false);
  }

  return (
    <div className="scrollbar-themed flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 text-dt-text">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-[16px] font-medium text-dt-text">{title}</h2>
          <p className="mt-1 text-[12px] font-normal text-dt-text-2">
            시나리오 데모 · {sim.clock} · {sim.running ? "진행 중" : "관제 시작 전"}
          </p>
        </div>

        <div className="flex flex-wrap gap-sm">
          {PORT_CALL_SCENARIOS.map((item) => (
            <Button
              key={item.id}
              aria-pressed={scenario === item.id}
              onClick={() => setScenario(item.id)}
              className={cn(
                "px-3 py-2 shadow-[inset_0_0_0_1px_#ffffff1f]",
                scenario === item.id ? "dt-active hover:bg-dt-point/16" : "bg-white/4 text-dt-text",
              )}
            >
              {item.label}
            </Button>
          ))}
          <Button onClick={advance} className="bg-white/4 px-3 text-dt-text shadow-[inset_0_0_0_1px_#ffffff1f]">
            +1시간
          </Button>
          <Button onClick={reset} className="bg-white/4 px-3 text-dt-text shadow-[inset_0_0_0_1px_#ffffff1f]">
            데모 초기화
          </Button>
        </div>
      </div>

      <p className="border-l-2 border-dt-warn bg-dt-warn/10 px-4 py-2 text-[14px] font-normal text-dt-text-2">
        모의 운영 데이터입니다. 지연 조건은 1선석에 적용됩니다. 시간 이동·시나리오 변경은 운영 데이터에 반영되며 3D 이동 애니메이션은 별도로 재생됩니다.
      </p>

      <div className="grid grid-cols-2 gap-sm xl:grid-cols-4">
        {[
          ["배정 선석", `${sim.ships.length}개`],
          ["양하·적재 중", `${sim.kpi.shipsWorking}척`],
          ["출항 준비", `${sim.ships.filter((item) => item.status === "preparing").length}척`],
          ["출항 지연 계획", `${delayed.length}척`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[10px] bg-white/[0.03] p-5">
            <p className="text-[12px] font-normal text-dt-text-2">{label}</p>
            <p className="mt-2 text-[20px] font-light text-dt-text">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 gap-md xl:grid-cols-[3fr_2fr]">
        <section className="min-w-0 rounded-[10px] bg-white/[0.03] p-5">
          <h3 className="mb-3 text-[16px] font-medium text-dt-text">선석 배정·일정표</h3>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-base">
              <thead className="border-b border-white/8 text-[10px] font-medium tracking-[1px] text-dt-text-3">
                <tr>
                  {["선석 / 상태", "선박 / 기항", "진행", "계획 이안", "예상 이안", "지연"].map((label) => (
                    <th key={label} className="px-sm py-sm font-normal">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sim.ships.map((item) => (
                  <tr
                    key={item.key}
                    className={cn("border-b border-white/8 text-[12px]", ship?.index === item.index && "bg-dt-info/12")}
                  >
                    <td className="px-sm py-sm">
                      {item.berth}
                      <p className="text-[12px] text-dt-text-3">{item.berthState}</p>
                    </td>
                    <td className="px-sm py-sm">
                      <Button
                        onClick={() => setSelectedIndex(item.index)}
                        aria-pressed={ship?.index === item.index}
                        className="text-dt-point-bright underline decoration-dt-point/30"
                      >
                        {item.name}
                      </Button>
                      <p className="text-[12px] text-dt-text-3">{item.callId}</p>
                    </td>
                    <td className="px-sm py-sm">
                      {shipStatusLabel(item.status)}
                      <p className="text-[12px] text-dt-text-3">{item.progress}%</p>
                    </td>
                    <td className="px-sm py-sm">{item.plannedDeparture}</td>
                    <td className="px-sm py-sm">{item.etd}</td>
                    <td className={cn("px-sm py-sm", item.delayMinutes > 0 ? "text-dt-warn" : "text-dt-text-3")}>
                      {item.delayMinutes > 0 ? `+${item.delayMinutes}분` : "정상"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {ship ? (
          <section className="rounded-[10px] bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-sm">
              <div>
                <h3 className="text-[16px] font-medium text-dt-text">{ship.name}</h3>
                <p className="mt-1 text-[14px] text-dt-info">
                  {ship.berth} · {shipStatusLabel(ship.status)}
                </p>
              </div>
              <Button onClick={openShip} className="bg-white/4 px-3 py-2 text-dt-text shadow-[inset_0_0_0_1px_#ffffff1f]">
                3D 상세
              </Button>
            </div>

            <ol className="my-md flex flex-col gap-sm">
              {ship.schedule.map((event) => (
                <li
                  key={event.label}
                  className={cn(
                    "flex justify-between gap-md border-l-2 px-md py-xs text-base",
                    event.complete ? "border-dt-point text-dt-text" : "border-white/20 text-dt-text-3",
                  )}
                >
                  <span>{event.label}{event.complete ? " · 도달" : " · 예정"}</span>
                  <span className="tabular-nums">{event.at}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-sm border-t border-white/10 pt-md text-base">
              <p>
                잔여 작업 <span className="text-dt-point-bright">{ship.remaining.toLocaleString()}개</span>
                {" · "}생산성 {ship.mph}개/h
              </p>
              <p>
                출항 지원: <span className={ship.delayMinutes > 0 ? "text-dt-warn" : "text-dt-ok"}>
                  {ship.departureCause}
                </span>
              </p>
              <p>후속 기항 접안 계획: {ship.nextBerthing}</p>
              <p className="text-dt-text-3">다음 접안 영향 {ship.nextDelayMinutes}분 · 선석 여유시간 내 지연은 흡수됩니다.</p>
            </div>
          </section>
        ) : (
          <p className="text-dt-text-2">선박 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
