import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

/**
 * 이 브라우저의 blob 워커에서는 Basis WASM 초기화가 끝나지 않아
 * KTX2 텍스처가 걸린 GLB 파싱이 영구히 멈춘다.
 * [perf] 먼저 같은 출처 클래식 워커(public/basis/ktx2_worker.js)로 트랜스코드하고,
 * 워커가 READY_TIMEOUT_MS 안에 WASM 준비 신호를 못 보내거나 오류가 나면 같은 디코더를 메인 스레드에서 돌린다.
 */
type MessageHandler = (event: { data: unknown }) => void;

let basisReady: Promise<void> | null = null;

function loadBasisScript() {
  if (basisReady) return basisReady;
  basisReady = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && "BASIS" in window) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${import.meta.env.BASE_URL}basis/basis_transcoder.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("basis_transcoder.js"));
    document.head.appendChild(script);
  });
  return basisReady;
}

const transcoderApi = KTX2Loader as unknown as {
  BasisWorker: { toString(): string };
  EngineFormat: unknown;
  EngineType: unknown;
  TranscoderFormat: unknown;
  BasisFormat: unknown;
};

const workerSource = transcoderApi.BasisWorker.toString();
const workerBody = workerSource.slice(workerSource.indexOf("{") + 1, workerSource.lastIndexOf("}"));
const runWorkerBody = new Function(
  "_EngineFormat",
  "_EngineType",
  "_TranscoderFormat",
  "_BasisFormat",
  "self",
  "BASIS",
  workerBody,
) as (
  engineFormat: unknown,
  engineType: unknown,
  transcoderFormat: unknown,
  basisFormat: unknown,
  selfShim: { addEventListener: (type: string, fn: MessageHandler) => void; postMessage: (data: unknown) => void },
  basis: unknown,
) => void;

function createMainThreadWorker(config: unknown, wasmBinary: ArrayBuffer) {
  const listeners = new Set<MessageHandler>();
  let inbound: MessageHandler | null = null;
  // 바로 처리하면 응답이 다음 텍스처 요청을 같은 태스크에서 부르며 전체 트랜스코드가 한 프레임에 몰린다.
  const pending: unknown[] = [];
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    const data = pending.shift();
    inbound?.({ data });
  };
  const selfShim = {
    addEventListener(_type: string, fn: MessageHandler) {
      inbound = fn;
    },
    postMessage(data: unknown) {
      for (const listener of listeners) listener({ data });
    },
  };
  runWorkerBody(
    transcoderApi.EngineFormat,
    transcoderApi.EngineType,
    transcoderApi.TranscoderFormat,
    transcoderApi.BasisFormat,
    selfShim,
    (window as unknown as { BASIS: unknown }).BASIS,
  );
  const worker = {
    addEventListener(type: string, fn: MessageHandler) {
      if (type === "message") listeners.add(fn);
    },
    removeEventListener(_type: string, fn: MessageHandler) {
      listeners.delete(fn);
    },
    postMessage(data: unknown) {
      pending.push(data);
      channel.port2.postMessage(null);
    },
    terminate() {
      channel.port1.close();
    },
  };
  worker.postMessage({
    type: "init",
    config,
    transcoderBinary: wasmBinary.slice(0),
  });
  return worker;
}

/** 워커가 WASM 준비 신호를 보낼 때까지 기다리는 시간. 넘기면 메인 스레드로 폴백 */
const READY_TIMEOUT_MS = 5000;
const WORKER_LIMIT = 2;
/** 한 번 실패하면 이후 생성은 바로 메인 스레드 */
let workerBroken = false;

type TranscodeTarget = { postMessage(data: unknown, transfer?: Transferable[]): void; terminate(): void };

/** 워커 우선 트랜스코더. 준비 전 요청은 큐에 두었다가 워커(또는 폴백한 메인 스레드)로 보낸다. 전송 버퍼는 준비 후에만 넘긴다. */
function createWorkerFirst(config: unknown, wasmBinary: ArrayBuffer) {
  if (workerBroken || typeof Worker === "undefined") return createMainThreadWorker(config, wasmBinary);
  let real: Worker;
  try {
    real = new Worker(`${import.meta.env.BASE_URL}basis/ktx2_worker.js`);
  } catch {
    workerBroken = true;
    return createMainThreadWorker(config, wasmBinary);
  }
  const listeners = new Set<MessageHandler>();
  const queued: [unknown, Transferable[] | undefined][] = [];
  let target: TranscodeTarget | null = null;
  const emit = (data: unknown) => {
    for (const listener of listeners) listener({ data });
  };
  const flush = () => {
    const t = target;
    if (!t) return;
    for (const [data, transfer] of queued.splice(0)) t.postMessage(data, transfer);
  };
  const fallback = (why: string) => {
    if (target) return;
    window.clearTimeout(timer);
    workerBroken = true;
    console.warn(`[ktx2] 워커 트랜스코더 ${why} → 메인 스레드`);
    real.terminate();
    const main = createMainThreadWorker(config, wasmBinary);
    main.addEventListener("message", (event) => emit(event.data));
    target = main;
    flush();
  };
  const timer = window.setTimeout(() => fallback("준비 시간 초과"), READY_TIMEOUT_MS);
  real.addEventListener("message", (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === "__ready") {
      if (target) return;
      window.clearTimeout(timer);
      target = real;
      flush();
      return;
    }
    emit(event.data);
  });
  real.addEventListener("error", () => fallback("오류"));
  real.postMessage({
    type: "__boot",
    transcoderUrl: new URL(`${import.meta.env.BASE_URL}basis/basis_transcoder.js`, window.location.href).href,
    body: workerBody,
    consts: [transcoderApi.EngineFormat, transcoderApi.EngineType, transcoderApi.TranscoderFormat, transcoderApi.BasisFormat],
  });
  const binary = wasmBinary.slice(0);
  real.postMessage({ type: "init", config, transcoderBinary: binary }, [binary]);
  return {
    addEventListener(type: string, fn: MessageHandler) {
      if (type === "message") listeners.add(fn);
    },
    removeEventListener(_type: string, fn: MessageHandler) {
      listeners.delete(fn);
    },
    postMessage(data: unknown, transfer?: Transferable[]) {
      if (target) target.postMessage(data, transfer);
      else queued.push([data, transfer]);
    },
    terminate() {
      window.clearTimeout(timer);
      real.terminate();
      target?.terminate();
    },
  };
}

let patched = false;

export function useMainThreadKtx2() {
  if (patched) return;
  patched = true;
  const original = KTX2Loader.prototype.init;
  KTX2Loader.prototype.init = function initOnMainThread(this: KTX2Loader) {
    if (this.transcoderPending) return this.transcoderPending;
    const created = original.call(this);
    const wrapped = Promise.resolve(loadBasisScript())
      .then(() => created)
      .then(() => {
        this.workerPool.setWorkerLimit(WORKER_LIMIT);
        this.workerPool.setWorkerCreator(
          () => createWorkerFirst(this.workerConfig, this.transcoderBinary as ArrayBuffer) as unknown as Worker,
        );
      });
    this.transcoderPending = wrapped;
    return wrapped;
  };
}
