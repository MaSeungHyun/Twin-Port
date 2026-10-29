/**
 * [perf] GLB 바이트 캐시 (smart-factory src/lib/three/glbCache.ts 이식).
 * - URL 당 세션 1회 fetch (진행 중/완료 요청 공유) → 모듈 로드 시 prefetch 와 useGLTF 가 같은 요청을 씀
 * - Cache Storage 에 보관 → 새로고침 시 재다운로드 없음. 배포 URL 은 content-hash 라 그대로 신뢰,
 *   dev 는 HEAD (ETag/Last-Modified/Content-Length) 비교 후 바뀌었으면 재다운로드.
 */
const CACHE_NAME = "tp-glb-v1";
const buffers = new Map<string, Promise<ArrayBuffer>>();

const version = (headers: Headers) =>
  [headers.get("etag"), headers.get("last-modified"), headers.get("content-length")].join("|");

async function download(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB ${url}: HTTP ${response.status}`);
  return response;
}

async function load(url: string): Promise<ArrayBuffer> {
  if (typeof caches === "undefined") return (await download(url)).arrayBuffer();
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) {
      if (import.meta.env.PROD) return await hit.arrayBuffer();
      const head = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (head.ok && version(head.headers) === hit.headers.get("x-tp-version")) return await hit.arrayBuffer();
    }
    const response = await download(url);
    const buffer = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set("x-tp-version", version(response.headers));
    cache.put(url, new Response(buffer.slice(0), { headers })).catch(() => {});
    return buffer;
  } catch {
    return (await download(url)).arrayBuffer();
  }
}

export function fetchGlb(url: string): Promise<ArrayBuffer> {
  const key = new URL(url, globalThis.location?.href).href;
  let pending = buffers.get(key);
  if (!pending) {
    pending = load(key);
    buffers.set(key, pending);
    pending.catch(() => buffers.delete(key));
  }
  return pending;
}