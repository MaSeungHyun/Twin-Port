/* [perf] KTX2(Basis) 트랜스코드 전용 클래식 워커. blob 워커 대신 같은 출처 파일로 띄운다.
 * 첫 메시지(__boot)로 three KTX2Loader.BasisWorker 본문과 상수를 받아 실행하고,
 * WASM 초기화가 끝나면 __ready 를 보낸다. (src/domain/ktx2MainThread.ts 가 준비 신호를 못 받으면 메인 스레드로 폴백) */
self.addEventListener("message", function boot(event) {
  var data = event.data;
  if (!data || data.type !== "__boot") return;
  self.removeEventListener("message", boot);
  importScripts(data.transcoderUrl);
  var basis = self.BASIS;
  var wrapped = function (options) {
    return basis(options).then(function (module) {
      self.postMessage({ type: "__ready" });
      return module;
    });
  };
  var run = new Function("_EngineFormat", "_EngineType", "_TranscoderFormat", "_BasisFormat", "BASIS", data.body);
  run(data.consts[0], data.consts[1], data.consts[2], data.consts[3], wrapped);
});