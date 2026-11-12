import { HOVER_OUTLINE_COLOR, HOVER_OUTLINE_THICKNESS } from "@/constants/hoverOutline";
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial } from "three";

/**
 * [outline] Inverted hull pushes vertices along normals. Hard-edged meshes (quay cranes: split/flat normals,
 * thin lattice beams ~1 m vs 3 m thickness) tear apart into floating face planes that look offset from the object.
 * Build a per-geometry copy whose normals are averaged over vertices sharing a position, so the hull stays closed.
 * Shares position/index/uv attributes with the source geometry (no extra vertex memory except the normal).
 */
const smoothCache = new WeakMap<BufferGeometry, BufferGeometry>();
export function getOutlineGeometry(src: BufferGeometry): BufferGeometry {
  const hit = smoothCache.get(src);
  if (hit) return hit;
  const pos = src.getAttribute("position");
  const nrm = src.getAttribute("normal");
  if (!pos || !nrm) { smoothCache.set(src, src); return src; }
  const n = pos.count;
  // 0.001 격자로 같은 위치인 정점을 묶는다. 문자열 키는 크레인 정점 수에서 마운트 프레임을 100ms 넘게 막는다.
  const cap = 1 << Math.ceil(Math.log2(n * 2 + 1));
  const table = new Int32Array(cap).fill(-1);
  const qs = new Int32Array(n * 3);
  const slotOf = new Int32Array(n);
  const sums = new Float64Array(n * 3);
  let groups = 0;
  for (let i = 0; i < n; i++) {
    const qx = Math.round(pos.getX(i) * 1000), qy = Math.round(pos.getY(i) * 1000), qz = Math.round(pos.getZ(i) * 1000);
    let h = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & (cap - 1);
    let g = table[h]!;
    while (g !== -1 && (qs[g * 3] !== qx || qs[g * 3 + 1] !== qy || qs[g * 3 + 2] !== qz)) {
      h = (h + 1) & (cap - 1);
      g = table[h]!;
    }
    if (g === -1) {
      g = groups++;
      table[h] = g;
      qs[g * 3] = qx; qs[g * 3 + 1] = qy; qs[g * 3 + 2] = qz;
    }
    slotOf[i] = g;
    sums[g * 3] += nrm.getX(i); sums[g * 3 + 1] += nrm.getY(i); sums[g * 3 + 2] += nrm.getZ(i);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = slotOf[i]!;
    const ax = sums[g * 3]!, ay = sums[g * 3 + 1]!, az = sums[g * 3 + 2]!;
    const l = Math.hypot(ax, ay, az);
    if (l > 1e-6) { out[i * 3] = ax / l; out[i * 3 + 1] = ay / l; out[i * 3 + 2] = az / l; }
    else { out[i * 3] = nrm.getX(i); out[i * 3 + 1] = nrm.getY(i); out[i * 3 + 2] = nrm.getZ(i); }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", pos);
  g.setAttribute("normal", new BufferAttribute(out, 3));
  if (src.index) g.setIndex(src.index);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.drawRange = { ...src.drawRange };
  if (src.boundingSphere) g.boundingSphere = src.boundingSphere.clone();
  if (src.boundingBox) g.boundingBox = src.boundingBox.clone();
  smoothCache.set(src, g);
  return g;
}
import { MeshBasicNodeMaterial } from "three/webgpu";
import { cameraPosition, color as tslColor, modelWorldMatrix, normalLocal, positionLocal, sin, time, uniform, vec4 } from "three/tsl";
import { FAILURE_BLINK } from "@/constants/failureScenario";
import { useEffect } from "react";
import { useControls } from "@/debug/controls";

/**
 * TSL inverted-hull 외곽선 (drei Outlines 와 같은 방식: 뒷면만 그리고 로컬 노멀 방향으로 thickness 만큼 밀어냄).
 * WebGPU / WebGL2 백엔드 공통. 머티리얼은 전 인스턴스 공유.
 */
/** [outline] thickness ~ screen pixels (scaled by camera distance, independent of object/parent scale) */
export const hoverOutlineThickness = uniform(HOVER_OUTLINE_THICKNESS);
const OUTLINE_KEY = "tp.outlinePx.v1";
const loadPx = () => { try { const v = parseFloat(localStorage.getItem(OUTLINE_KEY) ?? ""); return Number.isFinite(v) ? v : HOVER_OUTLINE_THICKNESS; } catch { return HOVER_OUTLINE_THICKNESS; } };
// [pt121u] Outline panel removed → always the default thickness (stored tp.outlinePx ignored)
hoverOutlineThickness.value = HOVER_OUTLINE_THICKNESS;
void loadPx;
/** Debug UI slider (mounted once in Scene) */
export function OutlineDebug() {
  const [v] = useControls("Outline", () => ({ thickness: { value: loadPx(), min: 0, max: 10, step: 0.1, label: "thickness px" } }));
  useEffect(() => { hoverOutlineThickness.value = v.thickness; try { localStorage.setItem(OUTLINE_KEY, String(v.thickness)); } catch { /* ignore */ } }, [v.thickness]);
  return null;
}
let outlineMat: MeshBasicNodeMaterial | null = null;
function getOutlineMaterial() {
  if (outlineMat) return outlineMat;
  const m = new MeshBasicNodeMaterial({ side: BackSide, toneMapped: false });
  m.color = new Color(HOVER_OUTLINE_COLOR);
  // world offset = px * distance * ~0.001 (about 1 px per unit at 1080p / fov 50); divide by the world length of the
  // local normal so node/parent scale (e.g. GLB scale) no longer multiplies the thickness.
  const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
  const dist = cameraPosition.distance(worldPos);
  const nScale = modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz.length().max(1e-6);
  m.positionNode = positionLocal.add(normalLocal.mul(hoverOutlineThickness.mul(dist).mul(0.001).div(nScale)));
  outlineMat = m;
  return m;
}

export type AlertOutlineVariant = "warning" | "failure" | "safe";

const ALERT_OUTLINE_COLOR: Record<AlertOutlineVariant, string> = {
  warning: "#FFB020",
  failure: FAILURE_BLINK.color,
  safe: "#2ECC71",
};

/** 경고·고장·복구 outline — 같은 inverted hull, 상태색 깜빡임 */
const alertMats: Partial<Record<AlertOutlineVariant, MeshBasicNodeMaterial>> = {};
function getAlertOutlineMaterial(variant: AlertOutlineVariant) {
  const cached = alertMats[variant];
  if (cached) return cached;
  const m = new MeshBasicNodeMaterial({ side: BackSide, toneMapped: false });
  const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
  const dist = cameraPosition.distance(worldPos);
  const nScale = modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz.length().max(1e-6);
  const px = hoverOutlineThickness.mul(FAILURE_BLINK.thicknessScale);
  m.positionNode = positionLocal.add(normalLocal.mul(px.mul(dist).mul(0.001).div(nScale)));
  const pulse = sin(time.mul((2 * Math.PI) / FAILURE_BLINK.periodSec)).mul(0.5).add(0.5);
  const intensity = pulse.mul(1 - FAILURE_BLINK.minIntensity).add(FAILURE_BLINK.minIntensity);
  m.colorNode = tslColor(new Color(ALERT_OUTLINE_COLOR[variant])).mul(intensity.mul(1.6));
  alertMats[variant] = m;
  return m;
}

function getFailureOutlineMaterial() {
  return getAlertOutlineMaterial("failure");
}

/** useFrame 에서 상태색으로 교체. hull 메시의 첫 자식이 outline 셸 */
export function setAlertOutlineVariant(root: Mesh, variant: AlertOutlineVariant) {
  const shell = root.children[0] as Mesh | undefined;
  if (!shell) return;
  const material = getAlertOutlineMaterial(variant);
  if (shell.material !== material) shell.material = material;
}

/** [hover] 깊이용 투명 머티리얼도 전 인스턴스 공유 (인스턴스별 생성 → 개별 파이프라인/바인드그룹 방지) */
let hullMat: MeshBasicMaterial | null = null;
function getHullMaterial() {
  if (!hullMat) hullMat = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  return hullMat;
}

/**
 * 외곽선 모드에서 선택(없으면 호버) 대상의 표면을 "원래 색 유지" 마스크로 덮는다.
 * 색은 0을 더해 3D 화면은 그대로이고, 외곽선 렌더 타깃의 마스크 채널만 1이 된다.
 */
let keepFillMat: MeshBasicNodeMaterial | null = null;
function getKeepFillMaterial() {
  if (keepFillMat) return keepFillMat;
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
  m.colorNode = vec4(0, 0, 0, 0);
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  keepFillMat = m;
  return m;
}
const OUTLINE_KEEP = { outlineKeep: true };
/**
 * [hover] WebGPU 는 오브젝트/머티리얼 조합이 처음 그려질 때 노드 빌드 + 렌더 파이프라인 컴파일을 한다.
 * 첫 hover 때 이 비용(측정 ~100ms)이 터져 프레임 드랍 → 마운트 직후 같은 geometry/머티리얼로 만든
 * 극소 스케일 더미를 3프레임 그려 파이프라인을 미리 캐시. 실제 outline 의 visible/matrix 는 건드리지 않음.
 */
const warmedGeoms = new WeakSet<BufferGeometry>();
const warmedFailureGeoms = new WeakSet<BufferGeometry>();
function warmOutline(node: Mesh, geometry: BufferGeometry, failure = false) {
  const warmed = failure ? warmedFailureGeoms : warmedGeoms;
  if (warmed.has(geometry)) return;
  warmed.add(geometry);
  requestAnimationFrame(() => {
    const parent = node.parent;
    if (!parent) return;
    const dummy = new Mesh(geometry, getHullMaterial());
    const shells = failure
      ? (["failure", "warning", "safe"] as const).map((variant) => new Mesh(getOutlineGeometry(geometry), getAlertOutlineMaterial(variant)))
      : [new Mesh(getOutlineGeometry(geometry), getOutlineMaterial()), new Mesh(geometry, getKeepFillMaterial())];
    for (const shell of shells) dummy.add(shell);
    dummy.scale.setScalar(1e-6);
    dummy.frustumCulled = false;
    dummy.raycast = () => {};
    for (const child of dummy.children) {
      child.frustumCulled = false;
      child.raycast = () => {};
    }
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
  variant = "hover",
}: {
  geometry: BufferGeometry;
  meshRef?: (node: Mesh | null) => void;
  /** failure = 고장 빨강 깜빡임 outline */
  variant?: "hover" | "failure";
}) {
  const failure = variant === "failure";
  return (
    <mesh
      ref={(node) => {
        if (node && node.userData.hoverOutlineInit !== true) {
          node.visible = false;
          node.userData.hoverOutlineInit = true;
          warmOutline(node, geometry, failure);
        }
        meshRef?.(node);
      }}
      geometry={geometry}
      matrixAutoUpdate={false}
      frustumCulled={false}
      raycast={() => null}
    >
      <primitive object={getHullMaterial()} attach="material" />
      <mesh geometry={getOutlineGeometry(geometry)} material={failure ? getFailureOutlineMaterial() : getOutlineMaterial()} frustumCulled={false} raycast={() => null} userData={OUTLINE_KEEP} />
      {failure ? null : (
        <mesh geometry={geometry} material={getKeepFillMaterial()} frustumCulled={false} raycast={() => null} userData={OUTLINE_KEEP} />
      )}
    </mesh>
  );
}
