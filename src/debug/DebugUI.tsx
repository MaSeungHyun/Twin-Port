/* eslint-disable @typescript-eslint/no-explicit-any */
import { useShipDebugStore } from "@/stores/shipDebug";
import { hasWebGPU, switchRenderer, useRendererStore } from "@/stores/renderer";
import { useSettings } from "@/views/viewport/_components/OceanTsl/state/settingsStore";
import HdriSection, { hdriCopyInfo } from "./HdriSection";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getValue, resetPanel, setPanelValues, useDebugStore, type FieldSpec } from "./controls";

// 표시 패널만 (Ocean/Camera/Ship 포즈 패널은 UI에서 제거 — 컨트롤은 코드에 등록된 채 현재 기본값 유지)
export const PANELS = ["Sky", "Environment HDR", "Ship Material", "Sun Light", "Ocean", "Render", "Camera Slots", "Outline"] as const;
/** 패널별 UI 숨김 필드 (값은 그대로 유지·적용됨) */
const HIDDEN_FIELDS: Record<string, string[]> = { "Sun Light": ["shadowCameraHelper"] };
const PANEL_KO: Record<string, string> = {
  Ship: "선박", "Ship Material": "선박 재질", "Sun Light": "조명", Render: "렌더",
  "Environment HDR": "HDR", Sky: "하늘", Ocean: "바다", Camera: "카메라",
};
const HELP: Record<string, string> = {"visible": "오브젝트를 화면에 보이거나 숨깁니다.", "enabled": "이 기능 전체를 켜거나 끕니다.", "intensity": "빛의 세기. 높을수록 장면이 밝아집니다.", "color": "색상. 빛이나 재질의 기본 색을 바꿉니다.", "azimuth": "태양의 수평 방향(도). 그림자가 드리우는 방향이 바뀝니다.", "elevation": "태양의 높이(도). 낮을수록 그림자가 길어집니다.", "distance": "광원과 대상 사이 거리. 그림자 범위 계산에 영향을 줍니다.", "castShadow": "그림자를 생성할지 여부. 끄면 성능이 좋아집니다.", "helper": "광원 위치/방향 도우미를 표시합니다.", "handleSize": "광원 핸들의 표시 크기.", "shadowCameraHelper": "그림자 카메라 범위를 선으로 표시합니다.", "glow": "태양 아래 바닥에 은은한 빛 번짐을 표시합니다.", "gizmoMode": "선택한 오브젝트를 이동/회전하는 기즈모 방식.", "mapSize": "그림자 텍스처 해상도. 클수록 선명하지만 무겁습니다.", "bias": "그림자 줄무늬(acne) 보정값.", "normalBias": "표면 방향 기준 그림자 보정. 경사면 줄무늬를 줄입니다.", "radius": "그림자 가장자리 부드러움.", "halfWidth": "그림자 범위 가로 절반(m).", "halfHeight": "그림자 범위 세로 절반(m).", "near": "그림자/카메라 근평면 거리.", "far": "그림자/카메라 원평면 거리.", "environmentIntensity": "HDR 환경광이 재질을 비추는 세기.", "rotationDeg": "HDR 환경맵 회전(도). 반사와 조명 방향이 바뀝니다.", "background": "HDR 이미지를 배경으로 표시할지 여부.", "backgroundIntensity": "배경 HDR 밝기.", "backgroundBlurriness": "배경 HDR 흐림 정도.", "toneMappingExposure": "전체 노출(밝기). 화면 전체 밝기가 바뀝니다.", "hdri": "사용할 HDRI 파일을 바꿉니다.", "material": "편집할 재질을 선택합니다.", "metalness": "금속성. 높을수록 금속처럼 반사합니다.", "roughness": "거칠기. 낮을수록 매끈하고 반사가 선명합니다.", "envMapIntensity": "환경 반사 세기.", "emissive": "스스로 빛나는 색.", "emissiveIntensity": "발광 세기.", "opacity": "불투명도. 낮을수록 투명해집니다(투명 켜야 적용).", "transparent": "투명 블렌딩 사용 여부.", "mapEnabled": "텍스처 이미지 사용 여부.", "toneMapped": "톤매핑 적용 여부. 끄면 색이 원색 그대로 보입니다.", "scale": "오브젝트 크기 배율.", "rotationY": "하늘(sky) 오브젝트를 세로축 기준으로 회전(0~360°). 저장됩니다.", "hdrRotY": "HDR 환경맵(반사·조명·배경)을 세로축 기준으로 회전(0~360°). 저장됩니다.", "level": "바다 수면 높이(월드 y, m).", "hidePortPlane": "모델에 포함된 기존 평면 수면을 숨깁니다.", "buoyancy": "선박이 파도에 따라 오르내리고 기울어지게 합니다.", "skyDome": "바다용 하늘돔 표시.", "wind": "풍속(m/s). 클수록 파도가 높고 거칠어집니다.", "windDir": "바람 방향(라디안). 파도가 진행하는 방향.", "peak": "피크 파장(m). 클수록 큰 너울 위주가 됩니다.", "choppy": "파도 꼭대기 날카로움(수평 변위).", "sharp": "물마루를 뾰족하게 만드는 정도.", "collFoam": "파도끼리 부딪쳐 생기는 흰 거품 양.", "persist": "거품이 사라지지 않고 남는 시간 배율.", "hour": "시각(바다 반사용). 수면에 비치는 태양 위치·하늘색을 바꿉니다.", "clouds": "구름 양(바다 반사용). 수면 반사와 햇빛 세기를 줄입니다.", "preset": "현재 적용된 물빛 프리셋 이름.", "deep": "깊은 곳의 물색.", "shallow": "얕은 곳/파도 투과 시 물색.", "turbidity": "탁도. 높을수록 물이 뿌옇게 됩니다.", "clarity": "투명도(m). 빛이 들어가는 깊이.", "depth": "물빛 계산용 수심(m).", "shoreFoam": "해안선(Ground·위성지형·선체) 거품 양.", "wallFoamW": "안벽(수직 벽) 앞 거품 띠 폭(m). 파도가 벽에 부딪혀 바다 쪽으로 빠지며 끊어진 띠로 보입니다.", "shoreWave": "해안 쪽 파도 높이(m).", "shoreLen": "해안 쪽 파도 파장(m).", "foamColor": "거품 색.", "foamBright": "거품 밝기.", "uwColor": "카메라가 물속일 때 보이는 물 색.", "uwDensity": "물속 시야 흡수 농도(/m). 0.014 ≈ 50m 거리에서 50% 물색. 높을수록 시야가 짧아집니다.", "uwDarkRange": "수면에서 이 깊이(m)까지 내려가면 물속이 가장 어두워집니다(최소 밝기에서 멈춤). 클수록 깊이 내려가도 밝게 유지됩니다.", "bubbles": "물속에 있을 때 카메라 주변에 올라가는 기포를 표시합니다.", "bubbleAmount": "카메라 주변 기포 개수(최대 1000).", "bubbleSize": "기포 크기(반지름, m). 기포마다 0.5~1.5배로 달라집니다.", "bubbleSpeed": "기포 상승 속도(m/s).", "uwMinBright": "아무리 깊어도 유지되는 최소 밝기(0~1). 0이면 깊은 곳이 검게 됩니다.", "quality": "바다 품질 프리셋. FFT 해상도와 격자 밀도를 함께 바꿉니다.", "fft0": "큰 파도 계층 FFT 해상도.", "fft1": "중간 파도 계층 FFT 해상도.", "fft2": "잔물결 계층 FFT 해상도.", "mode": "FFT 갱신 방식(매 프레임/교대/N프레임마다).", "nth": "N프레임마다 갱신할 때의 N.", "detail": "잔물결 디테일이 보이는 거리(m).", "fov": "카메라 시야각.", "position": "위치 좌표.", "pose": "위치/회전 값.", "selected": "선택 상태.", "side": "렌더링할 면. front=앞면, back=뒷면(하늘돔 안쪽에서 볼 때), double=양면."};
const KO: Record<string, string> = {
  hdri: "HDRI 파일",
  visible: "표시",
  enabled: "켜기",
  intensity: "세기",
  color: "색상",
  azimuth: "방위각",
  elevation: "고도",
  distance: "거리",
  castShadow: "그림자 생성",
  helper: "헬퍼 표시",
  handleSize: "핸들 크기",
  shadowCameraHelper: "그림자 카메라 헬퍼",
  glow: "바닥 글로우",
  gizmoMode: "기즈모 모드",
  mapSize: "그림자 해상도",
  bias: "바이어스",
  normalBias: "노멀 바이어스",
  radius: "부드러움",
  halfWidth: "범위 가로(½)",
  halfHeight: "범위 세로(½)",
  near: "근평면",
  far: "원평면",
  environmentIntensity: "환경광 세기",
  rotationDeg: "회전(°)",
  background: "배경 표시",
  backgroundIntensity: "배경 밝기",
  backgroundBlurriness: "배경 흐림",
  toneMappingExposure: "노출",
  material: "재질 선택",
  metalness: "금속성",
  roughness: "거칠기",
  envMapIntensity: "반사 세기",
  emissive: "발광색",
  emissiveIntensity: "발광 세기",
  opacity: "불투명도",
  transparent: "투명",
  mapEnabled: "텍스처",
  toneMapped: "톤매핑",
  side: "렌더 면",
  scale: "크기",
  rotationY: "하늘 Y 회전(°)",
  hdrRotY: "HDR Y 회전(°)",
  selected: "선택",
  mode: "모드",
  pose: "위치/회전",
  level: "수면 높이",
  hidePortPlane: "기존 수면 숨김",
  buoyancy: "부력",
  skyDome: "바다 하늘돔",
  wind: "풍속",
  windDir: "풍향",
  peak: "피크 주기",
  choppy: "파도 날카로움",
  hour: "시각 (바다 반사용)",
  clouds: "구름 (바다 반사용)",
  sharp: "물마루 날카로움",
  collFoam: "충돌 거품",
  persist: "거품 지속",
  foamBright: "거품 밝기",
  uwColor: "수중 색",
  uwDensity: "수중 밀도",
  uwDarkRange: "깊이 어두워짐 범위(m)",
  uwMinBright: "수중 최소 밝기",
  bubbles: "기포",
  bubbleAmount: "기포 양",
  bubbleSize: "기포 크기",
  bubbleSpeed: "기포 상승 속도",
  quality: "품질",
  fft0: "FFT 0",
  fft1: "FFT 1",
  fft2: "FFT 2",
  nth: "N프레임",
  preset: "물빛 프리셋",
  shoreFoam: "해안 거품",
  shoreWave: "해안 파고",
  shoreLen: "해안 파장",
  wallFoamW: "안벽 거품 폭",
  foamColor: "거품 색",
  amp: "너울 높이",
  len: "너울 파장",
  dir: "너울 방향",
  steep: "너울 경사",
  detail: "디테일",
  pan: "흐름",
  deep: "깊은 물색",
  shallow: "얕은 물색",
  turbidity: "탁도",
  clarity: "투명도",
  depth: "수심 색 깊이",
  shoreFoamOn: "해안 거품",
  fov: "화각",
  position: "위치",
};

type Preset = { label: string; panel: string; values: Record<string, any> };
const PRESETS: Record<string, Preset[]> = {};

const SHOWN_KEY = "twin-port.debugUI.shown";
const debugEnabled = () =>
  import.meta.env.DEV || new URLSearchParams(window.location.search).has("debug");

function copy(panel: string) {
  const p = useDebugStore.getState().panels[panel];
  if (!p) return;
  const vals = panel === "Sky" || panel === "Environment HDR" ? { ...hdriCopyInfo(), ...p.values } : p.values;
  const text = JSON.stringify(vals, null, 2);
  console.info(`[${panel}]\n${text}`);
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

function Field({ panel, f, v }: { panel: string; f: FieldSpec; v: any }) {
  const set = (nv: any) => setPanelValues(panel, { [f.key]: nv }, true);
  const label = (
    <span className="dbg-label">
      {KO[f.key] ?? f.label ?? f.key}
      {(HELP[f.key] ?? f.hint) && <i className="dbg-info" tabIndex={0} data-tip={HELP[f.key] ?? f.hint}>ⓘ</i>}
    </span>
  );
  if (f.kind === "button")
    return <button className="dbg-btn" onClick={() => f.fn?.(getValue)}>{f.key}</button>;
  if (f.kind === "boolean")
    return <label className="dbg-row">{label}<input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /></label>;
  if (f.kind === "color")
    return <label className="dbg-row">{label}<input type="color" value={v} onChange={(e) => set(e.target.value)} /><code>{v}</code></label>;
  if (f.kind === "select")
    return (
      <label className="dbg-row">{label}
        <select value={String(v)} onChange={(e) => set(f.options!.find((o) => String(o) === e.target.value))}>
          {f.options!.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </select>
      </label>
    );
  if (f.kind === "number") return <NumberRow f={f} v={v} set={set} label={label} />;
  if (f.kind === "vector")
    return (
      <div className="dbg-row">{label}
        {Object.keys(v).map((a) => (
          <input key={a} className="dbg-num" type="number" step={f.step ?? 1} value={v[a]} title={a}
            onChange={(e) => set({ ...v, [a]: +e.target.value })} />
        ))}
      </div>
    );
  return <label className="dbg-row">{label}<input type="text" readOnly={f.editable === false} value={v} onChange={(e) => set(e.target.value)} /></label>;
}

/** 그림자 패널: on/off 만 (세부 파라미터 mapSize/bias/카메라 범위는 코드 기본값 유지) */
function ShadowOnly() {
  const p = useDebugStore((s) => s.panels["Sun Light"]);
  const f = p?.fields.find((x) => x.key === "castShadow");
  if (!p || !f) return <p>태양광이 로드되면 표시됩니다.</p>;
  return <Field panel="Sun Light" f={f} v={p.values.castShadow} />;
}
/** [fog] 수면 위(대기) 안개 — OceanTsl settingsStore(airFog, localStorage 저장). 수중에선 수중 안개가 대신 적용 */
const FOG_TIP = {
  on: "수면 위(대기) 안개를 켜거나 끕니다. 카메라가 물속이면 수중 안개가 대신 적용됩니다. 바다 수면·하늘에는 적용되지 않습니다.",
  color: "안개 색. 멀리 있는 오브젝트가 이 색으로 섞입니다.",
  near: "안개가 시작되는 거리(m). 이보다 가까운 곳은 안개가 없습니다.",
  far: "안개가 100%가 되는 거리(m). 이보다 먼 곳은 안개색으로 완전히 덮입니다.",
};
function FogPanel() {
  const af = useSettings((s) => s.airFog);
  const setAirFog = useSettings((s) => s.setAirFog);
  const oe = useSettings((s) => s.oceanEdge);
  const setOceanEdge = useSettings((s) => s.setOceanEdge);
  const lab = (t: string, tip: string) => <span className="dbg-label">{t}<i className="dbg-info" tabIndex={0} data-tip={tip}>ⓘ</i></span>;
  return (
    <>
      <label className="dbg-row">{lab("안개", FOG_TIP.on)}<input type="checkbox" checked={af.on} onChange={(e) => setAirFog("on", e.target.checked)} /></label>
      <label className="dbg-row">{lab("안개 색", FOG_TIP.color)}<input type="color" value={af.color} onChange={(e) => setAirFog("color", e.target.value)} /><code>{af.color}</code></label>
      <NumberRow f={{ min: 0, max: 100000, step: 1 }} v={af.near} set={(x) => setAirFog("near", x)} label={lab("안개 시작 거리(m)", FOG_TIP.near)} />
      <NumberRow f={{ min: 0, max: 100000, step: 1 }} v={af.far} set={(x) => setAirFog("far", x)} label={lab("안개 끝 거리(m)", FOG_TIP.far)} />
      <NumberRow f={{ min: 0, max: 1, step: 0.01 }} v={oe.start} set={(x) => setOceanEdge("start", x)} label={lab("바다 끝 페이드 시작", "바다 반경(26km) 대비 비율. 여기서부터 수평선 색으로 섞이기 시작")} />
      <NumberRow f={{ min: 0, max: 1, step: 0.01 }} v={oe.end} set={(x) => setOceanEdge("end", x)} label={lab("바다 끝 페이드 끝", "바다 반경 대비 비율. 여기서 완전히 하늘색/투명")} />
    </>
  );
}
/** 렌더 패널: 그림자 on/off + WebGPU 사용 (전환 시 페이지 리로드로 캔버스 재생성) */
function RenderPanel() {
  const pref = useRendererStore((s) => s.pref);
  const active = useRendererStore((s) => s.active);
  const ok = hasWebGPU();
  const scale = useRendererStore((s) => s.renderScale);
  const setScale = useRendererStore((s) => s.setRenderScale);
  return (
    <>
      <ShadowOnly />
      <NumberRow f={{ min: 0.5, max: 2, step: 0.05 }} v={scale} set={setScale} label={<span className="dbg-label">렌더 해상도<i className="dbg-info" tabIndex={0} data-tip={"픽셀 비율 상한(DPR). 낮추면 빨라지고 흐려집니다. 기본 1.5, 화면 DPR 보다 높게는 적용되지 않습니다."}>ⓘ</i></span>} />
      <label className="dbg-row">
        <span className="dbg-label">WebGPU 사용<i className="dbg-info" tabIndex={0} data-tip={"WebGPU 렌더러를 사용합니다. 끄면 WebGL2 로 렌더링합니다(호환성↑, 일부 효과·성능↓). 바꾸면 화면을 다시 불러옵니다." + (ok ? "" : " 이 브라우저는 WebGPU 를 지원하지 않습니다.")}>ⓘ</i>
          <small>{active === "webgpu" ? "현재 WebGPU" : active === "webgl2" ? "현재 WebGL2" : ""}</small></span>
        <input type="checkbox" disabled={!ok} checked={ok && pref === "webgpu"} onChange={(e) => switchRenderer(e.target.checked ? "webgpu" : "webgl")} />
      </label>
      <FogPanel />
    </>
  );
}
function resetShadow() {
  useSettings.getState().resetAirFog();
  const p = useDebugStore.getState().panels["Sun Light"];
  if (p) setPanelValues("Sun Light", { castShadow: p.defaults.castShadow }, true);
}

export default function DebugUI() {
  const open = useDebugStore((s) => s.open);
  const setOpen = useDebugStore((s) => s.setOpen);
  const panel = useDebugStore((s) => (s.open ? s.panels[s.open] : undefined));
  const [shown, setShown] = useState(() => localStorage.getItem(SHOWN_KEY) === "1");
  const toggle = (v: boolean) => {
    setShown(v);
    localStorage.setItem(SHOWN_KEY, v ? "1" : "0");
  };
  // Esc: 기즈모 선택 중이면 ShipGizmo 가 선택 해제만 (패널 유지) → 아니면 열린 패널 닫기 → 그다음 툴바 숨김.
  // capture 단계에서 ShipGizmo 리스너보다 먼저 선택 상태를 읽는다.
  useEffect(() => {
    if (!debugEnabled()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      const g = useShipDebugStore.getState();
      if (g.selected != null || g.lightSelected) return;
      const d = useDebugStore.getState();
      if (d.open) d.setOpen(null);
      else toggle(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  if (!debugEnabled()) return null;
  const gear = (
    <button className={`dbg-gear ${shown ? "on" : ""}`} title={shown ? "설정 닫기 (Esc)" : "설정 열기"} aria-label="설정"
      onClick={() => toggle(!shown)}>⚙</button>
  );
  if (!shown) return <><style>{CSS}</style>{gear}</>;
  return (
    <div className="dbg-root">
      <style>{CSS}</style>
      {gear}
      <div className="dbg-toolbar">
        {PANELS.map((p) => (
          <button key={p} className={`dbg-tab ${open === p ? "on" : ""}`} onClick={() => setOpen(open === p ? null : p)}>
            {PANEL_KO[p]}
          </button>
        ))}
      </div>
      {open && (
        <div className="dbg-panel">
          <div className="dbg-head">
            <b>{PANEL_KO[open]}</b>
            <span>
              <button className="dbg-btn" onClick={() => (open === "Render" ? resetShadow() : resetPanel(open))}>초기화</button>
              <button className="dbg-btn" onClick={() => copy(open)}>값 복사</button>
              <button className="dbg-btn" onClick={() => setOpen(null)}>✕</button>
            </span>
          </div>
          {PRESETS[open] && (
            <div className="dbg-presets">
              {PRESETS[open]!.map((p) => (
                <button key={p.label} className="dbg-btn" onClick={() => setPanelValues(p.panel, p.values, true)}>{p.label}</button>
              ))}
            </div>
          )}
          {open === "Environment HDR" && <HdriSection />}
          {!panel && open !== "Render" && <p>이 패널은 해당 오브젝트가 로드되면 표시됩니다.</p>}
          {open === "Render" ? <RenderPanel /> : panel && (() => {
            // 연속된 버튼(예: 물빛 프리셋)은 한 줄로 묶어서 표시
            const fs = panel.fields.filter((f) => !HIDDEN_FIELDS[open]?.includes(f.key));
            const out: ReactNode[] = [];
            for (let i = 0; i < fs.length; ) {
              if (fs[i]!.kind === "button") {
                const g: typeof fs = [];
                while (i < fs.length && fs[i]!.kind === "button") g.push(fs[i++]!);
                out.push(<div key={"btns-" + g[0]!.key} className="dbg-btnrow">{g.map((f) => <Field key={f.key} panel={open} f={f} v={undefined} />)}</div>);
              } else { const f = fs[i++]!; out.push(<Field key={f.key} panel={open} f={f} v={panel.values[f.key]} />); }
            }
            return out;
          })()}
        </div>
      )}
    </div>
  );
}

const CSS = `
.dbg-info{position:relative;display:inline-block;margin-left:4px;font-style:normal;font-size:12px;opacity:.6;cursor:help}
.dbg-info:hover,.dbg-info:focus{opacity:1}
.dbg-info:hover::after,.dbg-info:focus::after{content:attr(data-tip);position:absolute;left:0;top:18px;width:230px;white-space:normal;background:#0b0e14;color:#eef;border:1px solid #3d7cff88;border-radius:6px;padding:6px 8px;font-size:12px;line-height:1.45;z-index:10001;box-shadow:0 4px 12px #000a}
.dbg-gear{position:fixed;top:64px;right:12px;z-index:10000;width:36px;height:36px;border-radius:50%;border:0;background:rgba(18,22,30,.85);color:#eef;font-size:20px;line-height:36px;cursor:pointer;box-shadow:0 2px 8px #0008;pointer-events:auto}
.dbg-gear.on{background:#3d7cff}
.dbg-gear:hover{filter:brightness(1.25)}
.dbg-root{position:fixed;top:64px;right:56px;width:min(400px,calc(100vw - 72px));max-height:calc(100vh - 76px);display:flex;flex-direction:column;align-items:stretch;z-index:9999;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#eef;pointer-events:none}
.dbg-root *{pointer-events:auto;box-sizing:border-box}
.dbg-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:rgba(18,22,30,.92);padding:8px;border-radius:10px;box-shadow:0 4px 16px #0008}
.dbg-tab{flex:1 1 30%;display:flex;flex-direction:column;align-items:center;background:#2a3140;color:#eef;border:0;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px}
.dbg-tab small{font-size:11px;opacity:.6}
.dbg-tab.on{background:#3d7cff}
.dbg-sep{width:1px;height:28px;background:#fff3;margin:0 4px}
.dbg-chip{background:#333a48;color:#ccd;border:0;border-radius:14px;padding:5px 10px;cursor:pointer;font-size:13px}
.dbg-chip.on{background:#1f9d6a;color:#fff}
.dbg-panel{margin:8px 0 0;width:100%;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:rgba(18,22,30,.95);border-radius:10px;padding:12px 14px;box-shadow:0 4px 16px #0008}
.dbg-head{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;font-size:16px}
.dbg-head small,.dbg-label small{opacity:.55;font-size:11px;margin-left:4px}
.dbg-presets,.dbg-btnrow{display:flex;flex-wrap:nowrap;gap:4px;align-items:center;margin-bottom:8px}
.dbg-btnrow .dbg-btn,.dbg-presets .dbg-btn{flex:1 1 0;min-width:0;padding:5px 4px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dbg-row{display:grid;grid-template-columns:150px 1fr auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #ffffff10}
.dbg-row input[type=range]{width:100%}
.dbg-row.dbg-sl{grid-template-columns:1fr auto;grid-template-areas:"l n" "r r";row-gap:2px}
.dbg-sl>.dbg-label{grid-area:l}.dbg-sl>.dbg-num{grid-area:n;width:64px}.dbg-sl>input[type=range]{grid-area:r;margin:0;cursor:ew-resize}
.dbg-row select,.dbg-row input[type=text]{background:#2a3140;color:#eef;border:1px solid #fff2;border-radius:6px;padding:3px 6px;font-size:14px}
.dbg-num::-webkit-inner-spin-button,.dbg-num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.dbg-num{width:38px;box-sizing:border-box;-moz-appearance:textfield;background:#2a3140;color:#eef;border:1px solid #fff2;border-radius:6px;padding:3px 2px;font-size:12px;text-align:right}
.dbg-btn{background:#2a3140;color:#eef;border:1px solid #fff2;border-radius:6px;padding:5px 9px;margin:3px 3px 3px 0;cursor:pointer;font-size:13px}
.dbg-btn:hover,.dbg-tab:hover,.dbg-chip:hover{filter:brightness(1.25)}
`;

// [twin-port] 세밀한 슬라이더: 범위의 ~1/1000 단계, Shift=10배 세밀, 방향키/휠/Shift+드래그 지원
function niceStep(x: number) { const p = Math.pow(10, Math.floor(Math.log10(x))); const m = x / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }
function NumberRow({ f, v, set, label }: { f: any; v: number; set: (x: number) => void; label: any }) {
  const min = f.min ?? Math.min(0, v * 2), max = f.max ?? Math.max(1, v * 2 || 1), span = max - min || 1;
  const isInt = f.step != null && f.step >= 1 && Number.isInteger(f.step) && Number.isInteger(min) && span <= 400;
  const step = isInt ? f.step : Math.min(f.step ?? Infinity, niceStep(span / 1000));
  const dec = Math.max(0, Math.ceil(-Math.log10(step / 10)));
  const clamp = (x: number) => Math.min(max, Math.max(min, +x.toFixed(dec)));
  const nudge = (dir: number, fine: boolean) => set(clamp(v + dir * (fine && !isInt ? step / 10 : step)));
  const drag = useRef<{ x: number; v: number } | null>(null);
  // 휠: 슬라이더 위에 있을 때만 한 단계씩 (패널 스크롤 방지). React onWheel 은 passive 라 네이티브로 등록
  const rng = useRef<HTMLInputElement>(null);
  const nudgeRef = useRef(nudge); nudgeRef.current = nudge;
  useEffect(() => {
    const el = rng.current; if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); nudgeRef.current(e.deltaY < 0 ? 1 : -1, e.shiftKey); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);
  return (
    <label className="dbg-row dbg-sl">{label}
      <input ref={rng} type="range" min={min} max={max} step={isInt ? step : step / 10} value={v}
        onChange={(e) => { if (!drag.current) set(+e.target.value); }}
        onKeyDown={(e) => { const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0; if (d) { e.preventDefault(); nudge(d, e.shiftKey); } }}
        onPointerDown={(e) => { if (!e.shiftKey) return; e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, v }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const w = (e.target as HTMLElement).clientWidth || 200; set(clamp(d.v + ((e.clientX - d.x) / w) * span * 0.1)); }}
        onPointerUp={() => { drag.current = null; }} />
      <input className="dbg-num" type="number" step={step} value={Number.isInteger(+v) ? +v : +(+v).toFixed(Math.max(1, dec))} onChange={(e) => { const x = +e.target.value; if (Number.isFinite(x)) set(x); }}
        onKeyDown={(e) => { const d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0; if (d) { e.preventDefault(); nudge(d, e.shiftKey); } }} />
    </label>
  );
}
