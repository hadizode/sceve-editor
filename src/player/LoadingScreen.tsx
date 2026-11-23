import { CircularProgress } from '@telegram-apps/telegram-ui';

/** Full-screen loading overlay shown while phase is 'loading' or 'closing'. */
export default function LoadingScreen({
  closing,
  sticker,
  label = 'در حال آماده‌سازی…',
}: {
  closing?: boolean;
  /** Optional sticker slot content (image/lottie) rendered above the spinner. */
  sticker?: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      className={
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 transition-all duration-300 ' +
        (closing ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100')
      }
      onTransitionEnd={(e) => {
        if (closing && e.propertyName === 'opacity') {
          window.dispatchEvent(new CustomEvent('loading-finished'));
        }
      }}
    >
      {sticker ? (
        <div className="w-28 h-28">{sticker}</div>
      ) : null}
      <CircularProgress size="large" />
      <p className="text-sm text-gray-200 text-center px-4">{label}</p>
    </div>
  );
}
