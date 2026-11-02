/**
 * 크레인 실시간 텔레메트리(속도·하중·모터 온도·전력·풍속·정비) 기준값.
 * 안벽 크레인(STS)·오버헤드 크레인(ASC/ARMG) 제원과 일반적인 모터 절연 등급(F종) 운전 범위를 참고했다.
 */
export const CRANE_TELEMETRY = {
  /** 외기 온도(°C) */
  ambientC: 25,
  /** 모터 온도 경고 / 고장(과열 정지) / 고장 후 재가동 허용 온도(°C) */
  warnC: 85,
  faultC: 100,
  recoverC: 70,
  /** 경고 해제 히스테리시스(°C) */
  warnClearC: 80,
  /** 모터 열 시정수(시뮬레이션 분) — 온도가 목표값으로 따라가는 속도 */
  tauMin: 12,
  /** 풍속 주의 / 작업 중지 기준(m/s) */
  windWarnMs: 15,
  windStopMs: 20,
  /** 정기 정비 주기(가동 시간 h) */
  maintIntervalH: 500,
  /** 과열이 잘 나는(부하 집중) 장비 비율과 그때 추가 온도 상승 폭(°C) */
  hotRatio: 0.18,
  hotStressC: 42,
  normalStressC: 10,
  /** 안벽 크레인(STS) 속도(m/min) */
  quay: { hoistLoaded: 90, hoistEmpty: 180, trolley: 240, gantry: 45, refMph: 31 },
  /** 오버헤드 크레인(ASC) 속도(m/min) — 안벽 크레인보다 호이스트·트롤리가 느리다 */
  overhead: { hoistLoaded: 45, hoistEmpty: 90, trolley: 70, gantry: 120, refMph: 25 },
} as const;
