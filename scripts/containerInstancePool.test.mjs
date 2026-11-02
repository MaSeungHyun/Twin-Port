import assert from "node:assert/strict";
import test from "node:test";
import { BoxGeometry, DoubleSide, Group, Matrix4, MeshStandardMaterial } from "three";
import { ensureContainerBlockMesh } from "../src/domain/containerInstancePool.ts";
import { attachFadeOpacity, writeFadeOpacity } from "../src/domain/fadeOpacity.ts";

test("Depth fade keeps a single double-sided pass and updates opacity without recompilation", () => {
  const material = attachFadeOpacity(new MeshStandardMaterial({ side: DoubleSide }));
  const version = material.version;
  const node = material.opacityNode;
  writeFadeOpacity(material, 0.1);
  assert.equal(material.side, DoubleSide);
  assert.equal(material.forceSinglePass, true);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.1);
  assert.equal(node.value, 0.1);
  writeFadeOpacity(material, 1);
  assert.equal(material.opacityNode, node);
  assert.equal(node.value, 1);
  assert.equal(material.version, version);
});

test("near/far and Depth transitions reuse the same mesh and instance buffer", () => {
  const root = new Group();
  const pool = new Map();
  const geometry = new BoxGeometry();
  const materials = [1, 0.1, 0.1].map(opacity => new MeshStandardMaterial({ opacity, transparent: opacity < 1 }));
  const ensure = () => ensureContainerBlockMesh(pool, root, "B01", "red", geometry, materials, 32);
  const mesh = ensure();
  const matrixBuffer = mesh.instanceMatrix;
  for (let i = 0; i < 100; i++) {
    const next = ensure();
    next.material = materials[i % 3];
    next.count = i % 2 ? 1 : 4;
    next.setMatrixAt(0, new Matrix4().makeScale(1, i % 2 ? 4 : 1, 1));
    assert.equal(next, mesh);
    assert.equal(next.instanceMatrix, matrixBuffer);
  }
  assert.equal(pool.size, 1);
  assert.equal(root.children.length, 1);
  assert.deepEqual(mesh.userData.warmMaterials, materials);
});

test("every block/color registers all material variants, even initially empty slots", () => {
  const root = new Group();
  const pool = new Map();
  const geometry = new BoxGeometry();
  const materials = [0, 1, 2].map(() => new MeshStandardMaterial());
  for (const code of ["B01", "B02"]) {
    for (const color of ["red", "blue"]) {
      const mesh = ensureContainerBlockMesh(pool, root, code, color, geometry, materials, 32);
      assert.equal(mesh.count, 0);
      assert.equal(mesh.visible, false);
      assert.deepEqual(mesh.userData.warmMaterials, materials);
    }
  }
  assert.equal(pool.size, 4);
});

test("geometry replacement disposes only the old instance, preserving shared assets", () => {
  const root = new Group();
  const pool = new Map();
  const geometry = new BoxGeometry();
  const materials = [0, 1, 2].map(() => new MeshStandardMaterial());
  const original = ensureContainerBlockMesh(pool, root, "B01", "red", geometry, materials, 32);
  let disposed = 0;
  original.addEventListener("dispose", () => disposed++);
  geometry.addEventListener("dispose", () => assert.fail("shared geometry disposed"));
  materials.forEach(m => m.addEventListener("dispose", () => assert.fail("shared material disposed")));
  const next = ensureContainerBlockMesh(pool, root, "B01", "red", geometry.clone(), materials, 32);
  assert.notEqual(next, original);
  assert.equal(original.parent, null);
  assert.equal(root.children.length, 1);
  assert.equal(disposed, 1);
});
