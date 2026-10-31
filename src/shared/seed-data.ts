import type { Project, Scene, SceneObject, View } from './types';
import { placeholderSvg, svgDataUrl } from './utils';

const mk = (
  id: string,
  name: string,
  type: SceneObject['type'],
  label: string,
  color: string,
  emoji: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<SceneObject> = {}
): SceneObject => ({
  id,
  name,
  type,
  imageUrl: placeholderSvg(label, color, w, h, emoji),
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  visible: true,
  locked: false,
  oneTimeUse: false,
  ...extra,
});

export const SEED_BACKGROUND = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/><stop offset="50%" style="stop-color:#16213e"/><stop offset="100%" style="stop-color:#0f3460"/>
      </linearGradient>
      <pattern id="wood" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#2d1810"/>
        <line x1="0" y1="5" x2="40" y2="5" stroke="#3d2216" stroke-width="0.5"/>
        <line x1="0" y1="25" x2="40" y2="25" stroke="#3d2216" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect x="0" y="420" width="800" height="180" fill="url(#wood)" opacity="0.7"/>
    <rect x="320" y="40" width="160" height="120" fill="#0a1628" stroke="#4a5568" stroke-width="3" rx="4"/>
    <rect x="50" y="100" width="200" height="300" fill="#3d2216" stroke="#5c3a1e" stroke-width="2" rx="4"/>
    <rect x="500" y="320" width="250" height="100" fill="#4a2c17" stroke="#5c3a1e" stroke-width="2" rx="4"/>
    <ellipse cx="400" cy="480" rx="150" ry="60" fill="#7c2d12" opacity="0.6" stroke="#92400e" stroke-width="2"/>
    <text x="400" y="590" text-anchor="middle" fill="#475569" font-size="11" font-family="Vazirmatn">اتاق کتابخانه قدیمی</text>
  </svg>`
);

const BASEMENT_BG = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0a0a"/><stop offset="100%" style="stop-color:#2d1515"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg2)"/>
    <rect x="0" y="450" width="800" height="150" fill="#1a1a1a"/>
    <rect x="100" y="100" width="600" height="350" fill="none" stroke="#4a2020" stroke-width="2" rx="8"/>
    <text x="400" y="580" text-anchor="middle" fill="#4a2020" font-size="11" font-family="Vazirmatn">اتاق زیرزمین تاریک</text>
  </svg>`
);

const CLOCK_VIEW: View = {
  id: 'view-clock',
  title: 'نمای نزدیک ساعت',
  backgroundUrl: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect width="100%" height="100%" fill="#1a0a2e"/>
      <circle cx="200" cy="200" r="150" fill="#1a1a2e" stroke="#c9a84c" stroke-width="4"/>
      <line x1="200" y1="200" x2="280" y2="200" stroke="#c9a84c" stroke-width="4" stroke-linecap="round"/>
      <line x1="200" y1="200" x2="200" y2="120" stroke="#c9a84c" stroke-width="3" stroke-linecap="round"/>
      <circle cx="200" cy="200" r="6" fill="#c9a84c"/>
    </svg>`
  ),
  width: 400,
  height: 400,
  closeMessage: 'ساعت را بستید',
  objects: [
    mk('view-clock-secret', 'رمز ساعت', 'decoration', '۳:۱۵', '#c9a84c', '', 160, 350, 80, 35, {
      message: '🕐 عقربه‌ها ساعت ۳:۱۵ را نشان می‌دهند... شاید این یک رمز باشد!',
    }),
  ],
};

export const SEED_PROJECT: Project = {
  id: 'proj-seed-001',
  name: 'Escape Room: Old Library',
  description: 'A classic escape room with chained clues in an old library.',
  scenes: ['scene-room-001', 'scene-room-002'],
  finalLockDigits: '73',
  assets: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const SEED_SCENE: Scene = {
  id: 'scene-room-001',
  projectId: 'proj-seed-001',
  title: 'Old Library',
  width: 800,
  height: 600,
  backgroundUrl: SEED_BACKGROUND,
  backgroundLayers: [],
  exitNumber: 7,
  clueChain: ['obj-clue-book', 'obj-clue-rug', 'obj-container-box'],
  objects: [
    mk('obj-clue-rug', 'Ornamental Rug', 'decoration', 'Rug', '#92400e', '🟫', 330, 440, 140, 70, {
      message: '🔑 زیر فرش یک کلید کوچک طلایی پیدا کردید!',
      grantsItem: 'key-gold',
    }),
    mk('obj-clue-painting', 'Wall Painting', 'decoration', 'Painting', '#0ea5e9', '🖼️', 550, 120, 90, 70, {
      message: '🔍 پشت تابلو نوشته: "عدد اول در صندوق است، عدد دوم در گلدان"',
    }),
    mk('obj-deco-clock', 'Wall Clock', 'decoration', 'Clock', '#6b7280', '🕐', 300, 60, 55, 55, {
      message: '🕐 یک ساعت قدیمی. عقربه‌ها روی ۳:۱۵ متوقف شده‌اند...',
      view: CLOCK_VIEW,
    }),
    mk('obj-clue-book', 'Red Ancient Book', 'decoration', 'Red Book', '#dc2626', '📕', 80, 130, 60, 80, {
      rotation: -5,
      message: '📜 یک یادداشت داخل کتاب پیدا کردید: "کلید زیر فرش است"',
    }),
    mk('obj-deco-candle', 'Candlestick', 'decoration', 'Candle', '#f59e0b', '🕯️', 650, 290, 35, 50, {
      message: '🕯️ شمع هنوز روشن است. نور ضعیفی دارد.',
    }),
    mk('obj-container-box', 'Locked Wooden Box', 'container', 'Box', '#7c3aed', '📦', 560, 330, 80, 60, {
      oneTimeUse: true,
      message: '🔓 صندوق باز شد! عدد ۷ داخل آن بود!',
      requiresItem: ['key-gold'],
      digit: 7,
      grantsItem: 'digit-7',
    }),
  ],
};

export const SEED_SCENE_2: Scene = {
  id: 'scene-room-002',
  projectId: 'proj-seed-001',
  title: 'Basement Room',
  width: 800,
  height: 600,
  backgroundUrl: BASEMENT_BG,
  backgroundLayers: [],
  exitNumber: 3,
  clueChain: ['obj2-clue-note', 'obj2-clue-frame'],
  objects: [
    mk('obj2-clue-frame', 'Photo Frame', 'decoration', 'Frame', '#8b5cf6', '🖼️', 150, 150, 70, 90, {
      message: '🔢 پشت قاب عکس، عدد ۳ حک شده!',
      grantsItem: 'digit-3',
      digit: 3,
    }),
    mk('obj2-deco-skull', 'Decorative Skull', 'decoration', 'Skull', '#6b7280', '💀', 550, 350, 45, 45, {
      message: '💀 یک جمجمه قدیمی. شاید متعلق به دزد دریایی باشد!',
    }),
    mk('obj2-clue-note', 'Note on Table', 'decoration', 'Note', '#fbbf24', '📝', 350, 250, 70, 50, {
      rotation: 3,
      message: '📝 یادداشت: "عدد ۳ پشت قاب عکس پنهان شده"',
    }),
    mk('obj2-wire-bare', 'Bare Wire End', 'decoration', 'Bare Wire', '#dc2626', '⚡', 400, 400, 50, 35, {
      message: '⚡ یک سر سیم لخت. بدون عایق خطرناک به نظر می‌رسد.',
      transforms: [
        {
          requiresItem: 'wire-cutter',
          newImageUrl: placeholderSvg('Fixed Wire', '#10b981', 50, 35, '✓'),
          newName: 'Fixed Wire',
          newMessage: '✅ سیم‌چین را استفاده کردید و سیم لخت به سیم سالم تبدیل شد!',
          consumesItem: false,
          triggersDiscovery: true,
        },
      ],
    }),
    mk('obj2-wire-cutter', 'Wire Cutter', 'inventory', 'Cutter', '#f59e0b', '🔧', 250, 300, 45, 45, {
      pickupable: true,
      pickupItemId: 'wire-cutter',
      pickupMessage: '🔧 سیم‌چین را برداشتید. شاید به درد بخورد!',
    }),
  ],
};

export const SEED_SCENES: Scene[] = [SEED_SCENE, SEED_SCENE_2];
