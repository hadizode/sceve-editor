# اتاق فرار گروهی - Escape Room Platform

پلتفرم بازی اتاق فرار و اشیاء پنهان گروهی از طریق تلگرام. فارسی، RTL، موبایل‌محور.

## ساختار

```
src/
├── shared/          # تایپ‌ها، اسکیمای Zod، منطق بازی
│   ├── types.ts     # Zod schemas + TypeScript types
│   ├── game-logic.ts # توابع خالص منطق بازی
│   └── seed-data.ts # داده‌های اولیه (یک پروژه با دو اتاق)
├── stores/
│   └── store.ts     # Zustand stores (Studio + Player)
├── studio/
│   └── Studio.tsx   # ویرایشگر صحنه با Konva
├── player/
│   └── Player.tsx   # رابط بازی بازیکن
├── App.tsx          # روتینگ اصلی
└── index.css        # استایل‌های RTL + Tailwind
```

## ویژگی‌ها

### استودیو طراحی
- ✅ مدیریت پروژه (ایجاد، حذف، لیست)
- ✅ ویرایشگر Konva با pan/zoom
- ✅ CRUD اشیاء با درگ و ریسایز
- ✅ پنل ویژگی‌ها برای هر SceneObject
- ✅ آپلود پس‌زمینه
- ✅ زنجیره سرنخ بصری
- ✅ لایه‌ها و z-order
- ✅ پیش‌نمایش درون‌صفحه‌ای
- ✅ اعتبارسنجی پروژه
- ✅ Undo/Redo
- ✅ خروجی/ورود JSON
- ✅ تکثیر اتاق
- ✅ شبکه و چسبندگی

### بازیکن
- ✅ لابی با لیست بازیکنان و دکمه آماده
- ✅ رندر اتاق با Konva
- ✅ کلیک و کشف اشیاء
- ✅ نمایش پیام سرنخ
- ✅ سیستم آیتم و ظرف
- ✅ شمارنده ارقام اتاق
- ✅ قفل نهایی با صفحه‌کلید عددی
- ✅ انیمیشن پیروزی
- ✅ ناوبری بین اتاق‌ها
- ✅ نشانگر آنلاین/آفلاین
- ✅ ذخیره در localStorage
- ✅ طراحی موبایل‌محور
- ✅ ARIA labels

## اجرا

```bash
npm install
npm run dev      # توسعه
npm run build    # ساخت
```

## بازی آزمایشی

بازی seed شامل:
- **پروژه:** اتاق فرار کتابخانه
- **اتاق ۱:** کتابخانه قدیمی (عدد خروجی: ۷)
  - زنجیره: کتاب قرمز → فرش → صندوق → عدد ۷
  - آیتم: کلید طلایی (از فرش) → صندوق
- **اتاق ۲:** اتاق زیرزمین (عدد خروجی: ۳)
  - زنجیره: یادداشت → قاب عکس → عدد ۳
- **قفل نهایی:** ۷۳

## Assumptions

- تصاویر به صورت SVG data URI ذخیره می‌شوند (در حالت واقعی فایل آپلود می‌شود)
- سرور واقعی Fastify/SQLite در این نسخه پیاده‌سازی نشده (فقط فرانت‌اند)
- Socket.io فقط به صورت client نصب شده (سرور واقعی نیاز به بک‌اند جدا دارد)
- فونت Vazirmatn از Google Fonts بارگذاری می‌شود (در production باید self-host شود)

## اندازه باندل

- **JS:** 594.71 kB (minified) → **182.24 kB** (gzip)
- **CSS:** 25.71 kB (minified) → **5.71 kB** (gzip)
- **Build time:** ~6 ثانیه
- هدف: Player bundle < 500 KB gzip ✅ (182 kB)
- هدف: Build < 10s ✅ (6s)

## تکنولوژی‌ها

- React 18 + TypeScript (strict)
- Vite 6
- TailwindCSS 4
- Konva.js + react-konva (canvas)
- Zustand (state management)
- Zod (validation schemas)
- Vazirmatn (فونت فارسی)
