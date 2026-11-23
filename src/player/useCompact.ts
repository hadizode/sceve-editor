import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia('(max-height: 480px)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia('(max-height: 480px)').matches;
}

function getServerSnapshot() {
  return false; // Default to non-compact on server
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
