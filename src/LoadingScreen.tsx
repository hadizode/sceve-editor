import React, { useEffect, useState } from 'react';

/** Rotating hints shown while the game loads (Persian, RTL). */
const HINTS: readonly string[] = [
  'روی درها بزن تا بگردی',
  'دنبال اعداد تک رقمی برای خروج بگرد',
  'آیتم‌ها رو از کیف انتخاب کن',
  '📲گوشی رو بچرخون',
];

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const toPersianDigits = (n: number): string =>
  String(n).replace(/\d/g, (ch) => PERSIAN_DIGITS[Number(ch)]);

export interface LoadingScreenProps {
  title: string;
  progress: number; // 0..1
  leaving?: boolean;
  error?: string;
  onRetry?: () => void;
}

export default function LoadingScreen({
  title,
  progress,
  leaving = false,
  error,
  onRetry,
}: LoadingScreenProps) {
  const [hint, setHint] = useState(HINTS[0]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHint((current) => {
        const index = HINTS.indexOf(current);
        return HINTS[(index + 1) % HINTS.length];
      });
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const percent = Math.round(Math.min(100, Math.max(0, progress * 100)));

  return (
    <div
      className={`fixed inset-0 z-[900] bg-gradient-to-b from-[#0b0d14] via-[#0f1220] to-[#0b0d14] text-white dir=rtl transition-opacity duration-400 ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="safe-top safe-bottom flex h-full w-full flex-col items-center justify-center gap-6 p-4">
        <div className="text-6xl animate-pulse-glow" aria-hidden="true">
          🔐
        </div>
        <h1 className="text-xl font-semibold tracking-wide">{title}</h1>
        <p className="text-sm text-gray-400">به اتاق فرار خوش آمدی</p>
        {error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={onRetry}
              disabled={!onRetry}
              className="px-4 py-1.5 rounded border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <>
            <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-400" dir="ltr">
              {toPersianDigits(percent)}٪
            </div>
            <p className="text-xs text-gray-500">{hint}</p>
          </>
        )}
      </div>
    </div>
  );
}
