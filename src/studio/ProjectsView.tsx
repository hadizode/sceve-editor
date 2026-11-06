import React, { useRef, useState } from 'react';
import { useStudioStore } from '../stores/store';
import { btnCls, inputCls } from './ui';

export default function ProjectsView() {
  const projects = useStudioStore((s) => s.projects);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const st = useStudioStore.getState;

  const create = () => {
    if (!name.trim()) return;
    const id = st().createProject(name.trim(), desc.trim());
    setName('');
    setDesc('');
    st().selectProject(id);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const res = st().importBundle(await f.text());
    if (!res.ok) alert(`Import failed: ${res.error}`);
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-300">🎨 Escape Room Studio</h1>
          <button className={btnCls} onClick={() => file.current?.click()}>Import JSON</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </div>

        <div className="bg-surface rounded-xl p-4 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3">New project</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input className={inputCls} placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            <input className={inputCls} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1 rounded-lg font-medium disabled:opacity-40" disabled={!name.trim()} onClick={create}>
              Create
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-surface rounded-xl p-4 border border-gray-700 hover:border-indigo-500 transition-colors flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{p.name}</h3>
                <p className="text-gray-400 text-sm truncate">{p.description}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {p.scenes.length} room(s) • code {p.finalLockDigits} • updated {new Date(p.updatedAt).toLocaleString()}
                </p>
              </div>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm" onClick={() => st().selectProject(p.id)}>Open</button>
              <button className={btnCls} onClick={() => st().duplicateProject(p.id)}>Duplicate</button>
              <button className={btnCls} onClick={() => confirm(`Delete "${p.name}"?`) && st().deleteProject(p.id)}>Delete</button>
            </div>
          ))}
          {projects.length === 0 && <p className="text-gray-500 text-center py-8">No projects yet</p>}
        </div>
      </div>
    </div>
  );
}
