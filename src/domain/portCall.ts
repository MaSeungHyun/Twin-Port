import { PORT_CALL } from "../constants/portCall.ts";
import { PORT_SIM } from "../constants/portSim.ts";
import type { ShipOperationalStatus } from "./portTwinBase";

type PhasePlan = {
  offsetH: number;
  periodH: number;
  workH: number;
  work: number;
  discharge: number;
  delayH: number;
};

type ShipPhase = {
  status: ShipOperationalStatus;
  voyage: number;
  local: number;
  done: number;
};

/** 같은 기항의 작업 완료량은 유지하고 다음 기항 접안 시 초기화한다. */
export function shipPhase(plan: PhasePlan, h: number): ShipPhase {
  const x = h + plan.offsetH;
  const voyage = Math.floor(x / plan.periodH);
  const local = x - voyage * plan.periodH;

  if (local < plan.workH) {
    const done = Math.floor((local / plan.workH) * plan.work);
    return {
      status: done < plan.discharge ? "discharging" : "loading",
      voyage,
      local,
      done,
    };
  }

  if (local < plan.workH + PORT_CALL.preparationH + plan.delayH)
    return { status: "preparing", voyage, local, done: plan.work };
  if (local < plan.workH + PORT_SIM.departHours + plan.delayH)
    return { status: "departing", voyage, local, done: plan.work };
  if (local < plan.periodH - PORT_CALL.approachH)
    return { status: "departed", voyage, local, done: plan.work };
  if (local >= plan.periodH - PORT_CALL.berthingH)
    return { status: "berthed", voyage, local, done: 0 };

  return { status: "arriving", voyage, local, done: 0 };
}

export function shipCumulativeMoves(plan: PhasePlan, h: number) {
  const phase = shipPhase(plan, h);
  const completed = Math.min(plan.work, Math.floor((phase.local / plan.workH) * plan.work));

  return phase.voyage * plan.work + completed;
}
