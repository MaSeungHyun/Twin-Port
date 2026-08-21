import type { Container } from "@/types/container";

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function slotAddress(container: Container) {
  const { block, slot } = container.location;
  const bay = String(slot.bay).padStart(3, "0");
  const row = String(slot.row).padStart(2, "0");
  const tier = String(slot.tier).padStart(2, "0");
  return `${block}-${bay}-${row}-${tier}`.toLowerCase();
}

function matchesNormalized(container: Container, q: string) {
  const id = container.id.toLowerCase();
  if (id.includes(q)) return true;
  if (container.company.toLowerCase().includes(q)) return true;
  const { block, slot } = container.location;
  if (block.toLowerCase().includes(q)) return true;
  if (
    String(slot.bay).includes(q) ||
    String(slot.row).includes(q) ||
    String(slot.tier).includes(q)
  ) {
    return true;
  }
  return slotAddress(container).includes(q);
}

export function containerMatchesQuery(container: Container, query: string) {
  const q = normalizeQuery(query);
  if (!q) return false;
  return matchesNormalized(container, q);
}

/** 정확한 ID가 있으면 그것만, 없으면 부분 검색 */
export function getMatchingContainers(
  containers: Container[],
  query: string,
  limit?: number,
): Container[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const exact: Container[] = [];
  for (const container of containers) {
    if (container.id.toLowerCase() !== q) continue;
    exact.push(container);
    if (limit !== undefined && exact.length >= limit) return exact;
  }
  if (exact.length > 0) return exact;

  const results: Container[] = [];
  for (const container of containers) {
    if (!matchesNormalized(container, q)) continue;
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
