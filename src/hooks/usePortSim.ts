import { getPortSim, type PortSimSnapshot } from "@/domain/portSim";
import { useFailureStore } from "@/stores/useFailureStore";
import { useOpsStore } from "@/stores/useOpsStore";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { useYardStore } from "@/stores/yard";
import { usePortCallStore } from "@/stores/usePortCallStore";

/**
 * 운영 시뮬레이션 스냅샷 구독. 시계·고장·양하 시나리오·야드 데이터가 바뀌면 다시 그린다.
 * 계산은 portSim 캐시를 공유하므로 여러 컴포넌트가 불러도 tick 당 한 번.
 */
export function usePortSim(): PortSimSnapshot {
  usePortCallStore((s) => s.scenario);
  usePortCallStore((s) => s.offsetH);
  usePortSimStore((s) => s.elapsedS);
  usePortSimStore((s) => s.startedAt);
  useFailureStore((s) => s.active);
  useOpsStore((s) => s.snapshot);
  useYardStore((s) => s.ships);
  useYardStore((s) => s.quayCranes);
  useYardStore((s) => s.blocks);
  useYardStore((s) => s.containers);
  return getPortSim();
}
