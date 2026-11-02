import { create } from "zustand";

export type DowntimeKind = "quayCrane" | "overheadCrane";

/** 장비 정지(고장) 이력 한 건 — 끝나도 지우지 않고 남긴다 */
export type DowntimeLogEntry = {
  id: string;
  /** `${kind}:${index}` — failure store 키와 같다 */
  key: string;
  kind: DowntimeKind;
  index: number;
  name: string;
  cause: string;
  /** epoch ms */
  start: number;
  /** epoch ms, 진행 중이면 null */
  end: number | null;
};

/** 세션 동안 보관할 최대 이력 수 */
export const DOWNTIME_LOG_LIMIT = 200;

type DowntimeLogStore = {
  /** 최신 순 */
  entries: DowntimeLogEntry[];
  open: (entry: Omit<DowntimeLogEntry, "id" | "end">) => void;
  close: (key: string, end: number) => void;
  updateCause: (key: string, cause: string) => void;
  clear: () => void;
};

let seq = 0;

export const useDowntimeLogStore = create<DowntimeLogStore>((set) => ({
  entries: [],
  open: (entry) =>
    set((s) => ({
      entries: [{ ...entry, id: `downtime-${++seq}`, end: null }, ...s.entries].slice(0, DOWNTIME_LOG_LIMIT),
    })),
  close: (key, end) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.key === key && e.end == null ? { ...e, end } : e)),
    })),
  updateCause: (key, cause) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.key === key && e.end == null && e.cause !== cause ? { ...e, cause } : e)),
    })),
  clear: () => set({ entries: [] }),
}));

/** 진행 중이면 now 까지, 분 단위(최소 1분) */
export function downtimeMinutes(entry: DowntimeLogEntry, now = Date.now()) {
  return Math.max(1, Math.round(((entry.end ?? now) - entry.start) / 60000));
}

export function downtimeFor(key: string): DowntimeLogEntry[] {
  return useDowntimeLogStore.getState().entries.filter((e) => e.key === key);
}
