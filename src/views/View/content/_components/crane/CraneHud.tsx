import { memo, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import SegmentedControl from "@/components/ui/SegmentedControl";
import WindowedList from "@/components/ui/WindowedList";
import { resolveCraneIndex } from "@/domain/cameraFocus";
import { resolveOverheadCraneIndex } from "@/domain/overheadCraneTwin";
import { usePortSim } from "@/hooks/usePortSim";
import type { SimCrane, SimOverheadCrane } from "@/domain/portSim";
import { useContentViewStore, type CraneTab } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { FrameSlot } from "@/components/ui/PanelFrames";
import { useDetailSelection } from "../useDetailSelection";

type StatusFilter = "all" | "active" | "idle" | "error";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "active", label: "가동" },
  { id: "idle", label: "대기" },
  { id: "error", label: "고장" },
];

function statusLabel(status: string) {
  if (status === "error") return "고장";
  if (status === "idle") return "대기";
  return "가동";
}

function statusTone(status: string): "danger" | "neutral" | "ok" {
  if (status === "error") return "danger";
  if (status === "idle") return "neutral";
  return "ok";
}

function statusClass(status: string) {
  if (status === "error") return "text-[#FF8A8B]";
  if (status === "idle") return "text-dt-text-3";
  return "text-[#6FE8C0]";
}

const CraneRow = memo(function CraneRow({
  name,
  subtitle,
  status,
  selected,
  onSelect,
}: {
  name: string;
  subtitle: string;
  status: SimCrane["status"];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-16 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-white/6",
        selected && "bg-dt-info/12 shadow-[inset_0_0_0_1px_#3D9BFF80]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-dt-text">{name}</span>
        <span className="block truncate text-[12px] text-dt-text-2">{subtitle}</span>
      </span>
      <span className={cn("inline-flex items-center gap-1.5 text-[12px]", statusClass(status))}>
        <span className="size-2 rounded-full bg-current" />
        {statusLabel(status)}
      </span>
    </button>
  );
}, (prev, next) => prev.name === next.name && prev.subtitle === next.subtitle && prev.status === next.status && prev.selected === next.selected);

export default function CraneHud() {
  const sim = usePortSim();
  const tab = useContentViewStore((s) => s.craneTab);
  const setCraneTab = useContentViewStore((s) => s.setCraneTab);
  const selectCrane = useViewportStore((s) => s.selectCrane);
  const selectOverheadCrane = useViewportStore((s) => s.selectOverheadCrane);
  const quayKey = useContentViewStore((s) => s.detailCraneKey);
  const ohcKey = useContentViewStore((s) => s.detailOverheadCraneKey);
  const storeIndex = tab === "quay"
    ? (quayKey ? resolveCraneIndex(quayKey) : null)
    : (ohcKey ? resolveOverheadCraneIndex(ohcKey) : null);
  const selection = useDetailSelection(storeIndex, () => {
    const viewport = useViewportStore.getState();
    const current = useContentViewStore.getState().craneTab;
    if (current === "quay") {
      viewport.clearCraneSelection();
      viewport.clearCraneDetailFocus();
      useContentViewStore.setState({ detailCraneKey: null });
    } else {
      viewport.clearOverheadCraneSelection();
      viewport.clearOverheadCraneDetailFocus();
      useContentViewStore.setState({ detailOverheadCraneKey: null });
    }
  });
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const source = tab === "quay" ? sim.cranes : sim.overheadCranes;
  const counts = useMemo(() => ({
    all: source.length,
    active: source.filter((item) => item.status === "active").length,
    idle: source.filter((item) => item.status === "idle").length,
    error: source.filter((item) => item.status === "error").length,
  }), [source]);

  const rows = source.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.name, "block" in item ? item.block : item.vessel].some((value) => value.toLowerCase().includes(q));
  });
  const selected = selection.key == null ? null : source.find((item) => item.index === selection.key) ?? null;

  // 위치추적 = 목록 클릭과 같은 카메라 Tracking. focus 는 같은 행을 다시 누르면 상세를 닫는 토글이라 상세 버튼에 쓰면 패널이 닫혔다.
  const track = (item: SimCrane | SimOverheadCrane) => {
    if (tab === "quay") selectCrane(item.index);
    else selectOverheadCrane(item.index);
  };
  const focus = (item: SimCrane | SimOverheadCrane) => {
    if (selection.select(item.index)) track(item);
  };

  return (
    <>
      <FrameSlot side="left" id="crane" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-3 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-medium text-dt-text">크레인</h2>
            <span className="text-[12px] text-dt-text-3">{source.length}대</span>
          </div>
          <SegmentedControl<CraneTab>
            className="mt-3"
            value={tab}
            onChange={(next) => { setCraneTab(next); selection.close(); }}
            options={[
              { value: "quay", label: "컨테이너" },
              { value: "overhead", label: "오버헤드" },
            ]}
          />
          <label className="mt-3 flex h-10 items-center gap-2 rounded-lg bg-white/4 px-3 text-dt-text-3 shadow-[inset_0_0_0_1px_#ffffff14]">
            <Icon icon="Search" className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="크레인, 선박, 블록 검색"
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
                  "h-7 rounded-md px-2 text-[12px] text-dt-text-2",
                  filter === item.id && "bg-white/8 text-dt-text",
                )}
              >
                {item.label} {counts[item.id]}
              </button>
            ))}
          </div>
        </header>
        <WindowedList
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
          items={rows}
          rowHeight={64}
          empty={<p className="px-2 py-6 text-center text-[12px] text-white/40">해당하는 크레인이 없습니다</p>}
          renderRow={(item) => (
            <CraneRow
              key={item.index}
              name={item.name}
              subtitle={"block" in item ? item.block : `${item.vessel || "대기"} · ${item.berth || "—"}`}
              status={item.status}
              selected={selected?.index === item.index}
              onSelect={() => focus(item)}
            />
          )}
        />
      </aside>
      </FrameSlot>

      <FrameSlot side="right" id="crane-detail" active={selected != null && !selection.closing} size={{ width: 360, height: "fill", lift: true }} rank={1}>
      {selected ? (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-6 text-dt-text">
          <header className="flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[1px] text-dt-text-3">CRANE · 크레인 상세</p>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="truncate text-[20px] font-medium">{selected.name}</h2>
                <Tag tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Tag>
              </div>
            </div>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 shrink-0 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-4" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {"cause" in selected && selected.cause ? (
            <p className="mt-2 text-[12px] text-[#FF8A8B]">{selected.cause}</p>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
            <Field label="이동" value={`${selected.moves.toLocaleString()}회`} />
            <Field label="속도" value={`${selected.mph.toFixed(1)} /h`} />
            <Field label="가동률" value={`${Math.round(selected.utilization)}%`} />
            {"vessel" in selected ? <Field label="선박" value={selected.vessel || "—"} /> : <Field label="블록" value={selected.block} />}
            {"berth" in selected ? <Field label="선석" value={selected.berth || "—"} /> : <Field label="장치" value={`${selected.stored}/${selected.capacity}`} />}
          </dl>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[12px] text-dt-text-2">
              <span>가동률</span>
              <span className="font-medium tabular-nums text-dt-text">{Math.round(selected.utilization)}%</span>
            </div>
            <ProgressBar value={selected.utilization} tone="info" />
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-white/40">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}
