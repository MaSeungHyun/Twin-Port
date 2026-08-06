import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function containerMatchesQuery(container: Container, query: string) {
  const q = normalizeQuery(query);
  if (!q) return false;

  const id = container.id.toLowerCase();
  if (id === q) return true;

  const company = container.company.toLowerCase();
  const address = formatSlotAddress(
    container.location.block,
    Number(container.location.slot.bay),
    Number(container.location.slot.row),
    Number(container.location.slot.tier),
  ).toLowerCase();

  return id.includes(q) || company.includes(q) || address.includes(q);
}

/** 정확한 ID가 있으면 그것만, 없으면 부분 검색 */
export function getMatchingContainers(
  containers: Container[],
  query: string,
  limit?: number,
): Container[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const exact = containers.filter(
    (container) => container.id.toLowerCase() === q,
  );
  if (exact.length > 0) {
    return limit !== undefined ? exact.slice(0, limit) : exact;
  }

  const results: Container[] = [];
  for (const container of containers) {
    if (!containerMatchesQuery(container, q)) continue;
    results.push(container);
    if (limit !== undefined && results.length >= limit) break;
  }
  return results;
}

export function searchContainers(
  containers: Container[],
  query: string,
  limit?: number,
): Container[] {
  return getMatchingContainers(containers, query, limit);
}
