import "@/domain/glbPrefetch"; // [perf] GLB 병렬 다운로드를 React 마운트 전에 시작
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
