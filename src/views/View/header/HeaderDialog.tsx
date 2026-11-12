import { useEffect, useRef, type ReactNode } from "react";

/**
 * 헤더 다이얼로그 공통 틀 (알람·그래픽 설정). 오른쪽 패널(PanelFrames)과 같은 자리·크기
 * (오른쪽 24, 위 88 = 헤더 64 + 24, 폭 360, 높이 최대 100dvh-112)에 그 위로 겹쳐 뜬다. 열린 오른쪽 패널은 밀거나 닫지 않는다.
 * Esc · 바깥 클릭 · × · 헤더 버튼(data-header-dialog-trigger)으로 닫힌다. 헤더(z-200) 안이라 로딩 화면 위에 뜬다.
 */
export default function HeaderDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // 다른 Esc 처리(콘텐츠 패널 닫기 등)까지 가지 않게 여기서 멈춘다
      event.stopPropagation();
      closeRef.current();
    };
    // 헤더의 알람·설정 버튼은 스스로 토글(다른 다이얼로그로 전환)하므로 바깥 클릭에서 뺀다
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || panelRef.current?.contains(target) || target.closest?.("[data-header-dialog-trigger]")) return;
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className="hud-glass settings-dialog-in fixed top-[88px] right-6 z-[210] max-h-[calc(100dvh-112px)] w-[360px] overflow-y-auto rounded-[14px] outline-none"
    >
      {children}
    </div>
  );
}
