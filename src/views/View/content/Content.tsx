import IconButton from "@/components/IconButton";
import { CONTENT_VIEW_NAV, contentMenu, useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";

/** 카테고리 nav — Scene과 flex로 영역 분리 */
export default function Content() {
  const activeView = useContentViewStore((s) => s.activeView);
  const setActiveView = useContentViewStore((s) => s.setActiveView);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const setMonitorMode = useViewportStore((s) => s.setMonitorMode);

  return (
    <nav
      aria-label="항만 운영 메뉴"
      className="relative flex h-full w-24 shrink-0 flex-col gap-2 overflow-y-auto border-r border-cyber/20 px-2 py-2 backdrop-blur-md bg-background bg-linear-to-b from-side-up to-side-down"
    >
      {CONTENT_VIEW_NAV.map(({ view, icon, label }) => {
        const active = !monitorMode && contentMenu(activeView) === view;
        return (
          <IconButton
            key={view}
            icon={icon}
            label={label}
            active={active}
            onClick={() => {
              if (!monitorMode || activeView !== view) {
                setActiveView(view);
              }

              setMonitorMode(false);
            }}
            className="min-h-16 w-full shrink-0 flex-col gap-1 py-2"
          >
            <span className="text-xs leading-tight text-white/70 group-aria-pressed:text-primary">
              {label}
            </span>
          </IconButton>
        );
      })}
    </nav>
  );
}
