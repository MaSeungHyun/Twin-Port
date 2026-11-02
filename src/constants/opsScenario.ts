/**
 * 1선석 양하 시나리오 — 90초 1사이클.
 * 선박에서 내린 컨테이너가 안벽 수취 → 야드 분배 → 블록 적재 → 반출 컨베이어로 이어진다.
 * 시간은 사이클 시작 기준 초.
 */

export const OPS_SCENARIO = {
  title: "선석 양하",
  cycleS: 90,
  /** 시나리오 1초 = 실제 운영 6초 — 처리량·리드타임 환산용 (안벽 크레인 약 20~27 moves/h) */
  timeScale: 6,
  tickMs: 1000,
  startDelayMs: 3000,
  moveLimit: 24,
} as const;

export type OpsShareKey = "run" | "move" | "wait" | "fault";
export type OpsMoveStatus = "이동" | "대기" | "완료" | "정체";
export type OpsConveyorState = "가동" | "감속" | "정지" | "정체";

export type OpsConveyorDef = {
  id: string;
  name: string;
  from: string;
  to: string;
};

export const OPS_CONVEYORS: readonly OpsConveyorDef[] = [
  { id: "cv-01", name: "CV-01 안벽 수취", from: "선박", to: "야드 분배" },
  { id: "cv-02", name: "CV-02 야드 분배", from: "안벽 수취", to: "블록" },
  { id: "cv-03", name: "CV-03 반출", from: "블록", to: "게이트" },
];

export type OpsEquipmentKind = "안벽 크레인" | "오버헤드 크레인";

export type OpsEquipmentDef = {
  id: string;
  name: string;
  kind: OpsEquipmentKind;
  /** 사이클 안에서 상태가 바뀌는 시각. 마지막 구간은 cycleS 까지 */
  segments: readonly { until: number; state: OpsShareKey }[];
  /** 이 장비가 사이클마다 처리하는 컨테이너 수 */
  movesPerCycle: number;
};

export const OPS_EQUIPMENT: readonly OpsEquipmentDef[] = [
  {
    id: "qc-00",
    name: "Crane 00",
    kind: "안벽 크레인",
    segments: [{ until: 90, state: "run" }],
    movesPerCycle: 4,
  },
  {
    id: "qc-01",
    name: "Crane 01",
    kind: "안벽 크레인",
    segments: [
      { until: 16, state: "run" },
      { until: 24, state: "move" },
      { until: 90, state: "run" },
    ],
    movesPerCycle: 3,
  },
  {
    id: "qc-02",
    name: "Crane 02",
    kind: "안벽 크레인",
    segments: [
      { until: 40, state: "run" },
      { until: 64, state: "fault" },
      { until: 90, state: "run" },
    ],
    movesPerCycle: 2,
  },
  {
    id: "ohc-01",
    name: "오버헤드크레인01",
    kind: "오버헤드 크레인",
    segments: [{ until: 90, state: "run" }],
    movesPerCycle: 3,
  },
  {
    id: "ohc-05",
    name: "오버헤드크레인05",
    kind: "오버헤드 크레인",
    segments: [
      { until: 36, state: "wait" },
      { until: 90, state: "run" },
    ],
    movesPerCycle: 2,
  },
  {
    id: "ohc-12",
    name: "오버헤드크레인12",
    kind: "오버헤드 크레인",
    segments: [
      { until: 36, state: "run" },
      { until: 48, state: "move" },
      { until: 90, state: "run" },
    ],
    movesPerCycle: 2,
  },
];

export type OpsConveyorKeyframe = {
  until: number;
  speed: number;
  queued: number;
  state: OpsConveyorState;
};

export const OPS_CONVEYOR_KEYS: Record<string, readonly OpsConveyorKeyframe[]> =
  {
    "cv-01": [
      { until: 40, speed: 1.2, queued: 1, state: "가동" },
      { until: 64, speed: 0.35, queued: 5, state: "정체" },
      { until: 90, speed: 1.1, queued: 1, state: "가동" },
    ],
    "cv-02": [
      { until: 22, speed: 1.0, queued: 1, state: "가동" },
      { until: 48, speed: 0.3, queued: 6, state: "정체" },
      { until: 90, speed: 1.0, queued: 2, state: "가동" },
    ],
    "cv-03": [
      { until: 40, speed: 0, queued: 0, state: "정지" },
      { until: 70, speed: 0.8, queued: 1, state: "가동" },
      { until: 90, speed: 0, queued: 0, state: "정지" },
    ],
  };

/** 한 사이클 동안 컨베이어를 통과한 컨테이너. n 은 사이클 안 일련번호 */
export type OpsMoveScript = {
  at: number;
  n: number;
  conveyorId: string;
  from: string;
  to: string;
  status: OpsMoveStatus;
  equipmentId: string;
};

export const OPS_MOVES: readonly OpsMoveScript[] = [
  {
    at: 4,
    n: 1,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-00",
  },
  {
    at: 10,
    n: 1,
    conveyorId: "cv-02",
    from: "CV-01 안벽 수취",
    to: "CV-02 야드 분배",
    status: "이동",
    equipmentId: "qc-00",
  },
  {
    at: 16,
    n: 1,
    conveyorId: "cv-02",
    from: "CV-02 야드 분배",
    to: "블록 B01",
    status: "완료",
    equipmentId: "ohc-01",
  },
  {
    at: 8,
    n: 2,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-00",
  },
  {
    at: 18,
    n: 2,
    conveyorId: "cv-02",
    from: "CV-01 안벽 수취",
    to: "CV-02 야드 분배",
    status: "이동",
    equipmentId: "qc-01",
  },
  {
    at: 28,
    n: 2,
    conveyorId: "cv-02",
    from: "CV-02 야드 분배",
    to: "블록 B05",
    status: "대기",
    equipmentId: "ohc-05",
  },
  {
    at: 40,
    n: 2,
    conveyorId: "cv-02",
    from: "CV-02 야드 분배",
    to: "블록 B05",
    status: "완료",
    equipmentId: "ohc-05",
  },
  {
    at: 14,
    n: 3,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-01",
  },
  {
    at: 24,
    n: 3,
    conveyorId: "cv-02",
    from: "CV-01 안벽 수취",
    to: "CV-02 야드 분배",
    status: "정체",
    equipmentId: "qc-01",
  },
  {
    at: 50,
    n: 3,
    conveyorId: "cv-02",
    from: "CV-02 야드 분배",
    to: "블록 B12",
    status: "완료",
    equipmentId: "ohc-12",
  },
  {
    at: 20,
    n: 4,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-00",
  },
  {
    at: 44,
    n: 4,
    conveyorId: "cv-01",
    from: "CV-01 안벽 수취",
    to: "CV-02 야드 분배",
    status: "정체",
    equipmentId: "qc-02",
  },
  {
    at: 66,
    n: 4,
    conveyorId: "cv-02",
    from: "CV-02 야드 분배",
    to: "블록 B01",
    status: "완료",
    equipmentId: "ohc-01",
  },
  {
    at: 32,
    n: 5,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-02",
  },
  {
    at: 46,
    n: 6,
    conveyorId: "cv-03",
    from: "블록 B01",
    to: "게이트",
    status: "이동",
    equipmentId: "ohc-01",
  },
  {
    at: 58,
    n: 6,
    conveyorId: "cv-03",
    from: "CV-03 반출",
    to: "게이트",
    status: "완료",
    equipmentId: "ohc-01",
  },
  {
    at: 62,
    n: 7,
    conveyorId: "cv-03",
    from: "블록 B05",
    to: "게이트",
    status: "이동",
    equipmentId: "ohc-05",
  },
  {
    at: 72,
    n: 7,
    conveyorId: "cv-03",
    from: "CV-03 반출",
    to: "게이트",
    status: "완료",
    equipmentId: "ohc-05",
  },
  {
    at: 70,
    n: 8,
    conveyorId: "cv-01",
    from: "MV PACIFIC STAR",
    to: "CV-01 안벽 수취",
    status: "이동",
    equipmentId: "qc-00",
  },
  {
    at: 78,
    n: 8,
    conveyorId: "cv-02",
    from: "CV-01 안벽 수취",
    to: "블록 B12",
    status: "완료",
    equipmentId: "ohc-12",
  },
];

export type OpsFaultLevel = "warning" | "error" | "recovery";

/** 기기별 오류. at~until 은 사이클 초. 한 기기 안에서 이상 → 고장 → 복구가 이어진다. */
export type OpsFaultScript = {
  at: number;
  until: number;
  equipmentId: string;
  level: OpsFaultLevel;
  message: string;
};

export const OPS_FAULTS: readonly OpsFaultScript[] = [
  {
    at: 6,
    until: 14,
    equipmentId: "qc-00",
    level: "warning",
    message: "호이스트 모터 온도 상승",
  },
  {
    at: 14,
    until: 20,
    equipmentId: "qc-00",
    level: "recovery",
    message: "온도 정상",
  },
  {
    at: 16,
    until: 24,
    equipmentId: "qc-01",
    level: "warning",
    message: "주행 모터 전류 변동",
  },
  {
    at: 24,
    until: 30,
    equipmentId: "qc-01",
    level: "recovery",
    message: "전류 안정",
  },
  {
    at: 34,
    until: 40,
    equipmentId: "qc-02",
    level: "warning",
    message: "트롤리 전류 상승",
  },
  {
    at: 40,
    until: 64,
    equipmentId: "qc-02",
    level: "error",
    message: "트롤리 주행 정지",
  },
  {
    at: 64,
    until: 72,
    equipmentId: "qc-02",
    level: "recovery",
    message: "정상 가동 재개",
  },
  {
    at: 10,
    until: 18,
    equipmentId: "ohc-01",
    level: "warning",
    message: "스프레더 센서 이상",
  },
  {
    at: 18,
    until: 24,
    equipmentId: "ohc-01",
    level: "recovery",
    message: "센서 정상",
  },
  {
    at: 22,
    until: 36,
    equipmentId: "ohc-05",
    level: "warning",
    message: "호이스트 브레이크 이상",
  },
  {
    at: 36,
    until: 42,
    equipmentId: "ohc-05",
    level: "recovery",
    message: "브레이크 정상",
  },
  {
    at: 36,
    until: 48,
    equipmentId: "ohc-12",
    level: "warning",
    message: "주행 레일 진동",
  },
  {
    at: 48,
    until: 54,
    equipmentId: "ohc-12",
    level: "recovery",
    message: "진동 정상",
  },
  {
    at: 40,
    until: 64,
    equipmentId: "cv-01",
    level: "error",
    message: "안벽 수취 정체",
  },
  {
    at: 64,
    until: 72,
    equipmentId: "cv-01",
    level: "recovery",
    message: "수취 재개",
  },
  {
    at: 22,
    until: 48,
    equipmentId: "cv-02",
    level: "error",
    message: "야드 분배 정체",
  },
  {
    at: 48,
    until: 56,
    equipmentId: "cv-02",
    level: "recovery",
    message: "분배 재개",
  },
];

export const OPS_FAULT_LABEL: Record<OpsFaultLevel, string> = {
  warning: "이상",
  error: "고장",
  recovery: "복구",
};

export const OPS_STATE_LABEL: Record<OpsShareKey, string> = {
  run: "작업",
  move: "이동",
  wait: "대기",
  fault: "고장",
};

export const OPS_SHARE_LABEL: Record<OpsShareKey, string> = {
  run: "작업",
  move: "이동",
  wait: "대기",
  fault: "고장",
};
