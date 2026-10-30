import { Helper, TransformControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { button, setPanelValues, useControls } from "@/debug/controls";
import {
  SUN_CAST_SHADOW,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
  SUN_SHADOW_BLUR_SAMPLES,
  SUN_SHADOW_CAMERA,
  SUN_SHADOW_MAP_SIZE,
  SUN_TARGET,
} from "@/constants/sunLight";
import { useShipDebugStore } from "@/stores/shipDebug";
import { SHADOW_PRESET, useViewportSettingsStore } from "@/stores/useViewportSettingsStore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Camera,
  CameraHelper,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  MathUtils,
  Object3D,
  Vector3,
} from "three";
import SunGlow from "./SunGlow";

const FOLDER = "Directional Light";

// [shadow] persisted shadow + target settings (localStorage)
const SUN_SAVE_KEY = "tp.sunShadow.v3";
type SunSaved = Partial<{ mapSize: number; bias: number; normalBias: number; radius: number; strength: number; halfWidth: number; halfHeight: number; near: number; far: number;
  targetX: number; targetY: number; targetZ: number; followCamera: boolean; followHalfSize: number; targetHandle: boolean }>;
const loadSun = (): SunSaved => { try { return JSON.parse(localStorage.getItem(SUN_SAVE_KEY) ?? "{}") as SunSaved; } catch { return {}; } };
const SAVED = loadSun();
const saveSun = (patch: SunSaved) => { try { localStorage.setItem(SUN_SAVE_KEY, JSON.stringify({ ...loadSun(), ...patch })); } catch { /* ignore */ } };
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** 타깃 기준 오프셋 → 방위각/고도/거리 */
function toSpherical(dx: number, dy: number, dz: number) {
  const distance = Math.hypot(dx, dy, dz) || 1;
  return {
    azimuth: +MathUtils.radToDeg(Math.atan2(dx, dz)).toFixed(2),
    elevation: +MathUtils.radToDeg(
      Math.asin(MathUtils.clamp(dy / distance, -1, 1)),
    ).toFixed(2),
    distance: +distance.toFixed(1),
  };
}

const SUN_DEFAULT = toSpherical(
  SUN_POSITION[0] - SUN_TARGET[0],
  SUN_POSITION[1] - SUN_TARGET[1],
  SUN_POSITION[2] - SUN_TARGET[2],
);

type GizmoMode = "translate" | "rotate";

export default function SunLight() {
  const scene = useThree((s) => s.scene);
  const lightRef = useRef<DirectionalLight>(null);
  const selected = useShipDebugStore((s) => s.lightSelected);
  const [mode, setMode] = useState<GizmoMode>("translate");
  const dragging = useRef(false);

  const target = useMemo(() => {
    const node = new Object3D();
    node.position.set(num(SAVED.targetX, SUN_TARGET[0]), num(SAVED.targetY, SUN_TARGET[1]), num(SAVED.targetZ, SUN_TARGET[2]));
    return node;
  }, []);
  /** translate 기즈모용 (라이트 위치) */
  const posProxy = useMemo(() => new Object3D(), []);
  /** rotate 기즈모용 (타깃에 위치, rotation.y=방위각, rotation.x=-고도) */
  const rotProxy = useMemo(() => {
    const o = new Object3D();
    o.rotation.order = "YXZ";
    o.position.set(num(SAVED.targetX, SUN_TARGET[0]), num(SAVED.targetY, SUN_TARGET[1]), num(SAVED.targetZ, SUN_TARGET[2]));
    return o;
  }, []);

  const tg = useControls(`${FOLDER}.Target`, {
    followCamera: { value: SAVED.followCamera ?? true, label: "☀ 타겟: 카메라 따라가기", hint: "켜면 그림자 범위가 카메라가 보는 지점(OrbitControls target)을 따라다녀 선명해집니다. 끄면 아래 X/Y/Z 고정 타겟 사용." },
    followHalfSize: { value: num(SAVED.followHalfSize, 1000), min: 50, max: 4000, step: 10, label: "☀ 그림자 범위 반경(m)", hint: "최소 반경. 카메라가 멀어지면 자동으로 넓어집니다(카메라 거리×0.9). 따라가기 모드에서 사용." },
    "☀ 타겟 = 현재 카메라 초점": button(() => {
      const t = controlsRef.current?.target;
      if (!t) return;
      setPanelValues("Sun Light", { targetX: +t.x.toFixed(2), targetY: +t.y.toFixed(2), targetZ: +t.z.toFixed(2) });
    }),
    targetX: { value: num(SAVED.targetX, SUN_TARGET[0]), min: -3000, max: 3000, step: 0.5, label: "☀ 타겟 X" },
    targetY: { value: num(SAVED.targetY, SUN_TARGET[1]), min: -500, max: 500, step: 0.1, label: "☀ 타겟 Y" },
    targetZ: { value: num(SAVED.targetZ, SUN_TARGET[2]), min: -3000, max: 3000, step: 0.5, label: "☀ 타겟 Z" },
    targetHandle: { value: false, label: "☀ 타겟 핸들 표시(드래그)", hint: "씬에 타겟 마커+이동 기즈모 표시. 따라가기 모드가 꺼져 있을 때 드래그로 이동." },
  });
  const controlsRef = useRef<{ target?: Vector3 } | null>(null);
  const T = useMemo<[number, number, number]>(() => [tg.targetX, tg.targetY, tg.targetZ], [tg.targetX, tg.targetY, tg.targetZ]);
  const tRef = useRef(T);
  tRef.current = T;
  useEffect(() => {
    saveSun({ targetX: tg.targetX, targetY: tg.targetY, targetZ: tg.targetZ, followCamera: tg.followCamera, followHalfSize: tg.followHalfSize, targetHandle: tg.targetHandle });
  }, [tg.targetX, tg.targetY, tg.targetZ, tg.followCamera, tg.followHalfSize, tg.targetHandle]);

  const [c, set] = useControls(FOLDER, () => ({
    visible: true,
    intensity: { value: SUN_INTENSITY, min: 0, max: 20, step: 0.05 },
    color: `#${new Color(SUN_COLOR).getHexString()}`,
    azimuth: { value: -49.6, min: -180, max: 180, step: 0.01 },
    elevation: { value: SUN_DEFAULT.elevation, min: -10, max: 90, step: 0.01 },
    distance: { value: SUN_DEFAULT.distance, min: 10, max: 20000, step: 0.1 },
    castShadow: SUN_CAST_SHADOW,
    helper: { value: false, label: "helper + handle" },
    handleSize: { value: 0, min: 0, max: 500, step: 1, hint: "0 = auto" },
    shadowCameraHelper: false,
    glow: false,
    gizmoMode: {
      value: "translate",
      options: ["translate", "rotate"],
      onChange: (v: GizmoMode) => setMode(v),
    },
    "Select light": button(() =>
      useShipDebugStore.getState().selectLight(true),
    ),
    "Copy values": button((get) => {
      const az = MathUtils.degToRad(get(`${FOLDER}.azimuth`));
      const el = MathUtils.degToRad(get(`${FOLDER}.elevation`));
      const d = get(`${FOLDER}.distance`);
      const h = Math.cos(el) * d;
      const pos = [
        tRef.current[0] + Math.sin(az) * h,
        tRef.current[1] + Math.sin(el) * d,
        tRef.current[2] + Math.cos(az) * h,
      ].map((n) => +n.toFixed(3));
      const text = [
        `SUN_POSITION = [${pos.join(", ")}]`,
        `SUN_TARGET = [${tRef.current.join(", ")}]`,
        `SUN_INTENSITY = ${get(`${FOLDER}.intensity`)}`,
        `SUN_COLOR = "${get(`${FOLDER}.color`)}"`,
        `azimuth=${get(`${FOLDER}.azimuth`)} elevation=${get(`${FOLDER}.elevation`)} distance=${d}`,
      ].join("\n");
      console.info("[SunLight]\n" + text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
  }));

  const position = useMemo<[number, number, number]>(() => {
    const az = MathUtils.degToRad(c.azimuth);
    const el = MathUtils.degToRad(c.elevation);
    const h = Math.cos(el) * c.distance;
    return [
      T[0] + Math.sin(az) * h,
      T[1] + Math.sin(el) * c.distance,
      T[2] + Math.cos(az) * h,
    ];
  }, [c.azimuth, c.elevation, c.distance, T]);

  // [shadow] target slider -> light.target (target is a scene child via <primitive>, matrices refreshed)
  useEffect(() => {
    if (tg.followCamera) return;
    target.position.set(...T);
    target.updateMatrixWorld();
    rotProxy.position.set(...T);
    const light = lightRef.current;
    if (light) { light.position.set(...position); light.updateMatrixWorld(); light.shadow.needsUpdate = true; }
  }, [T, position, tg.followCamera, target, rotProxy]);

  // [shadow] follow camera target: keep light direction, move target to OrbitControls target, snap to shadow texels (less shimmer)
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls) as { target?: import("three").Vector3 } | null;
  controlsRef.current = controls;
  const tgtProxy = useMemo(() => new Object3D(), []);
  useEffect(() => { if (!tgtDrag.current) tgtProxy.position.set(...T); }, [T, tgtProxy]);
  const tgtDrag = useRef(false);
  const onTargetDrag = () => { const p = tgtProxy.position; setPanelValues("Sun Light", { targetX: +p.x.toFixed(2), targetY: +p.y.toFixed(2), targetZ: +p.z.toFixed(2) }); };
  const offset = useMemo(() => new Vector3(), []);
  const snapped = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const light = lightRef.current;
    if (!light || !tg.followCamera || !controls?.target) return;
    // [pt109u] auto-scale: frustum grows with camera distance so cranes in view never fall off the shadow edge
    const camDist = camera.position.distanceTo(controls.target);
    const half = Math.max(followHalfSize, Math.ceil((camDist * 0.9) / 50) * 50);
    const sc = light.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); light.shadow.needsUpdate = true; }
    const texel = (2 * half) / light.shadow.mapSize.x;
    snapped.copy(controls.target);
    snapped.x = Math.round(snapped.x / texel) * texel;
    snapped.z = Math.round(snapped.z / texel) * texel;
    // [pt109u] was tg.targetY (-62.85): with a low sun the frustum centre then hit the ground ~300 m sunward of the focus,
    // so cranes at the focus sat at/outside the 280 m edge. Centre at the focus height instead (ground ≈ 20 m).
    snapped.y = controls.target.y;
    const moved = !snapped.equals(target.position);
    offset.set(position[0] - T[0], position[1] - T[1], position[2] - T[2]);
    target.position.copy(snapped);
    target.updateMatrixWorld();
    rotProxy.position.copy(snapped);
    light.position.copy(snapped).add(offset);
    light.updateMatrixWorld();
    if (moved) light.shadow.needsUpdate = true;
  });

  // leva → 기즈모 프록시 동기화 (드래그 중에는 기즈모가 주인)
  useEffect(() => {
    if (dragging.current) return;
    posProxy.position.set(...position);
    rotProxy.rotation.set(
      -MathUtils.degToRad(c.elevation),
      MathUtils.degToRad(c.azimuth),
      0,
      "YXZ",
    );
  }, [position, c.azimuth, c.elevation, posProxy, rotProxy]);

  // 단축키 (라이트 선택 시): W 이동, E 회전
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "w" || e.key === "W") set({ gizmoMode: "translate" });
      else if (e.key === "e" || e.key === "E") set({ gizmoMode: "rotate" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, set]);

  // 기즈모 → leva 동기화
  const onTranslate = () => {
    const p = posProxy.position;
    const t0 = tRef.current;
    set(toSpherical(p.x - t0[0], p.y - t0[1], p.z - t0[2]));
  };
  const onRotate = () => {
    const el = MathUtils.clamp(-MathUtils.radToDeg(rotProxy.rotation.x), -10, 90);
    let az = MathUtils.radToDeg(rotProxy.rotation.y);
    az = ((((az + 180) % 360) + 360) % 360) - 180;
    set({ azimuth: +az.toFixed(2), elevation: +el.toFixed(2) });
  };

  // 그림자 카메라 헬퍼
  const shadowHelper = useRef<CameraHelper | null>(null);
  useEffect(() => {
    const light = lightRef.current;
    if (!light || !c.shadowCameraHelper || !c.visible) return;
    const helper = new CameraHelper(light.shadow.camera);
    shadowHelper.current = helper;
    scene.add(helper);
    return () => {
      scene.remove(helper);
      helper.dispose();
      shadowHelper.current = null;
    };
  }, [c.shadowCameraHelper, c.visible, scene]);
  useFrame(() => shadowHelper.current?.update());

  // castShadow 토글 시 섀도맵 갱신 요청만.
  // WebGPURenderer에서는 ShadowNode가 shadow.map(렌더타깃+DepthTexture)을 소유하고 머티리얼이 그 depthTexture를
  // 직접 바인딩하므로, 여기서 dispose/null 하면 삭제된 텍스처를 계속 샘플링한다(WebGL2: bindTexture deleted object).

  const sh = useControls(`${FOLDER}.Shadow`, {
    mapSize: { value: num(SAVED.mapSize, SUN_SHADOW_MAP_SIZE), options: [1024, 2048, 4096, 8192] },
    bias: { value: num(SAVED.bias, -2), min: -50, max: 50, step: 0.1, label: "bias (×1e-4)", hint: "표시값×0.0001 이 실제 shadow.bias. -2 = -0.0002" },
    normalBias: { value: num(SAVED.normalBias, 18), min: 0, max: 50, step: 0.1 },
    radius: { value: num(SAVED.radius, 1.5), min: 0, max: 20, step: 0.1 },
    strength: { value: num(SAVED.strength, 1), min: 0, max: 1, step: 0.01, label: "그림자 진하기", hint: "1=가장 진함. 그림자가 너무 옅으면 Environment HDR 패널의 '환경광 세기'를 낮추세요." },
    halfWidth: { value: num(SAVED.halfWidth, SUN_SHADOW_CAMERA.right), min: 50, max: 8000, step: 10 },
    halfHeight: { value: num(SAVED.halfHeight, SUN_SHADOW_CAMERA.top), min: 50, max: 8000, step: 10 },
    near: { value: num(SAVED.near, SUN_SHADOW_CAMERA.near), min: 0.1, max: 1000, step: 0.1 },
    far: { value: num(SAVED.far, 10000), min: 100, max: 30000, step: 10 },
    devOverride: { value: false, label: "개발 오버라이드", hint: "켜면 castShadow / mapSize / 반경을 이 패널 값으로 사용 (헤더 그림자 설정 무시). 개발 모드 전용." },
  }, { collapsed: true });

  // [shadow] 사용자 프리셋(헤더 Graphics settings)이 leva / tp.sunShadow.v3 보다 우선. leva 는 개발 전용 오버라이드.
  // 그림자 갱신은 기존처럼 매 프레임(shadow.autoUpdate=true): 움직이는 배/크레인 그림자가 멈추지 않도록 보수적으로 유지.
  const shadowQuality = useViewportSettingsStore((st) => st.shadowQuality);
  const devOverride = import.meta.env.DEV && sh.devOverride;
  const preset = shadowQuality === "off" ? null : SHADOW_PRESET[shadowQuality];
  const castShadow = devOverride ? c.castShadow : preset !== null;
  const mapSize = devOverride ? Number(sh.mapSize) : (preset?.mapSize ?? SHADOW_PRESET.low.mapSize);
  const followHalfSize = devOverride ? tg.followHalfSize : (preset?.followHalfSize ?? tg.followHalfSize);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.shadow.needsUpdate = true;
  }, [castShadow]);

  // 품질 변경 시 셰이더 워밍업 (castShadow 토글은 리시버 머티리얼 재컴파일을 유발). 최초 마운트는 건너뜀.
  const gl = useThree((st) => st.gl);
  const warmed = useRef(false);
  useEffect(() => {
    if (!warmed.current) {
      warmed.current = true;
      return;
    }
    const id = requestAnimationFrame(() => {
      const r = gl as unknown as { compileAsync?: (o: Object3D, cam: Camera) => Promise<unknown> };
      void r.compileAsync?.(scene, camera)?.catch(() => undefined);
    });
    return () => cancelAnimationFrame(id);
  }, [castShadow, mapSize, gl, scene, camera]);

  // 그림자 카메라/맵 변경 반영
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    saveSun({ mapSize: Number(sh.mapSize), bias: sh.bias, normalBias: sh.normalBias, radius: sh.radius, strength: sh.strength, halfWidth: sh.halfWidth, halfHeight: sh.halfHeight, near: sh.near, far: sh.far });
    const cam = light.shadow.camera;
    // follow mode: tight square frustum around the look-at point (much higher texel density)
    const hw = tg.followCamera ? followHalfSize : sh.halfWidth;
    const hh = tg.followCamera ? followHalfSize : sh.halfHeight;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    cam.near = sh.near;
    cam.far = sh.far;
    cam.updateProjectionMatrix();
    light.shadow.bias = sh.bias * 1e-4;
    light.shadow.normalBias = sh.normalBias;
    light.shadow.radius = sh.radius;
    light.shadow.intensity = sh.strength;
    const ms = mapSize;
    if (light.shadow.mapSize.x !== ms) {
      // ShadowNode가 매 업데이트마다 mapSize로 shadowMap.setSize() 하므로 dispose 불필요
      light.shadow.mapSize.set(ms, ms);
    }
    light.shadow.needsUpdate = true;
  }, [sh, tg.followCamera, followHalfSize, mapSize]);

  const handleRadius = c.handleSize > 0 ? c.handleSize : Math.max(3, c.distance * 0.02);
  const showHandle = c.helper && c.visible;

  const onHandleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // [twin-port] 드래그 후 놓은 경우는 선택 안 함
    e.stopPropagation();
    useShipDebugStore.getState().selectLight(true);
  };

  return (
    <>
      {/* TEMP: 디버그 UI 비활성화 — 타깃 기즈모 off (복원: false && 제거) */}
      {false && tg.targetHandle && (
        <>
          <primitive object={tgtProxy}>
            <mesh renderOrder={999}>
              <sphereGeometry args={[4, 16, 12]} />
              <meshBasicMaterial color="#ff3366" toneMapped={false} depthTest={false} transparent opacity={0.9} />
            </mesh>
          </primitive>
          <TransformControls object={tgtProxy} mode="translate" space="world" onMouseDown={() => (tgtDrag.current = true)} onMouseUp={() => (tgtDrag.current = false)} onObjectChange={onTargetDrag} />
        </>
      )}
      <primitive object={target}>{c.glow && <SunGlow />}</primitive>
      <directionalLight
        ref={lightRef}
        visible={c.visible}
        position={position}
        target={target}
        intensity={c.intensity}
        color={c.color}
        castShadow={castShadow}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={sh.bias * 1e-4}
        shadow-normalBias={sh.normalBias}
        shadow-radius={sh.radius}
        shadow-blurSamples={SUN_SHADOW_BLUR_SAMPLES}
        shadow-camera-near={sh.near}
        shadow-camera-far={sh.far}
        shadow-camera-left={-(tg.followCamera ? followHalfSize : sh.halfWidth)}
        shadow-camera-right={tg.followCamera ? followHalfSize : sh.halfWidth}
        shadow-camera-top={tg.followCamera ? followHalfSize : sh.halfHeight}
        shadow-camera-bottom={-(tg.followCamera ? followHalfSize : sh.halfHeight)}
      >
        {showHandle && (
          <Helper type={DirectionalLightHelper} args={[handleRadius * 2, "orange"]} />
        )}
      </directionalLight>

      {/* 클릭 가능한 라이트 핸들 (라이트는 지오메트리가 없음) */}
      {showHandle && (
        <mesh
          position={position}
          onClick={onHandleClick}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
          renderOrder={999}
        >
          <sphereGeometry args={[handleRadius, 16, 12]} />
          <meshBasicMaterial
            color={selected ? "#ffee55" : "#ffaa00"}
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {selected && (
        <>
          <primitive object={posProxy} />
          <primitive object={rotProxy} />
          <TransformControls
            key={mode}
            object={mode === "translate" ? posProxy : rotProxy}
            mode={mode}
            space={mode === "rotate" ? "local" : "world"}
            showZ={mode === "translate"}
            onMouseDown={() => (dragging.current = true)}
            onMouseUp={() => (dragging.current = false)}
            onObjectChange={mode === "translate" ? onTranslate : onRotate}
          />
        </>
      )}
    </>
  );
}
