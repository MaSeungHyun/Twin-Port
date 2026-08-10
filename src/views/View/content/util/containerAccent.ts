import {
  COMPANY_COLOR,
  CONTAINER_COLORS,
  type ContainerCompany,
} from "@/constants/container";

const COLOR_HEX: Record<string, string> = Object.fromEntries(
  CONTAINER_COLORS.map((c) => [
    c.key,
    `#${c.hex.toString(16).padStart(6, "0")}`,
  ]),
);

function isCompany(value: string): value is ContainerCompany {
  return value in COMPANY_COLOR;
}

export function companyAccent(company: string) {
  if (!isCompany(company)) return "#94a3b8";
  return COLOR_HEX[COMPANY_COLOR[company]] ?? "#94a3b8";
}
