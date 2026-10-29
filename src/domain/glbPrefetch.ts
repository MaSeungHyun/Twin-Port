/**
 * [perf] React 마운트 전에 모든 GLB 다운로드를 병렬로 시작 (바이트만; 파싱은 useGLTF 가 캐시된 바이트로).
 * 화면 표시 순서/시점은 그대로 (인트로 시작 시 모두 함께).
 */
import busanUrl from "@/assets/model/BUSAN.glb";
import shipUrl from "@/assets/model/ship.glb";
import overheadCraneUrl from "@/assets/model/overhead_crane.glb";
import containersUrl from "@/assets/model/containers.glb";
import { fetchGlb } from "@/domain/glbCache";

for (const url of [busanUrl, shipUrl, overheadCraneUrl, containersUrl]) fetchGlb(url).catch(() => {});