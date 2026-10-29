import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import { FAILURE_SCENARIO } from "@/constants/failureScenario";
import FailureScenarioRunner from "./_components/FailureScenarioRunner";
import PortHoverTooltip from "./_components/PortHoverTooltip";

import Scene from "./_components/Scene";
import IntroOverlay from "./_components/IntroOverlay";
import MonitoringOverlay from "./_components/MonitoringOverlay";
import PerfOverlay from "./_components/PerfOverlay";

import Content from "../View/content/Content";
import ContentPanel from "../View/content/ContentPanel";

import ViewportLayout from "./layout";

export default function Viewport() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
      <Content />

      <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <ViewportLayout>
          <Scene />
        </ViewportLayout>

        <IntroOverlay />
        <ContentPanel />
        <MonitoringOverlay />
        {import.meta.env.DEV && <PerfOverlay />}
        {/* [failure] 기존 점유율 mock 토스트는 설정으로만 */}
        {FAILURE_SCENARIO.keepMockOccupancyToasts && <ToasterTestTrigger />}
        <FailureScenarioRunner />
        <PortHoverTooltip />
      </div>
    </div>
  );
}

