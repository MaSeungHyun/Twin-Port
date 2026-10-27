import { HOVER_OUTLINE_COLOR, HOVER_OUTLINE_THICKNESS } from "@/constants/hoverOutline";
import { BackSide, Color, type BufferGeometry, type Mesh } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { normalLocal, positionLocal, uniform } from "three/tsl";

/**
 * TSL inverted-hull 외곽선 (drei Outlines 와 같은 방식: 뒷면만 그리고 로컬 노멀 방향으로 thickness 만큼 밀어냄).
 * WebGPU / WebGL2 백엔드 공통. 머티리얼은 전 인스턴스 공유.
 */
export const hoverOutlineThickness = uniform(HOVER_OUTLINE_THICKNESS);
let outlineMat: MeshBasicNodeMaterial | null = null;
function getOutlineMaterial() {
  if (outlineMat) return outlineMat;
  const m = new MeshBasicNodeMaterial({ side: BackSide, toneMapped: false });
  m.color = new Color(HOVER_OUTLINE_COLOR);
  m.positionNode = positionLocal.add(normalLocal.mul(hoverOutlineThickness));
  outlineMat = m;
  return m;
}

/** visible은 React state 없이 ref로만 토글 */
export default function HoverOutlineMesh({
  geometry,
  meshRef,
}: {
  geometry: BufferGeometry;
  meshRef?: (node: Mesh | null) => void;
}) {
  return (
    <mesh
      ref={(node) => {
        if (node && node.userData.hoverOutlineInit !== true) {
          node.visible = false;
          node.userData.hoverOutlineInit = true;
        }
        meshRef?.(node);
      }}
      geometry={geometry}
      matrixAutoUpdate={false}
      frustumCulled={false}
      raycast={() => null}
    >
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
      <mesh geometry={geometry} material={getOutlineMaterial()} frustumCulled={false} raycast={() => null} />
    </mesh>
  );
}
