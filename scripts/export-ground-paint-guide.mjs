/**
 * 포트 전체 배치 가이드 — 1200×3000 (그라운드 120×300, 10px = 1)
 * 실행: node scripts/export-ground-paint-guide.mjs
 *
 * 이미지 위 = 월드 −Z (Ground scale.z = −1)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(resolve(__dirname, ".."), "src/assets/image/port");

const GROUND_X = 120;
const GROUND_Z = 300;
const WORLD_X0 = -GROUND_X / 2;
const WORLD_Z0 = -GROUND_Z / 2;
const PX = 10;
const W = 1200;
const H = 3000;

const CONTAINER_W = 0.98;
const CONTAINER_D = 2.42;
const BLOCK_SIZE_X = 6 * CONTAINER_W;
const BLOCK_SIZE_Z = 20 * CONTAINER_D;
const BLOCK_AISLE = BLOCK_SIZE_X * 2;
const BLOCK_PITCH_X = BLOCK_SIZE_X + BLOCK_AISLE;
const BLOCK_PITCH_Z = BLOCK_SIZE_Z + BLOCK_AISLE;
const YARD_OFFSET_X = 5;
const COL_COUNT = 6;
const ROW_COUNT = 4;
const COL_ORIGIN_X =
  -((COL_COUNT - 1) * BLOCK_PITCH_X + BLOCK_SIZE_X) / 2 - YARD_OFFSET_X;
const ROW_ORIGIN_Z = -92;
const PAD = 1.45;

const COL_X = Array.from(
  { length: COL_COUNT },
  (_, i) => COL_ORIGIN_X + i * BLOCK_PITCH_X,
);
const ROW_Z = Array.from(
  { length: ROW_COUNT },
  (_, i) => ROW_ORIGIN_Z + i * BLOCK_PITCH_Z,
);

const BLOCKS = COL_X.flatMap((x, col) =>
  ROW_Z.map((z, row) => {
    const colIndex = COL_COUNT - 1 - col;
    const rowIndex = ROW_COUNT - 1 - row;
    const index = colIndex * ROW_COUNT + rowIndex + 1;
    return {
      code: `B${String(index).padStart(2, "0")}`,
      origin: [x, 0, z],
    };
  }),
);

const SHIPS = [
  { x: 70, z: 80, side: "E" },
  { x: 70, z: 10, side: "E" },
  { x: 70, z: -60, side: "E" },
  { x: -70, z: 80, side: "W" },
  { x: -70, z: 10, side: "W" },
  { x: -70, z: -60, side: "W" },
];

const QUAY_CRANES = [
  ...[70, 80, 90, 0, 10, 20, -50, -60, -70].map((z) => ({ x: 58, z })),
  ...[70, 80, 90, 0, 10, 20, -50, -60, -70].map((z) => ({ x: -55, z })),
];

function wx(x) {
  return (x - WORLD_X0) * PX;
}
function wz(z) {
  return (z - WORLD_Z0) * PX;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const yardX0 = COL_X[0] + YARD_OFFSET_X;
const yardX1 = COL_X.at(-1) + YARD_OFFSET_X + BLOCK_SIZE_X;
const yardZ0 = ROW_Z[0];
const yardZ1 = ROW_Z.at(-1) + BLOCK_SIZE_Z;

const blockRects = BLOCKS.map((b) => {
  const x = b.origin[0] + YARD_OFFSET_X;
  const z = b.origin[2];
  return {
    ...b,
    x: wx(x),
    y: wz(z),
    w: BLOCK_SIZE_X * PX,
    h: BLOCK_SIZE_Z * PX,
    px: wx(x - PAD),
    py: wz(z - PAD),
    pw: (BLOCK_SIZE_X + PAD * 2) * PX,
    ph: (BLOCK_SIZE_Z + PAD * 2) * PX,
  };
});

const gridX = [];
for (let x = -60; x <= 60; x += 10) gridX.push(x);
const gridZ = [];
for (let z = -150; z <= 150; z += 10) gridZ.push(z);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>port layout 1200×3000 · 10px=1 world · top=−Z</title>
  <defs>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#7f1d1d" fill-opacity="0.85"/>
      <path d="M0 14L14 0M-3 3L3 -3M11 17L17 11" stroke="#fca5a5" stroke-width="2"/>
    </pattern>
    <pattern id="sea" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="#0c4a6e"/>
      <path d="M0 12h24M12 0v24" stroke="#155e75" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- 아스팔트 그라운드 전체 -->
  <rect width="${W}" height="${H}" fill="#292524"/>

  <!-- 10유닛 격자 -->
  ${gridX
    .map(
      (x) =>
        `<line x1="${wx(x)}" y1="0" x2="${wx(x)}" y2="${H}" stroke="${x === 0 ? "#a8a29e" : "#44403c"}" stroke-width="${x === 0 ? 2 : 1}"/>`,
    )
    .join("\n  ")}
  ${gridZ
    .map(
      (z) =>
        `<line x1="0" y1="${wz(z)}" x2="${W}" y2="${wz(z)}" stroke="${z === 0 ? "#a8a29e" : "#44403c"}" stroke-width="${z === 0 ? 2 : 1}"/>`,
    )
    .join("\n  ")}

  <!-- 안벽 띠 (그라운드 가장자리, 배 쪽) -->
  <rect x="${wx(50)}" y="0" width="${wx(60) - wx(50)}" height="${H}" fill="#1c1917" fill-opacity="0.7"/>
  <rect x="0" y="0" width="${wx(-50) - wx(-60)}" height="${H}" fill="#1c1917" fill-opacity="0.7"/>
  <text x="${wx(55)}" y="${wz(140)}" fill="#a8a29e" font-size="18" font-family="Segoe UI, sans-serif" text-anchor="middle" writing-mode="tb">+X 안벽 x=50~60</text>
  <text x="${wx(-55)}" y="${wz(140)}" fill="#a8a29e" font-size="18" font-family="Segoe UI, sans-serif" text-anchor="middle" writing-mode="tb">−X 안벽 x=−60~−50</text>

  <!-- 야드 바깥 공터 -->
  <text x="${W / 2}" y="${wz(-130)}" fill="#78716c" font-size="22" font-family="Segoe UI, sans-serif" text-anchor="middle">남측 공터  (Z −150 ~ −92)</text>
  <text x="${W / 2}" y="${wz(145)}" fill="#78716c" font-size="22" font-family="Segoe UI, sans-serif" text-anchor="middle">북측 공터  (Z 136.9 ~ 150)</text>

  <!-- 통로 -->
  ${COL_X.slice(0, -1)
    .map((x) => {
      const x0 = x + YARD_OFFSET_X + BLOCK_SIZE_X;
      return `<rect x="${wx(x0)}" y="${wz(yardZ0)}" width="${BLOCK_AISLE * PX}" height="${(yardZ1 - yardZ0) * PX}" fill="#3f3f46" fill-opacity="0.9"/>`;
    })
    .join("\n  ")}
  ${ROW_Z.slice(0, -1)
    .map((z) => {
      const z0 = z + BLOCK_SIZE_Z;
      return `<rect x="${wx(yardX0)}" y="${wz(z0)}" width="${(yardX1 - yardX0) * PX}" height="${BLOCK_AISLE * PX}" fill="#3f3f46" fill-opacity="0.9"/>`;
    })
    .join("\n  ")}

  <!-- 블록 마크(패드) → 컨테이너 footprint -->
  ${blockRects
    .map(
      (b) => `<g>
    <rect x="${b.px.toFixed(1)}" y="${b.py.toFixed(1)}" width="${b.pw.toFixed(1)}" height="${b.ph.toFixed(1)}" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="6 4"/>
    <rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="url(#hatch)" stroke="#f87171" stroke-width="2"/>
    <text x="${(b.x + b.w / 2).toFixed(1)}" y="${(b.y + b.h / 2).toFixed(1)}" fill="#fecaca" font-size="22" font-weight="700" font-family="Segoe UI, sans-serif" text-anchor="middle" dominant-baseline="middle">${b.code}</text>
  </g>`,
    )
    .join("\n  ")}

  <!-- 안벽 크레인 -->
  ${QUAY_CRANES.map((c) => {
    const cx = clamp(wx(c.x), 8, W - 8);
    const cy = wz(c.z);
    return `<g>
      <rect x="${cx - 8}" y="${cy - 8}" width="16" height="16" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1"/>
      <text x="${cx}" y="${cy - 12}" fill="#7dd3fc" font-size="11" font-family="Segoe UI, sans-serif" text-anchor="middle">${c.x},${c.z}</text>
    </g>`;
  }).join("\n  ")}

  <!-- 배: 그라운드 밖 x=±70 → 가장자리에 표시 -->
  ${SHIPS.map((s) => {
    const onRight = s.side === "E";
    const x = onRight ? W - 4 : 4;
    const y = wz(s.z);
    const w = 36;
    const h = 90;
    const rx = onRight ? x - w : x;
    return `<g>
      <rect x="${rx}" y="${y - h / 2}" width="${w}" height="${h}" fill="#1e3a5f" stroke="#7dd3fc" stroke-width="2"/>
      <text x="${onRight ? rx - 6 : rx + w + 6}" y="${y}" fill="#bae6fd" font-size="14" font-family="Segoe UI, sans-serif" text-anchor="${onRight ? "end" : "start"}" dominant-baseline="middle">SHIP (${s.x}, ${s.z})</text>
    </g>`;
  }).join("\n  ")}

  <!-- 눈금 -->
  ${gridX
    .filter((x) => x % 20 === 0)
    .map(
      (x) =>
        `<text x="${wx(x)}" y="22" fill="#d6d3d1" font-size="13" font-family="Segoe UI, sans-serif" text-anchor="middle">X ${x}</text>`,
    )
    .join("\n  ")}
  ${gridZ
    .filter((z) => z % 50 === 0)
    .map(
      (z) =>
        `<text x="8" y="${wz(z) + 16}" fill="#d6d3d1" font-size="13" font-family="Segoe UI, sans-serif">Z ${z}</text>`,
    )
    .join("\n  ")}

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#e7e5e4" stroke-width="2"/>
  <rect x="16" y="40" width="560" height="118" fill="#0c0a09" fill-opacity="0.85"/>
  <text x="28" y="68" fill="#fafaf9" font-size="22" font-weight="700" font-family="Segoe UI, sans-serif">PORT LAYOUT  1200×3000</text>
  <text x="28" y="92" fill="#d6d3d1" font-size="14" font-family="Segoe UI, sans-serif">그라운드 120×300 · 10px=1 · 위=−Z · 오른쪽=+X 해상</text>
  <text x="28" y="112" fill="#f87171" font-size="14" font-family="Segoe UI, sans-serif">빨강 해치 = 컨테이너 스택 5.88×48.4  · 노란 점선 = 블록 마크(±1.45)</text>
  <text x="28" y="132" fill="#38bdf8" font-size="14" font-family="Segoe UI, sans-serif">하늘색 점 = 안벽 크레인  · 가장자리 = 배(그라운드 밖 x=±70)</text>
  <text x="28" y="148" fill="#a8a29e" font-size="13" font-family="Segoe UI, sans-serif">야드 AABB  X ${yardX0.toFixed(1)}~${yardX1.toFixed(1)}   Z ${yardZ0}~${yardZ1.toFixed(1)}</text>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "ground-paint-guide.svg"), svg);

const txt = `PORT LAYOUT 1200×3000
그라운드 월드 X −60~+60, Z −150~+150
이미지 위 = Z −150 / 아래 = Z +150 / 오른쪽 = +X 해상

야드(컨테이너)  X ${yardX0.toFixed(2)} ~ ${yardX1.toFixed(2)}
                Z ${yardZ0} ~ ${yardZ1.toFixed(2)}
블록 5.88 × 48.4  통로 11.76  열피치 17.64  행피치 60.16
블록 마크 패딩 ±1.45 → 8.78 × 51.3

안벽 크레인  x=58 (동) / x=−55 (서)
             z ∈ {90,80,70, 20,10,0, −50,−60,−70}
배          x=±70 (그라운드 밖), z ∈ {80, 10, −60}

남측 공터 Z −150~−92
북측 공터 Z 136.9~150
동/서 안벽 가장자리 |x| 50~60

재생성: npm run export:ground-guide
`;
writeFileSync(join(outDir, "ground-paint-guide.txt"), txt);
console.log("1200×3000 port layout written");
console.log(`yard X ${yardX0.toFixed(2)}..${yardX1.toFixed(2)} Z ${yardZ0}..${yardZ1.toFixed(2)}`);
