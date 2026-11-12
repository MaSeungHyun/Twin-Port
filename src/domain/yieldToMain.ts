/** [loader] 메인 스레드 양보 — 긴 동기 루프를 쪼개 스피너/입력이 멈추지 않게 */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((r) => setTimeout(r, 0));
}

/** 화면이 한 번 그려진 뒤로 미룬다. scheduler.yield 는 연달아 쓰면 렌더가 약 100ms 마다만 끼어든다. */
export function afterNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** budgetMs 를 넘겼을 때만 양보하는 체크포인트 */
export function createTimeSlicer(budgetMs = 8) {
  let start = performance.now();
  return async () => {
    if (performance.now() - start < budgetMs) return;
    await yieldToMain();
    start = performance.now();
  };
}
