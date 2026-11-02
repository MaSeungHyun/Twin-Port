import { BLOCKS } from "@/constants/block";
import {
  craneTwinDetailRows,
  getCraneTwinProfile,
  type CraneTwinProfile,
} from "@/domain/portTwinMock";
import { getSimOverheadCrane } from "@/domain/portSim";
import { useYardStore } from "@/stores/yard";

const KEY_PREFIX = "ohc-";

/** UI key — ohc-3 → overhead crane instance 3 (블록 순서와 동일) */
export function overheadCraneKey(index: number): string {
  return `${KEY_PREFIX}${index}`;
}

export function resolveOverheadCraneIndex(key: string): number | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const index = Number.parseInt(key.slice(KEY_PREFIX.length), 10);
  return Number.isFinite(index) && index >= 0 ? index : null;
}

/** 크레인 인스턴스 = 블록 1:1 (createBlockCenterCraneInstances) */
export function overheadCraneBlockCode(index: number): string {
  const blocks = useYardStore.getState().blocks;
  const source = blocks.length > 0 ? blocks : BLOCKS;
  return source[index]?.code ?? String(index).padStart(2, "0");
}

export function overheadCraneTitle(index: number): string {
  return `오버헤드크레인${overheadCraneBlockCode(index).replace(/\D/g, "")}`;
}

/** 시뮬레이션(portSim) 값 — 블록 컨테이너 비율로 선석 처리량을 나눠 받는다 */
export function getOverheadCraneTwinProfile(index: number): CraneTwinProfile {
  const base = getCraneTwinProfile(index + 2);
  const code = overheadCraneBlockCode(index);
  const sim = getSimOverheadCrane(index);
  return {
    ...base,
    craneId: `OHC-${code}`,
    status: sim?.status ?? "idle",
    containersMoved: sim?.moves ?? 0,
    movesPerHour: Math.round(sim?.mph ?? 0),
    utilization: sim?.utilization ?? 0,
    assignedVessel: `Block ${code}`,
    berth: `Yard ${code}`,
  };
}

export function overheadCraneTwinDetailRows(profile: CraneTwinProfile) {
  return craneTwinDetailRows(profile).map((row) => {
    if (row.label === "assigned vessel") return { ...row, label: "block" };
    if (row.label === "berth") return { ...row, label: "yard area" };
    return row;
  });
}
