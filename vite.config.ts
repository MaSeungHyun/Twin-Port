import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // [perf] 벤더 분리: 앱 코드만 바뀌어도 three/r3f 청크는 브라우저 캐시 재사용 + 병렬 다운로드
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]three[\\/]/.test(id)) return "three";
          if (/@react-three|three-stdlib|three-mesh-bvh|troika|camera-controls|maath|meshoptimizer/.test(id)) return "r3f";
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/leva|@radix|@stitches/.test(id)) return "leva";
          return "vendor";
        },
      },
    },
  },
  assetsInclude: ["**/*.png", "**/*.glb", "**/*.hdr"],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
