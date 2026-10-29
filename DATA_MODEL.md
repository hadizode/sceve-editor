# Data Model

## ObjectType
```typescript
type ObjectType = 'clue' | 'number-piece' | 'decoration' | 'inventory' | 'container' | 'exit';
```

## SceneObject
```typescript
interface SceneObject {
  id: string;           // unique identifier
  name: string;         // display name
  type: ObjectType;     // object type
  imageUrl: string;     // URL to image file (never base64)
  x: number;           // position X
  y: number;           // position Y
  width: number;       // width in pixels
  height: number;      // height in pixels
  rotation: number;    // rotation in degrees
  zIndex: number;      // layer order
  visible: boolean;    // visibility toggle
  oneTimeUse: boolean; // disappears after use
  message?: string;    // clue text shown on discovery
  number?: number;     // 0-9, for number-piece type
  requiresItem?: string[];  // item IDs needed to interact
  grantsItem?: string;      // item ID granted on discovery
  soundUrl?: string;        // optional sound effect
  customData?: Record<string, string>; // extensible data
}
```

## Scene
```typescript
interface Scene {
  id: string;
  projectId: string;
  title: string;
  width: number;
  height: number;
  backgroundUrl: string;
  objects: SceneObject[];
  clueChain: string[];    // ordered object IDs forming the clue chain
  exitNumber: number;     // 0-9, this room's digit for the final lock
}
```

## Project
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  scenes: string[];       // scene IDs in order
  finalLockDigits: string; // concatenated room digits for final lock
  createdAt: string;      // ISO-8601
  updatedAt: string;      // ISO-8601
}
```

## Session
```typescript
interface Session {
  id: string;
  token: string;          // JWT
  projectId: string;
  players: Player[];
  state: SessionState;
  createdAt: string;
  expiresAt: string;
}

interface Player {
  telegramId: string;
  name: string;
  online: boolean;
  ready: boolean;
}

interface SessionState {
  currentSceneId: string;
  discoveredObjects: Record<string, string[]>;  // sceneId -> objectId[]
  inventory: string[];     // collected item IDs
  completedScenes: string[];
  finalLockEntered?: string;
}
```

## Validation Rules

1. هر اتاق باید حداقل یک `number-piece` داشته باشد
2. زنجیره سرنخ باید به یک `number-piece` ختم شود
3. تمام آیتم‌های زنجیر باید در `objects` وجود داشته باشند
4. تعداد ارقام `finalLockDigits` باید برابر تعداد اتاق‌ها باشد
5. هر `container` با `requiresItem` باید آیتم مربوطه در جای دیگری قابل دسترسی باشد

## Game Flow

```
Lobby → Room 1 → [find all number-pieces] → Room Complete → 
Room 2 → [find all number-pieces] → Room Complete → ... → 
All Rooms Complete → Final Lock → Victory!
```

## Realtime Sync Rules

- **First-click-wins:** Only the first player to click an object discovers it
- **Broadcast:** All other players receive the discovery event
- **Already discovered:** Late clickers see "already discovered" message
- **Presence:** Online/offline status updates broadcast to all
- **Inventory:** Shared across all players in the session
- **Room completion:** Triggered when all number-pieces in a room are discovered
