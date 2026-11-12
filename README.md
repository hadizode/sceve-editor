# Escape Room Studio

A Persian-language (RTL) escape room / hidden-object designer and player. Built as a single-page app: a Konva-based **Design Studio** for building rooms, and a **Player** for Telegram-group play. The UI is in English; all game content (messages, object names, clues) is in Persian/Farsi and rendered right-to-left.

## Structure

```
src/
├── shared/              # Types, constants, game logic, persistence
│   ├── types.ts         # TypeScript interfaces + factories + import normalization
│   ├── game-logic.ts    # Pure game logic (discover, pickup, item-on-object, doors, locks)
│   ├── validation.ts    # Project validation (errors + warnings)
│   ├── seed-data.ts     # Seed project (sample rooms, sprites, views)
│   ├── geometry.ts      # Box/point math + legacy geometry migration
│   ├── idb.ts           # IndexedDB storage layer
│   ├── notify.tsx       # Toast notifications
│   └── utils.ts         # uid, nowIso, svgDataUrl, image loading
├── stores/
│   └── store.ts         # Zustand stores (useStudioStore, usePlayerStore) + hooks
├── studio/              # Design editor (Konva + react-konva)
│   ├── Studio.tsx       # Shell + routing between projects/editor
│   ├── Canvas.tsx       # Konva stage, pan/zoom/grid, object rendering
│   ├── Panels.tsx       # Side panels (assets, layers, objects, views)
│   ├── Properties.tsx   # Per-object property editor
│   ├── ViewTab.tsx      # Interactive View editor inside an object
│   ├── Preview.tsx      # In-page player preview
│   ├── ProjectsView.tsx # Project list (create/delete/duplicate/import)
│   ├── MenuBar.tsx      # File/edit (undo/redo, export/import bundle)
│   ├── commands.ts      # Undo/redo commands (Command pattern)
│   ├── dock.tsx, ui.tsx, icons.tsx, konva-bits.tsx, Transitions.tsx
├── player/              # In-game interface
│   └── Player.tsx       # Lobby, room, inventory, views, final lock
├── App.tsx              # Main routing (studio vs player)
├── index.css            # RTL + Tailwind styles
├── main.tsx
├── index.html
├── vite.config.js
└── tsconfig.json
```

## Features

### Design Studio
- ✅ Project management: create, delete, duplicate, list; JSON bundle export/import (format `escape-studio`, version 3)
- ✅ **Assets Panel** — manage project images: folder upload, multi-file upload, search by name, delete, instant thumbnails
- ✅ **Unified sprite model** — every object is one "sprite"; behavior comes from properties and rules, not a type enum
- ✅ Konva editor with infinite pan/zoom, grid, snap-to-grid, select/multi-select (Shift+click), drag & resize
- ✅ **Properties panel** for every `SceneObject` field (geometry, sprite, visibility, locks, messages, digits)
- ✅ **Layered backgrounds** — multiple background layers with opacity, visibility, offset
- ✅ **Visual clue chain editor** — ordered object IDs that feed the final lock digits
- ✅ **Interactive Views** — close-up zoomable views per object (their own background + objects + transforms)
- ✅ **Doors** — clickable objects that move the player between rooms, optionally gated by inventory items
- ✅ **Motion (rotate)** — click-to-rotate sprites (hinges, levers, clock hands) with pivot, angle, step limits, toggle
- ✅ **Transforms & effects** — object look changes with optional cross-fade and click toggle; effects can transform other objects, change backgrounds, unlock doors, or complete rooms
- ✅ Validation panel (errors/warnings from `validateProject`)
- ✅ Undo/Redo (Ctrl+Z / Ctrl+Y) via command stack
- ✅ In-page preview mode
- ✅ JSON export/import, room duplication, migration of legacy `imageUrl` bundles

### Player
- ✅ Lobby with player list & Ready button
- ✅ Konva room rendering (responsive fit, no zoom/pan in main game)
- ✅ Click-to-discover objects (first-click-wins in multiplayer)
- ✅ Clue message display
- ✅ **Interactive Views** — zoom/pan inside close-up views
- ✅ **Full Inventory System**: pickupable objects, custom pickup messages, use item on object → transform, consume-or-keep items
- ✅ Room digit counter, final lock with numeric keypad, victory animation
- ✅ Room navigation via doors, online/offline player indicators
- ✅ Persistence (IndexedDB) save & resume
- ✅ Mobile-first touch UX, ARIA labels on all buttons

### Studio Canvas Controls
| Action | Control |
|--------|---------|
| Zoom | Mouse scroll wheel |
| Pan | Hold Space + drag, or middle mouse button drag |
| Select object | Click on object |
| Multi-select | Shift + Click |
| Delete object | Delete key |
| Undo | Ctrl + Z |
| Redo | Ctrl + Y |

### Player (Game)
| Action | Control |
|--------|---------|
| Discover object | Click on object |
| Use item | Select item from inventory → click target object |
| Open view | Click object with 🔍 indicator |
| Close view | Click "Close" button |
| View zoom / pan | Mouse scroll wheel / Space + drag |

## Running

```bash
npm install            # install dependencies
npm run dev            # dev server (Vite)
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm test               # vitest run
```

## Tech Stack

- React 18 + TypeScript (strict)
- Vite 6
- TailwindCSS 4
- Konva.js + react-konva (canvas rendering)
- Zustand (state management, IndexedDB persistence)
- Vazirmatn (Persian font, self-hosted via Google Fonts)
- vitest (testing)

> Note: there is **no Zod** in this project — validation is hand-rolled in `src/shared/validation.ts`.

## Language

- **UI Language:** English (buttons, labels, navigation)
- **Game Content:** Persian/Farsi (messages, object names, clues)
- **Direction:** RTL for game content
- **Font:** Vazirmatn

## Data Model

See `DATA_MODEL.md` for the full type reference (sprites, assets, scenes, projects, transforms, effects, runtime session state).ند
- `requiresItem` برای باز شدن
- می‌توانند `digit` یا `transforms` داشته باشند

### حذف شده:
- ❌ `clue` - هر شیء می‌تواند پیام داشته باشد
- ❌ `number-piece` - از فیلد `digit` استفاده می‌شود
- ❌ `exit` - خروجی اتاق با `exitNumber` در Scene مشخص می‌شود

## Assets System

پوشه Assets تمام تصاویر استفاده شده در پروژه را مدیریت می‌کند:
- آپلود تصاویر جدید
- نمایش thumbnail تمام assets
- استفاده مجدد در اشیاء مختلف
- پس‌زمینه‌های لایه‌ای (Background Layers)

## Layer System

سیستم لایه‌بندی یکپارچه:
- `layerIndex` - لایه اصلی (0 = پایین‌ترین)
- `zIndex` - ترتیب درون لایه
- پس‌زمینه‌ها هم می‌توانند لایه‌ای باشند (`backgroundLayers`)
- هر لایه پس‌زمینه دارای `opacity` و `offset` برای parallax

### Inventory Demo in Seed Game
1. In Room 2, find the **Wire Cutter** (🔧) and click it → added to inventory
2. Find the **Bare Wire End** (⚡) - it's dangerous!
3. Select "Wire Cutter" from inventory, then click "Bare Wire End"
4. The wire transforms to "Fixed Wire" (✅) - now safe!
5. Wire cutter is NOT consumed (can be used on other wires if added)

### Digits System
- هر شیء می‌تواند فیلد `digit` (0-9) داشته باشد
- وقتی همه اشیاء دارای digit در یک اتاق کشف شوند، اتاق کامل می‌شود
- رقم خروجی اتاق از `exitNumber` در Scene خوانده می‌شود
- قفل نهایی از ترکیب exitNumber همه اتاق‌ها ساخته می‌شود

## Interactive Views

Objects can have an interactive `view` property. When a player clicks an object with a view:
1. A full-screen overlay opens showing the object up close
2. The view has its own background, objects, and interactions
3. Objects in the view can be clicked to discover clues
4. Views support zoom (scroll) and pan (Space + drag)
5. Views can have conditions (requiresItem) to open
6. All discoveries in views are tracked separately

## Inventory & Transforms System

### Pickupable Objects
Objects can be configured as `pickupable: true` to allow players to pick them up and add them to inventory:
- `pickupable: boolean` - Whether this object can be picked up
- `pickupItemId: string` - The item ID added to inventory (defaults to object ID)
- `pickupMessage: string` - Message shown when picked up (Persian/Farsi)

Example:
```typescript
{
  id: 'wire-cutter',
  name: 'Wire Cutter',
  type: 'inventory',
  pickupable: true,
  pickupItemId: 'wire-cutter',
  pickupMessage: '🔧 You picked up the wire cutter!',
  // ... other properties
}
```

### Object Transforms
Objects can have `transforms` array that defines how they change when specific items are used on them:

```typescript
{
  id: 'bare-wire',
  name: 'Bare Wire End',
  transforms: [
    {
      requiresItem: 'wire-cutter',      // Item needed to trigger this transform
      newImageUrl: 'path/to/fixed.png', // New image after transform
      newName: 'Fixed Wire',            // New name after transform
      newMessage: '✅ Wire is now safe!', // Message shown (Persian/Farsi)
      grantsItem: 'copper-wire',        // Optional: item granted after transform
      consumesItem: false,              // Whether the used item is consumed (default: true)
      triggersDiscovery: true,          // Whether this counts as discovering the object
    },
  ],
}
```

### Transform Flow Example
1. Player finds "Bare Wire End" (dangerous, unusable)
2. Player picks up "Wire Cutter" from another location → added to inventory
3. Player selects "Wire Cutter" from inventory
4. Player clicks "Bare Wire End" → transform is triggered
5. "Bare Wire End" becomes "Fixed Wire" (new image, new name)
6. Message shown: "✅ Wire is now safe!"
7. Wire cutter is NOT consumed (can be used again)

### Multiple Transforms
Objects can have multiple transform rules that chain together:
```typescript
transforms: [
  { requiresItem: 'key', newImageUrl: 'unlocked.png' },      // State 0 → 1
  { requiresItem: 'crowbar', newImageUrl: 'open.png' },      // State 1 → 2
  { requiresItem: 'flashlight', newImageUrl: 'lit.png' },    // State 2 → 3
]
```

Each transform advances the object to the next state. The `currentTransform` property tracks which state the object is in.

## Controls

### Studio (Editor)
| Action | Control |
|--------|---------|
| Zoom | Mouse scroll wheel |
| Pan | Hold Space + drag, or Middle mouse button drag |
| Select object | Click on object |
| Multi-select | Shift + Click |
| Delete object | Delete key |
| Undo | Ctrl + Z |
| Redo | Ctrl + Y |

### Player (Game)
| Action | Control |
|--------|---------|
| Discover object | Click on object |
| Use item | Select item → click target object |
| Open view | Click object with 🔍 indicator |
| Close view | Click "Close" button |

### Inside Interactive Views (Player)
| Action | Control |
|--------|---------|
| Zoom | Mouse scroll wheel |
| Pan | Hold Space + drag |

## Bundle Size

- **JS:** 602.25 kB (minified) → **183.75 kB** (gzip) ✅ (target: < 500 KB)
- **CSS:** 26.81 kB (minified) → **5.90 kB** (gzip)
- **Build time:** ~6 seconds ✅ (target: < 10s)

## Tech Stack

- React 18 + TypeScript (strict)
- Vite 6
- TailwindCSS 4
- Konva.js + react-konva (canvas)
- Zustand (state management)
- Zod (validation schemas)
- Vazirmatn (Persian font)

## Language

- **UI Language:** English (all buttons, labels, navigation)
- **Game Content:** Persian/Farsi (messages, object names, clues, messages)
- **Direction:** RTL (right-to-left) for game content
- **Font:** Vazirmatn (self-hosted via Google Fonts)
