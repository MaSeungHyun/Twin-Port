import { useEffect, useRef, useState } from "react";
import { useHudUiStore } from "@/stores/hud";

const SLIDE_MS = 160;

/**
 * 오른쪽 상세는 목록을 누르거나 3D에서 연 뒤에만 연다.
 * 닫기(X)·Esc·같은 행 다시 클릭은 200ms 슬라이드 아웃 후 숨기고, 스토어 선택도 푼다.
 */
export function useDetailSelection<T>(storeKey: T | null, onRelease: () => void) {
  const [shown, setShown] = useState<T | null>(storeKey);
  const [closing, setClosing] = useState(false);
  const previous = useRef(storeKey);
  const releaseRef = useRef(onRelease);
  const shownRef = useRef(shown);
  const closingRef = useRef(closing);
  const timer = useRef<number | null>(null);
  releaseRef.current = onRelease;
  shownRef.current = shown;
  closingRef.current = closing;

  useEffect(() => {
    if (Object.is(previous.current, storeKey)) return;
    previous.current = storeKey;
    if (storeKey != null) {
      if (timer.current != null) window.clearTimeout(timer.current);
      setClosing(false);
      setShown(storeKey);
    }
  }, [storeKey]);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const close = () => {
    if (shownRef.current == null || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    releaseRef.current();
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      shownRef.current = null;
      closingRef.current = false;
      setShown(null);
      setClosing(false);
    }, SLIDE_MS);
  };

  const select = (next: T) => {
    if (!closingRef.current && shownRef.current != null && Object.is(shownRef.current, next)) {
      close();
      return false;
    }
    if (timer.current != null) window.clearTimeout(timer.current);
    closingRef.current = false;
    shownRef.current = next;
    setClosing(false);
    setShown(next);
    return true;
  };

  const detailOpen = shown != null;
  useEffect(() => {
    if (!detailOpen) return;
    useHudUiStore.getState().holdRightDetail();
    return () => useHudUiStore.getState().releaseRightDetail();
  }, [detailOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (shownRef.current == null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return { key: shown, closing, select, close };
}
