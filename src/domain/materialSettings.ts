import { BackSide, DoubleSide, FrontSide, Color, Mesh, MeshStandardMaterial, type Object3D, type Texture } from "three";
import type { MaterialSettings } from "@/constants/materials";

const ORIGINAL_MAP = new WeakMap<MeshStandardMaterial, Texture | null>();

/** MaterialSettings → MeshStandardMaterial 적용 (map on/off는 원본 텍스처 보존) */
export function applyMaterialSettings(
  mat: MeshStandardMaterial,
  s: MaterialSettings & { toneMapped?: boolean; side?: "front" | "back" | "double" },
) {
  if (!ORIGINAL_MAP.has(mat)) ORIGINAL_MAP.set(mat, mat.map);
  const map = ORIGINAL_MAP.get(mat) ?? null;
  const nextMap = s.mapEnabled ? map : null;
  if (mat.map !== nextMap) {
    mat.map = nextMap;
    mat.needsUpdate = true;
  }
  mat.color.set(s.color);
  mat.metalness = s.metalness;
  mat.roughness = s.roughness;
  // 개별 envMap 금지 → scene.environment(port_hdr)만 사용
  if (mat.envMap) {
    mat.envMap = null;
    mat.needsUpdate = true;
  }
  mat.envMapIntensity = s.envMapIntensity;
  mat.emissive.set(s.emissive);
  mat.emissiveIntensity = s.emissiveIntensity;
  mat.opacity = s.opacity;
  if (mat.transparent !== s.transparent) {
    mat.transparent = s.transparent;
    mat.needsUpdate = true;
  }
  if (s.side !== undefined) {
    const side = s.side === "back" ? BackSide : s.side === "double" ? DoubleSide : FrontSide;
    if (mat.side !== side) {
      mat.side = side;
      mat.needsUpdate = true;
    }
  }
  if (s.toneMapped !== undefined && mat.toneMapped !== s.toneMapped) {
    mat.toneMapped = s.toneMapped;
    mat.needsUpdate = true;
  }
}

/** root 하위에서 이름별 MeshStandardMaterial 수집 */
export function collectMaterials(root: Object3D, filter?: (name: string) => boolean) {
  const out = new Map<string, Set<MeshStandardMaterial>>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      if (filter && !filter(m.name)) continue;
      if (!out.has(m.name)) out.set(m.name, new Set());
      out.get(m.name)!.add(m);
    }
  });
  return out;
}

export function toHex(c: Color) {
  return `#${c.getHexString()}`;
}
