import { useEffect } from "react";
import Header from "./views/View/header";
import ViewLoader from "./views/View/ViewLoader";
import Viewport from "./views/viewport";

import Toaster, { toaster } from "@/components/Toaster";
import { useViewportStore } from "@/stores/viewport";

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function App() {
  const hudHidden = useViewportStore((s) => s.hudHidden);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyH" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      useViewportStore.getState().toggleHudHidden();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (hudHidden) toaster.dismiss();
  }, [hudHidden]);

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-dt-bg">
      <ViewLoader />
      {!hudHidden ? <Header /> : null}
      <Viewport />
      {!hudHidden ? <Toaster /> : null}
    </main>
  );
}

export default App;
