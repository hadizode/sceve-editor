# Escape Room - Multiplayer Game Platform

A Persian-language (RTL) multiplayer escape room & hidden object platform designed for Telegram group play. The UI is in English, but all game content (messages, object names, clues) is in Persian/Farsi.

## Structure

```
src/
├── shared/          # Types, Zod schemas, game logic
│   ├── types.ts     # TypeScript interfaces + Zod schemas
│   ├── game-logic.ts # Pure game logic functions
│   └── seed-data.ts # Seed data (project with 2 rooms + views)
├── stores/
│   └── store.ts     # Zustand stores (Studio + Player)
├── studio/
│   └── Studio.tsx   # Scene editor with Konva
├── player/
│   └── Player.tsx   # Player game interface
├── App.tsx          # Main routing
└── index.css        # RTL + Tailwind styles
```

## Features

### Design Studio
- ✅ Project management (create, delete, list)
- ✅ **Assets Panel** - manage all images used in project
  - 📂 **Folder upload** - upload entire folders at once
  - 📄 **Files upload** - upload multiple files
  - 🔍 **Search** - filter assets by name
  - 🗑️ **Delete** - remove unused assets
  - 🖼️ **Instant preview** - thumbnails shown immediately
- ✅ Konva editor with infinite pan/zoom
- ✅ Object CRUD with drag & resize
- ✅ Properties panel for every SceneObject field
- ✅ **Image upload for objects** (like background upload)
- ✅ Background upload with auto-dimension detection
- ✅ **Layered backgrounds** - multiple background layers with opacity
- ✅ **Global layer index system** - unified z-ordering for all objects
- ✅ Visual clue chain editor
- ✅ Layers panel with layerIndex + zIndex
- ✅ In-page preview mode
- ✅ Validation panel
- ✅ Undo/Redo (Ctrl+Z / Ctrl+Y)
- ✅ JSON export/import
- ✅ Room duplication
- ✅ Grid & snap-to-grid
- ✅ Interactive View configuration per object

### Player
- ✅ Lobby with player list & Ready button
- ✅ Konva room rendering (responsive fit, no zoom/pan in main game)
- ✅ Click-to-discover objects
- ✅ Clue message display (long duration: 5-7 seconds)
- ✅ **Interactive Views** (close-up zoomable views with zoom/pan inside)
- ✅ **Full Inventory System**:
  - Pickupable objects (configurable per object)
  - Items added to inventory with custom messages
  - Use items on objects to trigger transforms
  - Objects can change image/name after item use
  - Items can be consumed or kept after use
- ✅ Room digit counter
- ✅ Final lock with numeric keypad
- ✅ Victory animation
- ✅ Room navigation
- ✅ Online/offline player indicators
- ✅ localStorage save & resume
- ✅ Mobile-first touch UX
- ✅ ARIA labels on all buttons

### Studio Canvas Controls
- ✅ **Zoom:** Mouse scroll wheel
- ✅ **Pan:** Hold Space + drag, or middle mouse button drag
- ✅ **Web-app feel:** No browser scroll, fixed layout, overflow:hidden
- ✅ **Grid & snap:** Toggleable grid with adjustable size
- ✅ **Cursor feedback:** grab/grabbing when panning

## Running

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
```

## Object Types

ساده‌سازی شده به ۳ نوع:

### 1. Decoration (🖼️)
- اشیاء تزئینی که پیام نمایش می‌دهند
- می‌توانند `digit` داشته باشند (برای ارقام قفل)
- می‌توانند `view` داشته باشند (نمای تعاملی)
- می‌توانند `pickupable` باشند

### 2. Inventory (🎒)
- آیتم‌های قابل برداشتن
- حتماً `pickupable: true` دارند
- به inventory بازیکن اضافه می‌شوند

### 3. Container (📦)
- اشیایی که با آیتم باز می‌شوند
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
