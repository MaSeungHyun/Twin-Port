import type { BlockDefinition } from "@/constants/block";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
  getBlockLabelSize,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Material, Mesh } from "three";
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Vector3 } from "three";
import { useYardStore } from "@/stores/yard";
import {
  BLOCK_LABEL_MAX_SCALE,
  BLOCK_LABEL_MIN_SCALE,
  BLOCK_LABEL_REF_DISTANCE,
} from "./constants";

const _labelWorld = new Vector3();

/**
 * drei Text(troika, GLSL 파생 머티리얼) 대체: 캔버스 텍스처 평면 라벨.
 * troika 와 같은 룩 — fill #f8fafc 0.9, outline 0.08em #0f172a 0.55, letterSpacing 0.04em, 중앙 정렬.
 */
const LABEL_PX = 128;
const labelCache = new Map<string, { tex: CanvasTexture; aspect: number }>();
function getLabelTexture(text: string) {
  let e = labelCache.get(text);
  if (e) return e;
  const font = `600 ${LABEL_PX}px "Pretendard", "Malgun Gothic", system-ui, sans-serif`;
  const pad = LABEL_PX * 0.2;
  const cv = document.createElement("canvas");
  let ctx = cv.getContext("2d")!;
  ctx.font = font;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0.04em";
  const w = Math.ceil(ctx.measureText(text).width + pad * 2);
  const h = Math.ceil(LABEL_PX * 1.25 + pad * 2);
  cv.width = w;
  cv.height = h;
  ctx = cv.getContext("2d")!;
  ctx.font = font;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0.04em";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = LABEL_PX * 0.08 * 2;
  ctx.strokeStyle = "rgba(15,23,42,0.55)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = "rgba(248,250,252,0.9)";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  e = { tex, aspect: w / h };
  labelCache.set(text, e);
  return e;
}

function applyAlwaysOnTop(material: Material | Material[] | undefined) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  for (const mat of list) {
    if (mat.depthTest || mat.depthWrite || !mat.transparent) {
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  }
}

function labelScaleForDistance(distance: number) {
  return Math.min(
    BLOCK_LABEL_MAX_SCALE,
    Math.max(BLOCK_LABEL_MIN_SCALE, distance / BLOCK_LABEL_REF_DISTANCE),
  );
}

/** 바닥과 평행한 Block 코드 라벨 — 블록 크기 + 카메라 거리에 비례 */
export default function BlockFloorLabel({
  block,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
}) {
  const deckY = useYardStore((s) => s.deckY);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const fontSize = getBlockLabelSize(block);
  const alongBay = depth >= width;
  const groupRef = useRef<Group>(null);
  const textRef = useRef<Mesh>(null);
  const label = useMemo(() => getLabelTexture(block.code), [block.code]);
  // 캔버스 높이 = 1.25em + 패딩 0.4em → 평면 높이를 fontSize 기준으로 환산
  const planeH = fontSize * ((LABEL_PX * 1.25 + LABEL_PX * 0.4) / LABEL_PX);


  useFrame(({ camera }) => {
    const group = groupRef.current;
    const text = textRef.current;
    if (!group) return;

    group.getWorldPosition(_labelWorld);
    const scale = labelScaleForDistance(camera.position.distanceTo(_labelWorld));
    group.scale.setScalar(scale);

    if (!text) return;
    text.renderOrder = 10000;
    applyAlwaysOnTop(text.material);
  });

  return (
    <group
      ref={groupRef}
      position={[center[0], deckY + block.origin[1] + 0.006, center[2]]}
      rotation={[
        -Math.PI / 2,
        0,
        (block.yaw ?? 0) + (alongBay ? 0 : Math.PI / 2),
      ]}
    >
      <mesh ref={textRef} raycast={() => null} renderOrder={10000} scale={[planeH * label.aspect, planeH, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={label.tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
