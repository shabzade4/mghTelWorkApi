# سیستم جامع مدیریت هوشمند (mghTelWorkApi)

نسخه **۳.۷** — برنامه تحت‌وب (PWA) برای مدیریت مالی، وام، مخاطبین، کارها، یادداشت‌ها، تقویم شمسی و گزارشات.

**ریپو:** https://github.com/shabzade4/mghTelWorkApi

## فایل‌های موجود در ریپو

| فایل | توضیح |
|------|--------|
| `index.html` | برنامه اصلی (باید نسخه کامل را آپلود کنید) |
| `manifest.json` | تنظیمات PWA |
| `sw.js` | Service Worker آفلاین |
| `schema.sql` | ساخت جداول Supabase |
| `vercel.json` | پیکربندی Vercel |

## مهم: آپلود `index.html` کامل

به‌خاطر حجم فایل اصلی (~340KB)، اگر در ریشه فقط صفحه راهنما را می‌بینید:

1. فایل کامل `index.html` را از خروجی چت دانلود کنید
2. در GitHub: **Add file → Upload files**
3. روی `index.html` قبلی بکشید و **Commit** کنید

## استقرار روی Vercel

1. [vercel.com](https://vercel.com) → **Add New Project**
2. ریپوی `mghTelWorkApi` را Import کنید
3. Framework: Other · Deploy

## دیتابیس Supabase

1. پروژه در [supabase.com](https://supabase.com)
2. SQL Editor → اجرای کامل `schema.sql`
3. در اولین ورود به برنامه، URL و کلید `anon` را وارد کنید

## ورود پیش‌فرض

- کاربر: `admin`
- رمز: `admin`

سپس در تنظیمات: ایمیل/موبایل بازیابی را ذخیره و رمز را عوض کنید.

## امکانات

- مالی و وام ایران · مخاطبین (تماس/پیامک/ایمیل) · کارها · یادداشت · تقویم شمسی
- گزارش PDF/اکسل · تم و فونت فارسی · تومان/ریال
- ورود امن · رمزنگاری AES · بازیابی رمز · بکاپ JSON
