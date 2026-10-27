import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import { button, setPanelValues, useControls } from "@/debug/controls";
import type { OceanSim } from "./fft";
import { FFTOceanGPU } from "./webgpu/fftGPU";
import { FFTOceanFrag } from "./webgpu/fftFrag";
import { makeIslandMatGPU, makeOceanMatGPU, makeProbeGPU, makeSeabedGPU, makeSkyMatGPU } from "./webgpu/oceanTSL";
import { PERF_Q, Q, useSettings, type Quality } from "./state/settingsStore";
import { SceneContext, type SceneCtx } from "./scene/context";
import { radialGrid, type Cube, type Probe, type Seabed, type UniformMat } from "./scene/resources";
import { Ocean } from "./scene/Ocean";
import { Sky } from "./scene/Sky";
import { WATER_PRESETS } from "./spectrum";
import { oceanState } from "./oceanApi";
import { useShoreReady } from "./portShore";

/** 항구 수면 높이 (m) */
export const OCEAN_LEVEL = 15.29;
const D = useSettings.getState();

/**
 * ocean-tsl main 브랜치 r3f 바다 (OceanScene) 의 twin-port 통합판.
 * 리소스 생성은 원본 OceanScene 과 동일 (WebGPU → TSL+컴퓨트 FFT, 아니면 GLSL 폴백).
 * 생략: Island/Seabed/FloatingCubes/Buoy/HeightProbe (항구 지형이 해안을 대신함).
 */
export default function OceanTsl() {
  // ocean-tsl main 설정 패널(Panel.tsx 섹션) 1:1 — 키/범위/기본값/프리셋 동일, 기본값은 원본 settingsStore 에서 읽음
  const lookBtns = Object.fromEntries(
    Object.entries(WATER_PRESETS).map(([k, v]) => [
      `프리셋: ${k}`,
      button(() => setPanelValues("Ocean", { deep: v.deep, shallow: v.shallow, turbidity: v.turbidity, clarity: v.clarity, depth: v.depth, preset: k }, true)),
    ]),
  );
  const c = useControls("Ocean", {
    // [twin-port 통합]
    visible: true,
    buoyancy: true,
    level: { value: OCEAN_LEVEL, min: 0, max: 30, step: 0.01 },
    hidePortPlane: true,
    // 외해 파도 · 거품 (WaveSection)
    wind: { value: D.params.wind, min: 1, max: 25, step: 0.5 },
    peak: { value: D.params.peak, min: 8, max: 200, step: 1 },
    choppy: { value: D.params.choppy, min: 0, max: 2, step: 0.05 },
    windDir: { value: D.params.windDir, min: -3.14, max: 3.14, step: 0.01 },
    sharp: { value: D.shore.sharp, min: 0, max: 1, step: 0.05 },
    collFoam: { value: D.shore.collFoam, min: 0, max: 2, step: 0.05 },
    persist: { value: D.shore.persist, min: 0.3, max: 4, step: 0.1 },
    // 하늘 · 시간 (SkySection) — 하늘 돔은 꺼져 있고 바다 반사/조명용으로만 사용
    hour: { value: D.params.hour, min: 5.5, max: 18.5, step: 0.1 },
    clouds: { value: D.params.clouds, min: 0, max: 1, step: 0.05 },
    // 물빛 · 탁도 (LookSection)
    preset: { value: D.look.preset, editable: false },
    ...lookBtns,
    deep: D.look.deep,
    shallow: D.look.shallow,
    turbidity: { value: D.look.turbidity, min: 0, max: 1, step: 0.01 },
    clarity: { value: D.look.clarity, min: 2, max: 60, step: 1 },
    depth: { value: D.look.depth, min: 3, max: 40, step: 0.5 },
    // 해안 (ShoreSection)
    shoreFoam: { value: D.shore.shoreFoam, min: 0, max: 2, step: 0.05 },
    wallFoamW: { value: D.shore.wallFoamW, min: 0.5, max: 12, step: 0.1 },
    shoreWave: { value: D.shore.shoreWave, min: 0, max: 2, step: 0.05 },
    shoreLen: { value: D.shore.shoreLen, min: 6, max: 40, step: 1 },
    foamColor: D.shore.foamColor,
    foamBright: { value: D.shore.foamBright, min: 0.3, max: 2, step: 0.05 },
    // 수중 (UnderSection)
    uwColor: D.under.color,
    uwDensity: { value: D.under.density, min: 0.01, max: 0.4, step: 0.01 },
    // 성능 (PerfSection, 앱 단위 항목 제외)
    quality: {
      value: D.quality,
      options: ["low", "medium", "high"],
      onChange: (q: Quality) => setPanelValues("Ocean", { fft0: PERF_Q[q][0], fft1: PERF_Q[q][1], fft2: PERF_Q[q][2] }),
    },
    fft0: { value: D.perf.n[0], options: [128, 256, 512] },
    fft1: { value: D.perf.n[1], options: [128, 256, 512] },
    fft2: { value: D.perf.n[2], options: [128, 256, 512] },
    mode: { value: D.perf.mode, options: ["every", "alt", "nth"] },
    nth: { value: D.perf.nth, min: 2, max: 6, step: 1 },
    detail: { value: D.perf.detail, min: 50, max: 3000, step: 10 },
  });

  // 패널 → 원본 settings store (원본 effect 들이 GPU 유니폼/FFT 에 반영)
  useEffect(() => {
    oceanState.level = c.level;
    oceanState.visible = c.visible;
    oceanState.buoyancy = c.buoyancy;
    const s = useSettings.getState();
    useSettings.setState({
      params: { ...s.params, wind: c.wind, peak: c.peak, choppy: c.choppy, windDir: c.windDir, hour: c.hour, clouds: c.clouds },
      look: { deep: c.deep, shallow: c.shallow, turbidity: c.turbidity, clarity: c.clarity, depth: c.depth, preset: c.preset },
      shore: {
        shoreFoam: c.shoreFoam, wallFoamW: c.wallFoamW, shoreWave: c.shoreWave, shoreLen: c.shoreLen, foamColor: c.foamColor,
        foamBright: c.foamBright, sharp: c.sharp, collFoam: c.collFoam, persist: c.persist,
      },
      under: { color: c.uwColor, density: c.uwDensity },
      quality: c.quality as Quality,
      perf: { ...s.perf, n: [+c.fft0, +c.fft1, +c.fft2], mode: c.mode, nth: c.nth, detail: c.detail },
    });
  }, [c]);

  // busan.glb "Plane" 수면 메시 숨김
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.traverse((o) => {
      if (o.name === "Plane" && (o as THREE.Mesh).isMesh) o.visible = !(c.hidePortPlane && c.visible);
    });
  });

  // 해안 베이크(Ground 로드 시) 완료 후 마운트, 10초 넘으면 해안 없이 마운트
  const ready = useShoreReady((s) => s.ready);
  const [timeout, setTO] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTO(true), 10000);
    return () => clearTimeout(id);
  }, []);
  if (!ready && !timeout) return null;
  return (
    <group visible={c.visible}>
      <PortOceanScene skyDome={false} />
    </group>
  );
}

/** 원본 OceanScene 리소스 생성부 (TSL 경로만: WebGPU / WebGL2 백엔드 공통) */
function PortOceanScene({ skyDome }: { skyDome: boolean }) {
  const gl = useThree((s) => s.gl);
  const rings = useSettings((s) => Q[s.quality].rings);
  const n = useSettings(useShallow((s) => s.perf.n));
  const grid = useMemo(() => radialGrid(rings), [rings]);
  const sim = useMemo<OceanSim>(
    () => {
      const aniso = Math.min(16, (gl as unknown as { getMaxAnisotropy(): number }).getMaxAnisotropy());
      // WebGL2 백엔드는 워크그룹 공유메모리/스토리지 컴퓨트 미지원 → 프래그먼트 패스 FFT (같은 텍스처 출력, 같은 룩)
      const isGPU = (gl as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend?.isWebGPUBackend === true;
      return isGPU ? new FFTOceanGPU(n, aniso) : new FFTOceanFrag(n, aniso);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n[0], n[1], n[2], gl],
  );
  useEffect(() => () => sim.dispose(), [sim]);
  const ocean = useMemo(() => makeOceanMatGPU(grid.g) as UniformMat, [grid.g]);
  const sky = useMemo(() => makeSkyMatGPU() as UniformMat, []);
  const island = useMemo(() => makeIslandMatGPU() as UniformMat, []);
  const probe = useMemo(() => makeProbeGPU(ocean) as unknown as Probe, [ocean]);
  useEffect(() => () => probe.m.dispose(), [probe]);
  const seabed = useMemo(() => makeSeabedGPU(ocean) as Seabed, [ocean]);
  useEffect(() => () => { seabed.g.dispose(); seabed.m.dispose(); }, [seabed]);
  const cubes = useRef<Cube[]>([]);
  const ctx = useMemo<SceneCtx>(() => ({ sim, ocean, sky, island, probe, seabed, cubes }), [sim, ocean, sky, island, probe, seabed]);
  return (
    <SceneContext.Provider value={ctx}>
      <Sky dome={skyDome} lights={false} />
      <Ocean geo={grid.geo} />
    </SceneContext.Provider>
  );
}
