import { Node } from "three/webgpu";

/**
 * [perf] TSL 노드 생성 위치 추적(디버그용). 노드를 만들 때마다 Error().stack 을 만들고 파싱해서
 * 셰이더 노드 빌드가 몇 배 느려진다(관제 시작 비행·초반 이동 중 끊김의 큰 원인).
 * 주소에 ?tsltrace 를 붙였을 때만 켠다.
 */
const enabled =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tsltrace");

(Node as unknown as { captureStackTrace: boolean }).captureStackTrace = enabled;
