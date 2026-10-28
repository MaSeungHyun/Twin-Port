import type { Object3D } from "three";
import { Mesh } from "three";

/** [pt131u] true if the object or any ancestor is named sky / Sky / Sky_* / Sky.001 */
export function isSkyBranch(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (/^sky(\b|_|\.|$)/i.test(p.name)) return true;
  return false;
}

/** GLB 씬 내 모든 Mesh에 castShadow / receiveShadow 적용 */
export function enableGlbShadows(
  root: Object3D,
  options: { castShadow?: boolean; receiveShadow?: boolean } = {},
) {
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    // [pt131u] Sky (busan.glb "sky" dome and Sky_* children) never casts or receives shadows
    if (isSkyBranch(child)) { child.castShadow = false; child.receiveShadow = false; return; }
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
}
