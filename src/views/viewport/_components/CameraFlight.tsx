import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { type Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_FLIGHT_DURATION,
  CONTAINER_FOCUS_DISTANCE,
  CONTAINER_FOCUS_HEIGHT,
  CRANE_FOCUS_DISTANCE,
  CRANE_FOCUS_HEIGHT,
  SHIP_FOCUS_DISTANCE,
  SHIP_FOCUS_HEIGHT,
} from "@/constants/camera";
import {
  getCraneFocusTarget,
  getShipFocusTarget,
} from "@/domain/cameraFocus";
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

type FocusProfile = {
  distance: number;
  height: number;
  /** radial: 야드 중심 방향 — 줌/현재 시점과 무관하게 동일 bearing */
  bearing?: "camera" | "radial";
};

function setControlsEnabled(
  controlsRef: RefObject<OrbitControlsImpl | null>,
  enabled: boolean,
) {
  const controls = controlsRef.current;
  if (controls) controls.enabled = enabled;
}

function focusCameraPosition(
  target: Vector3,
  currentCameraPos: Vector3,
  profile: FocusProfile,
) {
  if (profile.bearing === "radial") {
    const bearing = new Vector3(target.x, 0, target.z);
    if (bearing.lengthSq() < 1e-4) {
      bearing.set(1, 0, 0);
    } else {
      bearing.normalize();
    }
    const offset = bearing.multiplyScalar(profile.distance);
    offset.y = profile.height;
    return target.clone().add(offset);
  }

  const offset = currentCameraPos.clone().sub(target);
  if (offset.lengthSq() < 1e-4) {
    offset.set(1, 0.6, 1);
  }
  offset.y = 0;
  if (offset.lengthSq() < 1e-4) {
    offset.set(1, 0, 1);
  }
  offset.normalize().multiplyScalar(profile.distance);
  offset.y = profile.height;
  return target.clone().add(offset);
}

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

function resolveFocusTarget(
  selectedContainerId: string | null,
  selectedShipKey: string | null,
  selectedCraneIndex: number | null,
): { target: Vector3; profile: FocusProfile } | null {
  if (selectedContainerId) {
    const { blocks, containers, deckY, yardOffset } = useYardStore.getState();
    const container = containers.find((item) => item.id === selectedContainerId);
    if (!container) return null;

    const block = blocks.find((item) => item.code === container.location.block);
    if (!block) return null;

    const grid = getBlockSlotGrid(block);
    return {
      target: getContainerWorldPosition(
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
      ),
      profile: {
        distance: CONTAINER_FOCUS_DISTANCE,
        height: CONTAINER_FOCUS_HEIGHT,
      },
    };
  }

  if (selectedShipKey) {
    const target = getShipFocusTarget(selectedShipKey);
    if (!target) return null;
    return {
      target,
      profile: { distance: SHIP_FOCUS_DISTANCE, height: SHIP_FOCUS_HEIGHT },
    };
  }

  if (selectedCraneIndex != null) {
    const target = getCraneFocusTarget(selectedCraneIndex);
    if (!target) return null;
    return {
      target,
      profile: {
        distance: CRANE_FOCUS_DISTANCE,
        height: CRANE_FOCUS_HEIGHT,
        bearing: "radial",
      },
    };
  }

  return null;
}

export default function CameraFlight({ controlsRef }: CameraFlightProps) {
  const camera = useThree((state) => state.camera);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const selectedShipKey = useViewportStore((s) => s.selectedShipKey);
  const selectedCraneIndex = useViewportStore((s) => s.selectedCraneIndex);
  const focusNonce = useViewportStore((s) => s.focusNonce);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  const prevMonitorModeRef = useRef<boolean | null>(null);
  const prevFocusNonceRef = useRef(0);

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
      setControlsEnabled(controlsRef, false);
      return;
    }

    setControlsEnabled(controlsRef, true);
  }, [monitorMode, controlsRef, camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (focusNonce === prevFocusNonceRef.current) return;
    prevFocusNonceRef.current = focusNonce;

    const resolved = resolveFocusTarget(
      selectedContainerId,
      selectedShipKey,
      selectedCraneIndex,
    );
    if (!resolved) return;

    const { target: toTarget, profile } = resolved;
    const toPosition = focusCameraPosition(toTarget, camera.position, profile);

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
  }, [
    selectedContainerId,
    selectedShipKey,
    selectedCraneIndex,
    focusNonce,
    controlsRef,
    camera,
  ]);

  return null;
}
