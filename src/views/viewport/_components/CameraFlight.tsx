import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_FLIGHT_DURATION,
  CONTAINER_FOCUS_DISTANCE,
  CONTAINER_FOCUS_HEIGHT,
} from "@/constants/camera";
import { BLOCK_BY_CODE } from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import { getContainerWorldPosition } from "@/domain/container";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useViewportStore } from "@/stores/viewport";

type CameraFlightProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
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

function animateLookAtFlight(options: {
  camera: { position: Vector3; lookAt: (v: Vector3) => void };
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

export default function CameraFlight({ controlsRef }: CameraFlightProps) {
  const camera = useThree((state) => state.camera);
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const focusNonce = useViewportStore((s) => s.focusNonce);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  const prevModeRef = useRef<boolean | null>(null);
  const prevFocusNonceRef = useRef(0);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (prevModeRef.current === null) {
      prevModeRef.current = occupancyMode;
      return;
    }
    if (prevModeRef.current === occupancyMode) return;
    prevModeRef.current = occupancyMode;

    tweenRef.current?.kill();
  }, [controlsRef, camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!selectedContainerId || focusNonce === prevFocusNonceRef.current) {
      return;
    }
    prevFocusNonceRef.current = focusNonce;

    const container = (mockContainers as Container[]).find(
      (item) => item.id === selectedContainerId,
    );
    if (!container) return;

    const block = BLOCK_BY_CODE[container.location.block];
    if (!block) return;

    const toTarget = getContainerWorldPosition(
      block.origin,
      Number(container.location.slot.row) - 1,
      Number(container.location.slot.bay) - 1,
      Number(container.location.slot.tier),
      DECK_Y,
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
