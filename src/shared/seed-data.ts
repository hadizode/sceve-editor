import type { Project, Scene, Session, SceneObject, Asset } from './types';

// SVG placeholder generator with better visuals
function makeSvg(text: string, color: string, w = 100, h = 100, emoji = ''): string {
  return `image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color}"/>
          <stop offset="100%" style="stop-color:${color}88"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" rx="12"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.min(w,h)*0.35}">${emoji}</text>
      <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${Math.min(w,h)*0.12}" font-family="Vazirmatn">${text}</text>
    </svg>`
  )}`;
}

export const SEED_BACKGROUND = `image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="50%" style="stop-color:#16213e"/>
        <stop offset="100%" style="stop-color:#0f3460"/>
      </linearGradient>
      <pattern id="wood" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#2d1810"/>
        <line x1="0" y1="5" x2="40" y2="5" stroke="#3d2216" stroke-width="0.5"/>
        <line x1="0" y1="15" x2="40" y2="15" stroke="#3d2216" stroke-width="0.3"/>
        <line x1="0" y1="25" x2="40" y2="25" stroke="#3d2216" stroke-width="0.5"/>
        <line x1="0" y1="35" x2="40" y2="35" stroke="#3d2216" stroke-width="0.3"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect x="0" y="420" width="800" height="180" fill="url(#wood)" opacity="0.7"/>
    <rect x="0" y="0" width="800" height="420" fill="none" stroke="#334155" stroke-width="1"/>
    <rect x="320" y="40" width="160" height="120" fill="#0a1628" stroke="#4a5568" stroke-width="3" rx="4"/>
    <line x1="400" y1="40" x2="400" y2="160" stroke="#4a5568" stroke-width="2"/>
    <line x1="320" y1="100" x2="480" y2="100" stroke="#4a5568" stroke-width="2"/>
    <circle cx="350" cy="65" r="1.5" fill="#fbbf24"/>
    <circle cx="380" cy="80" r="1" fill="#fbbf24"/>
    <circle cx="420" cy="55" r="1.5" fill="#fbbf24"/>
    <circle cx="450" cy="75" r="1" fill="#fbbf24"/>
    <circle cx="460" cy="130" r="1.5" fill="#fbbf24"/>
    <circle cx="440" cy="60" r="12" fill="#fde68a" opacity="0.8"/>
    <rect x="50" y="100" width="200" height="300" fill="#3d2216" stroke="#5c3a1e" stroke-width="2" rx="4"/>
    <line x1="50" y1="180" x2="250" y2="180" stroke="#5c3a1e" stroke-width="3"/>
    <line x1="50" y1="260" x2="250" y2="260" stroke="#5c3a1e" stroke-width="3"/>
    <line x1="50" y1="340" x2="250" y2="340" stroke="#5c3a1e" stroke-width="3"/>
    <rect x="500" y="320" width="250" height="100" fill="#4a2c17" stroke="#5c3a1e" stroke-width="2" rx="4"/>
    <rect x="520" y="420" width="15" height="80" fill="#3d2216"/>
    <rect x="720" y="420" width="15" height="80" fill="#3d2216"/>
    <ellipse cx="400" cy="480" rx="150" ry="60" fill="#7c2d12" opacity="0.6" stroke="#92400e" stroke-width="2"/>
    <ellipse cx="400" cy="480" rx="120" ry="45" fill="none" stroke="#b45309" stroke-width="1" opacity="0.5"/>
    <text x="400" y="590" text-anchor="middle" fill="#475569" font-size="11" font-family="Vazirmatn">اتاق کتابخانه قدیمی</text>
  </svg>`
)}`;

// Clock View - interactive view when clicking the clock
const CLOCK_VIEW = {
  id: 'view-clock',
  title: 'نمای نزدیک ساعت',
  backgroundUrl: `image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <defs>
        <radialGradient id="clockbg">
          <stop offset="0%" style="stop-color:#2d1b4e"/>
          <stop offset="100%" style="stop-color:#1a0a2e"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#clockbg)"/>
      <circle cx="200" cy="200" r="150" fill="#1a1a2e" stroke="#c9a84c" stroke-width="4"/>
      <circle cx="200" cy="200" r="140" fill="none" stroke="#8b7332" stroke-width="1"/>
      <text x="200" y="80" text-anchor="middle" fill="#c9a84c" font-size="20" font-family="Vazirmatn">۱۲</text>
      <text x="320" y="210" text-anchor="middle" fill="#c9a84c" font-size="20" font-family="Vazirmatn">۳</text>
      <text x="200" y="340" text-anchor="middle" fill="#c9a84c" font-size="20" font-family="Vazirmatn">۶</text>
      <text x="80" y="210" text-anchor="middle" fill="#c9a84c" font-size="20" font-family="Vazirmatn">۹</text>
      <line x1="200" y1="200" x2="280" y2="200" stroke="#c9a84c" stroke-width="4" stroke-linecap="round"/>
      <line x1="200" y1="200" x2="200" y2="120" stroke="#c9a84c" stroke-width="3" stroke-linecap="round"/>
      <circle cx="200" cy="200" r="6" fill="#c9a84c"/>
    </svg>`
  )}`,
  width: 400,
  height: 400,
  objects: [
    {
      id: 'view-clock-secret',
      name: 'رمز ساعت',
      type: 'decoration',
      imageUrl: makeSvg('۳:۱۵', '#c9a84c', 80, 40, ''),
      x: 160,
      y: 350,
      width: 80,
      height: 35,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '🕐 عقربه‌ها ساعت ۳:۱۵ را نشان می‌دهند... شاید این یک رمز باشد!',
    },
  ] as SceneObject[],
  requiresItem: undefined,
  closeMessage: 'ساعت را بستید',
};

export const SEED_PROJECT: Project = {
  id: 'proj-seed-001',
  name: 'Escape Room: Old Library',
  description: 'A classic escape room with chained clues in an old library. Find all digits and unlock the final lock.',
  scenes: ['scene-room-001', 'scene-room-002'],
  finalLockDigits: '73',
  assets: ['asset-bg-library', 'asset-bg-basement'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const SEED_ASSETS: Asset[] = [
  {
    id: 'asset-bg-library',
    name: 'Library Background',
    url: SEED_BACKGROUND,
    tags: ['background', 'library'],
    createdAt: new Date().toISOString(),
  },
];

export const SEED_SCENE: Scene = {
  id: 'scene-room-001',
  projectId: 'proj-seed-001',
  title: 'Old Library',
  width: 800,
  height: 600,
  backgroundUrl: SEED_BACKGROUND,
  objects: [
    {
      id: 'obj-clue-book',
      name: 'Red Ancient Book',
      type: 'decoration',
      imageUrl: makeSvg('Red Book', '#dc2626', 70, 90, '📕'),
      x: 80,
      y: 130,
      width: 60,
      height: 80,
      rotation: -5,
      zIndex: 2,
      layerIndex: 2,
      visible: true,
      oneTimeUse: false,
      message: '📜 یک یادداشت داخل کتاب پیدا کردید: "کلید زیر فرش است"',
    },
    {
      id: 'obj-clue-painting',
      name: 'Wall Painting',
      type: 'decoration',
      imageUrl: makeSvg('Painting', '#0ea5e9', 100, 80, '🖼️'),
      x: 550,
      y: 120,
      width: 90,
      height: 70,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '🔍 پشت تابلو نوشته: "عدد اول در صندوق است، عدد دوم در گلدان"',
    },
    {
      id: 'obj-clue-rug',
      name: 'Ornamental Rug',
      type: 'decoration',
      imageUrl: makeSvg('Rug', '#92400e', 140, 80, '🟫'),
      x: 330,
      y: 440,
      width: 140,
      height: 70,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '🔑 زیر فرش یک کلید کوچک طلایی پیدا کردید!',
      grantsItem: 'key-gold',
    },
    {
      id: 'obj-container-box',
      name: 'Locked Wooden Box',
      type: 'container',
      imageUrl: makeSvg('Box', '#7c3aed', 90, 70, '📦'),
      x: 560,
      y: 330,
      width: 80,
      height: 60,
      rotation: 0,
      zIndex: 3,
      layerIndex: 3,
      visible: true,
      oneTimeUse: true,
      message: '🔓 صندوق باز شد! عدد ۷ داخل آن بود!',
      requiresItem: ['key-gold'],
      digit: 7,
      grantsItem: 'digit-7',
    },
    {
      id: 'obj-deco-clock',
      name: 'Wall Clock',
      type: 'decoration',
      imageUrl: makeSvg('Clock', '#6b7280', 60, 60, '🕐'),
      x: 300,
      y: 60,
      width: 55,
      height: 55,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '🕐 یک ساعت قدیمی. عقربه‌ها روی ۳:۱۵ متوقف شده‌اند...',
      view: CLOCK_VIEW,
    },
    {
      id: 'obj-deco-candle',
      name: 'Candlestick',
      type: 'decoration',
      imageUrl: makeSvg('Candle', '#f59e0b', 40, 60, '🕯️'),
      x: 650,
      y: 290,
      width: 35,
      height: 50,
      rotation: 0,
      zIndex: 2,
      layerIndex: 2,
      visible: true,
      oneTimeUse: false,
      message: '🕯️ شمع هنوز روشن است. نور ضعیفی دارد.',
    },
  ],
  clueChain: ['obj-clue-book', 'obj-clue-rug', 'obj-container-box'],
  exitNumber: 7,
};

export const SEED_SCENE_2: Scene = {
  id: 'scene-room-002',
  projectId: 'proj-seed-001',
  title: 'Basement Room',
  width: 800,
  height: 600,
  backgroundUrl: `image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a0a0a"/>
          <stop offset="100%" style="stop-color:#2d1515"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg2)"/>
      <rect x="0" y="450" width="800" height="150" fill="#1a1a1a"/>
      <rect x="100" y="100" width="600" height="350" fill="none" stroke="#4a2020" stroke-width="2" rx="8"/>
      <text x="400" y="580" text-anchor="middle" fill="#4a2020" font-size="11" font-family="Vazirmatn">اتاق زیرزمین تاریک</text>
    </svg>`
  )}`,
  objects: [
    {
      id: 'obj2-clue-note',
      name: 'Note on Table',
      type: 'decoration',
      imageUrl: makeSvg('Note', '#fbbf24', 80, 60, '📝'),
      x: 350,
      y: 250,
      width: 70,
      height: 50,
      rotation: 3,
      zIndex: 2,
      layerIndex: 2,
      visible: true,
      oneTimeUse: false,
      message: '📝 یادداشت: "عدد ۳ پشت قاب عکس پنهان شده"',
    },
    {
      id: 'obj2-clue-frame',
      name: 'Photo Frame',
      type: 'decoration',
      imageUrl: makeSvg('Frame', '#8b5cf6', 80, 100, '🖼️'),
      x: 150,
      y: 150,
      width: 70,
      height: 90,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '🔢 پشت قاب عکس، عدد ۳ حک شده!',
      grantsItem: 'digit-3',
      digit: 3,
    },
    {
      id: 'obj2-deco-skull',
      name: 'Decorative Skull',
      type: 'decoration',
      imageUrl: makeSvg('Skull', '#6b7280', 50, 50, '💀'),
      x: 550,
      y: 350,
      width: 45,
      height: 45,
      rotation: 0,
      zIndex: 1,
      layerIndex: 1,
      visible: true,
      oneTimeUse: false,
      message: '💀 یک جمجمه قدیمی. شاید متعلق به دزد دریایی باشد!',
    },
    {
      id: 'obj2-wire-bare',
      name: 'Bare Wire End',
      type: 'decoration',
      imageUrl: makeSvg('Bare Wire', '#dc2626', 60, 40, '⚡'),
      x: 400,
      y: 400,
      width: 50,
      height: 35,
      rotation: 0,
      zIndex: 2,
      layerIndex: 2,
      visible: true,
      oneTimeUse: false,
      message: '⚡ یک سر سیم لخت. بدون عایق خطرناک به نظر می‌رسد.',
      transforms: [
        {
          requiresItem: 'wire-cutter',
          newImageUrl: makeSvg('Fixed Wire', '#10b981', 60, 40, '✓'),
          newName: 'Fixed Wire',
          newMessage: '✅ سیم‌چین را استفاده کردید و سیم لخت به سیم سالم تبدیل شد!',
          consumesItem: false,
          triggersDiscovery: true,
        },
      ],
    },
    {
      id: 'obj2-wire-cutter',
      name: 'Wire Cutter',
      type: 'inventory',
      imageUrl: makeSvg('Cutter', '#f59e0b', 50, 50, '🔧'),
      x: 250,
      y: 300,
      width: 45,
      height: 45,
      rotation: 0,
      zIndex: 2,
      layerIndex: 2,
      visible: true,
      oneTimeUse: false,
      pickupable: true,
      pickupItemId: 'wire-cutter',
      pickupMessage: '🔧 سیم‌چین را برداشتید. شاید به درد بخورد!',
    },
  ],
  clueChain: ['obj2-clue-note', 'obj2-clue-frame'],
  exitNumber: 3,
};

export const SEED_SESSION: Session = {
  id: 'session-seed-001',
  token: 'seed-token-abc123',
  projectId: 'proj-seed-001',
  players: [
    { telegramId: 'user-1', name: 'Player 1', online: true, ready: false },
    { telegramId: 'user-2', name: 'Player 2', online: true, ready: false },
  ],
  state: {
    currentSceneId: 'scene-room-001',
    discoveredObjects: {},
    inventory: [],
    completedScenes: [],
  },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
};
