import { GROUND_Y } from "./ground";

/**
 * 20ft 컨테이너 실제 치수 비율 유지
 * 실제: L6.06 × W2.44 × H2.59 (m)
 * 씬 스케일 1/5 (이전 1/10의 2배)
 */
export const CONTAINER_SCALE = 0.2;
export const CONTAINER_W = 0.98 * CONTAINER_SCALE; // Row 피치
export const CONTAINER_H = 1.04 * CONTAINER_SCALE; // Tier 높이
export const CONTAINER_D = 2.42 * CONTAINER_SCALE; // Bay 피치

export const MAX_PER_COLOR = 20000;
export const DECK_Y = (GROUND_Y + 1) / 2;

export const CONTAINER_COLORS = [
  { key: "blue", label: "블루", hex: 0x0057ff },
  { key: "red", label: "레드", hex: 0xff312c },
  { key: "orange", label: "오렌지", hex: 0xf07a1a },
  { key: "brown", label: "브라운", hex: 0x9e431f },
  { key: "green", label: "그린", hex: 0x18cd3e },
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
  SK: "orange",
  Amazon: "brown",
  HYUNDAI: "green",
};
