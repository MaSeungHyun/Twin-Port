/** [tooltip] quay crane hover id(uuid[:instance]) → GLB index (hover 시점에 Ground 에서 기록) */
const quayHoverIndex = new Map<string, number>();

export function rememberQuayHoverIndex(id: string, glbIndex: number | null) {
  if (glbIndex != null) quayHoverIndex.set(id, glbIndex);
}

export function quayGlbIndexOfHover(id: string): number | null {
  return quayHoverIndex.get(id) ?? null;
}
