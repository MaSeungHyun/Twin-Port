import { bakeShoreCore, type ShoreBakeInput } from "./shoreBakeCore";

/** [worker] 항구 해안 거리장 베이크 (래스터 + chamfer 거리장) — 메인 스레드 블로킹 제거 */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ShoreBakeInput>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

ctx.onmessage = (e) => {
  // [load] 워커 내부 실제 베이크 시간 (메인이 받는 시각과 분리)
  const t0 = performance.now();
  const out = bakeShoreCore(e.data);
  ctx.postMessage({ out, ms: performance.now() - t0 }, [out.buffer]);
};
