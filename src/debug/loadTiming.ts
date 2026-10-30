/**
 * [load] 로딩 단계 계측 (dev 전용 로그). 시각은 performance.now() 기준 → [perf] long task @시각 과 바로 대조 가능.
 * 각 단계는 performance.mark/measure 로도 남아 DevTools Performance 탭 Timings 트랙에서 보임.
 */
const DEV = import.meta.env.DEV;
const fmt = (n: number) => n.toFixed(0);

export function loadMark(label: string, extra = "") {
  if (!DEV) return;
  performance.mark(label);
  console.info(`[load] @${fmt(performance.now())} ${label}${extra ? " " + extra : ""}`);
}

/** start() → end(extra) 로 구간 로그: [load] label start@ end@ dur */
export function loadSpan(label: string) {
  const t0 = performance.now();
  const mark = `${label}:start`;
  if (DEV) performance.mark(mark);
  let ended = false;
  return (extra = "") => {
    if (ended || !DEV) return;
    ended = true;
    const t1 = performance.now();
    try {
      performance.measure(label, mark);
    } catch {
      /* noop */
    }
    console.info(`[load] ${label} start@${fmt(t0)} end@${fmt(t1)} ${fmt(t1 - t0)}ms${extra ? " " + extra : ""}`);
  };
}
