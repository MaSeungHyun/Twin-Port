import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Spherical, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useViewportStore } from "@/stores/viewport";
import {
  CAMERA_PULLBACK_DELAY,
  CAMERA_PULLBACK_DURATION,
  CAMERA_PULLBACK_EVENT,
  CAMERA_INTRO_ENABLED,
  CAMERA_INTRO_SLOT1,
  CAMERA_INTRO_SLOT2,
  CAMERA_INTRO_START_EVENT,
} from "@/constants/cameraIntro";
import { AREA_CAM_MOVE_DURATION, CAM_SLOT_NOTICE_BOTTOM_PX, CAM_SLOT_NOTICE_MS, DEPTH_EXIT_WHEEL_WINDOW_MS, DEPTH_EXIT_ZOOM_FACTOR, CAMERA_FLY_TO_EVENT, type CameraFlyToDetail } from "@/constants/areaCam";
import { useCameraDepthStore } from "@/stores/cameraDepth";
import { FAILURE_FOCUS_EVENT, type FailureFocusDetail } from "@/constants/failureScenario";
import { focusEquipment } from "@/domain/failureScenario";
import { useShipDebugStore } from "@/stores/shipDebug";

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

const _sph = new Spherical();

/** [camslots] Shift+숫자 저장 알림 — 화면 하단 가운데(breadcrumb 위) 잠깐 표시 후 페이드 (토스트 아님) */
let noticeEl: HTMLDivElement | null = null;
let noticeTimer = 0;
function showCamNotice(text: string) {
  if (!noticeEl) {
    noticeEl = document.createElement("div");
    Object.assign(noticeEl.style, {
      position: "fixed", left: "50%", bottom: `${CAM_SLOT_NOTICE_BOTTOM_PX}px`, transform: "translateX(-50%)",
      zIndex: "170", pointerEvents: "none", padding: "6px 16px", borderRadius: "8px",
      border: "2px solid rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.5)", color: "#fff",
      fontSize: "16px", whiteSpace: "nowrap", transition: "opacity 300ms ease", opacity: "0",
    });
    document.body.appendChild(noticeEl);
  }
  noticeEl.textContent = text;
  noticeEl.style.opacity = "1";
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { if (noticeEl) noticeEl.style.opacity = "0"; }, CAM_SLOT_NOTICE_MS);
}

export default function CameraSlots() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const anim = useRef<{ fp: Vector3; ft: Vector3; tp: Vector3; tt: Vector3; t: number; d: number; done?: () => void; arc?: { from: Spherical; to: Spherical } } | null>(null);
  const homeDone = useRef(0);
  const intro1 = useRef<Slot | null>(null);
  /** [pullback-skip] 관제 시작 후 사용자가 카메라를 직접 움직였으면 pullback 생략 */
  const userMovedRef = useRef(false);
  /** [depth] 현재 Depth 진입 시 카메라-타깃 거리 / 마지막 휠 아웃 시각 */
  const depthDistRef = useRef(0);
  const wheelOutAtRef = useRef(0);
  const gl = useThree((s) => s.gl);

  const save = (id: string) => {
    if (!controls) return;
    const s = readSlots();
    s[id] = { p: r3(camera.position), t: r3(controls.target) };
    writeSlots(s);
    console.info(`[camslots] saved ${id}`, s[id]);
  };
  const recall = (id: string, instant = false, slotOverride?: Slot | null, duration = DURATION, arc = false) => {
    const slot = slotOverride ?? readSlots()[id];
    if (!slot || !controls) return false;
    const tp = new Vector3(...slot.p), tt = new Vector3(...slot.t);
    if (instant) {
      camera.position.copy(tp); controls.target.copy(tt); controls.update(); anim.current = null;
    } else {
      const prevDone = anim.current?.done;
      const fp = camera.position.clone(), ft = controls.target.clone();
      let arcSph: { from: Spherical; to: Spherical } | undefined;
      if (arc) {
        // [pullback] 타깃 기준 구면좌표(거리·방위각·극각)를 한 easing으로 같이 보간 → 빠지면서 동시에 회전
        const from = new Spherical().setFromVector3(fp.clone().sub(ft));
        const to = new Spherical().setFromVector3(tp.clone().sub(tt));
        let dTheta = to.theta - from.theta;
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)); // 짧은 쪽으로 회전
        to.theta = from.theta + dTheta;
        arcSph = { from, to };
      }
      anim.current = { fp, ft, tp, tt, t: 0, d: duration, done: prevDone, arc: arcSph };
    }
    return true;
  };
  const saveRef = useRef(save); saveRef.current = save;
  const recallRef = useRef(recall); recallRef.current = recall;
  // [home] R → 관제 시작/출항 pullback 이 끝나는 시점(intro slot 2). Depth 비우고 Tracking 해제
  const goHome = () => {
    const home = introSlot("2") ?? readSlots()["home"];
    if (!home) return;
    userMovedRef.current = true; // 이후 pullback 생략
    depthDistRef.current = 0;
    useCameraDepthStore.setState({ stack: [] });
    const v = useViewportStore.getState();
    if (v.alarmFollow || v.selectedContainerId != null || v.selectedShipKey != null || v.selectedCraneIndex != null || v.selectedOverheadCraneIndex != null)
      useViewportStore.setState({ alarmFollow: null, selectedContainerId: null, selectedShipKey: null, selectedCraneIndex: null, selectedOverheadCraneIndex: null, skipReturnFlight: true });
    recallRef.current("home", false, home, AREA_CAM_MOVE_DURATION);
  };
  const goHomeRef = useRef(goHome); goHomeRef.current = goHome;

  // [pt121u] Camera Slots panel removed. Keyboard: Shift+0..9 save, 0..9 go, R = home(intro slot 2).
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
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || isTyping(e.target)) return;
      if (e.code === "KeyR" && !e.shiftKey) {
        e.preventDefault();
        goHomeRef.current();
        return;
      }
      // e.code 사용 (Shift 가 e.key 를 바꿈)
      const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
      if (!m) return;
      const id = m[1]!;
      e.preventDefault();
      if (e.shiftKey) {
        saveRef.current(id);
        showCamNotice(`카메라 ${id}번 저장됨`);
      } else recallRef.current(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // [camintro] Monitoring Mode toggle intentionally does NOT move the camera (user request): camera stays where it is.

  // [camintro] "관제 시작" → camera stays where it is (interaction enabled immediately).
  // [pullback] 지정 배(CAMERA_PULLBACK_SHIP_INDEX) 출항 시작 이벤트 → DELAY 후 slot 2로 DURATION 동안 서서히 빠짐
  useEffect(() => {
    const start = () => useViewportStore.getState().setInteractionReady(true);
    let timer = 0;
    const pull = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (userMovedRef.current) return; // [pullback-skip]
        const slot = CAMERA_INTRO_ENABLED ? introSlot("2") : null;
        if (slot) recallRef.current("2", false, slot, CAMERA_PULLBACK_DURATION, true);
      }, CAMERA_PULLBACK_DELAY * 1000);
    };
    window.addEventListener(CAMERA_INTRO_START_EVENT, start);
    window.addEventListener(CAMERA_PULLBACK_EVENT, pull);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CAMERA_INTRO_START_EVENT, start);
      window.removeEventListener(CAMERA_PULLBACK_EVENT, pull);
    };
  }, []);

  // [pullback-skip] 실제 사용자 입력(OrbitControls start / 캔버스 pointerdown·wheel·touchstart)과 구역 버튼·고장 자동 이동만 감지.
  // 관제 시작(interactionReady) 이후에만 기록. pullback 진행 중이면 그 자리에서 멈춤 (OrbitControls damping 으로 자연스럽게)
  useEffect(() => {
    const onUser = () => {
      if (!useViewportStore.getState().interactionReady) return;
      userMovedRef.current = true;
      if (anim.current?.arc) anim.current = null; // arc = pullback 트윈
    };
    const el = gl.domElement;
    const opts = { passive: true } as const;
    el.addEventListener("pointerdown", onUser, opts);
    el.addEventListener("wheel", onUser, opts);
    el.addEventListener("touchstart", onUser, opts);
    controls?.addEventListener("start", onUser);
    window.addEventListener(CAMERA_FLY_TO_EVENT, onUser);
    window.addEventListener(FAILURE_FOCUS_EVENT, onUser);
    // [autofocus] 위험 알람 Tracking 은 일회용 — 사용자 카메라 조작(드래그/휠/터치) 또는 구역 이동 시 그 자리에서 해제
    const endAuto = () => {
      const v = useViewportStore.getState();
      if (v.alarmFollow && v.alarmAuto) useViewportStore.setState({ alarmFollow: null, skipReturnFlight: true });
    };
    const onWheel = (e: WheelEvent) => { if (e.deltaY > 0) wheelOutAtRef.current = performance.now(); endAuto(); };
    el.addEventListener("wheel", onWheel, opts);
    el.addEventListener("touchstart", endAuto, opts);
    controls?.addEventListener("start", endAuto);
    window.addEventListener(CAMERA_FLY_TO_EVENT, endAuto);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", endAuto);
      controls?.removeEventListener("start", endAuto);
      window.removeEventListener(CAMERA_FLY_TO_EVENT, endAuto);
      el.removeEventListener("pointerdown", onUser);
      el.removeEventListener("wheel", onUser);
      el.removeEventListener("touchstart", onUser);
      controls?.removeEventListener("start", onUser);
      window.removeEventListener(CAMERA_FLY_TO_EVENT, onUser);
      window.removeEventListener(FAILURE_FOCUS_EVENT, onUser);
    };
  }, [gl, controls]);

  // [areacam] 버튼 등 외부에서 window event 로 카메라 이동 요청 (같은 트윈)
  useEffect(() => {
    const fly = (e: Event) => {
      const d = (e as CustomEvent<CameraFlyToDetail>).detail;
      if (!d) return;
      // [depth] 이동 전 현재 카메라+target 저장 (같은 level 교체 시 원래 복귀 위치 유지)
      if (d.depth && controls) {
        useCameraDepthStore.getState().enter(d.depth.level, d.depth.label, { p: r3(camera.position), t: r3(controls.target) });
        depthDistRef.current = new Vector3(...d.p).distanceTo(new Vector3(...d.t));
      }
      recallRef.current("fly", false, { p: d.p, t: d.t }, d.duration ?? DURATION);
    };
    // ESC 우선순위: 패널 닫기(preventDefault) > Tracking 해제(기존 Tracking·위험 알람) > Depth 한 단계 나가기
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTyping(e.target)) return;
      const g = useShipDebugStore.getState();
      if (g.selected != null || g.lightSelected) return;
      queueMicrotask(() => { // 모든 keydown 리스너가 끝난 뒤 판단
        if (e.defaultPrevented) return;
        const v = useViewportStore.getState();
        if (v.alarmFollow && v.alarmAuto) { // 위험 알람 Tracking: 그 자리에서 해제
          e.preventDefault();
          useViewportStore.setState({ alarmFollow: null, skipReturnFlight: true });
          return;
        }
        if (v.alarmFollow || v.selectedContainerId != null || v.selectedShipKey != null || v.selectedCraneIndex != null || v.selectedOverheadCraneIndex != null) {
          e.preventDefault(); // 기존 Tracking: Cancel 버튼과 동일 (CameraFlight 복귀 비행)
          useViewportStore.setState({ alarmFollow: null, selectedContainerId: null, selectedShipKey: null, selectedCraneIndex: null, selectedOverheadCraneIndex: null });
          return;
        }
        const top = useCameraDepthStore.getState().pop();
        if (!top) return;
        e.preventDefault();
        recallRef.current("back", false, top.back, AREA_CAM_MOVE_DURATION);
      });
    };
    // [autofocus] 고장 알람 → 위험 알람 Tracking (Depth 없음, 일회용)
    const failureFocus = (e: Event) => {
      const d = (e as CustomEvent<FailureFocusDetail>).detail;
      if (!d) return;
      anim.current = null;
      focusEquipment(d.kind, d.index, true);
    };
    window.addEventListener(CAMERA_FLY_TO_EVENT, fly);
    window.addEventListener(FAILURE_FOCUS_EVENT, failureFocus);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(CAMERA_FLY_TO_EVENT, fly); window.removeEventListener(FAILURE_FOCUS_EVENT, failureFocus); window.removeEventListener("keydown", onKey); };
  }, [camera, controls]);

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
    // [depth] Depth 안에서 휠로 크게 빠지면 Depth 통째로 나가기 (최상위 시점으로)
    if (!anim.current && controls && depthDistRef.current > 0 && performance.now() - wheelOutAtRef.current < DEPTH_EXIT_WHEEL_WINDOW_MS) {
      const depth = useCameraDepthStore.getState();
      if (!depth.stack.length) depthDistRef.current = 0;
      else if (camera.position.distanceTo(controls.target) > depthDistRef.current * DEPTH_EXIT_ZOOM_FACTOR) {
        const root = depth.exitAll();
        depthDistRef.current = 0;
        wheelOutAtRef.current = 0;
        if (root) recallRef.current("back", false, root, AREA_CAM_MOVE_DURATION);
      }
    }
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / a.d);
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
    controls.target.lerpVectors(a.ft, a.tt, k);
    if (a.arc) {
      const { from, to } = a.arc;
      _sph.set(
        from.radius + (to.radius - from.radius) * k,
        from.phi + (to.phi - from.phi) * k,
        from.theta + (to.theta - from.theta) * k,
      );
      camera.position.setFromSpherical(_sph).add(controls.target);
    } else camera.position.lerpVectors(a.fp, a.tp, k);
    controls.update();
    if (a.t >= 1) { anim.current = null; a.done?.(); }
  }, -2);

  return null;
}
