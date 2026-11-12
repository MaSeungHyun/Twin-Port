import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import WindowedList from "@/components/ui/WindowedList";
import { shipStatusLabel } from "@/domain/portTwinMock";
import { usePortSim } from "@/hooks/usePortSim";
import type { SimShip } from "@/domain/portSim";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { FrameSlot } from "@/components/ui/PanelFrames";
import { useDetailSelection } from "../useDetailSelection";

type ShipFilter = "all" | "working" | "arrive" | "depart";

const FILTERS: { id: ShipFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "working", label: "작업" },
  { id: "arrive", label: "입항" },
  { id: "depart", label: "출항" },
];

function matches(ship: SimShip, filter: ShipFilter) {
  if (filter === "working") return ship.status === "loading" || ship.status === "discharging" || ship.status === "berthed";
  if (filter === "arrive") return ship.status === "arriving";
  if (filter === "depart") return ship.status === "departing" || ship.status === "preparing";
  return true;
}

function statusTone(status: SimShip["status"]): "info" | "warning" | "ok" | "neutral" {
  if (status === "arriving" || status === "loading" || status === "discharging") return "info";
  if (status === "departing" || status === "preparing" || status === "berthed") return "warning";
  if (status === "departed") return "neutral";
  return "ok";
}

function statusClass(status: SimShip["status"]) {
  if (statusTone(status) === "info") return "text-[#8CC4FF]";
  if (statusTone(status) === "warning") return "text-[#FFC966]";
  if (statusTone(status) === "neutral") return "text-dt-text-3";
  return "text-[#6FE8C0]";
}

export default function ShipHud() {
  const sim = usePortSim();
  const selectShip = useViewportStore((s) => s.selectShip);
  const storeKey = useContentViewStore((s) => s.detailShipKey);
  const selection = useDetailSelection(storeKey, () => {
    const viewport = useViewportStore.getState();
    viewport.clearShipSelection();
    viewport.clearShipDetailFocus();
    useContentViewStore.setState({ detailShipKey: null });
  });
  const [filter, setFilter] = useState<ShipFilter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sim.ships.filter((ship) => {
      if (!matches(ship, filter)) return false;
      if (!q) return true;
      return [ship.name, ship.berth, ship.callId].some((value) => value.toLowerCase().includes(q));
    });
  }, [sim.ships, filter, query]);

  const selected = selection.key ? sim.ships.find((ship) => ship.key === selection.key) ?? null : null;

  const focus = (ship: SimShip) => {
    if (selection.select(ship.key)) selectShip(ship.key);
  };
  // 위치추적 = 목록 클릭과 같은 Tracking. focus 는 같은 선박 재선택 시 상세를 닫는 토글이라 쓰지 않는다.
  const track = (ship: SimShip) => selectShip(ship.key);

  return (
    <>
      <FrameSlot side="left" id="ship" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-dt-text">선박</h2>
            <span className="text-[12px] text-dt-text-3">{sim.ships.length}척</span>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-white/4 px-3 text-dt-text-3 shadow-[inset_0_0_0_1px_#ffffff14]">
            <Icon icon="Search" className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="선박명 · 기항 ID 검색"
              className="w-full bg-transparent text-[12px] text-dt-text outline-none placeholder:text-dt-text-3"
            />
          </label>
          <div className="mt-3 flex gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[12px] font-normal text-dt-text-2",
                  filter === item.id && "bg-white/8 text-dt-text",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <WindowedList
          className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          items={rows}
          rowHeight={64}
          empty={<p className="px-2 py-8 text-center text-[12px] text-[#5C6B7A]">해당하는 선박이 없습니다</p>}
          renderRow={(ship) => (
            <button
              key={ship.key}
              type="button"
              onClick={() => focus(ship)}
              className={cn(
                "flex h-16 w-full items-center gap-2 rounded-lg px-3 text-left",
                selected?.key === ship.key ? "bg-dt-info/12 shadow-[inset_0_0_0_1px_#3D9BFF80]" : "hover:bg-white/6",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-dt-text">{ship.name}</span>
                <span className="block truncate text-[12px] text-dt-text-2">{ship.callId} · 선석 {ship.berth || "—"}</span>
              </span>
              <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[12px]", statusClass(ship.status))}>
                <span className="size-2 rounded-full bg-current" />
                {shipStatusLabel(ship.status)}
              </span>
            </button>
          )}
        />
      </aside>
      </FrameSlot>

      <FrameSlot side="right" id="ship-detail" active={selected != null && !selection.closing} size={{ width: 360, height: "fill", lift: true }} rank={1}>
      {selected ? (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-6 text-dt-text">
          <div className="flex shrink-0 items-center justify-between">
            <p className="text-[10px] font-medium tracking-[1px] text-dt-text-3">VESSEL · 선박 상세</p>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex shrink-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-[20px] font-medium text-dt-text">{selected.name}</h2>
            <Tag tone={statusTone(selected.status)}>{shipStatusLabel(selected.status)}</Tag>
          </div>
          <p className="mt-1 shrink-0 text-[12px] text-dt-text-2">{selected.callId}</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <dl className="mt-4 flex flex-col">
            <Row label="선석" value={selected.berth || "—"} />
            <Row label="기항" value={selected.callId} />
            <Row label="ETA" value={selected.eta} />
            <Row label="ETD" value={selected.etd} />
            <Row label="크레인" value={selected.craneNames.join(", ") || "—"} />
          </dl>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[12px] text-dt-text-2">
              <span>양하</span>
              <span className="font-medium tabular-nums text-dt-text">{selected.discharged.toLocaleString()} / {selected.dischargeTotal.toLocaleString()}</span>
            </div>
            <ProgressBar value={selected.dischargeTotal ? (selected.discharged / selected.dischargeTotal) * 100 : 0} tone="info" />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px] text-dt-text-2">
              <span>적재</span>
              <span className="font-medium tabular-nums text-dt-text">{selected.loaded.toLocaleString()} / {selected.loadTotal.toLocaleString()}</span>
            </div>
            <ProgressBar value={selected.loadTotal ? (selected.loaded / selected.loadTotal) * 100 : 0} tone="info" />
          </div>
          <button
            type="button"
            onClick={() => track(selected)}
            className="mt-auto h-10 rounded-lg bg-dt-point text-[14px] font-medium text-dt-bg"
          >
            위치추적
          </button>
          </div>
        </aside>
      ) : null}
      </FrameSlot>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <dt className="text-[12px] font-normal text-dt-text-3">{label}</dt>
      <dd className="truncate text-[12px] font-medium text-dt-text">{value}</dd>
    </div>
  );
}
