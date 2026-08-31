import type { Object3D } from "three";

/** `crane` → 0, `crane.052` / `crane052` → 52 (Three.js GLTFLoader는 `.` 제거) */
export function parseCraneNameIndex(name: string): number | null {
  if (/^crane$/i.test(name)) return 0;

  const dotted = name.match(/^(?:crane|kran)\.(\d+)$/i);
  if (dotted) {
    const index = Number.parseInt(dotted[1]!, 10);
    return Number.isFinite(index) ? index : null;
  }

  const glued = name.match(/^(?:crane|kran)(\d+)$/i);
  if (glued) {
    const index = Number.parseInt(glued[1]!, 10);
    return Number.isFinite(index) ? index : null;
  }

  return null;
}

/** mesh / parent chain에서 GLB crane index */
export function parseQuayCraneGlbIndex(object: Object3D): number | null {
  let node: Object3D | null = object;
  while (node) {
    const index = parseCraneNameIndex(node.name);
    if (index != null) return index;
    node = node.parent;
  }
  return null;
}

export function formatQuayCraneGlbName(glbIndex: number): string {
  return `crane.${String(glbIndex).padStart(3, "0")}`;
}

export function resolveQuayCraneGlbIndexFromKey(key: string): number | null {
  if (!key.startsWith("crane-")) return null;
  const index = Number.parseInt(key.slice(6), 10);
  return Number.isFinite(index) ? index : null;
}
