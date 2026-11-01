/**
 * [depthfade] 구역/그룹 Depth 진입 시 포커스 밖 안벽 크레인을 반투명으로.
 * 로드 시 크레인 메시마다 transparent 복제 머티리얼을 미리 만들어 두고(SceneWarmup 에서 함께 컴파일),
 * 런타임에는 material 참조 교체 + opacity(uniform) 트윈만 ? transparent 토글/셰이더 재컴파일 없음.
 */
import { DEPTH_FADE_DURATION_S, DEPTH_UNFOCUSED_OPACITY } from "@/constants/areaCam";
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
    const index = parseQuayCraneGlbIndex(o);
    if (index == null) return;
    // 크레인끼리 공유하는 머티리얼 → 메시별 복제 (크레인마다 독립 페이드)
    const faded = list(o.material).map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.depthWrite = true; // 자기 부재끼리 비침 방지 (반투명 실루엣)
      c.opacity = 1;
      c.needsUpdate = true;
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
    for (const m of e.faded) m.opacity = e.opacity;
  }
}
