import { WGSLNodeBuilder } from "three/webgpu";

/**
 * 인스턴스 행렬을 개수만큼의 유니폼 배열로 만들면 배열 길이와 버퍼 이름이
 * 객체마다 달라 정점 셰이더가 갈라진다. 행렬은 정점 attribute 로 두고,
 * 남는 버퍼는 타입·개수·셰이더 안 순서로 같은 이름을 쓴다.
 * 값 버퍼는 객체마다 그대로고, 셰이더 코드만 공유한다.
 */
type BufferLike = {
  isBufferNode?: boolean;
  isStorageBufferNode?: boolean;
  bufferType?: string;
  bufferCount?: number;
};

type Builder = {
  shaderStage: string;
  _stableBufferOrdinals?: Map<string, number>;
  getDataFromNode: (node: object, stage: string) => { stableBufferName?: string };
  getUniformFromNode: (
    node: object,
    type: string,
    stage?: string,
    name?: string | null,
  ) => unknown;
  build: () => unknown;
};

type Capabilities = { getUniformBufferLimit?: () => number };

let patched = false;

export function shareInstanceShaders(renderer: { backend?: { capabilities?: Capabilities } }) {
  const caps = renderer.backend?.capabilities;
  if (caps) {
    // 행렬 1개 = 64바이트. 63 이하면 인스턴스 행렬은 항상 attribute 경로다.
    // 작은 유니폼(재질 값)은 이 한계를 넘지 않는다.
    caps.getUniformBufferLimit = () => 63;
  }
  if (patched) return;
  patched = true;

  const wgsl = WGSLNodeBuilder.prototype as unknown as Builder;
  const origUniform = wgsl.getUniformFromNode;
  wgsl.getUniformFromNode = function (node, type, shaderStage, name) {
    const stage = shaderStage ?? this.shaderStage;
    const buffer = node as BufferLike;
    if ((name == null || name === "") && buffer.isBufferNode) {
      const data = this.getDataFromNode(node, stage);
      if (data.stableBufferName) {
        name = data.stableBufferName;
      } else {
        const ordinals = (this._stableBufferOrdinals ??= new Map());
        const key = `${buffer.bufferType}:${buffer.bufferCount}:${buffer.isStorageBufferNode ? "s" : "u"}`;
        const n = ordinals.get(key) ?? 0;
        ordinals.set(key, n + 1);
        name = `buf_${buffer.bufferType}_${buffer.bufferCount}_${buffer.isStorageBufferNode ? "s" : "u"}_${n}`;
        data.stableBufferName = name;
      }
    }
    return origUniform.call(this, node, type, shaderStage, name);
  };

  const base = Object.getPrototypeOf(WGSLNodeBuilder.prototype) as Builder;
  const origBuild = base.build;
  base.build = function () {
    this._stableBufferOrdinals = new Map();
    return origBuild.call(this);
  };
}
