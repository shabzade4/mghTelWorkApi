-- ============================================================
-- سیستم جامع مدیریت هوشمند — نسخه ۳.۴.۰
-- اسکریپت کامل ساخت دیتابیس برای Supabase (PostgreSQL)
-- اجرا در: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- user_profile
CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user text DEFAULT 'admin',
  admin_pass text,
  name text DEFAULT 'مدیر سیستم',
  job_title text,
  bio text,
  experience text,
  skills text,
  resume text,
  avatar_url text,
  theme text DEFAULT 'slate',
  font_family text DEFAULT 'font-vazir',
  font_size text DEFAULT 'size-small',
  recovery_email text,
  recovery_mobile text,
  created_at timestamptz DEFAULT now()
);

-- app_users (multi-user)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  role text DEFAULT 'user',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text,
  category text,
  amount numeric,
  account text,
  date text,
  time text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- loans
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text,
  loan_type text,
  bank text,
  total_amount numeric,
  bank_fee numeric DEFAULT 0,
  net_received numeric,
  monthly_payment numeric,
  total_installments int,
  paid_installments int DEFAULT 0,
  remaining_amount numeric,
  interest_rate numeric,
  calc_method text,
  total_interest numeric,
  total_repay numeric,
  due_day text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- loan_payments
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  installment_no int,
  amount numeric,
  paid_at text,
  note text,
  created_at timestamptz DEFAULT now()
);

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phones text,
  mobile text,
  phone2 text,
  work_phone text,
  home_phone text,
  email text,
  address text,
  category text,
  birthday text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'متوسط',
  status text DEFAULT 'باز',
  is_completed boolean DEFAULT false,
  due_date text,
  due_time text,
  reminder_minutes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- notes
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text,
  content text,
  category text,
  color text DEFAULT 'blue',
  type text DEFAULT 'عادی',
  password text,
  created_at timestamptz DEFAULT now()
);

-- activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action text,
  details text,
  meta text,
  created_at timestamptz DEFAULT now()
);

-- calendar_events
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

-- RLS open policies (client app with anon key)
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_user_profile" ON user_profile FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_loans" ON loans FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_loan_payments" ON loan_payments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_notes" ON notes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_calendar_events" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- recovery columns (safe if already exist)
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS recovery_email text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS recovery_mobile text;
