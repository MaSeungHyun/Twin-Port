import title from "@/assets/image/wordmark.png";
import Status from "./Status";
import Alarm from "./Alarm";

import OccupancyMode from "./OccupancyMode";
import ViewOption from "./ViewOption";
import Monitoring from "./Monitoring";

export default function Header() {
  return (
    <div className="relative z-[200] flex w-full min-h-20 items-center justify-between bg-background px-10">
      <div className="flex items-center gap-8">
        {/* xd에 이미지를 담을 컨테이너 사이즈는 있지만 컨테이너 사이즈에 대한 패딩값이 없어 임의로 적용 */}
        <div className="flex items-end justify-center w-[278px] h-[57px] pl-1 pr-14 py-2">
          <img src={title} alt="title" className="w-full" />
        </div>
        <Status />
      </div>
      <div className="flex items-center gap-6">
        <Monitoring />
        <OccupancyMode />
        <ViewOption />
        <Alarm />
      </div>
    </div>
  );
}
