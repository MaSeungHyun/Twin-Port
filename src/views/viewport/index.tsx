import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import { FAILURE_SCENARIO } from "@/constants/failureScenario";
import { useViewportStore } from "@/stores/viewport";
import FailureScenarioRunner from "./_components/FailureScenarioRunner";
import OpsScenarioRunner from "./_components/OpsScenarioRunner";
import { BlockCursorTooltip } from "./_components/Port/Block/BlockHoverArea";
import PortHoverTooltip from "./_components/PortHoverTooltip";

import Scene from "./_components/Scene";
import IntroOverlay from "./_components/IntroOverlay";
import MonitoringOverlay from "./_components/MonitoringOverlay";
// TEMP: 디버그 UI 비활성화

import Presence from "@/components/ui/Presence";
import ContentPanel from "../View/content/ContentPanel";
import HudOverlay from "./_components/HudOverlay";
import PanelFrames from "@/components/ui/PanelFrames";

import ViewportLayout from "./layout";

export default function Viewport() {
  const hudHidden = useViewportStore((s) => s.hudHidden);
  const started = useViewportStore((s) => s.monitoringStarted);
  const introOpen = useViewportStore((s) => s.introOpen);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const showHud = !hudHidden && started && !introOpen;

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden">
      <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <ViewportLayout>
          <Scene />
        </ViewportLayout>

        <IntroOverlay />
        {!showHud ? null : <HudOverlay />}
        {!showHud ? null : <ContentPanel />}
        {!showHud ? null : <PanelFrames />}
        <Presence present={!hudHidden && !introOpen && monitorMode} variant="hold" className="pointer-events-none absolute inset-0 z-150">
          <MonitoringOverlay />
        </Presence>
        {/* TEMP: 디버그 UI 비활성화 */}
        {/* [failure] 기존 점유율 mock 토스트는 설정으로만 */}
        {!hudHidden && FAILURE_SCENARIO.keepMockOccupancyToasts ? (
          <ToasterTestTrigger />
        ) : null}
        <FailureScenarioRunner />
        <OpsScenarioRunner />
        {!showHud ? null : <PortHoverTooltip />}
        {!showHud ? null : <BlockCursorTooltip />}
      </div>
    </div>
  );
}
