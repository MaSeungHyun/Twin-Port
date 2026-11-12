import type { InstancedMesh } from "three";

/**
 * [perf] 매 프레임 움직이는 인스턴스 행렬 업로드를 실제로 그리는 앞부분(count)만 보낸다.
 * - count 가 0 이면 그리지 않으므로 업로드를 건너뛴다 (다음에 count 가 생기면 그 범위만 다시 보냄).
 * - updateRanges 는 WebGPU/WebGL2 백엔드 모두 업로드 후 자동으로 비운다.
 * setMatrixAt 은 호출하는 쪽에서 미리 끝내 둔다.
 */
export function commitInstanceMatrices(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  if (count <= 0) return;
  const attr = mesh.instanceMatrix;
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, Math.min(count * 16, attr.array.length));
  attr.needsUpdate = true;
}