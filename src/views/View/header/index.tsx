import title from "@/assets/image/wordmark.png";
import Status from "./Status";
import Alarm from "./Alarm";

import OccupancyMode from "./OccupancyMode";
import ViewOption from "./ViewOption";
import Monitoring from "./Monitoring";

export default function Header() {
  return (
    <div className="relative z-[200] flex w-full min-h-12 items-center justify-between bg-background px-4">
      <div className="flex items-center gap-24">
        <img src={title} alt="title" className="h-5" />
        <Status />
      </div>
      <div className="flex items-center gap-5">
        <Monitoring />
        <OccupancyMode />
        <ViewOption />
        <Alarm />
      </div>
    </div>
  );
}
