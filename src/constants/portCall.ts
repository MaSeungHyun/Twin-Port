export const PORT_CALL_SCENARIOS = [
  { id: "normal", label: "정상 운영", delayH: 0, cause: "출항 지원 준비 완료" },
  { id: "pilot", label: "도선 지연", delayH: 1.5, cause: "도선사 배정 대기" },
  { id: "weather", label: "기상 제한", delayH: 3, cause: "강풍으로 출항 대기" },
] as const;

export type PortCallScenario = (typeof PORT_CALL_SCENARIOS)[number]["id"];

export const PORT_CALL = {
  preparationH: 0.5,
  approachH: 1,
  berthingH: 0.25,
  turnaroundH: 0.5,
} as const;
