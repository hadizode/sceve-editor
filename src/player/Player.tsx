/// <reference types="vite/client" />
// ============ Player (Game) — plays the CURRENT studio project live ============
import '@telegram-apps/telegram-ui/dist/styles.css';
import { AppRoot, Snackbar, Placeholder, Button, Cell } from '@telegram-apps/telegram-ui';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useImage from 'use-image';
import { itemName, usePlayerStore, useStudioStore } from '../stores/store';
import type { Asset, Scene, SceneObject, SessionState, Sprite, View } from '../shared/types';
import { getSprite, resolveSprite, transformRef } from '../shared/types';
import { boxMatrix, cssMatrix, hitClipPath, motionAngle, pivotScene, placementMatrix } from '../shared/geometry';
import { spriteFilterCss } from '../shared/types';
import { normalizeOpacityAnim, opacityTransitionCss, swapFade, type OpacityAnim } from '../shared/opacity-anim';
import {
  allRoomsComplete,
  checkTransformCondition,
  firedOf,
  isUsable,
  pendingRules,
} from '../shared/game-logic';
import { findObject, allObjectsDeep } from '../shared/view-tree';
import { NumPadKeys } from '../shared/NumPadKeys';
import { Section, IconButton } from '@telegram-apps/telegram-ui';
import { Icon } from '../studio/icons';
import { clamp, clampPan, centroid, dist } from './gestures';
import { useBackButton, hasTelegramBack } from '../telegram';
import { useCompact } from './useCompact';
import { InventoryOverlay } from './InventoryOverlay';
import LoadingScreen from './LoadingScreen';

/** Resolve a sprite/image ref to the concrete image URL ('' when the sprite has no image). */
const spriteSrc = (
  ref: string | undefined,
  sprites: Record<string, Sprite>,
  assets: Record<string, Asset>,
) => (ref ? resolveSprite(ref, sprites, assets) : '');

const faDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);


// ---------- Game snackbar ----------
function GameSnackbar() {
  const toast = usePlayerStore((s) => s.toast);
  const setToast = usePlayerStore((s) => s.setToast);
  const compact = useCompact();
  if (!toast) return null;

  return (
    <Snackbar
      className={`game-snackbar${compact ? ' game-snackbar--compact' : ''}`}
      before={<Icon name="alert" size={18} />}
      onClose={() => setToast(null)}
    >
      <span className="game-snackbar__message">{toast}</span>
    </Snackbar>
  );
}

// ---------- Lobby (multiplayer simulation) ----------
function Lobby({ projectName }: { projectName: string }) {
  const session = usePlayerStore((s) => s.session);
  const setReady = usePlayerStore((s) => s.setPlayerReady);
  const startNewGame = usePlayerStore((s) => s.startNewGame);

  if (!session) return null;

  return (
    <div className="h-full flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md space-y-4">
        <Placeholder
          header={<span className="block text-center">لابی بازی</span>}
          description={<span className="block text-center">پروژه: {projectName}</span>}
        />

        <Section>
          {session.players.map((p) => (
            <Cell
              key={p.telegramId}
              before={
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    p.online ? 'bg-emerald-400' : 'bg-gray-600'
                  }`}
                />
              }
              after={
                <span className={`text-xs ${p.ready ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {p.ready ? 'آماده' : 'در انتظار…'}
                </span>
              }
            >
              {p.name}
            </Cell>
          ))}
        </Section>

        <Button
          stretched
          mode="filled"
          onClick={() => setReady()}
          disabled={session.players[0]?.ready}
        >
          {session.players[0]?.ready ? 'منتظر هم‌تیمی…' : 'آماده‌ام'}
        </Button>

        <Button stretched mode="bezeled" onClick={() => startNewGame()}>
          شروع بدون منتور (حالت تک‌نفره)
        </Button>
      </div>
    </div>
  );
}

// ---------- Game object sprite ----------
/**
 * Rendering rule: ONE box per object. The image fills the box (never clipped by it), the whole box
 * is placed with `boxMatrix` (the same matrix Studio/Preview use), and the click shape is a CSS
 * clip-path built from the normalized hit polygon. Z-order = DOM order = scene array order.
 */
// ============ SwapImage: cross-fades between two image URLs via a keyframe overlay ============
// The CURRENT image layer is a normal <img src={url}> filling the box, always opacity 1,
// never remounted (no key that changes with the url). On each swap a PREVIOUS-image overlay
// <img> is mounted absolutely ABOVE the current layer at opacity 1 with a keyframe animation
// `swap-fade-out` (opacity 1 → 0). The animation starts paused and runs only after the current
// image fires onLoad (or immediately if img.complete is already true), so the fade actually
// paints instead of snapping. The overlay is removed on animationEnd plus a safety timeout.
// Each swap gets its own swapId so rapid toggling stacks correctly and never leaves a stale overlay.
// If duration is 0, no overlay is mounted (instant swap).
function SwapImage({ url, fade, swapId, name }: { url: string; fade: OpacityAnim | undefined; swapId: number; name: string }) {
  const n = normalizeOpacityAnim(fade);
  const instant = n.duration <= 0;
  const curImg = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<Animation | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  // Capture the previous URL during render, before it gets overwritten.
  const prevUrl = prevUrlRef.current;
  prevUrlRef.current = url;

  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  // When swapId changes: schedule the overlay to appear (re-render), then animate it.
  useEffect(() => {
    if (instant || !prevUrl || prevUrl === url) {
      setOverlayUrl(null);
      return;
    }
    setOverlayUrl(prevUrl);
  }, [swapId, prevUrl, url, instant]);

  // When overlayUrl is set and the overlay  is in the DOM, start the WAAPI fade-out.
  useEffect(() => {
    if (!overlayUrl || instant) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    overlay.src = overlayUrl;
    overlay.style.opacity = '1';

    const startAnim = async () => {
      // Decode the current image first (capped at 300 ms) so the fade paints instead of snapping.
      try {
        await Promise.race([
          curImg.current && typeof curImg.current.decode === 'function'
            ? curImg.current.decode().catch(() => {})
            : Promise.resolve(),
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      } catch {}

      const anim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: n.duration,
        delay: n.delay,
        easing: n.easing,
        fill: 'forwards',
      });
      animRef.current = anim;
      anim.finished.then(() => {
        setOverlayUrl(null);
        if (animRef.current === anim) animRef.current = null;
      }).catch(() => {});
    };

    startAnim();

    return () => {
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
    };
  }, [overlayUrl, instant, n.duration, n.delay, n.easing]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
    };
  }, []);

  return (
    <div className="absolute inset-0">
      {!instant && overlayUrl && (
        <img
          ref={overlayRef}
          src={overlayUrl}
          alt={name}
          draggable={false}
          className="absolute inset-0 select-none"
          style={{
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            opacity: 1,
            zIndex: 1,
          }}
        />
      )}
      <img
        ref={curImg}
        src={url}
        alt={name}
        draggable={false}
        className="absolute inset-0 select-none"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          opacity: 1,
        }}
      />
    </div>
  );
}

// ============ FadeImg: cross-fades between two image URLs via opacity layers ============
// Keeps the previous url as a back layer and the new url as the front layer, both absolutely
// positioned over the box. On a url change (with a non-zero fade duration) the front layer starts
// at opacity 0 and is flipped to 1 after two requestAnimationFrames using `opacityTransitionCss(anim)`,
// so the new image decodes/paints before becoming visible; the back layer is dropped after
// duration + delay + 50 ms. When duration is 0 the swap is instant (no back layer).
function FadeImg({ url, alt, anim }: { url: string; alt: string; anim?: OpacityAnim }) {
  const n = normalizeOpacityAnim(anim);
  const seq = useRef(0);
  const [layers, setLayers] = useState<{ key: number; url: string }[]>([{ key: 0, url }]);

  useEffect(() => {
    setLayers((p) => {
      if (p[p.length - 1].url === url) return p;
      const next = { key: ++seq.current, url };
      return n.duration <= 0 ? [next] : [...p, next];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (layers.length < 2) return;
    const t = window.setTimeout(() => setLayers((p) => p.slice(-1)), n.duration + n.delay + 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  const topEmpty = !layers[layers.length - 1].url;
  return (
    <>
      {layers.map((l, i) => {
        if (!l.url) return null;
        const isTop = i === layers.length - 1;
        const anim_ = isTop && i > 0
          ? `fadeInImg ${n.duration}ms ${n.easing} ${n.delay}ms both`
          : !isTop && topEmpty
            ? `fadeOutImg ${n.duration}ms ${n.easing} ${n.delay}ms both`
            : undefined;
        return (
          <img
            key={l.key}
            src={l.url}
            alt={isTop ? alt : ''}
            draggable={false}
            className="absolute inset-0 select-none"
            style={{ width: '100%', height: '100%', maxWidth: 'none', animation: anim_ }}
          />
        );
      })}
    </>
  );
}

function ObjSprite({
  obj,
  state,
  sceneId,
  viewId,
  assets,
  sprites,
  onOpenView,
}: {
  obj: SceneObject;
  state: SessionState;
  sceneId: string;
  viewId?: string; // id of parent object whose view we are in
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  onOpenView: (objectId: string) => void;
}) {
  const discovered = state.discoveredObjects[viewId || sceneId]?.includes(obj.id);

  // Objects that carry a digit (shows its badge once found) or still have transform rules
  // (an item must be usable on them after the first click) must stay on screen after discovery.
  const keepVisible = obj.digit !== undefined || !!obj.transforms?.length;

  // pickup Gone removed: pickupObject already marks the object discovered, so `discovered` covers it
  // (and checking inventory by itemId would wrongly hide every sibling sharing a pickupItemId).
  const hidden = !obj.visible || (!keepVisible && !!discovered && !obj.view);
  const scenesById = usePlayerStore((s) => s.scenes);
  const usable = isUsable(state, obj, scenesById);
  const tIndex = (state.transformsApplied ?? {})[obj.id] ?? -1;

  // بالاترین ruleِ اجراشده که شرطش همین الان برقرار است
  let shown: NonNullable<SceneObject['transforms']>[number] | undefined;
  const rules = obj.transforms ?? [];
  for (let i = Math.min(tIndex, rules.length - 1); i >= 0; i--) {
    if (checkTransformCondition(rules[i].conditions, state, scenesById)) {
      shown = rules[i];
      break;
    }
  }
  const shownOk = !!shown;

  // Two-state sprites (a↔b) toggle client-side via React state so a click cross-fades between the
  // two looks; a shown transform rule still wins when one is applied.
  // `twoState` lives on normalized objects but isn't declared on the SceneObject interface, so
  // widen the type here to read it without touching shared/types.
  const o = obj as SceneObject & {
    twoState?: { a: string; b: string; initial: 'a' | 'b'; anim?: OpacityAnim; toggleOnClick?: boolean } | undefined;
  };
  const [twoStateSide, setTwoStateSide] = useState(() => (o.twoState?.initial === 'b' ? 'b' : 'a'));
  const ref = shownOk && shown?.newSpriteId
    ? transformRef(shown.newSpriteId)
    : o.twoState
      ? twoStateSide === 'b'
        ? o.twoState.b
        : o.twoState.a
      : obj.spriteRef;
  const sp = getSprite(ref, sprites);
  const url = spriteSrc(ref, sprites, assets);
  const fadeAnim = shown?.fade ?? o.twoState?.anim;
  const name = (shownOk ? shown?.newName : undefined) || obj.name;

  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const numpadOpen = usePlayerStore((s) => s.numpadOpen);
  const clickObject = usePlayerStore((s) => s.clickObject);
  const pickup = usePlayerStore((s) => s.pickup);
  const useItemOnObject = usePlayerStore((s) => s.useItemOnObject);
  const rotateObject = usePlayerStore((s) => s.rotateObject);
  const say = usePlayerStore((s) => s.setToast);
  const tryOpenView = usePlayerStore((s) => s.tryOpenView);
  // The zustand `PlayerState` interface (in `src/stores/player/state.ts`, which must not be touched)
  // declares fewer params than the implementations actually accept, so cast to pass `viewId` through.
  const openNumpad = usePlayerStore((
    s,
  ) => s.openNumpad as (objectId: string, viewId?: string) => void);
  const closeNumpad = usePlayerStore((s) => s.closeNumpad);

  // Click-to-rotate motion: the accumulated step counter drives the angle around the motion pivot.
  const steps = state.motionSteps?.[obj.id] ?? 0;
  const rot = obj.motion ? motionAngle(obj.motion, steps) : 0;
  const pv = obj.motion ? pivotScene(obj, obj.motion.pivot) : { x: 0, y: 0 };
  // The shown transform rule may tint the sprite with a CSS filter (invert / hue-rotate / …).
  const filterCss = shownOk ? spriteFilterCss(shown?.filter) : undefined;

  const hides = shownOk && !!shown?.hides;
  const [hideDone, setHideDone] = useState(false);
  const hidesPrev = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const hideAnimRef = useRef<Animation | null>(null);

  // Track the previously applied rule index and a swap counter so every image swap gets
  // its own overlay (prevents stale layers on rapid toggling).
  const prevTIndexRef = useRef(tIndex);
  const [swapId, setSwapId] = useState(0);
  const swapFadeAnim = useMemo(
    () => swapFade(obj.transforms ?? [], prevTIndexRef.current, tIndex),
    [obj.transforms, tIndex]
  );
  if (tIndex !== prevTIndexRef.current) {
    setSwapId((s) => s + 1);
    prevTIndexRef.current = tIndex;
  }

  // `hides`: fade the whole box out with WAAPI, then unmount after finished.
  // Un-hiding fades back to 1 with WAAPI.
  useEffect(() => {
    if (!hides) {
      setHideDone(false);
      if (hidesPrev.current) {
        // was hidden — fade back to 1 with the rule's fade
        const anim = normalizeOpacityAnim(shown?.fade);
        const box = boxRef.current;
        if (box) {
          hideAnimRef.current = box.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: anim.duration,
            delay: anim.delay,
            easing: anim.easing,
            fill: 'forwards',
          });
          hideAnimRef.current.finished.then(() => {
            if (hideAnimRef.current) hideAnimRef.current = null;
          }).catch(() => {});
        }
      }
      hidesPrev.current = false;
      return;
    }
    if (!hidesPrev.current && !hideDone) {
      const anim = normalizeOpacityAnim(shown?.fade);
      const box = boxRef.current;
      if (box) {
        hideAnimRef.current = box.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: anim.duration,
          delay: anim.delay,
          easing: anim.easing,
          fill: 'forwards',
        });
        hideAnimRef.current.finished.then(() => {
          setHideDone(true);
          if (hideAnimRef.current) hideAnimRef.current = null;
        }).catch(() => {});
      }
    }
    hidesPrev.current = true;
    return () => {
      if (hideAnimRef.current) {
        hideAnimRef.current.cancel();
        hideAnimRef.current = null;
      }
    };
  }, [hides, shown?.fade, hideDone]);

  if (hidden || hideDone) return null;

  const clickable =
    obj.digit !== undefined ||
    !!obj.requiresItem?.length ||
    !!obj.grantsItem ||
    !!obj.message ||
    !!obj.view ||
    obj.pickupable === true ||
    !!obj.transforms?.length ||
    !!obj.motion ||
    !!obj.door ||
    !!obj.numpad ||
    !!o.twoState?.toggleOnClick;

  const pending = pendingRules(obj, state, null, scenesById);
  const anyRuleLeft = (obj.transforms ?? []).some((_, i) => !firedOf(state, obj.id).includes(i));
  const onlyTransform =
    !obj.message && obj.digit === undefined && !obj.grantsItem && !obj.requiresItem?.length;

  const handleClick = () => {
    if (!clickable) return;

    if (!usable) {
      say(obj.unusableMessage || 'فعلاً قابل استفاده نیست');
      return;
    }

    const isCodeLock = obj.numpad && obj.numpadMode === 'type' && !!obj.numpadCode && obj.numpadTrigger !== 'pickup';
    const solved = state.discoveredObjects[viewId || sceneId]?.includes(obj.id) || (state.openDoors ?? []).includes(obj.id);
    if (isCodeLock && !solved && !selectedItem) {
      openNumpad(obj.id, viewId);
      return;
    }

    // Numpad object: opening the pad is additive — it never blocks the sprite's own click
    // behaviour (message, digit, grantsItem, view, pickup, door). With trigger 'click' the pad
    // opens when the sprite is clicked; with trigger 'pickup' it opens right after pickup
    // (handled in `pickup`). Tapping a key selects the number as `selectedItem`; the pad stays
    // open until ✕ or a room change. Clicking a sprite while a number is selected uses it on
    // that sprite (handled by the `selectedItem` branch below).
    if (obj.numpad && obj.numpadTrigger === 'click' && !selectedItem) {
      openNumpad(obj.id, viewId);
    }

    // Doors take the player to another room. When an item is selected we try using it first
    // (e.g. unlocking), otherwise clicking walks straight through (clickObject handles the door).
    if (obj.door) {
      clickObject(obj.id, viewId);
      return;
    }

    // Close-up view: open freely when not gated, or when the selected item is one of the
    // items required to open. A gated view with no valid selection shows the select-item
    // toast instead of falling through to "use item on object".
    if (obj.view && !anyRuleLeft) {
      const required = Array.from(
        new Set([...(obj.requiresItem ?? []), ...(obj.view?.requiresItem ?? [])])
      );
      const unlocked = (state.unlockedViews ?? []).includes(obj.id);
      const gated = required.length > 0 && !unlocked;
      if (!gated || !selectedItem || required.includes(selectedItem)) {
        if (tryOpenView(obj.id, viewId)) onOpenView(obj.id);
        return;
      }
      say('آیتم مناسب را از کیف خود انتخاب کنید');
      return;
    }

    // Two-state toggle: flip between look a and look b, cross-fading through FadeImg.
    // Return early only when the object is a pure two-state toggle (no message, digit, item
    // grant, view, pickup, pending rule, or motion to also handle).
    if (o.twoState?.toggleOnClick) {
      setTwoStateSide((s) => (s === 'a' ? 'b' : 'a'));
      if (
        !obj.message &&
        obj.digit === undefined &&
        !obj.grantsItem &&
        !obj.view &&
        obj.pickupable !== true &&
        !anyRuleLeft &&
        !obj.motion
      ) {
        return;
      }
    }

    if (selectedItem) {
      useItemOnObject(selectedItem, obj.id, viewId);
      return;
    }

    // Motion objects rotate one step per click. When the click does nothing else (no message,
    // digit, item grant, pickup, view or transform rule waiting), stop here after rotating.
    if (obj.motion) {
      rotateObject(obj.id, viewId);
      const onlyMotion = !obj.message && obj.digit === undefined && !obj.grantsItem && !obj.pickupable && !obj.view && !anyRuleLeft;
      if (onlyMotion) return;
    }

    // rule without an item: executes with a simple click — but only when its conditions hold;
    // unmet conditions fall through to useItemOnObject(null, …) which shows the "still missing" hint.
    if (pending.length > 0) {
      useItemOnObject(null, obj.id, viewId);
      return;
    }

    // Clicking again on the last applied toggle rule reverts to the previous look (−1 = original).
    if (!anyRuleLeft) {
      const fired = firedOf(state, obj.id);
      const lastIdx = fired.length ? Math.max(...fired) : -1;
      const last = obj.transforms?.[lastIdx];
      if (lastIdx >= 0 && last?.toggle && !last.conditions?.autoApply) {
        useItemOnObject(null, obj.id, viewId);
        return;
      }
    }

    if (obj.view) {
      onOpenView(obj.id);
      return;
    }

    if (obj.pickupable) {
      pickup(obj.id, viewId);
      return;
    }

    // transform-only object with no message: show a hint instead of staying silent.
    // Never show it merely because a numpad was opened on this sprite. Read the live pad state
    // from the store (not the render closure) so a pad opened moments earlier in this same
    // click does not still produce the "select an item" toast.
    const padIsOpen = usePlayerStore.getState().numpadOpen;
    if (anyRuleLeft && onlyTransform && !(obj.numpad && padIsOpen)) {
      say('برای استفاده از این مورد، آیتم مناسب را از کیف خود انتخاب کنید');
      return;
    }

    clickObject(obj.id, viewId);
  };

  // A sprite with neither image nor color is fully invisible — but still clickable
  // when it has game rules (invisible hotspot), and never shows a placeholder.
  const hasVisual = !!url || !!sp?.color;
  const pointerCls = clickable
    ? usable
      ? 'cursor-pointer pointer-events-auto'
      : 'cursor-not-allowed pointer-events-auto'
    : 'pointer-events-none';
  const clipPath = hitClipPath(obj);

  const boxStyle: React.CSSProperties = {
    left: 0,
    top: 0,
    width: obj.width,
    height: obj.height,
    transform: cssMatrix(boxMatrix(obj)),
    transformOrigin: '0 0',
  };

  return (
    // Motion wrapper: rotate() around a transform-origin placed exactly at the pivot. Using a plain
    // rotation (instead of animating the full matrix) lets CSS interpolate along the ARC the object
    // actually travels — a matrix tween would cut straight across the chord.
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transformOrigin: `${pv.x}px ${pv.y}px`,
        transform: `rotate(${rot}deg)`,
        transition: obj.motion ? `transform ${obj.motion.duration ?? 600}ms ease-in-out` : undefined,
      }}
    >
      {/* the box: colour fill + image stretched to it + click area (clip-path = hit polygon). Mirrors with flipX/flipY. */}
      <div
        ref={boxRef}
        className="absolute pointer-events-none"
        style={{
          ...boxStyle,
          filter: filterCss,
          transition: 'filter .4s',
        }}
      >
        {sp?.color && <div className="absolute inset-0" style={{ background: sp.color }} />}

        <FadeImg url={url} alt={name} anim={fadeAnim} />

        <div
          className={`absolute inset-0 ${pointerCls} ${
            hasVisual && clickable && usable ? 'hover:bg-amber-400/10' : ''
          }`}
          style={clipPath ? { clipPath } : undefined}
          onClick={handleClick}
          title={name}
        />
      </div>
    </div>
  );
}

// ---------- Zoom/Pan scene view ----------
function SceneStage({
  scene,
  state,
  assets,
  sprites,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
}) {
  const [openViews, setOpenViews] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Active pointers keyed by pointerId (touch + mouse).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // In-flight gesture: single-finger pan or two-finger pinch.
  const gesture = useRef<{
    mode: 'pan' | 'pinch';
    start: { x: number; y: number };   // screen position where the gesture began
    pan: { x: number; y: number };     // clamped pan when the gesture began
    startScale: number;                // scale when the gesture began
    c0: { x: number; y: number };      // gesture-start centroid (pinch) / start (pan)
    startDist?: number;                // pinch: pointer distance at gesture start
    started: boolean;                  // pan: moved past the pan threshold (capture + suppress click)
  } | null>(null);
  // Suppress the click that follows a drag that passed the pan threshold.
  const suppressClick = useRef(false);

  // The current view owner is the last element of the stack.
  const current = openViews[openViews.length - 1];
  // Resolve the open close-up view before computing fit, so the viewport fits
  // the view dimensions instead of always fitting the room dimensions.
  const view: View | undefined = current ? findObject(scene.objects, current)?.view : undefined;

  // Close one level of the close-up view stack: show the popped view's closeMessage
  // (same as tapping ✕ in ViewOverlay), then return to the previous view or the room.
  const say = usePlayerStore((s) => s.setToast);
  const goBack = useCallback(() => {
    setOpenViews((vs) => {
      const popped = vs[vs.length - 1];
      if (popped) {
        const poppedView = findObject(scene.objects, popped)?.view;
        if (poppedView?.closeMessage) say(poppedView.closeMessage);
      }
      return vs.slice(0, -1);
    });
  }, [scene, say]);

  // Telegram header Back button: active whenever a close-up view is open.
  useBackButton(openViews.length > 0, goBack);

  const dimW = view?.width ?? scene.width;
  const dimH = view?.height ?? scene.height;
  const zoom = fit * scale;

  // Content size at a given zoom, matching the rendered content div (incl. view minima).
  const contentSize = useCallback(
    (z: number) => ({
      w: Math.max(dimW * z, view ? 260 : 0),
      h: Math.max(dimH * z, view ? 200 : 0),
    }),
    [dimW, dimH, view],
  );

  // Clamp pan so the content always covers the viewport; when the content is
  // smaller than the viewport on an axis, center it on that axis instead.
  const clampPanNow = useCallback(
    (p: { x: number; y: number }, z: number) => {
      const el = wrapRef.current;
      if (!el) return p;
      return clampPan(p, contentSize(z), { w: el.clientWidth, h: el.clientHeight });
    },
    [contentSize],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const compute = () => {
      const contain = Math.min(el.clientWidth / dimW, el.clientHeight / dimH);
      // Rooms fill the screen (cover); close-up views stay contained.
      const nextFit = view ? Math.min(contain, 2) : Math.max(el.clientWidth / dimW, el.clientHeight / dimH);
      setFit(nextFit);
      // Keep the content covering the viewport after the viewport/content size changed.
      setPan((p) => clampPanNow(p, nextFit * scale));
    };

    compute();

    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dimW, dimH, view, scale, clampPanNow]);

  // Reset zoom/pan whenever the current view owner changes.
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [current]);

  // Safety reset when the underlying scene changes.
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setOpenViews([]);
  }, [scene.id]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(4, Math.max(0.5, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    setScale(next);
    setPan((p) => clampPanNow(p, next));
  }, [scale, clampPanNow]);


  // ---------- pointer gestures: one-finger pan, two-finger pinch ----------

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    suppressClick.current = false; // a new interaction starts; never carry stale suppression
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = Array.from(pointers.current.values());
    if (ps.length === 2) {
      const c = centroid(ps);
      const d = dist(ps[0], ps[1]);
      gesture.current = {
        mode: 'pinch',
        start: c,
        pan: { ...pan },
        startScale: scale,
        c0: c,
        startDist: d,
        started: false,
      };
    } else if (ps.length === 1) {
      gesture.current = {
        mode: 'pan',
        start: { x: e.clientX, y: e.clientY },
        pan: { ...pan },
        startScale: scale,
        c0: { x: e.clientX, y: e.clientY },
        started: false,
      };
    } else {
      gesture.current = null; // 3+ pointers: not supported
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = Array.from(pointers.current.values());
    const el = wrapRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;

    if (ps.length === 2) {
      const g = gesture.current;
      const c = centroid(ps);
      if (!g || g.mode !== 'pinch') {
        const d = dist(ps[0], ps[1]);
        gesture.current = {
          mode: 'pinch',
          start: c,
          pan: { ...pan },
          startScale: scale,
          c0: c,
          startDist: d,
          started: false,
        };
        return;
      }
      // Zoom anchored at the gesture centroid; centroid movement also pans.
      const k = dist(ps[0], ps[1]) / (g.startDist ?? 1);
      let next = g.startScale * k;
      next = clamp(next, 1, 4);
      const k2 = next / g.startScale;
      const np = {
        x: k2 * g.pan.x + (c.x - vw / 2) - k2 * (g.c0.x - vw / 2),
        y: k2 * g.pan.y + (c.y - vh / 2) - k2 * (g.c0.y - vh / 2),
      };
      setScale(next);
      setPan(clampPan(np, contentSize(next), { w: vw, h: vh }));
      return;
    }

    if (ps.length === 1) {
      const g = gesture.current;
      const p = ps[0];
      if (!g || g.mode !== 'pan') {
        gesture.current = {
          mode: 'pan',
          start: p,
          pan: { ...pan },
          startScale: scale,
          c0: p,
          started: false,
        };
        return;
      }
      if (!g.started) {
        // Pan only after the pointer moved more than 8 px; tap reaches sprites below that.
        if (dist(p, g.start) > 8) {
          g.started = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      } else {
        const np = { x: g.pan.x + p.x - g.start.x, y: g.pan.y + p.y - g.start.y };
        setPan(clampPan(np, contentSize(scale), { w: vw, h: vh }));
      }
      return;
    }

    gesture.current = null;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    suppressClick.current = g?.mode === 'pan' && g.started;
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    suppressClick.current = false;
  };

  // Capture-phase click: suppress the click that follows a threshold-crossing drag once.
  const onClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
    }
  };

  return (
    // wrapRef is the game VIEWPORT — the only element allowed to crop sprites.
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden bg-black/40 touch-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      <div
        data-scene-content
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl"
        style={{
          width: Math.max(dimW * zoom, view ? 260 : 0),
          height: Math.max(dimH * zoom, view ? 200 : 0),
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
          willChange: 'transform',
        }}
      >
        {view ? (
          <ViewOverlay
            scene={scene}
            state={state}
            assets={assets}
            sprites={sprites}
            view={view}
            ownerId={current}
            zoom={zoom}
            onOpenView={(objectId) => setOpenViews((vs) => [...vs, objectId])}
            onClose={() => setOpenViews((vs) => vs.slice(0, -1))}
          />
        ) : (
          <div
            className="absolute top-0 left-0"
            style={{
              width: dimW,
              height: dimH,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <SceneContent
              scene={scene}
              state={state}
              assets={assets}
              sprites={sprites}
              onOpenView={(objectId) => setOpenViews((vs) => [...vs, objectId])}
            />
          </div>
        )}
      </div>

      {/* Zoom controls are now available for rooms and close-up views. */}
      <div className="absolute bottom-2 left-2 flex gap-1 z-10" dir="ltr">
        <button
          className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-sm"
          onClick={() => {
            const next = Math.min(4, scale * 1.2);
            setScale(next);
            setPan((p) => clampPanNow(p, next));
          }}
        >
          +
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-sm"
          onClick={() => {
            const next = Math.max(0.5, scale / 1.2);
            setScale(next);
            setPan((p) => clampPanNow(p, next));
          }}
        >
          −
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-xs"
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          ⟲
        </button>
      </div>
    </div>
  );
}

// ---------- Scene content (background layers + objects in array order) ----------
function SceneContent({
  scene,
  state,
  assets,
  sprites,
  viewId,
  onOpenView,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  viewId?: string;
  onOpenView: (objectId: string) => void;
}) {
  const parent = viewId ? findObject(scene.objects, viewId) : undefined;
  const W = viewId ? (parent?.view?.width ?? scene.width) : scene.width;
  const H = viewId ? (parent?.view?.height ?? scene.height) : scene.height;
  const objects = viewId ? (parent?.view?.objects ?? []) : scene.objects;
  const baseBgRef = viewId ? (parent?.view?.backgroundUrl ?? '') : scene.backgroundUrl;

  // Effects can override a room's (or a close-up view's) background at runtime — e.g. "the lights turn on".
  const bgOverride = state.backgrounds?.[viewId || scene.id];
  const bgRef = bgOverride || baseBgRef;
  const bgUrl = spriteSrc(bgRef, sprites, assets);
  const bgSp = getSprite(bgRef, sprites);
  const [bg] = useImage(bgUrl || '', 'anonymous');
  // NOTE: no overflow-hidden here — sprite images may extend past the scene bounds; only the viewport crops.
  return (
    <div className="absolute inset-0 bg-surface-light" style={{ width: W, height: H }}>
      {/* background: image (cover) or solid color sprite */}
      {bg ? (
        <img
          src={bgUrl}
          alt=""
          className="absolute inset-0 w-full h-full select-none pointer-events-none"
          style={{ objectFit: 'fill' }}
        />
      ) : bgSp?.color ? (
        <div className="absolute inset-0" style={{ background: bgSp.color }} />
      ) : null}

      {!viewId &&
        scene.backgroundLayers
          .filter((l) => l.visible)
          .map((l) => {
            const u = spriteSrc(l.spriteRef, sprites, assets);
            const lsp = getSprite(l.spriteRef, sprites);
            if (!u && !lsp?.color) return null;

            return u ? (
              <img
                key={l.id}
                src={u}
                alt=""
                className="absolute select-none pointer-events-none"
                style={{ left: l.offsetX, top: l.offsetY, width: '100%', height: '100%', objectFit: 'fill', opacity: l.opacity }}
              />
            ) : (
              <div
                key={l.id}
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `translate(${l.offsetX}px, ${l.offsetY}px)`,
                  background: lsp?.color,
                  opacity: l.opacity,
                }}
              />
            );
          })}

      {objects.map((o) => (
        <ObjSprite
          key={o.id}
          obj={o}
          state={state}
          sceneId={scene.id}
          viewId={viewId}
          assets={assets}
          sprites={sprites}
          onOpenView={onOpenView}
        />
      ))}
    </div>
  );
}

// ---------- Close-up view overlay ----------
function ViewOverlay({
  scene,
  state,
  assets,
  sprites,
  view,
  ownerId,
  zoom,
  onOpenView,
  onClose,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  view: View;
  ownerId?: string;
  zoom: number;
  onOpenView: (objectId: string) => void;
  onClose: () => void;
}) {
  const parentObj = ownerId ? findObject(scene.objects, ownerId) : undefined;

  const required = Array.from(
    new Set([...(parentObj?.requiresItem ?? []), ...(view.requiresItem ?? [])])
  );
  const unlocked = (state.unlockedViews ?? []).includes(ownerId ?? '');
  // Lock screen only for a view that was never unlocked and still lacks a required item from
  // the inventory — opening it once keeps it openable even if items are consumed later.
  const locked = required.length > 0 && !unlocked && required.some((i) => !state.inventory.includes(i));
  const say = usePlayerStore((s) => s.setToast);
  // In Telegram the header Back button replaces ✕, so hide the close button and
  // keep the title chip below the top safe area.
  const tgBack = hasTelegramBack();

  if (locked) {
    return (
      <div
        className="w-full h-full bg-surface border border-gray-700 rounded-xl flex flex-col items-center justify-center gap-3 p-6"
        dir="rtl"
      >
        <Icon name="lock" size={32} className="text-gray-400" />
        <p className="text-sm text-gray-300">برای باز کردن این مورد به آیتم نیاز دارید.</p>
        <Button mode="gray" size="s" onClick={onClose}>
          بازگشت
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-surface">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-0"
          style={{
            width: view.width,
            height: view.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <SceneContent
            scene={scene}
            state={state}
            assets={assets}
            sprites={sprites}
            viewId={ownerId}
            onOpenView={onOpenView}
          />
        </div>
      </div>

      {tgBack ? (
        // Telegram shows its own header Back button: hide ✕ and keep the title chip
        // below the top safe area so the header does not cover it.
        <div className="absolute left-2 right-2 z-10" dir="rtl">
          <div className="safe-top flex justify-end">
            <span className="bg-black/60 text-xs px-2 py-1 rounded-lg">{view.title}</span>
          </div>
        </div>
      ) : (
        <div
          className="absolute top-2 right-2 left-2 flex items-center justify-between z-10"
          dir="rtl"
        >
          <span className="bg-black/60 text-xs px-2 py-1 rounded-lg">{view.title}</span>
          <Button
            size="s"
            mode="gray"
            after={<Icon name="x" size={12} />}
            onClick={() => {
              if (view.closeMessage) say(view.closeMessage);
              onClose();
            }}
          >
            بستن
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Inventory ----------
const EMPTY: string[] = [];

function InventoryPanel({
  lockOpen,
  onToggleLock,
}: { lockOpen?: boolean; onToggleLock?: () => void } = {}) {
  const inventory = usePlayerStore((s) => s.session?.state.inventory ?? EMPTY);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const selectItem = usePlayerStore((s) => s.selectItem);
  const scenes = usePlayerStore((s) => s.scenes);
  const projectId = usePlayerStore((s) => s.session?.projectId);
  const assets = usePlayerStore((s) => s.assets);
  const sprites = usePlayerStore((s) => s.sprites);

  const itemMeta = useMemo(() => {
    const m: Record<string, { name: string; url: string; color?: string; numpad?: { objectId: string; viewId?: string } }> = {};
    if (!projectId) return m;

    const walk = (objs: SceneObject[], viewId?: string) => {
      for (const o of objs) {
        const sp = getSprite(o.spriteRef, sprites);
        const u = spriteSrc(o.spriteRef, sprites, assets);

        if (o.grantsItem && !m[o.grantsItem]) {
          m[o.grantsItem] = { name: o.name, url: u, color: sp?.color };
        }

        const key = o.pickupItemId || o.id;
        if (o.pickupable && !m[key]) {
          m[key] = {
            name: o.name, url: u, color: sp?.color,
            numpad: o.numpad ? { objectId: o.id, viewId } : undefined,
          };
        }

        o.transforms?.forEach((t) => {
          if (t.grantsItem && !m[t.grantsItem]) {
            const tref = t.newSpriteId ? transformRef(t.newSpriteId) : o.spriteRef;
            m[t.grantsItem] = {
              name: `${o.name} ✨`,
              url: spriteSrc(tref, sprites, assets),
              color: getSprite(tref, sprites)?.color,
            };
          }
        });

        if (o.view) walk(o.view.objects, o.id);
      }
    };

    Object.values(scenes)
      .filter((sc) => sc.projectId === projectId)
      .forEach((sc) => walk(sc.objects));

    return m;
  }, [scenes, projectId, assets, sprites]);

  // Group duplicates so e.g. 3 collected fuses show one icon with a ×3 counter.
  const counts = inventory.reduce<Record<string, number>>(
    (a, id) => ((a[id] = (a[id] ?? 0) + 1), a),
    {},
  );

  return (
    <div
      className="bg-surface border-t border-gray-700 px-3 py-2 flex items-center gap-2 min-h-[64px] overflow-x-auto safe-bottom"
      dir="rtl"
    >
      {onToggleLock && (
        <button
          type="button"
          onClick={onToggleLock}
          aria-label="قفل خروج"
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 ${
            lockOpen ? 'bg-white/15 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
          }`}
        >
          <Icon name={lockOpen ? 'unlock' : 'lock'} size={18} />
        </button>
      )}

      {inventory.length === 0 && (
        <div className="flex-1 flex items-center justify-center" aria-label="کیف خالی">
          <Icon name="bag" size={22} className="text-gray-500" />
        </div>
      )}

      {Object.keys(counts).map((id) => {
        const meta = itemMeta[id];

        return (
          <button
            key={id}
            onClick={() => {
              const next = selectedItem === id ? null : id;
              const owner = itemMeta[id]?.numpad;
              if (owner && next) {
                // set selectedItem AND open the pad in one update (openNumpad() would clear selectedItem)
                usePlayerStore.setState({
                  selectedItem: next,
                  numpadOpen: true,
                  numpadObjectId: owner.objectId,
                  numpadViewId: owner.viewId ?? null,
                });
              } else if (owner && !next) {
                usePlayerStore.getState().closeNumpad(); // deselecting the pen closes the pad
              } else {
                selectItem(next);
              }
            }}
            className={`relative shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden transition-all ${
              selectedItem === id
                ? 'border-white/70 ring-2 ring-white/20 scale-110'
                : 'border-gray-600 hover:border-gray-400'
            }`}
            title={meta?.name ?? itemName([], id)}
          >
            {meta?.url ? (
              <img src={meta.url} alt="" className="w-full h-full object-contain p-0.5" />
            ) : meta?.color ? (
              <div
                className="w-full h-full rounded-md"
                style={{ background: meta.color }}
                title={meta.name}
              />
            ) : (
              <span className="text-[9px] text-gray-300 px-0.5 truncate">
                {meta?.name ?? itemName([], id)}
              </span>
            )}

            {counts[id] > 1 && (
                <span className="absolute -bottom-1 -left-1 bg-gray-600 text-white text-[10px] rounded-full px-1">
                ×{counts[id]}
              </span>
            )}
          </button>
        );
      })}

    </div>
  );
}

// ---------- Bottom inventory drawer (play mode only) ----------
function Drawer({ children, open }: { children: React.ReactNode; open: boolean }) {
  return (
    <div
      className={`absolute bottom-0 inset-x-0 z-30 transition-transform duration-200 ease-out ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {children}
    </div>
  );
}

// Handle that always peeks at the bottom center and toggles the drawer.
function DrawerHandle({
  open,
  selectedItem,
  pulse,
  onToggle,
}: {
  open: boolean;
  selectedItem: string | null;
  pulse: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'بستن نوار انبار' : 'باز کردن نوار انبار'}
      className={`absolute bottom-4 right-4 z-40 w-11 h-11 shrink-0 rounded-full bg-black/50 hover:bg-black/60 flex items-center justify-center text-white text-xs ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      {open ? '▼' : '▲'}
      {!open && selectedItem && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white/30" />
      )}
    </button>
  );
}
//+++++++++++ NumPad UI +++++++++++

/**
 * numpad interactive ui is as same as inventory but its contains numbers that set in studio(praperties.tsx),
 * if a sprit with enabled numpad argument clicked ; a panel or pad appears right on the inventory (overlay the inventory),
 * numbes in panel can be selected then clicked on some sprit and a rule fires . 
 */
function NumsPadUI() {
  const numpadOpen = usePlayerStore((s) => s.numpadOpen);
  const numpadObjectId = usePlayerStore((s) => s.numpadObjectId);
  const numpadViewId = usePlayerStore((s) => s.numpadViewId);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const typeDigit = usePlayerStore((s) => s.typeDigit);
  const backspaceDigit = usePlayerStore((s) => s.backspaceDigit);
  const undoNumpadDigit = usePlayerStore((s) => s.undoNumpadDigit);
  const closeNumpad = usePlayerStore((s) => s.closeNumpad);
  const selectItem = usePlayerStore((s) => s.selectItem);
  // The zustand `PlayerState` interface (in `src/stores/player/state.ts`, which must not be touched)
  // declares fewer params than the implementations actually accept, so cast to pass `viewId` through.
  const useItemOnObject = usePlayerStore((
    s,
  ) => s.useItemOnObject as (itemId: string, objectId: string, viewId?: string) => void);
  const scenes = usePlayerStore((s) => s.scenes);
  const session = usePlayerStore((s) => s.session);

  if (!numpadOpen || !numpadObjectId || !session) return null;

  const sourceObj = Object.values(scenes)
    .flatMap((sc) => allObjectsDeep(sc.objects))
    .find((o) => o.id === numpadObjectId);
  if (!sourceObj?.numpad) return null;

  // With trigger 'pickup' the sprite leaves the scene on pickup, so type mode is forced to pick.
  const mode = sourceObj.numpadTrigger === 'pickup' || sourceObj.pickupable
    ? 'pick'
    : (sourceObj.numpadMode ?? 'pick');
  const cells = sourceObj.numpadCells ?? 3;
  const min = sourceObj.numpadMin ?? 1;
  const max = sourceObj.numpadMax ?? 9;
  const font = sourceObj.numpadFont ?? 'Vazirmatn';
  const color = sourceObj.numpadColor ?? '#ffffff';
  const bg = sourceObj.numpadBg ?? '#3a3a3a';
  const size = sourceObj.numpadSize ?? 40;

  const selected = selectedItem && /^\d+$/.test(selectedItem) ? selectedItem : null;
  const typed = session.state.numpadTyped?.[numpadObjectId] ?? [];

  const pressKey = (n: string) => {
    if (mode === 'type') typeDigit(numpadObjectId, n, cells);
    else selectItem(selected === n ? null : n);
  };

  // Delete key: in type mode undo the last typed cell; in pick mode clear the selection, and when
  // nothing is selected undo the last fired numeric rule of the pad object.
  const deleteKey = () => {
    if (mode === 'type') {
      backspaceDigit(numpadObjectId);
      return;
    }
    if (selected) selectItem(null);
    else undoNumpadDigit(numpadObjectId);
  };

  return (
    <Section
      header="پد عددی"
      className="absolute bottom-0 left-0 right-0 z-50 w-full !bg-surface border-t border-gray-700 max-h-[40dvh] overflow-y-auto"
      dir="rtl"
    >
      <div className="flex w-full items-center justify-end">
        <IconButton
          size="s"
          mode="plain"
          onClick={closeNumpad}
          aria-label="بستن"
          title="بستن"
        >
          <Icon name="x" size={18} />
        </IconButton>
      </div>

      {mode === 'type' && (
        <div className="flex items-center gap-1.5" dir="ltr">
          {Array.from({ length: cells }, (_, i) => (
            <div key={i} className="w-7 h-8 rounded border border-gray-500 flex items-center justify-center text-sm font-bold bg-black/30 sr-only">
              {typed[i] ?? ''}
            </div>
          ))}
          <button type="button" onClick={() => backspaceDigit(numpadObjectId)} className="px-2 h-8 rounded bg-red-900/40 text-xs">⌫</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-[1px]">
          <NumPadKeys min={min} max={max} selected={selected} onPress={pressKey} size={size} font={font} color={color} bg={bg} />
        </div>
        <IconButton
          size="s"
          mode="gray"
          onClick={deleteKey}
          aria-label="پاک کردن"
          title="پاک کردن"
        >
          <Icon name="backspace" size={18} />
        </IconButton>
      </div>

      {mode === 'pick' && selected !== null && (
        <p className="text-[10px] text-amber-300 text-center animate-pulse">
          عدد {selected} انتخاب شد — روی یک شیء کلیک کنید
        </p>
      )}
    </Section>
  );
}

// ---------- Final lock ----------
function FinalLock() {
  const session = usePlayerStore((s) => s.session);
  const scenes = usePlayerStore((s) => s.scenes);
  const lockInput = usePlayerStore((s) => s.lockInput);
  const enterDigit = usePlayerStore((s) => s.enterLockDigit);
  const clearDigit = usePlayerStore((s) => s.clearLockDigit);
  const submitLock = usePlayerStore((s) => s.submitLock);
  const resetGame = usePlayerStore((s) => s.resetGame);

  if (!session) return null;

  const list = Object.values(scenes).filter((sc) => sc.projectId === session.projectId);
  const ready = allRoomsComplete(session.state, list);

  if (session.complete) {
    return (
      <div className="h-full flex items-center justify-center p-6" dir="rtl">
        <Placeholder
          header={<span className="block text-center text-emerald-400">تبریک! فرار موفق!</span>}
          description={
            <span className="block text-center">
              شما رمز نهایی را درست وارد کردید و اتاق فرار را تمام کردید.
            </span>
          }
          children={<Icon name="check" size={48} className="text-emerald-400" />}
          action={
            <Button mode="filled" before={<Icon name="play" size={16} />} onClick={resetGame}>
              بازی جدید
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm space-y-4">
        <Placeholder
          header={<span className="block text-center">قفل خروج</span>}
          description={
            <span className="block text-center">
              {ready
                ? 'همه اتاق‌ها کامل شده‌اند! رمز نهایی را وارد کنید.'
                : 'ابتدا همه اتاق‌ها را کامل کنید.'}
            </span>
          }
          children={<Icon name="lock" size={40} className="text-amber-400" />}
        />

        <div className="flex gap-2 justify-center" dir="ltr">
          {list.map((sc) => {
            const done = session.state.completedScenes.includes(sc.id);
            return (
              <div
                key={sc.id}
                className={`w-10 h-12 rounded-lg border flex items-center justify-center text-lg font-bold ${
                  done
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-gray-600 text-gray-600'
                }`}
              >
                {/* the lock code is each room's exit digit — not whichever digit object the player found */}
                {done ? faDigits(String(sc.exitNumber)) : '?'}
              </div>
            );
          })}
        </div>

        <div
          className="bg-black/40 rounded-xl py-3 text-center text-2xl tracking-[0.5em] font-mono"
          dir="ltr"
        >
          {lockInput ? (
            faDigits(lockInput)
          ) : (
            <span className="text-gray-600 text-base">— — —</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2" dir="ltr">
          {'123456789'.split('').map((d) => (
            <Button
              key={d}
              size="l"
              mode="bezeled"
              disabled={!ready}
              onClick={() => enterDigit(d)}
            >
              {faDigits(d)}
            </Button>
          ))}

          <IconButton
            size="l"
            mode="gray"
            disabled={!ready}
            onClick={clearDigit}
            aria-label="پاک کردن"
            title="پاک کردن"
          >
            <Icon name="backspace" size={18} />
          </IconButton>

          <Button size="l" mode="bezeled" disabled={!ready} onClick={() => enterDigit('0')}>
            {faDigits('0')}
          </Button>

          <Button
            size="l"
            mode="filled"
            disabled={!ready || !lockInput}
            onClick={submitLock}
            aria-label="ثبت رمز"
          >
            <Icon name="check" size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Silent Error Boundary for Player ----------
interface SilentBoundaryProps {
  children: React.ReactNode;
}

interface SilentBoundaryState {
  hasError: boolean;
  tries: number;
}

class SilentBoundary extends React.Component<SilentBoundaryProps, SilentBoundaryState> {
  state: SilentBoundaryState = {
    hasError: false,
    tries: 0,
  };

  private internalKey = 0;
  private recentErrors: number[] = [];

  static getDerivedStateFromError(_: unknown): Partial<SilentBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Player render error (auto-recovered):', error);
    const now = Date.now();
    this.recentErrors = this.recentErrors.filter((t) => now - t <= 2000);
    this.recentErrors.push(now);

    if (this.recentErrors.length > 3) {
      this.setState((prev) => ({ tries: prev.tries + 1 }));
      return;
    }

    this.internalKey++;
    this.setState((prev) => ({
      hasError: false,
      tries: prev.tries + 1,
    }));
  }

  private handleRetry = () => {
    this.recentErrors = [];
    this.internalKey++;
    this.setState({ hasError: false, tries: 0 });
  };

  render() {
    if (this.state.hasError && this.recentErrors.length > 3) {
      return (
        <div className="p-4 flex items-center justify-center text-center">
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-xl bg-surface-lighter hover:bg-surface-hover text-white text-sm"
          >
            تلاش دوباره
          </button>
        </div>
      );
    }

    if (this.state.hasError) {
      return null;
    }

    return (
      <React.Fragment key={this.internalKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

// ---------- Main Player ----------
export default function Player({ projectName }: { projectName: string }) {
  // Keep the additional Telegram theme field local to the Player UI.
  const webApp = window.Telegram?.WebApp as
    | (NonNullable<NonNullable<Window['Telegram']>['WebApp']> & {
        colorScheme?: 'light' | 'dark';
      })
    | undefined;

  return (
    <AppRoot
      platform="ios"
      appearance={webApp?.colorScheme ?? 'dark'}
      className="player-root h-full w-full min-h-0 relative text-center"
    >
      <PlayerContent projectName={projectName} />
    </AppRoot>
  );
}

function PlayerContent({ projectName }: { projectName: string }) {
  const loadFromStudio = usePlayerStore((s) => s.loadFromStudio);
  const session = usePlayerStore((s) => s.session);
  const scenes = usePlayerStore((s) => s.scenes);
  const assets = usePlayerStore((s) => s.assets);
  const sprites = usePlayerStore((s) => s.sprites);
  const switchScene = usePlayerStore((s) => s.switchScene);
  const resetGame = usePlayerStore((s) => s.resetGame);
  const startNewGame = usePlayerStore((s) => s.startNewGame);
  const [tab, setTab] = useState<'rooms' | 'exit'>('rooms');
  const [phase, setPhase] = useState<'loading' | 'closing' | 'ready'>('loading');

  // Play-only mode (vite --mode play, or VITE_PLAY_ONLY=1 for build:play): auto-start and never show the lobby.
  const isPlay = import.meta.env.MODE === 'play' || import.meta.env.VITE_PLAY_ONLY === '1';

  const [confirmReset, setConfirmReset] = useState(false);

  const [lockOpen, setLockOpen] = useState(false);

  const toggleLock = () => setLockOpen((o) => !o);
  const closeLock = () => setLockOpen(false);

  // Telegram native Back closes the exit-lock overlay; outside Telegram a ✕ button is shown instead.
  useBackButton(lockOpen, closeLock);

  useEffect(() => {
    if (!confirmReset) return;
    const t = window.setTimeout(() => setConfirmReset(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmReset]);

  useEffect(() => {
    loadFromStudio();
  }, [loadFromStudio]);

  // Loading phase machine: 'loading' -> 'closing' -> 'ready'. Move on only when the
  // minimum delay elapsed AND the first scene's images preloaded (errors resolve too).
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;

    const firstScene = session ? scenes[session.state.currentSceneId] : undefined;
    const urls: string[] = [];
    if (firstScene) {
      const bg = resolveSprite(firstScene.backgroundUrl ?? '', sprites, assets);
      if (bg) urls.push(bg);
      for (const obj of firstScene.objects ?? []) {
        const u = resolveSprite(obj.spriteRef, sprites, assets);
        if (u) urls.push(u);
      }
    }

    const preloaded = urls.length
      ? Promise.all(
          urls.map(
            (u) =>
              new Promise<void>((res) => {
                const im = new Image();
                im.onload = () => res();
                im.onerror = () => res(); // a broken image must never block loading
                im.src = u;
              }),
          ),
        )
      : Promise.resolve();

    Promise.all([preloaded, new Promise((res) => setTimeout(res, 600))]).then(() => {
      if (!cancelled) setPhase('closing');
    });
    return () => {
      cancelled = true;
    };
  }, [phase, session, scenes, assets, sprites]);

  // 'closing' -> 'ready' when the loading screen's fade-out transition ends (timeout fallback).
  useEffect(() => {
    if (phase !== 'closing') return;
    const done = () => setPhase('ready');
    window.addEventListener('loading-finished', done, { once: true });
    const t = window.setTimeout(done, 500); // fallback if transitionend never fires
    return () => {
      window.removeEventListener('loading-finished', done);
      window.clearTimeout(t);
    };
  }, [phase]);

  // Play-only mode: start the game immediately so the lobby is never visible.
  // Also covers the post-win "بازی جدید" button, which calls resetGame() and
  // leaves the session unstarted — this effect restarts it automatically.
  useEffect(() => {
    if (!isPlay) return;
    if (session && !session.started) {
      startNewGame();
    }
  }, [isPlay, session, startNewGame]);

  const sceneList = useMemo(
    () =>
      session
        ? Object.values(scenes).filter((sc) => sc.projectId === session.projectId)
        : [],
    [scenes, session],
  );

  const currentScene = session ? scenes[session.state.currentSceneId] : undefined;

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400" dir="rtl">
        در حال بارگذاری…
      </div>
    );
  }

  if (!session.started) {
    return (
      <>
        <GameSnackbar />
        {!isPlay && <Lobby projectName={projectName} />}
        {phase !== 'ready' && <LoadingScreen closing={phase === 'closing'} />}
      </>
    );
  }

  const roomDone = (sc: Scene) => session.state.completedScenes.includes(sc.id);

  return (
    <div className={isPlay ? 'fixed inset-0' : 'h-full flex flex-col'} dir="rtl">
      <GameSnackbar />
      {phase !== 'ready' && <LoadingScreen closing={phase === 'closing'} />}

      {!isPlay && (
        // Room tabs (hidden in play-only mode — the room fills the whole screen)
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto flex-shrink-0">
        {sceneList.map((sc, i) => (
          <Button
            key={sc.id}
            size="s"
            mode={tab === 'rooms' && sc.id === session.state.currentSceneId ? 'filled' : 'plain'}
            before={roomDone(sc) ? <Icon name="check" size={14} /> : undefined}
            onClick={() => {
              setTab('rooms');
              switchScene(sc.id);
            }}
          >
            {faDigits(String(i + 1))}. {sc.title}
          </Button>
        ))}

        <Button
          mode={tab === 'exit' ? 'filled' : 'plain'}
          size="s"
          before={<Icon name="door" size={14} />}
          onClick={() => setTab('exit')}
        >
          خروج
        </Button>

        <Button
          mode={confirmReset ? 'filled' : 'outline'}
          size="s"
          before={<Icon name="undo" size={14} />}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            setConfirmReset(false);
            setTab('rooms');
            resetGame();
          }}
          title="ریست بازی"
          aria-label="ریست بازی"
        >
          {confirmReset ? 'مطمئنید؟ دوباره بزنید' : 'ریست'}
        </Button>
      </div>
        )}
      
      {/* Stage */}
      <div className={`${isPlay ? 'absolute inset-0' : 'flex-1 min-h-0'} relative`}>
        {tab === 'exit' ? (
          <FinalLock />
        ) : currentScene ? (
          <SilentBoundary key={currentScene.id}>
            <SceneStage
              key={currentScene.id}
              scene={currentScene}
              state={session.state}
              assets={assets}
              sprites={sprites}
            />
          </SilentBoundary>
        ) : (
          <div
            className="h-full flex items-center justify-center text-gray-500 text-sm"
            dir="rtl"
          >
            اتاقی وجود ندارد.
          </div>
        )}
      </div>

      {isPlay ? (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <SilentBoundary>
              <InventoryOverlay lockOpen={lockOpen} onToggleLock={toggleLock} />
            </SilentBoundary>
            <NumsPadUI />
          </div>
          {lockOpen && (
            <div className="absolute inset-0 z-40 bg-black/85" dir="rtl">
              <FinalLock />
              {!hasTelegramBack() && (
                <IconButton
                  type="button"
                  onClick={closeLock}
                  aria-label="بستن"
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-12 h-12 shrink-0"
                >
                  <Icon name="x" size={20} />
                </IconButton>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 pointer-events-none">
          <SilentBoundary>
            <InventoryOverlay />
          </SilentBoundary>
          <NumsPadUI />
        </div>
      )}
    </div>
  );
}