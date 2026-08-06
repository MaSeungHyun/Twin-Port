import title from "@/assets/image/wordmark.png";
import Status from "./Status";
import Alarm from "../content/_components/alarm";

import OccupnacyMode from "./OccupnacyMode";

export default function Header() {
  return (
    <div className="relative z-[200] flex w-full min-h-12 items-center justify-between bg-background px-4">
      <div className="flex items-center gap-24">
        <img src={title} alt="title" className="h-5" />
        <Status />
      </div>
      <div className="flex items-center gap-3">
        <OccupnacyMode />
        <Alarm />
      </div>
    </div>
  );
}
