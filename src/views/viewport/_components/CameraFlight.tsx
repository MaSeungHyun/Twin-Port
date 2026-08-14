import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_FLIGHT_DURATION,
  CONTAINER_FOCUS_DISTANCE,
  CONTAINER_FOCUS_HEIGHT,
  CONTROL_MODE_CAMERA_POSITION,
  CONTROL_MODE_CAMERA_QUATERNION,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
  cameraLookAtTarget,
} from "@/constants/camera";
import { getContainerWorldPosition } from "@/domain/container";
import { getBlockSlotGrid } from "@/constants/block";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";

type CameraFlightProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

type FlightCamera = {
  position: Vector3;
  quaternion: Quaternion;
  lookAt: (v: Vector3) => void;
};

function setControlsEnabled(
  controlsRef: RefObject<OrbitControlsImpl | null>,
  enabled: boolean,
) {
  const controls = controlsRef.current;
  if (controls) controls.enabled = enabled;
}

/**
 * 현재 카메라 방향을 유지한 채 목표 주변을 바라보는 위치 계산
 * (항상 +X+Z에서 접근하면 급격한 yaw 회전이 생김)
 */
function focusCameraPosition(target: Vector3, currentCameraPos: Vector3) {
  const offset = currentCameraPos.clone().sub(target);
  if (offset.lengthSq() < 1e-4) {
    offset.set(1, 0.6, 1);
  }
  offset.y = 0;
  if (offset.lengthSq() < 1e-4) {
    offset.set(1, 0, 1);
  }
  offset.normalize().multiplyScalar(CONTAINER_FOCUS_DISTANCE);
  offset.y = CONTAINER_FOCUS_HEIGHT;
  return target.clone().add(offset);
}

/** position + lookAt 타겟 보간 (컨테이너 포커스용) */
function animateLookAtFlight(options: {
  camera: FlightCamera;
  controls: OrbitControlsImpl;
  toPosition: Vector3;
  toTarget: Vector3;
  duration?: number;
}) {
  const {
    camera,
    controls,
    toPosition,
    toTarget,
    duration = CAMERA_FLIGHT_DURATION,
  } = options;

  const fromTarget = controls.target.clone();
  const targetProxy = { x: fromTarget.x, y: fromTarget.y, z: fromTarget.z };
  const lookAtPoint = new Vector3();

  controls.enabled = false;

  const timeline = gsap.timeline({
    onUpdate: () => {
      lookAtPoint.set(targetProxy.x, targetProxy.y, targetProxy.z);
      camera.lookAt(lookAtPoint);
      controls.target.copy(lookAtPoint);
      controls.update();
    },
    onComplete: () => {
      camera.position.copy(toPosition);
      camera.lookAt(toTarget);
      controls.target.copy(toTarget);
      controls.update();
      controls.enabled = true;
    },
  });

  timeline.to(
    camera.position,
    {
      x: toPosition.x,
      y: toPosition.y,
      z: toPosition.z,
      duration,
      ease: "power2.inOut",
    },
    0,
  );

  timeline.to(
    targetProxy,
    {
      x: toTarget.x,
      y: toTarget.y,
      z: toTarget.z,
      duration,
      ease: "power2.inOut",
    },
    0,
  );

  return timeline;
}

/** position + quaternion slerp (관제모드 탑뷰용) */
function animateQuaternionFlight(options: {
  camera: FlightCamera;
  controls: OrbitControlsImpl;
  toPosition: Vector3;
  toQuaternion: Quaternion;
  duration?: number;
  /** 완료 후 OrbitControls 재활성화 여부 (모니터모드 유지 시 false) */
  restoreControls?: boolean;
}) {
  const {
    camera,
    controls,
    toPosition,
    toQuaternion,
    duration = CAMERA_FLIGHT_DURATION,
    restoreControls = true,
  } = options;

  const fromQuat = camera.quaternion.clone();
  const toQuat = toQuaternion.clone();
  const slerpQuat = new Quaternion();
  const progress = { t: 0 };
  const toTarget = cameraLookAtTarget(toPosition, toQuat);

  controls.enabled = false;

  const timeline = gsap.timeline({
    onUpdate: () => {
      slerpQuat.slerpQuaternions(fromQuat, toQuat, progress.t);
      camera.quaternion.copy(slerpQuat);
      controls.target.copy(
        cameraLookAtTarget(camera.position, camera.quaternion),
      );
    },
    onComplete: () => {
      camera.position.copy(toPosition);
      camera.quaternion.copy(toQuat);
      controls.target.copy(toTarget);
      controls.enabled = restoreControls;
    },
  });

  timeline.to(
    camera.position,
    {
      x: toPosition.x,
      y: toPosition.y,
      z: toPosition.z,
      duration,
      ease: "power2.inOut",
    },
    0,
  );

  timeline.to(
    progress,
    {
      t: 1,
      duration,
      ease: "power2.inOut",
    },
    0,
  );

  return timeline;
}

export default function CameraFlight({ controlsRef }: CameraFlightProps) {
  const camera = useThree((state) => state.camera);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const focusNonce = useViewportStore((s) => s.focusNonce);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  const prevMonitorModeRef = useRef<boolean | null>(null);
  const prevFocusNonceRef = useRef(0);
  const preControlCameraRef = useRef<{
    position: Vector3;
    quaternion: Quaternion;
    target: Vector3;
  } | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (prevMonitorModeRef.current === null) {
      prevMonitorModeRef.current = monitorMode;
      return;
    }
    if (prevMonitorModeRef.current === monitorMode) return;
    prevMonitorModeRef.current = monitorMode;

    tweenRef.current?.kill();

    if (monitorMode) {
      preControlCameraRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        target: controls.target.clone(),
      };

      const timeline = animateQuaternionFlight({
        camera,
        controls,
        toPosition: CONTROL_MODE_CAMERA_POSITION.clone(),
        toQuaternion: CONTROL_MODE_CAMERA_QUATERNION.clone(),
        restoreControls: false,
      });
      tweenRef.current = timeline;

      return () => {
        timeline.kill();
        // 모니터모드 유지 중이면 OrbitControls를 다시 켜지 않음
        if (!useViewportStore.getState().monitorMode) {
          setControlsEnabled(controlsRef, true);
        }
      };
    }

    const restore = preControlCameraRef.current;
    const toPosition =
      restore?.position.clone() ?? INITIAL_CAMERA_POSITION.clone();
    const toQuaternion =
      restore?.quaternion.clone() ?? INITIAL_CAMERA_QUATERNION.clone();
    preControlCameraRef.current = null;

    const timeline = animateQuaternionFlight({
      camera,
      controls,
      toPosition,
      toQuaternion,
      restoreControls: true,
    });
    tweenRef.current = timeline;

    return () => {
      timeline.kill();
      if (!useViewportStore.getState().monitorMode) {
        setControlsEnabled(controlsRef, true);
      }
    };
  }, [monitorMode, controlsRef, camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!selectedContainerId || focusNonce === prevFocusNonceRef.current) {
      return;
    }
    prevFocusNonceRef.current = focusNonce;

    const { blocks, containers, deckY, yardOffset } = useYardStore.getState();
    const container = containers.find(
      (item) => item.id === selectedContainerId,
    );
    if (!container) return;

    const block = blocks.find((item) => item.code === container.location.block);
    if (!block) return;

    const grid = getBlockSlotGrid(block);
    const toTarget = getContainerWorldPosition(
      block.origin,
      Number(container.location.slot.row) - 1,
      Number(container.location.slot.bay) - 1,
      Number(container.location.slot.tier),
      deckY,
      yardOffset,
      block.yaw ?? 0,
      grid.rowPitch,
      grid.bayPitch,
      grid.padX,
      grid.padZ,
    );
    const toPosition = focusCameraPosition(toTarget, camera.position);

    tweenRef.current?.kill();
    const timeline = animateLookAtFlight({
      camera,
      controls,
      toPosition,
      toTarget,
    });
    tweenRef.current = timeline;

    return () => {
      timeline.kill();
      setControlsEnabled(controlsRef, true);
    };
  }, [selectedContainerId, focusNonce, controlsRef, camera]);

  return null;
}
