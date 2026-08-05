// "stored": 적재 상태

export type Slot = {
  bay: string;
  row: string;
  tier: string;
};

export type Location = {
  block: string;
  slot: Slot;
};

export type ContainerStatus = "stored" | "moving";

/**
 * 컨테이너 엔티티
 * 고유번호(id)로 추적 — 택배 송장과 동일 개념
 *
 * owner/company: 선사
 * status: 상태
 * location: 위치 (Block + Slot) ex. B03-045-06-04
 * destination: 이동 목적지 (stored면 빈 문자열)
 */
export type Container = {
  id: string;
  company: string;
  status: ContainerStatus;
  location: Location;
  destination: string;
};
