import {
  HOVER_OUTLINE_COLOR,
  HOVER_OUTLINE_THICKNESS,
} from "@/constants/hoverOutline";
import { Outlines } from "@react-three/drei";
import { type BufferGeometry, type Mesh } from "three";

/** drei Outlines. visible은 React state 없이 ref로만 토글 */
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
      <Outlines
        color={HOVER_OUTLINE_COLOR}
        thickness={HOVER_OUTLINE_THICKNESS}
        angle={0}
        toneMapped={false}
      />
    </mesh>
  );
}
