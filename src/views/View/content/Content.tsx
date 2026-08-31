import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { CONTENT_VIEW_NAV, useContentViewStore } from "@/stores/contentView";
import { cn } from "@/utils/style";

/** 카테고리 nav — Scene과 flex로 영역 분리 */
export default function Content() {
  const activeView = useContentViewStore((s) => s.activeView);
  const setActiveView = useContentViewStore((s) => s.setActiveView);

  return (
    <nav
      aria-label="Content categories"
      className="relative flex h-full w-16 shrink-0 flex-col gap-5 border-r border-cyber/20 bg-background px-2 py-1 backdrop-blur-md"
    >
      {CONTENT_VIEW_NAV.map(({ view, icon, label }) => {
        const active = activeView === view;
        return (
          <Button
            key={view}
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex aspect-square w-full items-center justify-center",
              active &&
                "border border-cyber/40 bg-cyber/15 shadow-[0_0_12px_rgba(0,232,255,0.25)]",
              !active && "hover:bg-cyber/10",
            )}
          >
            <Icon icon={icon} />
          </Button>
        );
      })}
    </nav>
  );
}
