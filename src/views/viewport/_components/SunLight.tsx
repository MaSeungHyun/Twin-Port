import { Helper, TransformControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { button, useControls } from "@/debug/controls";
import {
  SUN_CAST_SHADOW,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
  SUN_SHADOW_BIAS,
  SUN_SHADOW_BLUR_SAMPLES,
  SUN_SHADOW_CAMERA,
  SUN_SHADOW_MAP_SIZE,
  SUN_SHADOW_NORMAL_BIAS,
  SUN_SHADOW_RADIUS,
  SUN_TARGET,
} from "@/constants/sunLight";
import { useShipDebugStore } from "@/stores/shipDebug";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CameraHelper,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  MathUtils,
  Object3D,
} from "three";
import SunGlow from "./SunGlow";

const FOLDER = "Directional Light";

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
    node.position.set(...SUN_TARGET);
    return node;
  }, []);
  /** translate 기즈모용 (라이트 위치) */
  const posProxy = useMemo(() => new Object3D(), []);
  /** rotate 기즈모용 (타깃에 위치, rotation.y=방위각, rotation.x=-고도) */
  const rotProxy = useMemo(() => {
    const o = new Object3D();
    o.rotation.order = "YXZ";
    o.position.set(...SUN_TARGET);
    return o;
  }, []);

  const [c, set] = useControls(FOLDER, () => ({
    visible: true,
    intensity: { value: SUN_INTENSITY, min: 0, max: 20, step: 0.05 },
    color: `#${new Color(SUN_COLOR).getHexString()}`,
    azimuth: { value: SUN_DEFAULT.azimuth, min: -180, max: 180, step: 0.01 },
    elevation: { value: SUN_DEFAULT.elevation, min: -10, max: 90, step: 0.01 },
    distance: { value: SUN_DEFAULT.distance, min: 10, max: 20000, step: 0.1 },
    castShadow: SUN_CAST_SHADOW,
    helper: { value: import.meta.env.DEV, label: "helper + handle" },
    handleSize: { value: 0, min: 0, max: 500, step: 1, hint: "0 = auto" },
    shadowCameraHelper: false,
    glow: true,
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
        SUN_TARGET[0] + Math.sin(az) * h,
        SUN_TARGET[1] + Math.sin(el) * d,
        SUN_TARGET[2] + Math.cos(az) * h,
      ].map((n) => +n.toFixed(3));
      const text = [
        `SUN_POSITION = [${pos.join(", ")}]`,
        `SUN_TARGET = [${SUN_TARGET.join(", ")}]`,
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
      SUN_TARGET[0] + Math.sin(az) * h,
      SUN_TARGET[1] + Math.sin(el) * c.distance,
      SUN_TARGET[2] + Math.cos(az) * h,
    ];
  }, [c.azimuth, c.elevation, c.distance]);

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
    set(toSpherical(p.x - SUN_TARGET[0], p.y - SUN_TARGET[1], p.z - SUN_TARGET[2]));
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
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.shadow.needsUpdate = true;
  }, [c.castShadow]);

  const sh = useControls(`${FOLDER}.Shadow`, {
    mapSize: { value: SUN_SHADOW_MAP_SIZE, options: [1024, 2048, 4096, 8192] },
    bias: { value: SUN_SHADOW_BIAS, min: -0.005, max: 0.005, step: 0.00001 },
    normalBias: { value: SUN_SHADOW_NORMAL_BIAS, min: 0, max: 20, step: 0.01 },
    radius: { value: SUN_SHADOW_RADIUS, min: 0, max: 20, step: 0.1 },
    halfWidth: { value: SUN_SHADOW_CAMERA.right, min: 50, max: 8000, step: 10 },
    halfHeight: { value: SUN_SHADOW_CAMERA.top, min: 50, max: 8000, step: 10 },
    near: { value: SUN_SHADOW_CAMERA.near, min: 0.1, max: 1000, step: 0.1 },
    far: { value: SUN_SHADOW_CAMERA.far, min: 100, max: 30000, step: 10 },
  }, { collapsed: true });

  // 그림자 카메라/맵 변경 반영
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -sh.halfWidth;
    cam.right = sh.halfWidth;
    cam.top = sh.halfHeight;
    cam.bottom = -sh.halfHeight;
    cam.near = sh.near;
    cam.far = sh.far;
    cam.updateProjectionMatrix();
    light.shadow.bias = sh.bias;
    light.shadow.normalBias = sh.normalBias;
    light.shadow.radius = sh.radius;
    if (light.shadow.mapSize.x !== sh.mapSize) {
      // ShadowNode가 매 업데이트마다 mapSize로 shadowMap.setSize() 하므로 dispose 불필요
      light.shadow.mapSize.set(sh.mapSize, sh.mapSize);
    }
    light.shadow.needsUpdate = true;
  }, [sh]);

  const handleRadius = c.handleSize > 0 ? c.handleSize : Math.max(3, c.distance * 0.02);
  const showHandle = c.helper && c.visible;

  const onHandleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // [twin-port] 드래그 후 놓은 경우는 선택 안 함
    e.stopPropagation();
    useShipDebugStore.getState().selectLight(true);
  };

  return (
    <>
      <primitive object={target}>{c.glow && <SunGlow />}</primitive>
      <directionalLight
        ref={lightRef}
        visible={c.visible}
        position={position}
        target={target}
        intensity={c.intensity}
        color={c.color}
        castShadow={c.castShadow}
        shadow-mapSize={[sh.mapSize, sh.mapSize]}
        shadow-bias={sh.bias}
        shadow-normalBias={sh.normalBias}
        shadow-radius={sh.radius}
        shadow-blurSamples={SUN_SHADOW_BLUR_SAMPLES}
        shadow-camera-near={sh.near}
        shadow-camera-far={sh.far}
        shadow-camera-left={-sh.halfWidth}
        shadow-camera-right={sh.halfWidth}
        shadow-camera-top={sh.halfHeight}
        shadow-camera-bottom={-sh.halfHeight}
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
