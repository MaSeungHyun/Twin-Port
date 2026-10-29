import { memo, Suspense, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import { initKtx2Support } from "@/domain/gltfLoaders";
import DebugUI from "@/debug/DebugUI";
import CameraPanel from "@/debug/CameraPanel";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Controls from "./Controls";
import Models from "./Models";
import SunLight from "./SunLight";
import OccupancyTransition from "./OccupancyTransition";
import SkyMeshDebug from "./SkyMeshDebug";
import OceanTsl from "./OceanTsl/OceanTsl";
import EnvironmentHdr from "./EnvironmentHdr";
import { useShipDebugStore } from "@/stores/shipDebug";
import { useViewportStore } from "@/stores/viewport";

/** 빈 곳 클릭 판정: pointerdown→click 이동이 이 픽셀 이하일 때만 (드래그/오빗 후 해제 방지) */
const EMPTY_CLICK_MAX_PX = 5;
import { hasWebGPU, useRendererStore } from "@/stores/renderer";
import { useViewportSettingsStore } from "@/stores/useViewportSettingsStore";

// 모니터링 모드일 때, Scene의 렌더링을 멈추고 싶을 때 적용
// 성능 향상이나 현재 60fps로 잘 나오므로 우선 제거
// import MonitorFrameLoopGate from "./MonitorFrameLoopGate";

// HDR 선택/적용은 EnvironmentHdr.tsx 로 이동

import { TONE_MAPPING, TONE_MAPPING_EXPOSURE } from "@/constants/environment";

import {
  INITIAL_CAMERA_FAR,
  INITIAL_CAMERA_FOV,
  INITIAL_CAMERA_NEAR,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
} from "@/constants/camera";

import { PCFSoftShadowMap, SRGBColorSpace } from "three";
import CameraFlight from "./CameraFlight";
import { PerfCollector } from "./PerfOverlay";

// import EnvironmentRotationPanel from "./EnvironmentRotationPanel";

const initialCamera = {
  position: INITIAL_CAMERA_POSITION,
  quaternion: INITIAL_CAMERA_QUATERNION,
  fov: INITIAL_CAMERA_FOV,
  near: INITIAL_CAMERA_NEAR,
  far: INITIAL_CAMERA_FAR,
} as const;

const RELOAD_KEY = "twin-port.webglFallbackReload";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * ocean-tsl/r3f 방식: WebGPURenderer. WebGL2 는 forceWebGL (TSL 그대로, 클래식 WebGLRenderer 사용 안 함).
 * 폴백: WebGPU 미지원 / requestAdapter()=null / init 실패 → forceWebGL 로 재시도, 이유는 fallbackReason 에 기록.
 */
const createRenderer = async (props: { canvas: unknown }) => {
  const rs = useRendererStore.getState();
  let reason: string | null = null;
  let forceWebGL = rs.pref === "webgl";
  if (!forceWebGL) {
    if (!hasWebGPU()) reason = "이 브라우저는 WebGPU 를 지원하지 않습니다";
    else {
      try {
        const gpu = (navigator as unknown as {
          gpu: { requestAdapter: (o?: object) => Promise<unknown> };
        }).gpu;
        const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) reason = "WebGPU 어댑터를 찾지 못했습니다 (requestAdapter → null)";
      } catch (e) {
        reason = `WebGPU requestAdapter 실패: ${errMsg(e)}`;
      }
    }
    if (reason) forceWebGL = true;
  }
  const make = (fw: boolean) =>
    new WebGPURenderer({
      forceWebGL: fw,
      canvas: props.canvas as HTMLCanvasElement,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  let r = make(forceWebGL);
  try {
    await r.init();
  } catch (e) {
    if (forceWebGL) throw e;
    reason = `WebGPU 초기화 실패: ${errMsg(e)}`;
    console.warn(`[Scene] ${reason} → WebGL2 로 재시도`);
    r.dispose();
    r = make(true);
    try {
      await r.init();
    } catch (e2) {
      // 같은 canvas 에 webgpu 컨텍스트가 이미 잡혀 webgl2 를 못 얻는 경우: 1회만 WebGL2 로 리로드
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          const url = new URL(window.location.href);
          url.searchParams.set("renderer", "webgl");
          window.location.replace(url.toString());
        }
      } catch {
        /* noop */
      }
      throw e2;
    }
  }
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* noop */
  }
  initKtx2Support(r); // [perf] BUSAN.glb KTX2 텍스처 (WebGPU/WebGL2 백엔드 공통)
  r.toneMapping = TONE_MAPPING;
  r.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  r.outputColorSpace = SRGBColorSpace;
  const backend = (r as unknown as { backend?: { isWebGPUBackend?: boolean } })
    .backend;
  const isWebGPU = !!backend?.isWebGPUBackend;
  if (!reason && rs.pref === "webgpu" && !isWebGPU)
    reason = "WebGPU 백엔드를 사용할 수 없어 WebGL2 로 전환되었습니다";
  rs.setActive(isWebGPU ? "webgpu" : "webgl2");
  rs.setFallbackReason(reason);
  if (reason) console.warn(`[Scene] WebGL2 폴백: ${reason}`);
  console.info(
    `[Scene] renderer: WebGPURenderer (${isWebGPU ? "WebGPU" : "WebGL2"} backend, pref=${rs.pref})`,
  );
  return r as unknown as import("three").WebGLRenderer;
};

import CamParam from "@/debug/CamParam";
import CameraSlots from "@/debug/CameraSlots";

function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  // [perf] DPR 상한 (4K 에서 픽셀 수 감소). 헤더 품질 프리셋(1/1.25/1.5) 또는 DebugUI 오버라이드
  const renderScale = useViewportSettingsStore((s) => s.renderScale);
  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    renderScale,
  );

  return (
    <div
      className="relative h-full w-full"
      onPointerDownCapture={(e) => {
        downPos.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
      }}
    >
      {/* {import.meta.env.DEV && <EnvironmentRotationPanel />} */}
      {/* 디버그 패널: 개발 모드 또는 ?debug 일 때만 표시 */}
      <DebugUI />
      <R3FCanvas
        className="h-full w-full touch-none"
        style={{
          display: "block",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
        shadows={{ type: PCFSoftShadowMap }}
        // R3F 9 는 async gl 팩토리 지원 (타입 정의는 동기만 선언)
        gl={createRenderer as never}
        frameloop="always"
        dpr={dpr}
        onPointerMissed={(e) => {
          const me = e as MouseEvent;
          if (me.type !== "click") return;
          useShipDebugStore.getState().clearSelection();
          // [select] 빈 곳 클릭 → 선택/Tracking/outline 해제, 패널은 유지 (사용자가 직접 닫음)
          const d = downPos.current;
          downPos.current = null;
          if (!d || Math.hypot(me.clientX - d.x, me.clientY - d.y) > EMPTY_CLICK_MAX_PX) return;
          const viewport = useViewportStore.getState();
          if (!viewport.interactionReady) return;
          viewport.clearSceneSelection();
        }}
        camera={initialCamera}
      >
        {/* <MonitorFrameLoopGate /> */}
        {/* 로딩 UI는 App의 ViewLoader(React DOM)에서 처리 */}
        {/* <fogExp2 attach="fog" args={["#000000", OCCUPANCY_TRANSITION.fogFrom]} /> */}
        <Suspense fallback={null}>
          <EnvironmentHdr />
          <OccupancyTransition />
          <Controls controlsRef={controlsRef} />
          <CameraFlight controlsRef={controlsRef} />
          {/* <ambientLight color={0xacaccc} intensity={0.2} /> */}
          <SunLight />
          {/* <directionalLight
            color={0xffffff}
            intensity={1}
            position={[0, 5, -0]}
            castShadow
          >
            <Helper type={DirectionalLightHelper} args={[3]} />
          </directionalLight> */}
          {/* <Water /> */}
          <Models />
          <SkyMeshDebug />
          <OceanTsl />
          <CameraPanel />
          <CamParam />
          <CameraSlots />
        </Suspense>

        <PerfCollector />
        {/* StatsGl 은 WebGL 전용이라 WebGPU 전환 시 제거 */}
      </R3FCanvas>
    </div>
  );
}

export default memo(Scene);

