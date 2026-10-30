import React, { useState, useRef } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Group, Line } from 'react-konva';
import useImage from 'use-image';
import { useStudioStore } from '../stores/store';
import type { SceneObject, ObjectType, View } from '../shared/types';
import { validateScene } from '../shared/types';

// ============ Konva Image Component ============
function KonvaImage({ obj, isSelected, onSelect, onDragEnd, onChange }: {
  obj: SceneObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onChange: (id: string, updates: Partial<SceneObject>) => void;
}) {
  const [image] = useImage(obj.imageUrl);
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  React.useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!obj.visible) return null;

  return (
    <Group>
      <KImage
        ref={shapeRef}
        image={image}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        rotation={obj.rotation}
        draggable
        onClick={(e) => onSelect(obj.id, e.evt.shiftKey)}
        onTap={() => onSelect(obj.id, false)}
        onDragEnd={(e) => onDragEnd(obj.id, e.target.x(), e.target.y())}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          onChange(obj.id, {
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          borderStroke="#6366f1"
          anchorStroke="#6366f1"
          anchorFill="#6366f1"
        />
      )}
      {/* Object type indicator */}
      <Rect
        x={obj.x}
        y={obj.y - 18}
        width={obj.width}
        height={16}
        fill={getTypeColor(obj.type)}
        opacity={0.8}
        cornerRadius={4}
        listening={false}
      />
      <Text
        x={obj.x}
        y={obj.y - 18}
        width={obj.width}
        text={obj.name}
        fontSize={10}
        fill="white"
        align="center"
        listening={false}
      />
      {/* View indicator */}
      {obj.view && (
        <Rect
          x={obj.x + obj.width - 16}
          y={obj.y + obj.height - 16}
          width={14}
          height={14}
          fill="#6366f1"
          cornerRadius={3}
          listening={false}
        />
      )}
    </Group>
  );
}

function getTypeColor(type: ObjectType): string {
  switch (type) {
    case 'clue': return '#3b82f6';
    case 'number-piece': return '#f59e0b';
    case 'decoration': return '#6b7280';
    case 'inventory': return '#10b981';
    case 'container': return '#8b5cf6';
    case 'exit': return '#ef4444';
    default: return '#6b7280';
  }
}

// ============ Properties Panel ============
function PropertiesPanel() {
  const { scenes, currentSceneId, selectedObjectIds, updateObject } = useStudioStore();
  const scene = currentSceneId ? scenes[currentSceneId] : null;
  const obj = scene?.objects.find(o => o.id === selectedObjectIds[0]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!obj) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        <p>Select an object to edit its properties</p>
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    updateObject(obj.id, { [field]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleChange('imageUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-3 space-y-3 text-sm overflow-y-auto max-h-[calc(100vh-200px)]">
      <h3 className="font-bold text-indigo-300 text-base">Object Properties</h3>
      
      <div>
        <label className="block text-gray-400 mb-1">Name</label>
        <input
          className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
          value={obj.name}
          onChange={e => handleChange('name', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-gray-400 mb-1">Type</label>
        <select
          className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
          value={obj.type}
          onChange={e => handleChange('type', e.target.value)}
        >
          <option value="clue">Clue</option>
          <option value="number-piece">Number Piece</option>
          <option value="decoration">Decoration</option>
          <option value="inventory">Inventory Item</option>
          <option value="container">Container</option>
          <option value="exit">Exit</option>
        </select>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-gray-400 mb-1">Image</label>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <button
          className="w-full bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded text-xs"
          onClick={() => imageInputRef.current?.click()}
        >
          📁 Upload Image
        </button>
        <div className="mt-2 w-full h-16 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
          <img src={obj.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-gray-400 mb-1">X</label>
          <input type="number" className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
            value={Math.round(obj.x)} onChange={e => handleChange('x', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Y</label>
          <input type="number" className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
            value={Math.round(obj.y)} onChange={e => handleChange('y', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Width</label>
          <input type="number" className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
            value={Math.round(obj.width)} onChange={e => handleChange('width', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Height</label>
          <input type="number" className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
            value={Math.round(obj.height)} onChange={e => handleChange('height', Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="block text-gray-400 mb-1">Rotation (deg)</label>
        <input type="number" className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
          value={Math.round(obj.rotation)} onChange={e => handleChange('rotation', Number(e.target.value))} />
      </div>

      <div>
        <label className="block text-gray-400 mb-1">Message (shown on click)</label>
        <textarea className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white" dir="rtl" lang="fa"
          value={obj.message || ''} onChange={e => handleChange('message', e.target.value)} rows={2} />
      </div>

      {obj.type === 'number-piece' && (
        <div>
          <label className="block text-gray-400 mb-1">Number (0-9)</label>
          <input type="number" min={0} max={9} className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
            value={obj.number ?? ''} onChange={e => handleChange('number', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={obj.visible} onChange={e => handleChange('visible', e.target.checked)} />
          <span className="text-gray-300">Visible</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={obj.oneTimeUse} onChange={e => handleChange('oneTimeUse', e.target.checked)} />
          <span className="text-gray-300">One-time use</span>
        </label>
      </div>

      <div>
        <label className="block text-gray-400 mb-1">Requires Items (comma-separated IDs)</label>
        <input className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
          value={obj.requiresItem?.join(', ') || ''}
          onChange={e => handleChange('requiresItem', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)} />
      </div>

      <div>
        <label className="block text-gray-400 mb-1">Grants Item (ID)</label>
        <input className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white"
          value={obj.grantsItem || ''}
          onChange={e => handleChange('grantsItem', e.target.value || undefined)} />
      </div>

      {/* Pickup / Inventory Section */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-bold text-green-300 text-sm mb-2">🎒 Inventory / Pickup</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={obj.pickupable || false} 
              onChange={e => handleChange('pickupable', e.target.checked)} 
            />
            <span className="text-gray-300">Pickupable (can be added to inventory)</span>
          </label>
          
          {obj.pickupable && (
            <>
              <div>
                <label className="block text-gray-400 mb-1 text-xs">Pickup Item ID</label>
                <input 
                  className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white text-xs"
                  value={obj.pickupItemId || ''}
                  placeholder="e.g., wire-cutter"
                  onChange={e => handleChange('pickupItemId', e.target.value || undefined)} 
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1 text-xs">Pickup Message (Persian)</label>
                <textarea 
                  className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white text-xs"
                  dir="rtl" lang="fa"
                  value={obj.pickupMessage || ''}
                  placeholder="پیام هنگام برداشتن..."
                  onChange={e => handleChange('pickupMessage', e.target.value || undefined)} 
                  rows={2}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transforms Section */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-bold text-purple-300 text-sm mb-2">🔄 Transforms</h4>
        <p className="text-xs text-gray-500 mb-2">Rules for when items are used on this object</p>
        
        {obj.transforms && obj.transforms.length > 0 ? (
          <div className="space-y-2">
            {obj.transforms.map((rule, i) => (
              <div key={i} className="bg-surface-light rounded p-2 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Transform {i + 1}</span>
                  <button 
                    className="text-red-400 hover:text-red-300"
                    onClick={() => {
                      const newTransforms = [...(obj.transforms || [])];
                      newTransforms.splice(i, 1);
                      handleChange('transforms', newTransforms.length > 0 ? newTransforms : undefined);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <label className="text-gray-500">Requires Item:</label>
                  <input 
                    className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white"
                    value={rule.requiresItem}
                    onChange={e => {
                      const newTransforms = [...(obj.transforms || [])];
                      newTransforms[i] = { ...newTransforms[i], requiresItem: e.target.value };
                      handleChange('transforms', newTransforms);
                    }}
                  />
                </div>
                <div>
                  <label className="text-gray-500">New Message:</label>
                  <input 
                    className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white"
                    dir="rtl" lang="fa"
                    value={rule.newMessage || ''}
                    onChange={e => {
                      const newTransforms = [...(obj.transforms || [])];
                      newTransforms[i] = { ...newTransforms[i], newMessage: e.target.value || undefined };
                      handleChange('transforms', newTransforms);
                    }}
                  />
                </div>
                <div>
                  <label className="text-gray-500">Grants Item:</label>
                  <input 
                    className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white"
                    value={rule.grantsItem || ''}
                    onChange={e => {
                      const newTransforms = [...(obj.transforms || [])];
                      newTransforms[i] = { ...newTransforms[i], grantsItem: e.target.value || undefined };
                      handleChange('transforms', newTransforms);
                    }}
                  />
                </div>
                <label className="flex items-center gap-1">
                  <input 
                    type="checkbox" 
                    checked={rule.consumesItem !== false}
                    onChange={e => {
                      const newTransforms = [...(obj.transforms || [])];
                      newTransforms[i] = { ...newTransforms[i], consumesItem: e.target.checked };
                      handleChange('transforms', newTransforms);
                    }}
                  />
                  <span className="text-gray-400">Consumes item</span>
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No transforms defined</p>
        )}
        
        <button
          className="w-full bg-purple-700 hover:bg-purple-600 text-white px-2 py-1.5 rounded text-xs mt-2"
          onClick={() => {
            const newTransforms = [...(obj.transforms || [])];
            newTransforms.push({
              requiresItem: '',
              newMessage: '',
              consumesItem: true,
            });
            handleChange('transforms', newTransforms);
          }}
        >
          + Add Transform Rule
        </button>
      </div>

      {/* View Section */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-bold text-amber-300 text-sm mb-2">🔍 Interactive View</h4>
        {obj.view ? (
          <div className="space-y-2">
            <p className="text-xs text-green-400">✓ View is configured</p>
            <p className="text-xs text-gray-400">Title: {obj.view.title}</p>
            <p className="text-xs text-gray-400">Objects: {obj.view.objects.length}</p>
            <button
              className="w-full bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
              onClick={() => handleChange('view', undefined)}
            >
              Remove View
            </button>
          </div>
        ) : (
          <button
            className="w-full bg-amber-700 hover:bg-amber-600 text-white px-2 py-1.5 rounded text-xs"
            onClick={() => {
              const newView: View = {
                id: `view-${Date.now()}`,
                title: obj.name + ' - Close-up',
                backgroundUrl: obj.imageUrl,
                width: 400,
                height: 400,
                objects: [],
              };
              handleChange('view', newView);
            }}
          >
            + Add Interactive View
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Layers Panel ============
function LayersPanel() {
  const { scenes, currentSceneId, selectedObjectIds, selectObject } = useStudioStore();
  const scene = currentSceneId ? scenes[currentSceneId] : null;
  if (!scene) return null;

  const sorted = [...scene.objects].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="p-3">
      <h3 className="font-bold text-indigo-300 mb-2">Layers</h3>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sorted.map(obj => (
          <div
            key={obj.id}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${
              selectedObjectIds.includes(obj.id) ? 'bg-indigo-600/30 border border-indigo-500' : 'hover:bg-gray-700'
            }`}
            onClick={() => selectObject(obj.id)}
          >
            <div className="w-3 h-3 rounded" style={{ background: getTypeColor(obj.type) }} />
            <span className="truncate flex-1">{obj.name}</span>
            <span className="text-gray-500 text-xs">{obj.type}</span>
            {obj.view && <span className="text-amber-400 text-xs">🔍</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Clue Chain Panel ============
function ClueChainPanel() {
  const { scenes, currentSceneId, updateScene } = useStudioStore();
  const scene = currentSceneId ? scenes[currentSceneId] : null;
  if (!scene) return null;

  const errors = validateScene(scene);
  const chainObjects = scene.clueChain.map(id => scene.objects.find(o => o.id === id)).filter(Boolean);

  const addToChain = (objId: string) => {
    if (!scene.clueChain.includes(objId)) {
      updateScene({ ...scene, clueChain: [...scene.clueChain, objId] });
    }
  };

  const removeFromChain = (index: number) => {
    const newChain = [...scene.clueChain];
    newChain.splice(index, 1);
    updateScene({ ...scene, clueChain: newChain });
  };

  const moveInChain = (index: number, dir: -1 | 1) => {
    const newChain = [...scene.clueChain];
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= newChain.length) return;
    [newChain[index], newChain[newIndex]] = [newChain[newIndex], newChain[index]];
    updateScene({ ...scene, clueChain: newChain });
  };

  return (
    <div className="p-3 border-t border-gray-700">
      <h3 className="font-bold text-indigo-300 mb-2">Clue Chain</h3>
      {errors.length > 0 && (
        <div className="mb-2 p-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-300">
          {errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
        </div>
      )}
      <div className="space-y-1 mb-2">
        {chainObjects.map((obj, i) => (
          <div key={obj!.id} className="flex items-center gap-1 text-sm">
            <span className="text-gray-500 w-5">{i + 1}.</span>
            <div className="w-2 h-2 rounded" style={{ background: getTypeColor(obj!.type) }} />
            <span className="flex-1 truncate">{obj!.name}</span>
            <button onClick={() => moveInChain(i, -1)} className="text-gray-400 hover:text-white px-1" disabled={i === 0}>↑</button>
            <button onClick={() => moveInChain(i, 1)} className="text-gray-400 hover:text-white px-1" disabled={i === chainObjects.length - 1}>↓</button>
            <button onClick={() => removeFromChain(i)} className="text-red-400 hover:text-red-300 px-1">×</button>
          </div>
        ))}
      </div>
      <select
        className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white text-sm"
        onChange={e => { if (e.target.value) addToChain(e.target.value); e.target.value = ''; }}
        defaultValue=""
      >
        <option value="">+ Add to chain...</option>
        {scene.objects.filter(o => !scene.clueChain.includes(o.id)).map(o => (
          <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
        ))}
      </select>
    </div>
  );
}

// ============ Validation Panel ============
function ValidationPanel() {
  const { scenes, currentProjectId, projects } = useStudioStore();
  const project = projects.find(p => p.id === currentProjectId);
  if (!project) return null;

  const projectScenes = project.scenes.map(sid => scenes[sid]).filter(Boolean);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (project.scenes.length === 0) {
    errors.push('Project must have at least one room');
  }
  if (project.finalLockDigits.length !== project.scenes.length && project.scenes.length > 0) {
    errors.push(`Final lock digits (${project.finalLockDigits.length}) must match number of rooms (${project.scenes.length})`);
  }

  for (const scene of projectScenes) {
    const sceneErrors = validateScene(scene);
    errors.push(...sceneErrors.map(e => `[${scene.title}]: ${e}`));
    
    if (scene.clueChain.length === 0 && scene.objects.length > 0) {
      warnings.push(`[${scene.title}]: No clue chain defined`);
    }
    if (scene.objects.filter(o => o.type === 'number-piece').length === 0) {
      errors.push(`[${scene.title}]: No number pieces found`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="p-3 border-t border-gray-700">
        <h3 className="font-bold text-green-400 text-sm mb-1">✓ Validation</h3>
        <p className="text-xs text-gray-400">All checks passed</p>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-gray-700">
      <h3 className="font-bold text-amber-300 text-sm mb-2">⚠️ Validation</h3>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {errors.map((e, i) => (
          <div key={`e${i}`} className="text-xs text-red-400 flex items-start gap-1">
            <span>❌</span><span>{e}</span>
          </div>
        ))}
        {warnings.map((w, i) => (
          <div key={`w${i}`} className="text-xs text-amber-400 flex items-start gap-1">
            <span>⚠️</span><span>{w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Preview Mode ============
function PreviewMode() {
  const { scenes, currentSceneId } = useStudioStore();
  const scene = currentSceneId ? scenes[currentSceneId] : null;
  const [previewDiscovered, setPreviewDiscovered] = useState<Set<string>>(new Set());
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewInventory, setPreviewInventory] = useState<string[]>([]);

  if (!scene) return <div className="text-center text-gray-400 p-8">No scene to preview</div>;

  const handleClick = (obj: SceneObject) => {
    if (previewDiscovered.has(obj.id)) {
      setPreviewMessage('Already discovered');
      setTimeout(() => setPreviewMessage(null), 2000);
      return;
    }
    setPreviewDiscovered(prev => new Set([...prev, obj.id]));
    if (obj.message) {
      setPreviewMessage(obj.message);
      setTimeout(() => setPreviewMessage(null), 5000);
    }
    if (obj.grantsItem && !previewInventory.includes(obj.grantsItem)) {
      setPreviewInventory(prev => [...prev, obj.grantsItem!]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {previewMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm" dir="rtl" lang="fa">{previewMessage}</div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <Stage width={scene.width} height={scene.height} style={{ maxWidth: '100%' }}>
          <Layer>
            <BackgroundImage url={scene.backgroundUrl} width={scene.width} height={scene.height} />
            {scene.objects.sort((a, b) => a.zIndex - b.zIndex).map(obj => {
              const discovered = previewDiscovered.has(obj.id);
              if (discovered && obj.oneTimeUse) return null;
              return (
                <KonvaImage
                  key={obj.id}
                  obj={obj}
                  isSelected={false}
                  onSelect={() => handleClick(obj)}
                  onDragEnd={() => {}}
                  onChange={() => {}}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
      <div className="bg-surface p-3 border-t border-gray-700 text-center text-sm text-gray-400">
        Preview Mode • {previewDiscovered.size}/{scene.objects.length} objects discovered
        {previewInventory.length > 0 && <span> • Items: {previewInventory.join(', ')}</span>}
      </div>
    </div>
  );
}

// ============ Main Studio Component ============
export default function Studio() {
  const store = useStudioStore();
  const {
    projects, scenes, currentProjectId, currentSceneId, selectedObjectIds,
    view, zoom, panX, panY, showGrid, gridSize, snapToGrid,
    selectProject, selectScene, setView, createProject, deleteProject,
    addScene, updateScene, addObject, updateObject, deleteObject,
    selectObject, clearSelection, setZoom, setPan, toggleGrid, toggleSnap,
    duplicateScene, exportProject, importProject, undo, redo, pushUndo,
  } = store;
  const [previewMode, setPreviewMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [newSceneName, setNewSceneName] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentScene = currentSceneId ? scenes[currentSceneId] : null;

  const handleAddObject = (type: ObjectType) => {
    const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newObj: SceneObject = {
      id,
      name: `New Object`,
      type,
      imageUrl: `image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
          <rect width="100%" height="100%" fill="${getTypeColor(type)}" rx="8"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="12">Object</text>
        </svg>`
      )}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 80,
      height: 80,
      rotation: 0,
      zIndex: (currentScene?.objects.length || 0),
      visible: true,
      oneTimeUse: false,
    };
    pushUndo();
    addObject(newObj);
  };

  const handleDragEnd = (id: string, x: number, y: number) => {
    let finalX = x, finalY = y;
    if (snapToGrid) {
      finalX = Math.round(x / gridSize) * gridSize;
      finalY = Math.round(y / gridSize) * gridSize;
    }
    updateObject(id, { x: finalX, y: finalY });
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentScene) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        updateScene({ ...currentScene, backgroundUrl: reader.result as string, width: img.width, height: img.height });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    importProject(importJson);
    setShowImport(false);
    setImportJson('');
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedObjectIds.length > 0) {
        pushUndo();
        selectedObjectIds.forEach(id => deleteObject(id));
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.code === 'Space' && !previewMode) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [selectedObjectIds, deleteObject, undo, redo, pushUndo, previewMode]);

  // Canvas wheel zoom handler
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(zoom + delta);
  };

  // Canvas pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or space+left click
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      setPan(panX + dx, panY + dy);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // ============ Projects View ============
  if (view === 'projects') {
    return (
      <div className="min-h-screen p-4 md:p-8 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-300 mb-6">🎮 Project Management</h1>
          
          {/* Create Project */}
          <div className="bg-surface rounded-xl p-4 mb-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3">Create New Project</h2>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                className="flex-1 bg-surface-light border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="Project name"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
              />
              <input
                className="flex-1 bg-surface-light border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="Description"
                value={newProjectDesc}
                onChange={e => setNewProjectDesc(e.target.value)}
              />
              <button
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                onClick={() => {
                  if (newProjectName) {
                    createProject(newProjectName, newProjectDesc);
                    setNewProjectName('');
                    setNewProjectDesc('');
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>

          {/* Project List */}
          <div className="space-y-3">
            {projects.map(project => (
              <div key={project.id} className="bg-surface rounded-xl p-4 border border-gray-700 hover:border-indigo-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{project.description}</p>
                    <p className="text-gray-500 text-xs mt-1">{project.scenes.length} room(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      onClick={() => selectProject(project.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this project?')) {
                          deleteProject(project.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ Editor View ============
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* Top Toolbar */}
      <div className="bg-surface border-b border-gray-700 px-3 py-2 flex items-center gap-2 flex-wrap flex-shrink-0">
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setView('projects')}
        >
          ← Projects
        </button>
        <span className="text-indigo-300 font-semibold text-sm">{currentProject?.name}</span>
        
        <div className="flex-1" />

        {/* Scene tabs */}
        {currentProject?.scenes.map(sid => {
          const s = scenes[sid];
          return (
            <button
              key={sid}
              className={`px-3 py-1 rounded text-sm ${sid === currentSceneId ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => selectScene(sid)}
            >
              {s?.title || 'Untitled'}
            </button>
          );
        })}

        <button
          className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
          onClick={() => {
            if (newSceneName) {
              addScene(newSceneName);
              setNewSceneName('');
            } else {
              addScene(`Room ${Date.now() % 1000}`);
            }
          }}
        >
          + Room
        </button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Zoom */}
        <button className="text-gray-300 hover:text-white px-1" onClick={() => setZoom(zoom - 0.1)}>−</button>
        <span className="text-gray-400 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button className="text-gray-300 hover:text-white px-1" onClick={() => setZoom(zoom + 0.1)}>+</button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Grid */}
        <button
          className={`px-2 py-1 rounded text-xs ${showGrid ? 'bg-indigo-600' : 'bg-gray-700'} text-white`}
          onClick={toggleGrid}
        >
          Grid
        </button>
        <button
          className={`px-2 py-1 rounded text-xs ${snapToGrid ? 'bg-indigo-600' : 'bg-gray-700'} text-white`}
          onClick={toggleSnap}
        >
          Snap
        </button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Undo/Redo */}
        <button className="text-gray-300 hover:text-white px-1 text-sm" onClick={undo} title="Undo">↶</button>
        <button className="text-gray-300 hover:text-white px-1 text-sm" onClick={redo} title="Redo">↷</button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Export/Import */}
        <button className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs" onClick={handleExport}>
          Export JSON
        </button>
        <button className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs" onClick={() => setShowImport(!showImport)}>
          Import JSON
        </button>
        
        <div className="h-5 w-px bg-gray-600" />
        
        <button
          className={`px-2 py-1 rounded text-xs ${previewMode ? 'bg-amber-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
          onClick={() => setPreviewMode(!previewMode)}
        >
          {previewMode ? '✏️ Edit' : '▶️ Preview'}
        </button>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="bg-surface-light border-b border-gray-700 p-3">
          <textarea
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm h-32"
            placeholder="Paste project JSON here..."
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm" onClick={handleImport}>
              Import
            </button>
            <button className="bg-gray-700 text-white px-3 py-1 rounded text-sm" onClick={() => setShowImport(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {previewMode ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <PreviewMode />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Tools */}
        <div className="w-48 bg-surface border-l border-gray-700 flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 mb-2">Add Object</h3>
            <div className="grid grid-cols-2 gap-1">
              {([
                ['clue', '🔍 Clue'],
                ['number-piece', '🔢 Number'],
                ['decoration', '🖼️ Deco'],
                ['inventory', '🎒 Item'],
                ['container', '📦 Container'],
                ['exit', '🚪 Exit'],
              ] as [ObjectType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-1 py-1.5 rounded text-xs transition-colors"
                  onClick={() => handleAddObject(type)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Background Upload */}
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 mb-2">Background</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBackgroundUpload}
            />
            <button
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Upload Image
            </button>
          </div>

          {/* Scene Properties */}
          {currentScene && (
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 mb-2">Room Properties</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-gray-400">Title</label>
                  <input
                    className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white mt-1"
                    value={currentScene.title}
                    onChange={e => updateScene({ ...currentScene, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-gray-400">Exit Number</label>
                  <input
                    type="number" min={0} max={9}
                    className="w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white mt-1"
                    value={currentScene.exitNumber}
                    onChange={e => updateScene({ ...currentScene, exitNumber: Number(e.target.value) })}
                  />
                </div>
                <button
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                  onClick={() => duplicateScene(currentScene.id)}
                >
                  📋 Duplicate Room
                </button>
              </div>
            </div>
          )}

          {/* Layers */}
          <LayersPanel />
          
          {/* Clue Chain */}
          <ClueChainPanel />
          <ValidationPanel />
        </div>

        {/* Canvas Area */}
        <div 
          ref={canvasContainerRef}
          className="flex-1 bg-gray-900 overflow-hidden relative select-none"
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={e => e.preventDefault()}
          style={{ 
            cursor: spaceHeld ? (isPanning ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none'
          }}
        >
          {currentScene ? (
            <Stage
              ref={stageRef}
              width={800}
              height={600}
              scaleX={zoom}
              scaleY={zoom}
              x={panX}
              y={panY}
              onClick={(e) => {
                if (e.target === e.target.getStage() && !spaceHeld) {
                  clearSelection();
                }
              }}
              style={{ 
                cursor: spaceHeld ? (isPanning ? 'grabbing' : 'grab') : 'default',
                touchAction: 'none'
              }}
            >
              <Layer>
                {/* Grid */}
                {showGrid && (
                  <>
                    {Array.from({ length: Math.ceil(currentScene.width / gridSize) + 1 }).map((_, i) => (
                      <Line
                        key={`v${i}`}
                        points={[i * gridSize, 0, i * gridSize, currentScene.height]}
                        stroke="#334155"
                        strokeWidth={0.5}
                      />
                    ))}
                    {Array.from({ length: Math.ceil(currentScene.height / gridSize) + 1 }).map((_, i) => (
                      <Line
                        key={`h${i}`}
                        points={[0, i * gridSize, currentScene.width, i * gridSize]}
                        stroke="#334155"
                        strokeWidth={0.5}
                      />
                    ))}
                  </>
                )}

                {/* Background */}
                <BackgroundImage url={currentScene.backgroundUrl} width={currentScene.width} height={currentScene.height} />

                {/* Objects */}
                {currentScene.objects
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map(obj => (
                    <KonvaImage
                      key={obj.id}
                      obj={obj}
                      isSelected={selectedObjectIds.includes(obj.id)}
                      onSelect={selectObject}
                      onDragEnd={handleDragEnd}
                      onChange={updateObject}
                    />
                  ))}
              </Layer>
            </Stage>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select or create a room</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-64 bg-surface border-r border-gray-700 overflow-y-auto flex-shrink-0">
          <PropertiesPanel />
        </div>
      </div>
      )}
    </div>
  );
}

// Background Image Component
function BackgroundImage({ url, width, height }: { url: string; width: number; height: number }) {
  const [image] = useImage(url);
  if (!image) {
    return <Rect x={0} y={0} width={width} height={height} fill="#1a1a2e" />;
  }
  return <KImage image={image} x={0} y={0} width={width} height={height} />;
}
