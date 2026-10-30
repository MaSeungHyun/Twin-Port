import { MeshoptSimplifier } from "meshoptimizer";
import type { MeshoptRequest, MeshoptResponse } from "@/workers/meshopt.worker";

/**
 * [worker] meshopt simplify 워커 풀. 메인 스레드는 요청/결과 index 만 주고받음 (결과는 transfer).
 * 워커 생성/로드 실패 시 메인 스레드 simplify 로 폴백.
 */
type Level = { target: number; error: number };
type Pending = { resolve: (outs: Uint32Array[]) => void; fallback: () => void };

const pending = new Map<number, Pending>();
let workers: Worker[] | null = null;
let broken = false;
let nextId = 1;
let rr = 0;

function failAll() {
  broken = true;
  workers?.forEach((w) => w.terminate());
  workers = null;
  const list = [...pending.values()];
  pending.clear();
  list.forEach((p) => p.fallback());
}

function getPool() {
  if (broken) return null;
  if (workers) return workers;
  try {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL("../workers/meshopt.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<MeshoptResponse>) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.outs) p.resolve(e.data.outs);
        else p.fallback();
      };
      w.onerror = (ev) => {
        ev.preventDefault();
        console.warn("[meshopt] worker 실패 → 메인 스레드 폴백", ev.message);
        failAll();
      };
      return w;
    });
    return workers;
  } catch {
    broken = true;
    return null;
  }
}

async function simplifyMain(indices: Uint32Array, positions: Float32Array, levels: Level[]) {
  await MeshoptSimplifier.ready;
  return levels.map(({ target, error }) => MeshoptSimplifier.simplify(indices, positions, 3, target, error, ["Prune"])[0]);
}

/** levels 각각에 대해 단순화된 index 배열. indices/positions 는 복제되어 전송(원본 유지) */
export function simplifyLevels(indices: Uint32Array, positions: Float32Array, levels: Level[]): Promise<Uint32Array[]> {
  const pool = getPool();
  if (!pool) return simplifyMain(indices, positions, levels);
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, {
      resolve,
      fallback: () => void simplifyMain(indices, positions, levels).then(resolve),
    });
    const req: MeshoptRequest = { id, indices, positions, levels };
    pool[rr++ % pool.length]!.postMessage(req);
  });
}
