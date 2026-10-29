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
import { splitBlockCode } from "@/domain/blockLabel";
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
/** 2줄 라벨: 윗줄 "Block"(작게) + 아랫줄 번호 */
const PREFIX_EM = 0.55;
const PREFIX_LINE_EM = 0.7;
const NUMBER_LINE_EM = 1.1;
const LABEL_TEXT_EM = PREFIX_LINE_EM + NUMBER_LINE_EM;
const LABEL_PAD_EM = 0.2;
const labelCache = new Map<string, { tex: CanvasTexture; aspect: number }>();
function getLabelTexture(code: string) {
  let e = labelCache.get(code);
  if (e) return e;
  const { prefix, number } = splitBlockCode(code);
  const family = `"Pretendard", "Malgun Gothic", system-ui, sans-serif`;
  const numFont = `600 ${LABEL_PX}px ${family}`;
  const preFont = `500 ${Math.round(LABEL_PX * PREFIX_EM)}px ${family}`;
  const pad = LABEL_PX * LABEL_PAD_EM;
  const cv = document.createElement("canvas");
  let ctx = cv.getContext("2d")!;
  const ls = ctx as unknown as { letterSpacing: string };
  ls.letterSpacing = "0.04em";
  ctx.font = numFont;
  const numW = ctx.measureText(number).width;
  ctx.font = preFont;
  const preW = ctx.measureText(prefix).width;
  const w = Math.ceil(Math.max(numW, preW) + pad * 2);
  const h = Math.ceil(LABEL_PX * LABEL_TEXT_EM + pad * 2);
  cv.width = w;
  cv.height = h;
  ctx = cv.getContext("2d")!;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0.04em";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(15,23,42,0.55)";
  ctx.fillStyle = "rgba(248,250,252,0.9)";
  const lines: [string, string, number, number][] = [
    [prefix, preFont, pad + (LABEL_PX * PREFIX_LINE_EM) / 2, PREFIX_EM],
    [number, numFont, pad + LABEL_PX * (PREFIX_LINE_EM + NUMBER_LINE_EM / 2), 1],
  ];
  for (const [text, font, y, em] of lines) {
    ctx.font = font;
    ctx.lineWidth = LABEL_PX * em * 0.08 * 2;
    ctx.strokeText(text, w / 2, y);
    ctx.fillText(text, w / 2, y);
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  e = { tex, aspect: w / h };
  labelCache.set(code, e);
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
  // 2줄이라 번호 글자 크기를 기존 대비 0.8배로 → 전체 라벨이 블록 안에 들어가게
  const planeH = fontSize * 0.8 * (LABEL_TEXT_EM + LABEL_PAD_EM * 2);


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
