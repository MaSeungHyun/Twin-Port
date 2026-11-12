import assert from "node:assert/strict";
import test from "node:test";
import { shipPhase, shipCumulativeMoves } from "../src/domain/portCall.ts";

const plan = {
  offsetH: 0,
  periodH: 20,
  workH: 10,
  work: 1000,
  discharge: 600,
  delayH: 0,
};

test("a port call transitions through cargo, departure and next arrival", () => {
  for (const [hour, status] of [
    [0, "discharging"],
    [6, "loading"],
    [10, "preparing"],
    [10.5, "departing"],
    [11, "departed"],
    [19, "arriving"],
    [19.75, "berthed"],
    [20, "discharging"],
  ]) {
    assert.equal(shipPhase(plan, hour).status, status, `hour ${hour}`);
  }
});

test("departure support delays retain completed cargo and defer departure", () => {
  const delayed = { ...plan, periodH: 23, delayH: 3 };
  assert.equal(shipPhase(delayed, 11).status, "preparing");
  assert.equal(shipPhase(delayed, 13.5).status, "departing");
  assert.equal(shipPhase(delayed, 14).status, "departed");
  assert.equal(shipPhase(delayed, 13).done, plan.work);
});

test("cumulative throughput stays monotonic across arrivals and call boundaries", () => {
  let previous = 0;
  for (let step = 0; step <= 800; step += 1) {
    const current = shipCumulativeMoves(plan, step / 10);
    assert.ok(current >= previous, `throughput decreased at ${step / 10}`);
    previous = current;
  }
  assert.equal(shipCumulativeMoves(plan, 19.75), 1000);
  assert.equal(shipCumulativeMoves(plan, 20), 1000);
  assert.equal(shipCumulativeMoves(plan, 26), 1600);
  assert.equal(shipPhase(plan, 19.75).done, 0);
  assert.equal(shipPhase(plan, 20).voyage, 1);
});
