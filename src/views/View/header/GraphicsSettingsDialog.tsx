import GraphicsSettingsPanel from "./RenderSettings";
import HeaderDialog from "./HeaderDialog";

/** 그래픽 설정 다이얼로그 (관제 시작 전·중 공통). 자리·닫기 동작은 HeaderDialog */
export default function GraphicsSettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <HeaderDialog label="그래픽 설정" onClose={onClose}>
      <GraphicsSettingsPanel onClose={onClose} />
    </HeaderDialog>
  );
}
