import type { CraneDetailGraphMetrics } from "@/types/detailGraph";
import { getCraneDetailGraph, getOverheadCraneDetailGraph } from "./portSim";

/** 크레인 디테일 그래프 — 운영 시뮬레이션(portSim)에서 계산 */
export function getCraneDetailGraphMetrics(
  index: number,
  subjectKey: string,
  kind: "crane" | "overheadCrane" = "crane",
): CraneDetailGraphMetrics {
  return kind === "overheadCrane"
    ? getOverheadCraneDetailGraph(index, subjectKey)
    : getCraneDetailGraph(index, subjectKey);
}
