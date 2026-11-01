import type { Material, Texture } from "three";
import { texture, uniform } from "three/tsl";

type OpacityUniform = { value: number };
type FadeColor = { clone: () => FadeColor; copy: (source: FadeColor) => FadeColor; multiplyScalar: (scale: number) => FadeColor; isColor?: boolean };

/**
 * WebGPU 는 표준 재질을 노드 재질로 바꿀 때 opacity 숫자를 컴파일 시점에 복사한다.
 * 유니폼 노드를 붙여 두면 그 참조가 셰이더에 들어가 value 만 바꿔도 바로 반영된다.
 * 크레인 텍스처는 부품마다 다시 칠해져 알파가 쌓이므로, 같은 유니폼으로 알베도도 같이 낮춘다.
 */
export function attachFadeOpacity(material: Material, opacity = material.opacity) {
  const node = uniform(opacity) as unknown as OpacityUniform;
  (material as Material & { opacityNode?: unknown }).opacityNode = node;
  material.userData.fadeOpacity = node;
  material.transparent = true;
  material.opacity = opacity;
  material.depthWrite = true;
  material.needsUpdate = true;
  return material;
}

/** 크레인 텍스처는 알파가 쌓여도 다시 진해지지 않도록 알베도를 같은 값으로 낮춘다. */
export function attachCraneFade(material: Material) {
  attachFadeOpacity(material, 1);
  const map = (material as Material & { map?: Texture | null }).map;
  if (!map) return material;
  const scale = uniform(1) as unknown as OpacityUniform;
  (material as Material & { colorNode?: unknown }).colorNode = texture(map).mul(scale as never);
  material.userData.fadeScale = scale;
  return material;
}

export function writeFadeOpacity(material: Material | Material[], opacity: number) {
  const list = Array.isArray(material) ? material : [material];
  for (const m of list) {
    m.opacity = opacity;
    const node = m.userData.fadeOpacity as OpacityUniform | undefined;
    if (node) node.value = opacity;
    const scale = m.userData.fadeScale as OpacityUniform | undefined;
    if (scale) scale.value = opacity;
    const base = m.userData.fadeColor as FadeColor | undefined;
    const color = (m as Material & { color?: FadeColor }).color;
    if (base && color) color.copy(base).multiplyScalar(opacity);
  }
}
