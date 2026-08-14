/**
 * Port Ground (아스팔트 박스) → GLB
 * 실행: node scripts/export-ground.mjs
 *
 * 참고: 런타임 Ground 커스텀 셰이더(멀티스케일 패턴)는 GLB에 담기지 않음.
 * 지오메트리 + asphalt PBR 맵(UV REPEAT)만 포함.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO, TextureInfo } from "@gltf-transform/core";
import { BoxGeometry, BufferAttribute } from "three";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const GROUND_X = 120;
const GROUND_Y = 3;
const GROUND_Z = 300;
const TILE_SIZE = 12;
const REPEAT_U = GROUND_X / TILE_SIZE;
const REPEAT_V = GROUND_Z / TILE_SIZE;

const portDir = join(root, "src/assets/image/port");
const outPath = join(root, "src/assets/model/ground.glb");

function toFloat32(attr) {
  const arr = attr.array;
  return arr instanceof Float32Array ? arr : new Float32Array(arr);
}

function scaleUVs(uvAttr, repeatU, repeatV) {
  const uv = toFloat32(uvAttr).slice();
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] *= repeatU;
    uv[i + 1] *= repeatV;
  }
  return uv;
}

function setRepeat(info) {
  if (!info) return;
  info.setWrapS(TextureInfo.WrapMode.REPEAT);
  info.setWrapT(TextureInfo.WrapMode.REPEAT);
}

const geometry = new BoxGeometry(GROUND_X, GROUND_Y, GROUND_Z);
geometry.setAttribute(
  "uv",
  new BufferAttribute(
    scaleUVs(geometry.getAttribute("uv"), REPEAT_U, REPEAT_V),
    2,
  ),
);

const position = toFloat32(geometry.getAttribute("position"));
const normal = toFloat32(geometry.getAttribute("normal"));
const uv = toFloat32(geometry.getAttribute("uv"));
const indices = geometry.index
  ? new Uint32Array(geometry.index.array)
  : null;

const document = new Document();
const buffer = document.createBuffer();

const prim = document
  .createPrimitive()
  .setAttribute(
    "POSITION",
    document
      .createAccessor("position")
      .setType("VEC3")
      .setArray(position)
      .setBuffer(buffer),
  )
  .setAttribute(
    "NORMAL",
    document
      .createAccessor("normal")
      .setType("VEC3")
      .setArray(normal)
      .setBuffer(buffer),
  )
  .setAttribute(
    "TEXCOORD_0",
    document
      .createAccessor("texcoord_0")
      .setType("VEC2")
      .setArray(uv)
      .setBuffer(buffer),
  );

if (indices) {
  prim.setIndices(
    document
      .createAccessor("indices")
      .setType("SCALAR")
      .setArray(indices)
      .setBuffer(buffer),
  );
}

const diffTex = document
  .createTexture("asphalt_diff")
  .setMimeType("image/jpeg")
  .setImage(readFileSync(join(portDir, "asphalt_02_diff_1k.jpg")));

const normalTex = document
  .createTexture("asphalt_normal")
  .setMimeType("image/png")
  .setImage(readFileSync(join(portDir, "asphalt_02_nor_gl_1k.png")));

const material = document
  .createMaterial("GroundAsphalt")
  .setMetallicFactor(0)
  .setRoughnessFactor(0.92)
  .setBaseColorTexture(diffTex)
  .setNormalTexture(normalTex);

setRepeat(material.getBaseColorTextureInfo());
setRepeat(material.getNormalTextureInfo());

prim.setMaterial(material);

const mesh = document.createMesh("Ground").addPrimitive(prim);
const node = document.createNode("Ground").setMesh(mesh);
document.createScene("GroundScene").addChild(node);

mkdirSync(dirname(outPath), { recursive: true });
const io = new NodeIO();
const bytes = await io.writeBinary(document);
writeFileSync(outPath, bytes);

console.log(
  `Exported ${outPath} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB)`,
);
console.log(
  `size ${GROUND_X}×${GROUND_Y}×${GROUND_Z}, UV repeat ${REPEAT_U}×${REPEAT_V}`,
);
