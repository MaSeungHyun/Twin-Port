import { TransformControls } from "@react-three/drei";
import { button, useControls } from "@/debug/controls";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Object3D } from "three";
import {
  formatShipPose,
  useShipDebugStore,
  type ShipDebugPose,
} from "@/stores/shipDebug";
import type { ShipInstance } from "./Ship";

function poseOf(obj: Object3D): ShipDebugPose {
  return {
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
  };
}

/** 선박 선택 시 TransformControls 기즈모. W=이동, E=회전, Esc=해제 */
export default function ShipGizmo({
  posesRef,
}: {
  posesRef: RefObject<ShipInstance[]>;
}) {
  const selected = useShipDebugStore((s) => s.selected);
  const mode = useShipDebugStore((s) => s.mode);
  const proxy = useMemo(() => new Object3D(), []);
  const ready = useRef(false);

  const [, setPanel] = useControls("Ship", () => ({
    selected: { value: "-", editable: false },
    mode: {
      value: "translate",
      options: ["translate", "rotate"],
      onChange: (v: "translate" | "rotate") =>
        useShipDebugStore.getState().setMode(v),
    },
    pose: { value: "-", editable: false, rows: 2 },
    "Log / Copy pose": button(() => {
      const o = useShipDebugStore.getState().override;
      const pose = o ?? (posesRef.current?.[0] ? toPose(posesRef.current[0]) : null);
      if (!pose) return;
      const text = formatShipPose(pose);
      console.info("[ShipGizmo]", text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    }),
    "Reset (tween 복귀)": button(() =>
      useShipDebugStore.getState().setOverride(null),
    ),
    Deselect: button(() => useShipDebugStore.getState().select(null)),
  }));

  useEffect(() => {
    setPanel({ selected: selected == null ? "-" : `#${selected}`, mode });
  }, [selected, mode, setPanel]);

  // 선택 시 현재 pose를 proxy에 복사
  useEffect(() => {
    ready.current = false;
    if (selected == null) return;
    const ship = posesRef.current?.[selected];
    if (!ship) return;
    proxy.position.set(...ship.position);
    proxy.rotation.set(...(ship.rotation ?? [0, 0, 0]));
    proxy.updateMatrixWorld();
    const pose = poseOf(proxy);
    useShipDebugStore.getState().setOverride(pose);
    setPanel({ pose: formatShipPose(pose) });
    ready.current = true;
  }, [selected, posesRef, proxy, setPanel]);

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = useShipDebugStore.getState();
      if (e.key === "Escape") s.clearSelection();
      else if (s.selected == null) return;
      else if (e.key === "w" || e.key === "W") s.setMode("translate");
      else if (e.key === "e" || e.key === "E") s.setMode("rotate");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (selected == null) return null;

  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        object={proxy}
        mode={mode}
        showX={mode === "translate"}
        showY
        showZ={mode === "translate"}
        onObjectChange={() => {
          if (!ready.current) return;
          const pose = poseOf(proxy);
          useShipDebugStore.getState().setOverride(pose);
          setPanel({ pose: formatShipPose(pose) });
        }}
      />
    </>
  );
}

function toPose(ship: ShipInstance): ShipDebugPose {
  return {
    position: [...ship.position],
    rotation: ship.rotation ? [...ship.rotation] : [0, 0, 0],
  };
}
