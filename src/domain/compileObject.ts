import type { Object3D } from "three";

type ClippingContextLike = { getGroupContext(group: Object3D): ClippingContextLike };
type ProjectObject = (o: Object3D, c: unknown, order: number, list: unknown, ctx: ClippingContextLike) => void;
type CompilingRenderer = {
  compileAsync: (o: Object3D, c: unknown, s: Object3D) => Promise<unknown>;
  _projectObject: ProjectObject;
};

/**
 * compileAsync(객체) 는 조상 ClippingGroup 을 거치지 않아 잘라내기 없는 키로 빌드되고,
 * 화면 렌더가 그 렌더 객체를 버리고 다시 빌드한다. 조상 그룹의 잘라내기 문맥을 붙여 컴파일한다.
 */
export function compileInClippingGroups(gl: unknown, o: Object3D, camera: unknown, scene: Object3D) {
  const r = gl as CompilingRenderer;
  const groups: Object3D[] = [];
  for (let p = o.parent; p; p = p.parent) {
    const g = p as Object3D & { isClippingGroup?: boolean; enabled?: boolean };
    if (g.isClippingGroup && g.enabled) groups.unshift(g);
  }
  if (groups.length === 0) return r.compileAsync(o, camera, scene);
  const own = Object.prototype.hasOwnProperty.call(r, "_projectObject");
  const project = r._projectObject;
  const restore = () => {
    if (own) r._projectObject = project;
    else delete (r as Partial<CompilingRenderer>)._projectObject;
  };
  r._projectObject = function (this: unknown, obj, c, order, list, ctx) {
    restore();
    let next = ctx;
    for (const g of groups) next = next.getGroupContext(g);
    return project.call(this, obj, c, order, list, next);
  };
  // compileAsync 의 첫 투영은 첫 await 전에 동기로 끝나므로 다른 병렬 호출과 겹치지 않는다.
  const pending = r.compileAsync(o, camera, scene);
  restore();
  return pending;
}
