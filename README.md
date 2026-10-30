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
- ✅ Konva editor with pan/zoom
- ✅ Object CRUD with drag & resize
- ✅ Properties panel for every SceneObject field
- ✅ **Image upload for objects** (like background upload)
- ✅ Background upload with auto-dimension detection
- ✅ Visual clue chain editor
- ✅ Layers panel with z-order
- ✅ In-page preview mode
- ✅ Validation panel
- ✅ Undo/Redo (Ctrl+Z / Ctrl+Y)
- ✅ JSON export/import
- ✅ Room duplication
- ✅ Grid & snap-to-grid
- ✅ Interactive View configuration per object

### Player
- ✅ Lobby with player list & Ready button
- ✅ Konva room rendering
- ✅ Click-to-discover objects
- ✅ Clue message display (long duration: 5-7 seconds)
- ✅ **Interactive Views** (close-up zoomable views for objects)
- ✅ **Zoom** (mouse scroll wheel)
- ✅ **Pan** (hold Space + drag)
- ✅ Zoom controls (+ / - / reset buttons)
- ✅ Item & container system
- ✅ Room digit counter
- ✅ Final lock with numeric keypad
- ✅ Victory animation
- ✅ Room navigation
- ✅ Online/offline player indicators
- ✅ localStorage save & resume
- ✅ Mobile-first touch UX
- ✅ ARIA labels on all buttons

## Running

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
```

## Seed Game

The seed project includes:
- **Project:** Escape Room: Old Library
- **Room 1:** Old Library (exit digit: 7)
  - Chain: Red Book → Rug → Box → Number 7
  - Item: Golden Key (from rug) → unlocks box
  - **View:** Wall Clock opens an interactive close-up view
- **Room 2:** Basement Room (exit digit: 3)
  - Chain: Note → Photo Frame → Number 3
- **Final Lock Code:** 73

## Interactive Views

Objects can have an interactive `view` property. When a player clicks an object with a view:
1. A full-screen overlay opens showing the object up close
2. The view has its own background, objects, and interactions
3. Objects in the view can be clicked to discover clues
4. Views support zoom (scroll) and pan (Space + drag)
5. Views can have conditions (requiresItem) to open
6. All discoveries in views are tracked separately

## Controls

| Action | Control |
|--------|---------|
| Zoom | Mouse scroll wheel |
| Pan | Hold Space + drag |
| Discover object | Click on object |
| Use item | Select item → click target object |
| Open view | Click object with 🔍 indicator |
| Close view | Click "Close" button |

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
