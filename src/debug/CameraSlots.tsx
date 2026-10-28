import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useViewportStore } from "@/stores/viewport";
import {
  CAMERA_INTRO_DURATION,
  CAMERA_INTRO_ENABLED,
  CAMERA_INTRO_SLOT1,
  CAMERA_INTRO_SLOT2,
  CAMERA_INTRO_START_EVENT,
} from "@/constants/cameraIntro";

/**
 * [camslots] Camera position + OrbitControls target slots, saved to a cookie (and localStorage).
 * Shift+1..4 save slot, 1..4 recall (smooth), Shift+0 save Home, 0 recall Home. Home is applied on load.
 * Ignored while typing in inputs/textareas/contenteditable.
 */
type Slot = { p: [number, number, number]; t: [number, number, number] };
type Slots = Record<string, Slot>;
const KEY = "tp_cam_slots";

function readSlots(): Slots {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + KEY + "=([^;]*)"));
    if (m) return JSON.parse(decodeURIComponent(m[1]!)) as Slots;
  } catch { /* ignore */ }
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Slots; } catch { return {}; }
}
function writeSlots(s: Slots) {
  const v = JSON.stringify(s);
  try { document.cookie = `${KEY}=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
}
const r3 = (v: Vector3): [number, number, number] => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName));
};

const DURATION = 0.8;
/** [camintro] stored slot first, then code constant */
const introSlot = (id: "1" | "2"): Slot | null => (id === "1" ? CAMERA_INTRO_SLOT1 : CAMERA_INTRO_SLOT2) ?? readSlots()[id] ?? null; // [pt125u] hard-coded intro wins
const fmt = (v: [number, number, number]) => `[${v.join(", ")}]`;
const slotTs = (s: Slot | undefined) => (s ? `{ p: ${fmt(s.p)}, t: ${fmt(s.t)} }` : "null");

export default function CameraSlots() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const anim = useRef<{ fp: Vector3; ft: Vector3; tp: Vector3; tt: Vector3; t: number; d: number; done?: () => void } | null>(null);
  const homeDone = useRef(0);
  const intro1 = useRef<Slot | null>(null);

  const save = (id: string) => {
    if (!controls) return;
    const s = readSlots();
    s[id] = { p: r3(camera.position), t: r3(controls.target) };
    writeSlots(s);
    console.info(`[camslots] saved ${id}`, s[id]);
  };
  const recall = (id: string, instant = false, slotOverride?: Slot | null, duration = DURATION) => {
    const slot = slotOverride ?? readSlots()[id];
    if (!slot || !controls) return false;
    const tp = new Vector3(...slot.p), tt = new Vector3(...slot.t);
    if (instant) {
      camera.position.copy(tp); controls.target.copy(tt); controls.update(); anim.current = null;
    } else {
      const prevDone = anim.current?.done;
      anim.current = { fp: camera.position.clone(), ft: controls.target.clone(), tp, tt, t: 0, d: duration, done: prevDone };
    }
    return true;
  };
  const saveRef = useRef(save); saveRef.current = save;
  const recallRef = useRef(recall); recallRef.current = recall;

  // [pt121u] Camera Slots panel removed. Keyboard (Shift+1..4 save, 1..4 go, Shift+0/0 Home) still works.
  // Copy slots 1/2 as a TS snippet from the console: window.__copyCamSlots()
  useEffect(() => {
    const w = window as unknown as { __copyCamSlots?: () => string };
    w.__copyCamSlots = () => {
      const s = readSlots();
      const ts = `export const CAMERA_INTRO_SLOT1: CameraSlotValue | null = ${slotTs(s["1"])};\nexport const CAMERA_INTRO_SLOT2: CameraSlotValue | null = ${slotTs(s["2"])};\n`;
      void navigator.clipboard?.writeText(ts).catch(() => undefined);
      console.info("[camslots] code snippet (copied)\n" + ts);
      return ts;
    };
    return () => { delete w.__copyCamSlots; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
      const m = /^(?:Digit|Numpad)([0-4])$/.exec(e.code);
      if (!m) return;
      const id = m[1] === "0" ? "home" : m[1]!;
      e.preventDefault();
      if (e.shiftKey) saveRef.current(id);
      else recallRef.current(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // [camintro] Monitoring Mode (header button) on → slot 2, off → back to slot 1. Tween drives camera+target together.
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const prevMonitor = useRef(monitorMode);
  useEffect(() => {
    if (prevMonitor.current === monitorMode) return;
    prevMonitor.current = monitorMode;
    if (!CAMERA_INTRO_ENABLED) return;
    const slot = introSlot(monitorMode ? "2" : "1");
    if (slot) recallRef.current(monitorMode ? "2" : "1", false, slot, CAMERA_INTRO_DURATION);
  }, [monitorMode]);

  // [camintro] "관제 시작" overlay → slot 2 (independent of monitorMode; a newer flight simply replaces a running one)
  useEffect(() => {
    const go = () => {
      const slot = CAMERA_INTRO_ENABLED ? introSlot("2") : null;
      const ready = () => useViewportStore.getState().setInteractionReady(true);
      if (slot && recallRef.current("2", false, slot, CAMERA_INTRO_DURATION) && anim.current) anim.current.done = ready;
      else ready(); // no slot 2 → enable immediately
    };
    window.addEventListener(CAMERA_INTRO_START_EVENT, go);
    return () => window.removeEventListener(CAMERA_INTRO_START_EVENT, go);
  }, []);

  // [hovergate] R3F pointer events (hover outline/tooltips/cursor/click select) disabled until interactionReady.
  // events.enabled=false → R3F skips raycasting entirely. OrbitControls / TransformControls / DOM debug UI are unaffected.
  const setEvents = useThree((s) => s.setEvents);
  const interactionReady = useViewportStore((s) => s.interactionReady);
  useEffect(() => {
    setEvents({ enabled: interactionReady });
    if (!interactionReady) document.body.style.cursor = "";
  }, [interactionReady, setEvents]);

  useFrame((_, dt) => {
    // apply Home once after the GLB view camera has been applied (Ground layout effect)
    // [camintro] precedence on load: slot 1 (stored → constant) > Home slot > GLB view camera.
    // Slot 1 is forced on EVERY frame from the very first one (priority -2 = before render) through frame 30,
    // so the GLB view camera (Ground layout effect) is never visible → no load flash.
    if (homeDone.current < 31) {
      const n = ++homeDone.current;
      if (n === 1) intro1.current = CAMERA_INTRO_ENABLED ? introSlot("1") : null;
      const s1 = intro1.current;
      if (s1) {
        camera.position.set(...s1.p);
        if (controls) { controls.target.set(...s1.t); controls.update(); } else camera.lookAt(...s1.t);
      } else if (n === 30 && controls) recallRef.current("home", true);
      if (!controls && n === 30) homeDone.current = 29; // wait for OrbitControls
    }
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / a.d);
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
    camera.position.lerpVectors(a.fp, a.tp, k);
    controls.target.lerpVectors(a.ft, a.tt, k);
    controls.update();
    if (a.t >= 1) { anim.current = null; a.done?.(); }
  }, -2);

  return null;
}
