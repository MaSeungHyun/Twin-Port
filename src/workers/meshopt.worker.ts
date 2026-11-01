import { MeshoptSimplifier } from "meshoptimizer";

/** [worker] meshoptimizer simplify — LOD/반사 단순화를 메인 스레드 밖에서 실행 */
export type MeshoptRequest = {
  id: number;
  indices: Uint32Array;
  positions: Float32Array;
  levels: { target: number; error: number }[];
  /** true 면 error 는 메시 크기 비율이 아니라 좌표 단위(m) */
  absolute?: boolean;
};
export type MeshoptResponse = { id: number; outs?: Uint32Array[]; error?: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<MeshoptRequest>) => void) | null;
  postMessage(message: MeshoptResponse, transfer: Transferable[]): void;
};

ctx.onmessage = (e) => {
  const { id, indices, positions, levels, absolute } = e.data;
  const flags = absolute ? (["Prune", "ErrorAbsolute"] as const) : (["Prune"] as const);
  void MeshoptSimplifier.ready.then(() => {
    try {
      const outs = levels.map(
        ({ target, error }) => MeshoptSimplifier.simplify(indices, positions, 3, target, error, [...flags])[0],
      );
      ctx.postMessage({ id, outs }, outs.map((o) => o.buffer));
    } catch (err) {
      ctx.postMessage({ id, error: String(err) }, []);
    }
  });
};
