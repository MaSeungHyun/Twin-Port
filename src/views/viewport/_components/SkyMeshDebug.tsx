import { useFrame, useThree } from "@react-three/fiber";
import { button, useControls } from "@/debug/controls";
import { useEffect, useRef, useState } from "react";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import {
  SKY_MATERIALS,
  SKY_MATERIAL_DEFAULT,
  SKY_TRANSFORM,
  SKY_VISIBLE,
  type SkyMaterialSettings,
} from "@/constants/materials";
import { applyMaterialSettings } from "@/domain/materialSettings";
import { occupancyTransitionProgressRef } from "@/constants/occupancyTransition";

type SkyEntry = { obj: Object3D; baseScale: [number, number, number]; baseRotY: number };

const r = (x: number) => +x.toFixed(4);
const NAMES = Object.keys(SKY_MATERIALS);
const FIRST = SKY_MATERIALS[NAMES[0]!] ?? SKY_MATERIAL_DEFAULT;
const SIDES = ["front", "back", "double"];
// [slider] 하늘 Y 회전 0~360° 저장
const SKY_ROT_KEY = "tp.skyRotY.v1";
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const loadSkyRot = () => { try { const v = parseFloat(localStorage.getItem(SKY_ROT_KEY) ?? ""); return Number.isFinite(v) ? norm360(v) : norm360(SKY_TRANSFORM.rotationY); } catch { return norm360(SKY_TRANSFORM.rotationY); } };

/**
 * busan.glb "sky" 오브젝트 + "Sky" 패널.
 * 오브젝트: 표시/회전/스케일. 머티리얼: 하위 메시의 모든 머티리얼을 이름별로 선택해 Ship Material 처럼 편집.
 * 기본값 = constants/materials.ts SKY_MATERIALS (목록에 없는 머티리얼은 SKY_MATERIAL_DEFAULT 로 추가됨)
 */
export default function SkyMeshDebug() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [skies, setSkies] = useState<SkyEntry[]>([]);
  const mats = useRef(new Map<string, Set<MeshStandardMaterial>>());
  const values = useRef<Record<string, SkyMaterialSettings>>(structuredClone(SKY_MATERIALS));
  const current = useRef(NAMES[0]!);
  const found = useRef(false);

  // [occ] 점유율 전환 진행도에 맞춰 하늘 머티리얼을 서서히 어둡게/밝게 (속성만 변경 → 재컴파일 없음)
  const lastK = useRef(-1);
  useFrame(() => {
    if (!found.current) return;
    const k = 1 - 0.85 * occupancyTransitionProgressRef.current.t;
    if (Math.abs(k - lastK.current) < 1e-4) return;
    lastK.current = k;
    for (const [n, set] of mats.current) {
      const v = values.current[n]; if (!v) continue;
      set.forEach((m) => { m.color.set(v.color).multiplyScalar(k); m.emissiveIntensity = v.emissiveIntensity * k; m.envMapIntensity = v.envMapIntensity * k; });
    }
    invalidate();
  });
  useFrame(() => {
    if (found.current) return;
    const list: SkyEntry[] = [];
    scene.traverse((o) => {
      if (!/^sky(\b|_|\.|$)/i.test(o.name)) return;
      o.traverse((m) => {
        if (!(m instanceof Mesh)) return;
        m.castShadow = false;
        m.receiveShadow = false;
        const arr = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of arr) {
          if (!(mat instanceof MeshStandardMaterial)) continue;
          const n = mat.name || "(이름 없음)";
          if (!mats.current.has(n)) mats.current.set(n, new Set());
          mats.current.get(n)!.add(mat);
        }
      });
      list.push({ obj: o, baseScale: [o.scale.x, o.scale.y, o.scale.z], baseRotY: o.rotation.y });
    });
    if (list.length === 0) return;
    found.current = true;
    for (const n of mats.current.keys()) {
      if (!values.current[n]) {
        values.current[n] = { ...SKY_MATERIAL_DEFAULT };
        console.warn(`[Sky] 머티리얼 "${n}" 이 SKY_MATERIALS 에 없어 기본값 사용 (선택 목록에는 constants 에 추가해야 표시)`);
      }
    }
    for (const [n, set] of mats.current) set.forEach((m) => applyMaterialSettings(m, values.current[n]!));
    list.forEach((s) => (s.obj.visible = SKY_VISIBLE));
    setSkies(list);
  });

  // 오브젝트 단위
  const [o, setObj] = useControls("Sky Material", () => ({
    visible: SKY_VISIBLE,
    rotationY: { value: loadSkyRot(), min: 0, max: 360, step: 0.1, label: "rotationY°" },
    scale: { value: SKY_TRANSFORM.scale, min: 0.1, max: 5, step: 0.01 },
  }));

  // 머티리얼 단위 (선택한 머티리얼 편집)
  const [c, setPanel] = useControls("Sky Material", () => ({
    material: { value: NAMES[0]!, options: NAMES },
    color: FIRST.color,
    emissive: FIRST.emissive,
    emissiveIntensity: { value: FIRST.emissiveIntensity, min: 0, max: 20, step: 0.01 },
    mapEnabled: { value: FIRST.mapEnabled, label: "map on" },
    opacity: { value: FIRST.opacity, min: 0, max: 1, step: 0.01 },
    transparent: FIRST.transparent,
    toneMapped: FIRST.toneMapped,
    side: { value: FIRST.side as string, options: SIDES },
    metalness: { value: FIRST.metalness, min: 0, max: 1, step: 0.01 },
    roughness: { value: FIRST.roughness, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: FIRST.envMapIntensity, min: 0, max: 5, step: 0.01 },
    "Reset this": button(() => {
      const n = current.current;
      values.current[n] = { ...(SKY_MATERIALS[n] ?? SKY_MATERIAL_DEFAULT) };
      setPanel(values.current[n]!);
      setObj({ visible: SKY_VISIBLE, ...SKY_TRANSFORM, rotationY: norm360(SKY_TRANSFORM.rotationY) });
    }),
    "Copy values": button(() => {
      const body = Object.entries(values.current)
        .map(([n, v]) => `  ${JSON.stringify(n)}: ${JSON.stringify({ ...v, metalness: r(v.metalness), roughness: r(v.roughness), envMapIntensity: r(v.envMapIntensity), emissiveIntensity: r(v.emissiveIntensity), opacity: r(v.opacity) })},`)
        .join("\n");
      const ol = latestObj.current;
      const text = [
        `export const SKY_VISIBLE = ${ol.visible};`,
        `export const SKY_TRANSFORM = { rotationY: ${ol.rotationY}, scale: ${r(ol.scale)} };`,
        `export const SKY_MATERIALS: Record<string, SkyMaterialSettings> = {\n${body}\n};`,
      ].join("\n");
      console.info("[Sky]\n" + text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
  }));
  const latestObj = useRef(o);
  latestObj.current = o;

  useEffect(() => { try { localStorage.setItem(SKY_ROT_KEY, String(o.rotationY)); } catch { /* ignore */ } }, [o.rotationY]);
  useEffect(() => {
    if (skies.length === 0) return;
    for (const s of skies) {
      s.obj.visible = o.visible;
      s.obj.scale.set(...s.baseScale).multiplyScalar(o.scale);
      s.obj.rotation.y = s.baseRotY + (o.rotationY * Math.PI) / 180;
    }
    invalidate();
  }, [o, skies, invalidate]);

  useEffect(() => {
    const name = c.material;
    if (name !== current.current) {
      current.current = name;
      setPanel(values.current[name] ?? SKY_MATERIAL_DEFAULT);
      return;
    }
    const { material: _m, ...rest } = c;
    void _m;
    const v = { ...rest, side: rest.side as SkyMaterialSettings["side"] };
    values.current[name] = v;
    mats.current.get(name)?.forEach((m) => applyMaterialSettings(m, v));
    lastK.current = -1; // [occ] 편집 후 현재 밝기 배율 재적용
    invalidate();
  }, [c, skies, setPanel, invalidate]);

  return null;
}
