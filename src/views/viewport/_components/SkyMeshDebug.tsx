import { useFrame, useThree } from "@react-three/fiber";
import { button, useControls } from "@/debug/controls";
import { useEffect, useRef, useState } from "react";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { SKY_MATERIAL, SKY_VISIBLE } from "@/constants/materials";
import { applyMaterialSettings } from "@/domain/materialSettings";

type SkyEntry = {
  obj: Object3D;
  baseScale: [number, number, number];
  baseRotY: number;
  mats: MeshStandardMaterial[];
};

const r = (x: number) => +x.toFixed(4);

/**
 * busan.glb "sky" 메시(mat: adskMatsky) + leva "Sky Material" 패널.
 * 찾을 때까지만 매 프레임 탐색 → 찾은 뒤에는 패널 값만 적용 (숨김 루프와 충돌 없음).
 */
export default function SkyMeshDebug() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [skies, setSkies] = useState<SkyEntry[]>([]);
  const found = useRef(false);

  useFrame(() => {
    if (found.current) return;
    const list: SkyEntry[] = [];
    scene.traverse((o) => {
      if (!/^sky(\b|_|\.|$)/i.test(o.name)) return;
      const mats: MeshStandardMaterial[] = [];
      o.traverse((m) => {
        if (!(m instanceof Mesh)) return;
        const arr = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of arr) if (mat instanceof MeshStandardMaterial) mats.push(mat);
      });
      list.push({
        obj: o,
        baseScale: [o.scale.x, o.scale.y, o.scale.z],
        baseRotY: o.rotation.y,
        mats,
      });
    });
    if (list.length === 0) return;
    found.current = true;
    // 하늘 메시는 그림자 제외
    list.forEach((s) => s.obj.traverse((m) => { m.castShadow = false; m.receiveShadow = false; }));
    // 패널 적용 전 깜빡임 방지
    list.forEach((s) => (s.obj.visible = SKY_VISIBLE));
    setSkies(list);
  });

  const [c, setPanel] = useControls("Sky Material", () => ({
    visible: SKY_VISIBLE,
    color: SKY_MATERIAL.color,
    metalness: { value: SKY_MATERIAL.metalness, min: 0, max: 1, step: 0.01 },
    roughness: { value: SKY_MATERIAL.roughness, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { value: SKY_MATERIAL.envMapIntensity, min: 0, max: 5, step: 0.01 },
    emissive: SKY_MATERIAL.emissive,
    emissiveIntensity: { value: SKY_MATERIAL.emissiveIntensity, min: 0, max: 20, step: 0.01 },
    opacity: { value: SKY_MATERIAL.opacity, min: 0, max: 1, step: 0.01 },
    transparent: SKY_MATERIAL.transparent,
    mapEnabled: { value: SKY_MATERIAL.mapEnabled, label: "map on" },
    toneMapped: SKY_MATERIAL.toneMapped,
    scale: { value: 1, min: 0.1, max: 5, step: 0.01 },
    rotationY: { value: 0, min: -180, max: 180, step: 1, label: "rotationY°" },
    Reset: button(() =>
      setPanel({ ...SKY_MATERIAL, visible: SKY_VISIBLE, scale: 1, rotationY: 0 }),
    ),
  }), { collapsed: true });

  // Copy 버튼은 최신 값을 ref로 읽음
  const latest = useRef(c);
  latest.current = c;
  useControls("Sky Material", () => ({
    "Copy values": button(() => {
      const { visible, scale, rotationY, ...m } = latest.current;
      const v = {
        ...m,
        metalness: r(m.metalness),
        roughness: r(m.roughness),
        envMapIntensity: r(m.envMapIntensity),
        emissiveIntensity: r(m.emissiveIntensity),
        opacity: r(m.opacity),
      };
      const text = [
        `export const SKY_VISIBLE = ${visible};`,
        `export const SKY_MATERIAL: MaterialSettings & { toneMapped: boolean } = ${JSON.stringify(v, null, 2)};`,
        `// transform (코드 미반영 참고값): scale=${scale}, rotationY°=${rotationY}`,
      ].join("\n");
      console.info("[Sky Material]\n" + text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
  }));

  useEffect(() => {
    if (skies.length === 0) return;
    const { visible, scale, rotationY, ...m } = c;
    for (const s of skies) {
      s.obj.visible = visible;
      s.obj.scale.set(...s.baseScale).multiplyScalar(scale);
      s.obj.rotation.y = s.baseRotY + (rotationY * Math.PI) / 180;
      s.mats.forEach((mat) => applyMaterialSettings(mat, m));
    }
    invalidate();
  }, [c, skies, invalidate]);

  return null;
}
