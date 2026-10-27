import { HOVER_OUTLINE_COLOR, HOVER_OUTLINE_THICKNESS } from "@/constants/hoverOutline";
import { BackSide, Color, Mesh, MeshBasicMaterial, type BufferGeometry } from "three";
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

/** [hover] 깊이용 투명 머티리얼도 전 인스턴스 공유 (인스턴스별 생성 → 개별 파이프라인/바인드그룹 방지) */
let hullMat: MeshBasicMaterial | null = null;
function getHullMaterial() {
  if (!hullMat) hullMat = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  return hullMat;
}
/**
 * [hover] WebGPU 는 오브젝트/머티리얼 조합이 처음 그려질 때 노드 빌드 + 렌더 파이프라인 컴파일을 한다.
 * 첫 hover 때 이 비용(측정 ~100ms)이 터져 프레임 드랍 → 마운트 직후 같은 geometry/머티리얼로 만든
 * 극소 스케일 더미를 3프레임 그려 파이프라인을 미리 캐시. 실제 outline 의 visible/matrix 는 건드리지 않음.
 */
const warmedGeoms = new WeakSet<BufferGeometry>();
function warmOutline(node: Mesh, geometry: BufferGeometry) {
  if (warmedGeoms.has(geometry)) return;
  warmedGeoms.add(geometry);
  requestAnimationFrame(() => {
    const parent = node.parent;
    if (!parent) return;
    const dummy = new Mesh(geometry, getHullMaterial());
    dummy.add(new Mesh(geometry, getOutlineMaterial()));
    dummy.scale.setScalar(1e-6);
    dummy.frustumCulled = false;
    dummy.children[0].frustumCulled = false;
    dummy.raycast = () => {};
    dummy.children[0].raycast = () => {};
    parent.add(dummy);
    let n = 0;
    const tick = () => {
      if (++n < 3) { requestAnimationFrame(tick); return; }
      parent.remove(dummy);
    };
    requestAnimationFrame(tick);
  });
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
          warmOutline(node, geometry);
        }
        meshRef?.(node);
      }}
      geometry={geometry}
      matrixAutoUpdate={false}
      frustumCulled={false}
      raycast={() => null}
    >
      <primitive object={getHullMaterial()} attach="material" />
      <mesh geometry={geometry} material={getOutlineMaterial()} frustumCulled={false} raycast={() => null} />
    </mesh>
  );
}
