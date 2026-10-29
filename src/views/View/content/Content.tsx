import IconButton from "@/components/IconButton";
import { CONTENT_VIEW_NAV, useContentViewStore } from "@/stores/contentView";

/** 카테고리 nav — Scene과 flex로 영역 분리 */
export default function Content() {
  const activeView = useContentViewStore((s) => s.activeView);
  const setActiveView = useContentViewStore((s) => s.setActiveView);

  return (
    <nav
      aria-label="Content categories"
      className="relative flex h-full w-16 shrink-0 flex-col gap-5 border-r border-cyber/20 px-2 py-1 backdrop-blur-md bg-background bg-linear-to-b from-side-up to-side-down"
    >
      {CONTENT_VIEW_NAV.map(({ view, icon, label }) => {
        const active = activeView === view;
        return (
          <IconButton
            key={view}
            icon={icon}
            label={label}
            active={active}
            onClick={() => setActiveView(view)}
            className="aspect-square w-full"
          />
        );
      })}
    </nav>
  );
}
