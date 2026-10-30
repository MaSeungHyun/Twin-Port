import { loadSpan } from "@/debug/loadTiming";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { button, useControls } from "@/debug/controls";
import { useEffect, useMemo, useState } from "react";
import { EquirectangularReflectionMapping, type DataTexture } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { useHdriStore } from "@/stores/hdri";
import {
  ENVIRONMENT_BACKGROUND_INTENSITY,
  ENVIRONMENT_MESH_INTENSITY,
  TONE_MAPPING_EXPOSURE,
} from "@/constants/environment";
import {
  environmentRotationRad,
  formatEnvironmentRotationEuler,
  useEnvironmentDebugStore,
} from "@/stores/environmentDebug";

/** 조명/반사 HDR — 기본 port_hdr, 하늘 패널에서 교체 (stores/hdri) */
/** 조명/반사용 drei Environment + 디버그 패널 ("Environment HDR") */
export default function EnvironmentHdr() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const rotationDeg = useEnvironmentDebugStore((s) => s.rotationDeg);
  const rotation = useMemo(
    () => environmentRotationRad(rotationDeg),
    [rotationDeg],
  );

  const c = useControls("Environment HDR", {
    enabled: { value: true, label: "on/off" },
    environmentIntensity: {
      value: ENVIRONMENT_MESH_INTENSITY,
      min: 0,
      max: 5,
      step: 0.01,
    },
    rotationDeg: {
      value: { ...useEnvironmentDebugStore.getState().rotationDeg },
      step: 1,
      label: "rotation° xyz",
      onChange: (v: { x: number; y: number; z: number }) => {
        const st = useEnvironmentDebugStore.getState();
        (["x", "y", "z"] as const).forEach((a) => st.setRotationDeg(a, v[a]));
      },
    },
    // [slider] HDR Y 회전 단일 슬라이더 (0~360°, 저장) — 배경/환경 회전 모두 적용
    hdrRotY: {
      value: ((useEnvironmentDebugStore.getState().rotationDeg.y % 360) + 360) % 360,
      min: 0,
      max: 360,
      step: 0.1,
      onChange: (v: number) => useEnvironmentDebugStore.getState().setRotationDeg("y", v),
    },
    // 기본 false: HDR은 조명/반사에만 사용, 배경은 캔버스 검정(#000)
    background: { value: false, label: "background (HDR 표시)" },
    backgroundIntensity: {
      value: ENVIRONMENT_BACKGROUND_INTENSITY,
      min: 0,
      max: 5,
      step: 0.01,
    },
    backgroundBlurriness: { value: 0, min: 0, max: 1, step: 0.01 },
    toneMappingExposure: {
      value: TONE_MAPPING_EXPOSURE,
      min: 0,
      max: 3,
      step: 0.01,
    },
    "Copy values": button((get) => {
      const text = JSON.stringify(
        {
          hdri: useHdriStore.getState().current.name,
          environmentIntensity: get("Environment HDR.environmentIntensity"),
          rotationDeg: useEnvironmentDebugStore.getState().rotationDeg,
          rotationEuler: formatEnvironmentRotationEuler(
            useEnvironmentDebugStore.getState().rotationDeg,
          ),
          background: get("Environment HDR.background"),
          backgroundIntensity: get("Environment HDR.backgroundIntensity"),
          backgroundBlurriness: get("Environment HDR.backgroundBlurriness"),
          toneMappingExposure: get("Environment HDR.toneMappingExposure"),
        },
        null,
        2,
      );
      console.info("[Environment HDR]", text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
  });

  // HDRI 로드 (번들 URL / 로컬 object URL). drei Environment 에 map 으로 넘김 → WebGPURenderer 가 equirect 를 PMREM 처리
  const hdri = useHdriStore((s) => s.current);
  const [envMap, setEnvMap] = useState<DataTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loader = hdri.ext === "exr" ? new EXRLoader() : new HDRLoader();
    useHdriStore.getState().setStatus("loading");
    const endHdr = loadSpan(`hdr load+parse ${hdri.name}`);
    loader.loadAsync(hdri.url).then(
      (tex) => {
        endHdr(); // PMREM 은 첫 컴파일/렌더 때 생성 (예열 로그에 포함)
        if (cancelled) return tex.dispose();
        tex.mapping = EquirectangularReflectionMapping;
        tex.name = hdri.name;
        setEnvMap((prev) => {
          if (prev && prev !== tex) queueMicrotask(() => prev.dispose());
          return tex as DataTexture;
        });
        useHdriStore.getState().setStatus("ready");
        invalidate();
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error("[HDRI] 로드 실패", hdri.name, e);
        useHdriStore.getState().setStatus("error", String((e as Error)?.message ?? e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hdri, invalidate]);
  useEffect(() => () => envMap?.dispose(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // drei 내부 적용과 별개로 scene/renderer에 매 변경마다 직접 반영 (재질 반영 보장)
  useEffect(() => {
    scene.environmentIntensity = c.environmentIntensity;
    scene.environmentRotation.set(...rotation);
    scene.backgroundIntensity = c.backgroundIntensity;
    scene.backgroundBlurriness = c.backgroundBlurriness;
    scene.backgroundRotation.set(...rotation);
    gl.toneMappingExposure = c.toneMappingExposure;
    invalidate();
  });

  if (!c.enabled || !envMap) return null;

  return (
    <Environment
      map={envMap}
      background={c.background}
      backgroundRotation={rotation}
      backgroundBlurriness={c.backgroundBlurriness}
      backgroundIntensity={c.backgroundIntensity}
      environmentRotation={rotation}
      environmentIntensity={c.environmentIntensity}
    />
  );
}
