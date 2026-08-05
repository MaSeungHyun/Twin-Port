import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_FLIGHT_DURATION,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
  OCCUPANCY_CAMERA_POSITION,
  OCCUPANCY_CAMERA_QUATERNION,
} from "@/constants/camera";
import { useViewportStore } from "@/stores/viewport";

type CameraFlightProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

function syncControlsTarget(
  controls: OrbitControlsImpl,
  position: Vector3,
  quaternion: Quaternion,
) {
  const direction = new Vector3(0, 0, -1).applyQuaternion(quaternion);
  const distance = Math.max(position.y, 1);
  controls.target.copy(position).addScaledVector(direction, distance);
  controls.update();
}

function setControlsEnabled(
  controlsRef: RefObject<OrbitControlsImpl | null>,
  enabled: boolean,
) {
  const controls = controlsRef.current;
  if (controls) controls.enabled = enabled;
}

export default function CameraFlight({ controlsRef }: CameraFlightProps) {
  const camera = useThree((state) => state.camera);
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  const prevModeRef = useRef<boolean | null>(null);

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

    const toPosition = occupancyMode
      ? OCCUPANCY_CAMERA_POSITION
      : INITIAL_CAMERA_POSITION;
    const toQuaternion = occupancyMode
      ? OCCUPANCY_CAMERA_QUATERNION
      : INITIAL_CAMERA_QUATERNION;

    const fromQuaternion = camera.quaternion.clone();
    const proxy = { t: 0 };
    const nextQuaternion = new Quaternion();

    setControlsEnabled(controlsRef, false);

    const timeline = gsap.timeline({
      onComplete: () => {
        camera.position.copy(toPosition);
        camera.quaternion.copy(toQuaternion);
        const orbit = controlsRef.current;
        if (orbit) {
          syncControlsTarget(orbit, toPosition, toQuaternion);
          orbit.enabled = true;
        }
      },
    });

    timeline.to(
      camera.position,
      {
        x: toPosition.x,
        y: toPosition.y,
        z: toPosition.z,
        duration: CAMERA_FLIGHT_DURATION,
        ease: "power2.inOut",
      },
      0,
    );

    timeline.to(
      proxy,
      {
        t: 1,
        duration: CAMERA_FLIGHT_DURATION,
        ease: "power2.inOut",
        onUpdate: () => {
          nextQuaternion.copy(fromQuaternion).slerp(toQuaternion, proxy.t);
          camera.quaternion.copy(nextQuaternion);
        },
      },
      0,
    );

    tweenRef.current = timeline;

    return () => {
      timeline.kill();
      setControlsEnabled(controlsRef, true);
    };
  }, [occupancyMode, controlsRef, camera]);

  return null;
}
