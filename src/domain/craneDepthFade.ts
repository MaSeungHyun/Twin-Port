/**
 * [depthfade] 구역/그룹 Depth 진입 시 포커스 밖 안벽 크레인을 반투명으로.
 * 인스턴스로 묶이지 않은 부품만 여기서 다룬다.
 * 로드 시 크레인 메시마다 transparent 복제 머티리얼을 미리 만들어 두고(SceneWarmup 에서 함께 컴파일),
 * 런타임에는 material 참조 교체 + opacity(uniform) 트윈만 한다.
 */
import { DEPTH_FADE_DURATION_S, DEPTH_UNFOCUSED_OPACITY } from "@/constants/areaCam";
import { attachCraneFade, writeFadeOpacity } from "@/domain/fadeOpacity";
import { setQuayInstanceFocus } from "@/domain/quayCraneInstance";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { Material, Mesh, type Object3D } from "three";

type Entry = { mesh: Mesh; index: number; original: Material | Material[]; faded: Material[]; opacity: number; target: number };

let entries: Entry[] = [];
const byMesh = new Map<Mesh, Entry>();
let focus: ReadonlySet<number> | null = null;

const list = (m: Material | Material[]) => (Array.isArray(m) ? m : [m]);

/** Ground 모델 준비 직후 1회 (머티리얼 설정 이후) */
export function bindCraneDepthFade(model: Object3D | null) {
  for (const e of entries) e.mesh.material = e.original;
  for (const e of entries) for (const m of e.faded) m.dispose();
  entries = [];
  byMesh.clear();
  if (!model) return;
  model.traverse((o) => {
    if (!(o instanceof Mesh) || o.name.endsWith("-occupancy")) return;
    if (o.userData.quaySource || o.userData.quayDraw || o.userData.quayDepth) return;
    const index = parseQuayCraneGlbIndex(o);
    if (index == null) return;
    // 크레인끼리 공유하는 머티리얼 → 메시별 복제 (크레인마다 독립 페이드)
    const faded = list(o.material).map((m) => {
      const c = m.clone();
      // 원본과 셰이더를 공유하면 opacity 노드가 빠져 그대로 진하게 남는다.
      c.customProgramCacheKey = () => "quay-part-fade";
      const lit = c as Material & { emissive?: { set: (hex: number) => void }; emissiveMap?: unknown; emissiveIntensity?: number };
      lit.emissive?.set(0);
      lit.emissiveMap = null;
      lit.emissiveIntensity = 0;
      attachCraneFade(c);
      c.depthWrite = true;
      return c;
    });
    const e: Entry = { mesh: o, index, original: o.material, faded, opacity: 1, target: 1 };
    entries.push(e);
    byMesh.set(o, e);
  });
  applyTargets();
}

/** SceneWarmup: 원본 컴파일 후 페이드 변형도 같은 메시로 컴파일 */
export function getCraneFadeVariant(mesh: Mesh): Material | Material[] | null {
  const e = byMesh.get(mesh);
  if (!e) return null;
  return Array.isArray(e.original) ? e.faded : e.faded[0]!;
}

/** null = Depth 없음(전체 불투명). 집합 = 포커스 크레인 GLB index */
export function setCraneDepthFocus(next: ReadonlySet<number> | null) {
  focus = next;
  applyTargets();
  setQuayInstanceFocus(next);
}

function applyTargets() {
  for (const e of entries) e.target = !focus || focus.has(e.index) ? 1 : DEPTH_UNFOCUSED_OPACITY;
}

/** 매 프레임 (Ground useFrame) */
export function updateCraneDepthFade(dt: number) {
  const step = DEPTH_FADE_DURATION_S > 0 ? (dt * (1 - DEPTH_UNFOCUSED_OPACITY)) / DEPTH_FADE_DURATION_S : 1;
  for (const e of entries) {
    if (e.opacity === e.target && (e.target < 1 ? true : e.mesh.material === e.original)) continue;
    const d = e.target - e.opacity;
    e.opacity = Math.abs(d) <= step ? e.target : e.opacity + Math.sign(d) * step;
    if (e.opacity >= 1) {
      if (e.mesh.material !== e.original) e.mesh.material = e.original;
      continue;
    }
    if (e.mesh.material === e.original) e.mesh.material = Array.isArray(e.original) ? e.faded : e.faded[0]!;
    writeFadeOpacity(e.faded, e.opacity);
  }
}
