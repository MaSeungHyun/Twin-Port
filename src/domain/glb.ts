import type { Object3D } from "three";
import { Mesh } from "three";

/** GLB 씬 내 모든 Mesh에 castShadow / receiveShadow 적용 */
export function enableGlbShadows(
  root: Object3D,
  options: { castShadow?: boolean; receiveShadow?: boolean } = {},
) {
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
}
