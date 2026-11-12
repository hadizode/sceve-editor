import React, { useEffect, useState } from "react";
import Player from "./player/Player";
import { useStudioStore } from "./stores/store";
import { Toasts } from "./shared/notify";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

interface BundleProject {
  id?: string;
  name?: string;
}

/**
 * Play-only entry point for the Telegram Mini App: loads the single exported
 * `/project.json` bundle and plays it with the existing Player. No Studio UI.
 */
export default function PlayApp() {
  const hydrated = useStudioStore((s) => s.hydrated);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Tell Telegram the Mini App is ready and ask for full-height expansion (once).
  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/project.json");
        if (!res.ok) throw new Error(`Failed to load project.json (HTTP ${res.status})`);
        const text = await res.text();

        let bundle: { project?: BundleProject };
        try {
          bundle = JSON.parse(text);
        } catch {
          throw new Error("project.json is not valid JSON");
        }
        const id = bundle?.project?.id;
        if (!id) throw new Error('project.json is missing "project.id"');

        const studio = useStudioStore.getState();
        // Replace any stale IndexedDB copy so the bundle is always authoritative.
        if (studio.projects.some((p) => p.id === id)) {
          studio.deleteProject(id);
        }

        const result = useStudioStore.getState().importBundle(text);
        if (!result.ok) {
          if (!cancelled) setError(result.error);
          return;
        }

        useStudioStore.getState().selectProject(id);
        if (cancelled) return;
        setProjectId(id);
        setProjectName(bundle.project?.name ?? "");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  return (
    <div className="h-screen bg-gray-900 text-white" dir="rtl">
      {!hydrated ? (
        <div className="h-full flex items-center justify-center text-gray-400">در حال بارگذاری…</div>
      ) : error ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 p-6">
          <p className="text-lg">⛔ خطا در بارگذاری پروژه</p>
          <pre className="text-sm whitespace-pre-wrap text-left" dir="ltr">{error}</pre>
        </div>
      ) : projectId ? (
        <Player key={projectId} projectName={projectName} />
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">در حال بارگذاری…</div>
      )}
      <Toasts />
    </div>
  );
}
