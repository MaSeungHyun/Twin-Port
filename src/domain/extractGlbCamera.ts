import { type Camera, type Object3D, PerspectiveCamera, Vector3 } from "three";

export type GlbViewCamera = {
  position: Vector3;
  target: Vector3;
  fov?: number;
  near?: number;
  far?: number;
};

function isNamedCamera(object: Object3D) {
  return /^camera$/i.test(object.name);
}

function isNamedTarget(object: Object3D) {
  return /^camera_target$/i.test(object.name);
}

/** BUSAN GLB의 CAMERA + camera_target. root는 이미 world 변환이 적용된 상태 */
export function extractGlbViewCamera(root: Object3D): GlbViewCamera | null {
  const found: { camera?: Object3D; target?: Object3D } = {};

  root.traverse((child) => {
    if (!found.camera && isNamedCamera(child)) found.camera = child;
    if (!found.target && isNamedTarget(child)) found.target = child;
  });

  const cameraObject = found.camera;
  if (!cameraObject) return null;

  const position = new Vector3();
  cameraObject.updateWorldMatrix(true, false);
  cameraObject.getWorldPosition(position);

  const target = new Vector3();
  if (found.target) {
    found.target.updateWorldMatrix(true, false);
    found.target.getWorldPosition(target);
  }

  const view: GlbViewCamera = { position, target };
  if (cameraObject instanceof PerspectiveCamera) {
    view.fov = cameraObject.fov;
    view.near = cameraObject.near;
    view.far = cameraObject.far;
  }

  return view;
}

export function applyGlbViewCamera(
  camera: Camera,
  view: GlbViewCamera,
  controls?: { target: Vector3; update: () => void } | null,
) {
  camera.position.copy(view.position);
  if (camera instanceof PerspectiveCamera) {
    if (view.fov != null) camera.fov = view.fov;
    if (view.near != null) camera.near = view.near;
    if (view.far != null) camera.far = view.far;
    // camera.aspect = 1920 / 1080;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(view.target);
  camera.updateMatrixWorld();

  if (controls) {
    controls.target.copy(view.target);
    controls.update();
  }
}
