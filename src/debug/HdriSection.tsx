import { useRef, useState } from "react";
import { BUNDLED_HDRIS, DEFAULT_HDRI, useHdriStore } from "@/stores/hdri";

export const hdriCopyInfo = () => {
  const h = useHdriStore.getState().current;
  return { hdri: h.name, hdriSource: h.local ? "local" : "bundled" };
};

/** 하늘 패널 상단: HDRI 교체 (번들 목록 / 파일 업로드 / 드래그앤드롭 / 기본으로) */
export default function HdriSection() {
  const current = useHdriStore((s) => s.current);
  const status = useHdriStore((s) => s.status);
  const error = useHdriStore((s) => s.error);
  const { select, loadLocalFile, reset } = useHdriStore.getState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [warn, setWarn] = useState("");
  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setWarn(loadLocalFile(f) ? "" : `지원하지 않는 형식: ${f.name} (.hdr / .exr 만)`);
  };
  return (
    <div
      className={`dbg-hdri ${drag ? "drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
    >
      <style>{CSS}</style>
      <div className="dbg-hdri-head">
        <b>환경 HDRI <small>HDRI swap</small></b>
        <span className={`dbg-hdri-st ${status}`}>
          {status === "loading" ? "로딩중…" : status === "error" ? "오류" : "적용됨"}
        </span>
      </div>
      <div className="dbg-hdri-cur">
        현재: <code>{current.name}</code>{current.local && <small> (로컬 파일)</small>}
      </div>
      <div className="dbg-hdri-list">
        {BUNDLED_HDRIS.map((h) => (
          <button key={h.url} className={`dbg-hdri-item ${current.url === h.url ? "on" : ""}`} onClick={() => select(h)} title={h.name}>
            <span className="dbg-hdri-thumb">{h.ext.toUpperCase()}</span>
            <span>{h.name}{h === DEFAULT_HDRI ? " ★" : ""}</span>
          </button>
        ))}
      </div>
      <div>
        <button className="dbg-btn" onClick={() => inputRef.current?.click()}>파일 불러오기 (.hdr/.exr)</button>
        <button className="dbg-btn" disabled={current.url === DEFAULT_HDRI.url} onClick={reset}>기본(port_hdr)으로</button>
        <input ref={inputRef} type="file" accept=".hdr,.exr" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="dbg-hdri-drop">여기에 .hdr / .exr 파일을 끌어다 놓으세요</div>
      {(warn || (status === "error" && error)) && <div className="dbg-hdri-err">{warn || error}</div>}
    </div>
  );
}

const CSS = `
.dbg-hdri{border:1px solid #fff2;border-radius:8px;padding:8px 10px;margin-bottom:10px;background:#ffffff08}
.dbg-hdri.drag{border-color:#3d7cff;background:#3d7cff22}
.dbg-hdri-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.dbg-hdri-head small{opacity:.55;font-size:11px;margin-left:4px}
.dbg-hdri-st{font-size:12px;padding:2px 8px;border-radius:10px;background:#1f9d6a}
.dbg-hdri-st.loading{background:#a07a1f}.dbg-hdri-st.error{background:#b33}
.dbg-hdri-cur{font-size:13px;margin-bottom:6px}
.dbg-hdri-list{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.dbg-hdri-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:96px;background:#2a3140;color:#eef;border:2px solid transparent;border-radius:8px;padding:5px;cursor:pointer;font-size:11px;word-break:break-all}
.dbg-hdri-item.on{border-color:#3d7cff}
.dbg-hdri-thumb{width:84px;height:42px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:700;background:linear-gradient(180deg,#6fa8ff,#f3d9a8 70%,#5a5040)}
.dbg-hdri-drop{font-size:12px;opacity:.6;border:1px dashed #fff4;border-radius:6px;padding:6px;text-align:center;margin-top:4px}
.dbg-hdri-err{color:#ff8a8a;font-size:12px;margin-top:4px}
`;
