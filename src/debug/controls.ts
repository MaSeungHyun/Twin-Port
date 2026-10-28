/**
 * 디자이너용 디버그 UI 상태 (leva 대체). leva의 useControls/button 과 호환되는 최소 API.
 * 모든 패널 값은 하나의 zustand 스토어(useDebugStore)에 저장된다.
 */
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Getter = (path: string) => any;
export interface ButtonInput { __button: true; fn: (get: Getter) => void }
export const button = (fn: (get: Getter) => void): ButtonInput => ({ __button: true, fn });

export interface FieldSpec {
  key: string;
  kind: "number" | "boolean" | "color" | "text" | "select" | "vector" | "button";
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: any[];
  label?: string;
  hint?: string;
  editable?: boolean;
  onChange?: (v: any) => void;
  fn?: (get: Getter) => void;
}
export interface PanelState { fields: FieldSpec[]; values: Record<string, any>; defaults: Record<string, any> }

interface DebugStore {
  panels: Record<string, PanelState>;
  rev: number;
  open: string | null;
  setOpen: (p: string | null) => void;
}
export const useDebugStore = create<DebugStore>()((set) => ({
  panels: {},
  rev: 0,
  open: null,
  setOpen: (open) => set({ open }),
}));

/** leva 폴더 이름 → 패널 이름 */
export const panelOf = (folder: string) => {
  const map: Record<string, string> = {
    "Directional Light": "Sun Light",
    "Directional Light.Shadow": "Sun Light",
    "Directional Light.Target": "Sun Light",
    "Sky Material": "Sky",
  };
  return map[folder] ?? folder;
};

function parse(key: string, raw: any): FieldSpec {
  if (raw && raw.__button) return { key, kind: "button", fn: raw.fn };
  if (typeof raw === "number") return { key, kind: "number", value: raw };
  if (typeof raw === "boolean") return { key, kind: "boolean", value: raw };
  if (typeof raw === "string") return { key, kind: raw.startsWith("#") ? "color" : "text", value: raw };
  if (Array.isArray(raw)) return { key, kind: "select", value: raw[0], options: raw };
  const s = raw as Record<string, any>;
  const v = s.value;
  const base = { key, label: s.label, hint: s.hint, onChange: s.onChange, editable: s.editable };
  if (s.options) return { ...base, kind: "select", value: v ?? s.options[0], options: Array.isArray(s.options) ? s.options : Object.values(s.options) };
  if (typeof v === "number") return { ...base, kind: "number", value: v, min: s.min, max: s.max, step: s.step };
  if (typeof v === "boolean") return { ...base, kind: "boolean", value: v };
  if (typeof v === "string") return { ...base, kind: v.startsWith("#") ? "color" : "text", value: v };
  if (v && typeof v === "object") return { ...base, kind: "vector", value: { ...v }, step: s.step };
  return { ...base, kind: "text", value: String(v ?? "") };
}

let notifyQueued = false;
const notify = () => {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    useDebugStore.setState((s) => ({ rev: s.rev + 1, panels: { ...s.panels } }));
  });
};

/** 패널 등록 (렌더 중 동기 — 이미 있으면 새 필드만 병합) */
function register(panel: string, schema: Record<string, any>) {
  const st = useDebugStore.getState();
  const p: PanelState = st.panels[panel] ?? { fields: [], values: {}, defaults: {} };
  let changed = !st.panels[panel];
  for (const [k, raw] of Object.entries(schema)) {
    const f = parse(k, raw);
    const i = p.fields.findIndex((x) => x.key === k);
    if (i >= 0) {
      p.fields[i] = { ...p.fields[i], onChange: f.onChange, fn: f.fn };
      continue;
    }
    p.fields.push(f);
    if (f.kind !== "button") {
      p.values[k] = f.value;
      p.defaults[k] = f.value;
    }
    changed = true;
  }
  if (changed) {
    st.panels[panel] = p;
    p.values = { ...p.values };
    notify();
  }
  return p;
}

export const getValue: Getter = (path) => {
  const i = path.lastIndexOf(".");
  const folder = i >= 0 ? path.slice(0, i) : "";
  const key = i >= 0 ? path.slice(i + 1) : path;
  const panels = useDebugStore.getState().panels;
  const p = panels[panelOf(folder)] ?? Object.values(panels).find((x) => key in x.values);
  return p?.values[key];
};

/** 패널 값 일부 변경 (onChange 호출 포함 옵션) */
export function setPanelValues(panel: string, partial: Record<string, any>, fireOnChange = false) {
  useDebugStore.setState((s) => {
    const p = s.panels[panel];
    if (!p) return s;
    if (fireOnChange)
      for (const [k, v] of Object.entries(partial)) p.fields.find((f) => f.key === k)?.onChange?.(v);
    return { panels: { ...s.panels, [panel]: { ...p, values: { ...p.values, ...partial } } } };
  });
}
export const resetPanel = (panel: string) => {
  const p = useDebugStore.getState().panels[panel];
  if (p) setPanelValues(panel, { ...p.defaults }, true);
};

/** leva useControls 호환: (folder, schema|fn, opts?) → values | [values, set] */
export function useControls(folder: string, schema: any, _opts?: any): any {
  const panel = panelOf(folder);
  const isFn = typeof schema === "function";
  const schemaRef = useRef<Record<string, any> | null>(null);
  if (!schemaRef.current) schemaRef.current = isFn ? schema() : schema;
  register(panel, schemaRef.current!);
  const values = useDebugStore((s) => s.panels[panel]?.values) ?? useDebugStore.getState().panels[panel]!.values;
  const keys = useMemo(() => Object.keys(schemaRef.current!), []);
  const own = useMemo(() => {
    const o: Record<string, any> = {};
    for (const k of keys) if (k in values) o[k] = values[k];
    return o;
  }, [values, keys]);
  const set = useMemo(() => (partial: Record<string, any>) => setPanelValues(panel, partial), [panel]);
  useEffect(() => undefined, []);
  return isFn ? [own, set] : own;
}
