/**
 * 항만 운영 시뮬레이션 — 대시보드·상세 패널·디테일 그래프가 함께 쓰는 단일 데이터 소스 설정.
 * 시간은 관제 시작 이후 실제 경과 초에 speed 를 곱한 "시뮬레이션 시각" 기준.
 */
export const PORT_SIM = {
  /** 실제 1초 = 시뮬레이션 60초(1분) */
  speed: 60,
  /** 갱신 주기(ms) */
  tickMs: 1000,
  /** 관제 시작 시점이 시뮬레이션 기준 시각 후 몇 시간째인지 — 시작하자마자 누적 수치가 보이도록 */
  warmHours: 4,
  /** 안벽 크레인 1대 순생산성(moves/h) 범위 — 부산신항 실측 27~31 moves/h, 국내 최대 약 30 */
  craneMphMin: 25,
  craneMphMax: 31,
  /** 선석(선박) 1척에 붙이는 최대 안벽 크레인 수 — 4대 × 약 28 = 선석 생산성 약 110 moves/h (부산신항 78~117) */
  maxCranesPerShip: 4,
  /** 이번 기항 양하·적재 물량 비율(양하:적재) — 총 물량은 배정 크레인 수 × 생산성 × 목표 작업시간으로 정함 */
  dischargeRatio: 0.08,
  loadRatio: 0.07,
  /** 기항 1회 목표 작업시간(h) 범위 — 선박별로 결정적으로 고름(실제 체류 약 1~1.5일) */
  callHoursMin: 24,
  callHoursMax: 36,
  /** 작업 종료 후 출항 소요(h) */
  departHours: 1,
  /** 다음 선박 입항 전 선석 공백(h) 범위 — 이 동안 크레인은 유휴(입항 대기·접안 포함) */
  arriveHoursMin: 8,
  arriveHoursMax: 20,
  /** 컨테이너 1개 = 평균 TEU (TEU factor ≈ 1.6~1.7) */
  teuPerBox: 1.65,
  /** 안벽 크레인 에너지: 1회 이동당 호이스트·트롤리 kWh + 보조동력(조명·HVAC·제어) kW — 30 moves/h 기준 합 약 6 kWh/move */
  kwhPerMove: 4,
  auxKw: 60,
  /** 오버헤드(ASC/ARMG) 크레인 에너지 — 이동당 kWh + 보조동력 kW, 합 약 4.5~5 kWh/move */
  ohcKwhPerMove: 3.5,
  ohcAuxKw: 20,
  /** 오버헤드 크레인 1대 처리 한계(moves/h) — ARMG 실측 waterside 18, 최신 ASC 피크 약 25 */
  ohcCapacityMph: 25,
  /** 디테일 그래프 시간대 포인트 수 */
  seriesHours: 8,
  /** 선박 상세 작업 로그 개수 */
  shipLogLimit: 20,
  /** 크레인 상세 처리 컨테이너 개수 */
  craneLogLimit: 6,
} as const;
