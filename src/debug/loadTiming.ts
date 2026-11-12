/**
 * [load] 로딩 단계 계측. 시각은 performance.now() 기준 → [perf] long task @시각 과 바로 대조 가능.
 * 개발 서버와 프로덕션의 `?meas` 측정에서 남긴다. 빈 구간이 생기지 않게 1초 심박도 같이 찍는다.
 * 각 단계는 performance.mark/measure 로도 남아 DevTools Performance 탭 Timings 트랙에서 보임.
 */
const fmt = (n: number) => n.toFixed(0);

export function loadTracing() {
  if (import.meta.env.DEV) return true;
  if (typeof location === "undefined") return false;
  return /(?:^|[?&])meas(?:=|&|$)/.test(location.search);
}

export function loadMark(label: string, extra = "") {
  if (!loadTracing()) return;
  const stamp = `${label} @${fmt(performance.now())}`;
  try {
    performance.mark(stamp);
  } catch {
    /* 같은 이름이 이미 있으면 측정은 console 로 남긴다 */
  }
  console.info(`[load] @${fmt(performance.now())} ${label}${extra ? " " + extra : ""}`);
}

/** start() → end(extra) 로 구간 로그: [load] label start@ end@ dur */
export function loadSpan(label: string) {
  const t0 = performance.now();
  const mark = `${label}:start@${fmt(t0)}`;
  if (loadTracing()) {
    try {
      performance.mark(mark);
    } catch {
      /* noop */
    }
  }
  let ended = false;
  return (extra = "") => {
    if (ended || !loadTracing()) return;
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

/** 로딩 동안 1초마다. 콜백이 늦으면 그 간격이 메인 스레드가 막힌 시간이다. */
export function startLoadHeartbeat(stage: () => string) {
  if (!loadTracing()) return () => {};
  let last = performance.now();
  const id = window.setInterval(() => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    loadMark(gap > 1500 ? "heartbeat 지연" : "heartbeat", `${fmt(gap)}ms · ${stage()}`);
  }, 1000);
  return () => window.clearInterval(id);
}
