import { useEffect, useRef } from 'react';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  requestFullscreen: () => void;
  isFullscreen: boolean;
  disableVerticalSwipes: () => void;
  isVersionAtLeast: (version: string) => boolean;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function tg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function hasTelegramBack(): boolean {
  const app = tg();
  return !!app && app.isVersionAtLeast('6.1');
}

let initDone = false;

export function initTelegram(): void {
  if (initDone) return;
  initDone = true;

  const app = tg();
  if (!app) return;

  try {
    app.ready();
  } catch {
    /* ignore */
  }

  try {
    app.expand();
  } catch {
    /* ignore */
  }

  try {
    if (app.isVersionAtLeast('8.0') && !app.isFullscreen) {
      app.requestFullscreen();
    }
  } catch {
    /* ignore */
  }

  try {
    if (app.isVersionAtLeast('7.7')) {
      app.disableVerticalSwipes();
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof app.setHeaderColor === 'function') {
      app.setHeaderColor('#000000');
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof app.setBackgroundColor === 'function') {
      app.setBackgroundColor('#000000');
    }
  } catch {
    /* ignore */
  }
}

/* Module-level stack for back-button handlers.
   When several hooks are active, only the most-recently-pushed handler runs. */
const backStack: Array<() => void> = [];
let backClickRegistered = false;

function runTopBackHandler(): void {
  const handler = backStack[backStack.length - 1];
  if (handler) handler();
}

function ensureBackClickRegistered(app: TelegramWebApp): void {
  if (!backClickRegistered) {
    app.BackButton.onClick(runTopBackHandler);
    backClickRegistered = true;
  }
}

function unregisterBackClick(app: TelegramWebApp): void {
  if (backClickRegistered) {
    app.BackButton.offClick(runTopBackHandler);
    backClickRegistered = false;
  }
}

export function useBackButton(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const app = tg();
    if (!app || !hasTelegramBack()) return;

    if (active) {
      const handler = () => {
        onBackRef.current();
      };
      backStack.push(handler);
      app.BackButton.show();
      ensureBackClickRegistered(app);

      return () => {
        const idx = backStack.lastIndexOf(handler);
        if (idx !== -1) backStack.splice(idx, 1);
        if (backStack.length === 0) {
          app.BackButton.hide();
          unregisterBackClick(app);
        }
      };
    }
  }, [active]);
}
