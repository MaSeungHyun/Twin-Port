import { getShipDetailGraph } from "./portSim";

/** 선박 디테일 그래프 — 운영 시뮬레이션(portSim)에서 계산 */
export function getShipDetailGraphData(index: number, subjectKey: string) {
  return getShipDetailGraph(index, subjectKey);
}
