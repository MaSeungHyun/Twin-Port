import { GROUND_Y } from "./ground";

/**
 * 20ft 컨테이너 실제 치수 비율 유지
 * 실제: L6.06 × W2.44 × H2.59 (m)
 * Ground scale 1 기준 (이전 Ground 5일 때 0.2)
 */
export const CONTAINER_W = 2.456; // Row 피치
export const CONTAINER_H = 2.606; // Tier 높이
export const CONTAINER_D = 6.065; // Bay 피치

export const MAX_PER_COLOR = 20000;
export const DECK_Y = (GROUND_Y + 0.2) / 2;

export const CONTAINER_COLORS = [
  { key: "blue", label: "블루", hex: 0x0057ff },
  { key: "red", label: "레드", hex: 0xff312c },
  { key: "green", label: "그린", hex: 0x18cd3e },
  { key: "sky", label: "스카이", hex: 0x38bdf8 }, // containers.glb 그룹명과 동일해야 함
] as const;

export type ContainerColorKey = (typeof CONTAINER_COLORS)[number]["key"];

export const CONTAINER_COMPANIES = [
  "SAMSUNG",
  "LG",
  "SK",
  "Amazon",
  "HYUNDAI",
] as const;

export type ContainerCompany = (typeof CONTAINER_COMPANIES)[number];

export const COMPANY_COLOR: Record<ContainerCompany, ContainerColorKey> = {
  SAMSUNG: "blue",
  LG: "red",
  SK: "sky",
  Amazon: "sky",
  HYUNDAI: "green",
};
