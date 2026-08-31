import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_FLIGHT_DURATION,
  CONTAINER_TRACKING_FOCUS_DISTANCE,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  TRACKING_FOCUS_DISTANCE,
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

function setControlsEnabled(
  controlsRef: RefObject<OrbitControlsImpl | null>,
  enabled: boolean,
) {
  const controls = controlsRef.current;
  if (controls) controls.enabled = enabled;
}

/** 현재 카메라→대상 방향 유지, 대상 기준 거리만 맞춤 */
function focusCameraPosition(
  target: Vector3,
  currentCameraPos: Vector3,
  distance: number,
) {
  const offset = currentCameraPos.clone().sub(target);
  if (offset.lengthSq() < 1e-4) {
    offset.set(1, 0.6, 1);
  }
  offset.normalize().multiplyScalar(distance);
  return target.clone().add(offset);
}

function animateLookAtFlight(options: {
  camera: { position: Vector3 };
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

  controls.enabled = false;

  const timeline = gsap.timeline({
    onUpdate: () => {
      controls.target.set(targetProxy.x, targetProxy.y, targetProxy.z);
      controls.update();
    },
    onComplete: () => {
      camera.position.copy(toPosition);
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

function resolveTrackingTarget(
  selectedContainerId: string | null,
  selectedShipKey: string | null,
  selectedCraneIndex: number | null,
): Vector3 | null {
  if (selectedContainerId) {
    const { blocks, containers, deckY, yardOffset } = useYardStore.getState();
    const container = containers.find((item) => item.id === selectedContainerId);
    if (!container) return null;

    const block = blocks.find((item) => item.code === container.location.block);
    if (!block) return null;

    const grid = getBlockSlotGrid(block);
    return getContainerWorldPosition(
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
  }

  if (selectedShipKey) {
    return getShipFocusTarget(selectedShipKey);
  }

  if (selectedCraneIndex != null) {
    return getCraneFocusTarget(selectedCraneIndex);
  }

  return null;
}

function resolveTrackingFocusDistance(
  selectedContainerId: string | null,
): number {
  if (selectedContainerId) return CONTAINER_TRACKING_FOCUS_DISTANCE;
  return TRACKING_FOCUS_DISTANCE;
}

export default function CameraFlight({ controlsRef }: CameraFlightProps) {
  const camera = useThree((state) => state.camera);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const selectedShipKey = useViewportStore((s) => s.selectedShipKey);
  const selectedCraneIndex = useViewportStore((s) => s.selectedCraneIndex);
  const focusNonce = useViewportStore((s) => s.focusNonce);
  const quayCranes = useYardStore((s) => s.quayCranes);
  const ships = useYardStore((s) => s.ships);
  const blocks = useYardStore((s) => s.blocks);
  const tweenRef = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);
  const preTrackingCameraRef = useRef<Vector3 | null>(null);
  const prevMonitorModeRef = useRef<boolean | null>(null);
  const prevYardDataRef = useRef({ quayCranes, ships, blocks });
  const prevSelectionRef = useRef({
    selectedContainerId: null as string | null,
    selectedShipKey: null as string | null,
    selectedCraneIndex: null as number | null,
    focusNonce: 0,
  });

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

    const prev = prevSelectionRef.current;
    const prevYard = prevYardDataRef.current;
    const selectionChanged =
      prev.selectedContainerId !== selectedContainerId ||
      prev.selectedShipKey !== selectedShipKey ||
      prev.selectedCraneIndex !== selectedCraneIndex;
    const focusRetrigger = prev.focusNonce !== focusNonce;
    const trackingDataUpdated =
      (selectedCraneIndex != null && prevYard.quayCranes !== quayCranes) ||
      (selectedShipKey != null && prevYard.ships !== ships) ||
      (selectedContainerId != null && prevYard.blocks !== blocks);
    prevYardDataRef.current = { quayCranes, ships, blocks };

    prevSelectionRef.current = {
      selectedContainerId,
      selectedShipKey,
      selectedCraneIndex,
      focusNonce,
    };

    if (!selectionChanged && !focusRetrigger && !trackingDataUpdated) return;

    const wasTracking =
      prev.selectedContainerId != null ||
      prev.selectedShipKey != null ||
      prev.selectedCraneIndex != null;
    const isTracking =
      selectedContainerId != null ||
      selectedShipKey != null ||
      selectedCraneIndex != null;

    const toTarget = resolveTrackingTarget(
      selectedContainerId,
      selectedShipKey,
      selectedCraneIndex,
    );

    tweenRef.current?.kill();

    if (toTarget && isTracking) {
      if (!wasTracking) {
        preTrackingCameraRef.current = camera.position.clone();
      }

      const toPosition = focusCameraPosition(
        toTarget,
        camera.position,
        resolveTrackingFocusDistance(selectedContainerId),
      );
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
    }

    if (wasTracking && !isTracking) {
      const toPosition =
        preTrackingCameraRef.current?.clone() ?? INITIAL_CAMERA_POSITION.clone();
      preTrackingCameraRef.current = null;

      const timeline = animateLookAtFlight({
        camera,
        controls,
        toPosition,
        toTarget: INITIAL_CAMERA_TARGET.clone(),
      });
      tweenRef.current = timeline;

      return () => {
        timeline.kill();
        setControlsEnabled(controlsRef, true);
      };
    }
  }, [
    selectedContainerId,
    selectedShipKey,
    selectedCraneIndex,
    focusNonce,
    quayCranes,
    ships,
    blocks,
    controlsRef,
    camera,
  ]);

  useFrame(() => {
    if (tweenRef.current?.isActive()) return;

    const isTracking =
      selectedContainerId != null ||
      selectedShipKey != null ||
      selectedCraneIndex != null;
    if (!isTracking) return;

    const controls = controlsRef.current;
    if (!controls) return;

    const target = resolveTrackingTarget(
      selectedContainerId,
      selectedShipKey,
      selectedCraneIndex,
    );
    if (!target) return;

    if (controls.target.distanceToSquared(target) > 1e-6) {
      controls.target.copy(target);
    }
  });

  return null;
}
