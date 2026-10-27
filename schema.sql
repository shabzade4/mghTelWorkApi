-- ============================================================
-- سیستم جامع مدیریت هوشمند — نسخه ۳.۴.۰
-- اسکریپت کامل ساخت دیتابیس برای Supabase (PostgreSQL)
-- اجرا در: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- اکستنشن‌ها
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------- پروفایل / تنظیمات --------------------
CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT 'مدیر سیستم',
  admin_user text DEFAULT 'admin',
  admin_pass text,
  avatar_url text,
  theme text DEFAULT 'slate',
  font_family text DEFAULT 'font-vazir',
  font_size text DEFAULT 'size-small',
  job_title text,
  bio text,
  experience text,
  skills text,
  resume text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- -------------------- کاربران --------------------
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- -------------------- تراکنش‌های مالی --------------------
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  account text,
  date text,
  time text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- وام‌ها --------------------
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  loan_type text,
  bank text,
  total_amount numeric NOT NULL DEFAULT 0,
  bank_fee numeric DEFAULT 0,
  net_received numeric DEFAULT 0,
  monthly_payment numeric DEFAULT 0,
  total_installments int DEFAULT 0,
  paid_installments int DEFAULT 0,
  remaining_amount numeric DEFAULT 0,
  interest_rate numeric DEFAULT 0,
  calc_method text DEFAULT 'amortization',
  total_interest numeric DEFAULT 0,
  total_repay numeric DEFAULT 0,
  due_day text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- پرداخت اقساط وام --------------------
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  installment_no int,
  amount numeric NOT NULL DEFAULT 0,
  paid_at text,
  note text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- مخاطبین --------------------
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phones text,
  mobile text,
  phone2 text,
  work_phone text,
  home_phone text,
  email text,
  address text,
  category text DEFAULT 'دوستان',
  notes text,
  birthday text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- کارها --------------------
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'متوسط',
  status text DEFAULT 'باز',
  due_date text,
  due_time text,
  reminder_minutes int DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- -------------------- یادداشت‌ها --------------------
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  category text DEFAULT 'عمومی',
  color text DEFAULT 'blue',
  type text DEFAULT 'عادی',
  password text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- لاگ فعالیت --------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text,
  details text,
  meta text,
  created_at timestamptz DEFAULT now()
);

-- -------------------- ایندکس‌ها --------------------
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);

-- -------------------- RLS (اختیاری — برای استفاده تک‌کاربره با anon key باز) --------------------
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- سیاست‌های باز برای anon (اپلیکیشن کلاینت‌ساید فعلی)
DO $$
BEGIN
  -- حذف سیاست‌های قبلی اگر وجود داشته باشند و ساخت مجدد
  BEGIN
    DROP POLICY IF EXISTS "allow_all_user_profile" ON user_profile;
    DROP POLICY IF EXISTS "allow_all_app_users" ON app_users;
    DROP POLICY IF EXISTS "allow_all_transactions" ON transactions;
    DROP POLICY IF EXISTS "allow_all_loans" ON loans;
    DROP POLICY IF EXISTS "allow_all_loan_payments" ON loan_payments;
    DROP POLICY IF EXISTS "allow_all_contacts" ON contacts;
    DROP POLICY IF EXISTS "allow_all_tasks" ON tasks;
    DROP POLICY IF EXISTS "allow_all_notes" ON notes;
    DROP POLICY IF EXISTS "allow_all_logs" ON activity_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "allow_all_user_profile" ON user_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_loans" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_loan_payments" ON loan_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notes" ON notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- -------------------- داده اولیه ادمین --------------------
-- رمز: admin  → SHA-256
INSERT INTO user_profile (name, admin_user, admin_pass, theme, font_family, font_size)
SELECT 'مدیر سیستم', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'slate', 'font-vazir', 'size-small'
WHERE NOT EXISTS (SELECT 1 FROM user_profile LIMIT 1);

INSERT INTO app_users (username, password_hash, display_name, role, is_active)
SELECT 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'مدیر سیستم', 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');

-- پایان
SELECT 'Schema OK — tables ready' AS status;

-- تقویم رویدادها (نسخه ۳.۶)
CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  title text NOT NULL,
  event_date text,
  event_time text,
  description text,
  color text DEFAULT 'blue',
  remind boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_calendar_events" ON calendar_events;
CREATE POLICY "allow_all_calendar_events" ON calendar_events FOR ALL USING (true) WITH CHECK (true);


-- بازیابی حساب و رمزنگاری (v3.7)
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS recovery_email text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS recovery_mobile text;


-- پیوست‌ها (فایل/تصویر) برای مخاطب، کار و یادداشت
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attachments text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments text;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS attachments text;
