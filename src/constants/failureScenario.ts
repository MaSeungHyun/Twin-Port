/**
 * [failure] 장비 고장 시나리오 — 60초 1사이클을 무한 반복.
 * 매 사이클마다 대상(컨테이너 크레인 / 오버헤드 크레인)을 랜덤으로 뽑고, 시각을 지터링해서 반복 티가 덜 나게 한다.
 * 시간 단위는 ms (사이클 시작 기준).
 */
export type FailureKind = "quayCrane" | "overheadCrane";

/** [autofocus] 고장(빨간) 알람 시 카메라 자동 이동. 연달아 오면 최신 것으로, 너무 잦은 이동 방지 */
export const FAILURE_AUTO_FOCUS = {
  enabled: false, // [trackprompt] 자동 이동 대신 다이얼로그로 사용자가 선택
  /** 마지막 고장 후 이 시간 동안 추가 고장이 없으면 이동 (몰려오면 최신 것 하나만) */
  debounceMs: 600,
  /** 자동 이동 사이 최소 간격 — 그 안에 온 고장은 간격이 끝난 뒤 최신 것으로 이동 */
  minIntervalMs: 5000,
} as const;
/** [autofocus] window CustomEvent<{ kind, index, label }> — CameraSlots 가 받아 depth push 후 이동 */
export const FAILURE_FOCUS_EVENT = "tp:failure-focus";
export type FailureFocusDetail = { kind: FailureKind; index: number; label: string };

export type FailureSlot = {
  /** 이 슬롯이 이번 사이클에 발생할 확률 (0~1) */
  probability: number;
  /** 고장 발생 시각 범위 [min, max] */
  failAt: [number, number];
  /** 고장 지속 시간 범위 [min, max] → 이후 복구 */
  duration: [number, number];
  /** 고장 전 '이상 징후' 경고를 띄울 확률 */
  warningProbability: number;
  /** 경고 → 고장까지 리드 타임 범위 */
  warningLead: [number, number];
};

export const FAILURE_SCENARIO = {
  /** 사이클 길이 */
  cycleMs: 60_000,
  /** 인트로("관제 시작") 끝난 뒤 첫 사이클 시작까지 대기 */
  startDelayMs: 3_000,
  /** 슬롯 순서대로 스케줄. 2번째 슬롯은 1번째와 다른 종류를 우선 선택 (크레인 종류 섞기) */
  slots: [
    {
      probability: 1,
      failAt: [8_000, 16_000],
      duration: [15_000, 30_000],
      warningProbability: 0.6,
      warningLead: [4_000, 6_000],
    },
    {
      probability: 0.65,
      failAt: [26_000, 36_000],
      duration: [15_000, 22_000],
      warningProbability: 0.5,
      warningLead: [4_000, 6_000],
    },
  ] satisfies FailureSlot[],
  /** 복구는 사이클 종료 이 시간 전까지는 반드시 끝나도록 duration 을 자름 */
  recoverBeforeCycleEndMs: 1_500,
  /** 직전 사이클에서 고장났던 장비는 다음 사이클 후보에서 제외 */
  avoidPreviousTargets: true,
  /** 종류 가중치 (1번째 슬롯) */
  kindWeights: { quayCrane: 0.5, overheadCrane: 0.5 } satisfies Record<FailureKind, number>,
  /** 기존 점유율 mock 토스트(ToasterTestTrigger)도 같이 띄울지 */
  keepMockOccupancyToasts: false,
  /** 토스트 표시 시간 — 고장 토스트는 복구될 때까지 유지 */
  warningToastMs: 6_000,
  recoveryToastMs: 6_000,
  /** 알림 드롭다운에 쌓는 시나리오 이벤트 최대 개수 */
  maxAlarmEvents: 40,
} as const;

/** 고장 원인 문구 — 랜덤 선택 */
export const FAILURE_CAUSES: Record<FailureKind, readonly string[]> = {
  quayCrane: [
    "호이스트 모터 과열",
    "스프레더 잠금장치 이상",
    "트롤리 주행 정지",
    "유압 압력 저하",
    "붐 리미트 스위치 오류",
  ],
  overheadCrane: [
    "갠트리 주행 모터 이상",
    "호이스트 브레이크 이상",
    "전원 공급 차단",
    "스프레더 센서 오류",
    "주행 레일 이탈 감지",
  ],
};

export const FAILURE_WARNING_CAUSES: readonly string[] = [
  "진동 수치 상승",
  "모터 온도 상승",
  "전류 변동 감지",
  "통신 지연 감지",
];

/** 3D 고장 outline 깜빡임 */
export const FAILURE_BLINK = {
  color: "#ff1f3d",
  /** 깜빡임 1주기(초) */
  periodSec: 0.9,
  /** 어두울 때 밝기 비율 */
  minIntensity: 0.12,
  /** hover outline 대비 두께 배율 */
  thicknessScale: 1.6,
} as const;
