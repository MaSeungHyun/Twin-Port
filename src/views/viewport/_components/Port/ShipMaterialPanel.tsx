import shipUrl from "@/assets/model/ship.glb";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { button, useControls } from "@/debug/controls";
import { useEffect, useMemo, useRef } from "react";
import { SHIP_MATERIAL, type MaterialSettings } from "@/constants/materials";
import { applyMaterialSettings, collectMaterials } from "@/domain/materialSettings";

const NAMES = Object.keys(SHIP_MATERIAL);

/** leva "Ship Material": ship.glb 머티리얼 라이브 편집 (기본값 = constants/materials.ts) */
export default function ShipMaterialPanel() {
  const { scene } = useGLTF(shipUrl);
  const invalidate = useThree((s) => s.invalidate);
  const mats = useMemo(
    () => collectMaterials(scene, (n) => n in SHIP_MATERIAL),
    [scene],
  );
  const values = useRef<Record<string, MaterialSettings>>(
    structuredClone(SHIP_MATERIAL),
  );
  const current = useRef(NAMES[0]);

  // 로드 시 전체 적용
  useEffect(() => {
    for (const [name, set] of mats) {
      const v = values.current[name];
      if (v) set.forEach((m) => applyMaterialSettings(m, v));
    }
    invalidate();
  }, [mats, invalidate]);

  const [c, setPanel] = useControls("Ship Material", () => ({
    material: { value: NAMES[0], options: NAMES },
    color: SHIP_MATERIAL[NAMES[0]].color,
    metalness: { value: SHIP_MATERIAL[NAMES[0]].metalness, min: 0, max: 1, step: 0.01 },
    roughness: { value: SHIP_MATERIAL[NAMES[0]].roughness, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: SHIP_MATERIAL[NAMES[0]].envMapIntensity, min: 0, max: 5, step: 0.01 },
    emissive: SHIP_MATERIAL[NAMES[0]].emissive,
    emissiveIntensity: { value: SHIP_MATERIAL[NAMES[0]].emissiveIntensity, min: 0, max: 20, step: 0.01 },
    opacity: { value: SHIP_MATERIAL[NAMES[0]].opacity, min: 0, max: 1, step: 0.01 },
    transparent: SHIP_MATERIAL[NAMES[0]].transparent,
    mapEnabled: { value: SHIP_MATERIAL[NAMES[0]].mapEnabled, label: "map on" },
    "Reset this": button(() => {
      const n = current.current;
      values.current[n] = { ...SHIP_MATERIAL[n] };
      setPanel(values.current[n]);
    }),
    "Copy values": button(() => {
      const r = (x: number) => +x.toFixed(4);
      const body = Object.entries(values.current)
        .map(([n, v]) => `  ${n}: ${JSON.stringify({ ...v, metalness: r(v.metalness), roughness: r(v.roughness), envMapIntensity: r(v.envMapIntensity), emissiveIntensity: r(v.emissiveIntensity), opacity: r(v.opacity) })},`)
        .join("\n");
      const text = `export const SHIP_MATERIAL: Record<string, MaterialSettings> = {\n${body}\n};`;
      console.info("[Ship Material]\n" + text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
  }));

  useEffect(() => {
    const name = c.material;
    if (name !== current.current) {
      // 선택 변경: 패널에 해당 머티리얼 값 로드 (이번 렌더 값은 쓰지 않음)
      current.current = name;
      setPanel(values.current[name]);
      return;
    }
    const { material: _m, ...v } = c;
    void _m;
    values.current[name] = v;
    mats.get(name)?.forEach((m) => applyMaterialSettings(m, v));
    invalidate();
  }, [c, mats, setPanel, invalidate]);

  return null;
}
