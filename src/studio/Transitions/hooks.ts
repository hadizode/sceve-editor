import { useMemo } from 'react';
import { useCurrentProject, useStudioStore } from '../../stores/store';
import type { Scene, SceneObject } from '../../shared/types';

export interface ProjectObj {
  key: string;
  sceneId: string;
  sceneTitle: string;
  objTitle: string;
  obj: SceneObject;
}

/** Every object in every room of the project (incl. close-up view objects), addressable as `sceneId|objectId`. */
export function useProjectObjects(): ProjectObj[] {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  return useMemo(() => {
    const out: ProjectObj[] = [];
    for (const sc of (project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean)) {
      const walk = (objs: SceneObject[], prefix = '') => {
        for (const o of objs) {
          out.push({
            key: `${sc.id}|${o.id}`,
            sceneId: sc.id,
            sceneTitle: sc.title,
            objTitle: prefix + o.name,
            obj: o,
          });
          if (o.view) walk(o.view.objects, `${prefix}${o.name} › `);
        }
      };
      walk(sc.objects);
    }
    return out;
  }, [project, scenes]);
}

export function useRooms() {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  return useMemo(
    () => (project?.scenes ?? []).map((id) => scenes[id]).filter((s): s is Scene => !!s),
    [project, scenes]
  );
}
