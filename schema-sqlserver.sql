-- ============================================================
-- سیستم جامع مدیریت هوشمند — اسکیمای Microsoft SQL Server
-- نسخه 3.9
-- اجرا در SSMS یا sqlcmd روی سرور لوکال
-- ============================================================

IF DB_ID(N'MGH_App') IS NULL
BEGIN
  CREATE DATABASE MGH_App;
END
GO

USE MGH_App;
GO

-- user_profile
IF OBJECT_ID(N'dbo.user_profile', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_profile (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    admin_user NVARCHAR(100) NULL N'admin',
    admin_pass NVARCHAR(128) NULL,
    name NVARCHAR(200) NULL N'مدیر سیستم',
    job_title NVARCHAR(200) NULL,
    bio NVARCHAR(MAX) NULL,
    experience NVARCHAR(MAX) NULL,
    skills NVARCHAR(MAX) NULL,
    resume NVARCHAR(MAX) NULL,
    avatar_url NVARCHAR(MAX) NULL,
    theme NVARCHAR(50) NULL N'slate',
    font_family NVARCHAR(50) NULL N'font-vazir',
    font_size NVARCHAR(50) NULL N'size-small',
    recovery_email NVARCHAR(200) NULL,
    recovery_mobile NVARCHAR(30) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.app_users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_users (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    username NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(128) NOT NULL,
    display_name NVARCHAR(200) NULL,
    role NVARCHAR(50) NULL N'user',
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.transactions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.transactions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    type NVARCHAR(50) NULL,
    category NVARCHAR(100) NULL,
    amount DECIMAL(18,2) NULL,
    account NVARCHAR(100) NULL,
    date NVARCHAR(20) NULL,
    time NVARCHAR(20) NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.loans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.loans (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(200) NULL,
    loan_type NVARCHAR(100) NULL,
    bank NVARCHAR(200) NULL,
    total_amount DECIMAL(18,2) NULL,
    bank_fee DECIMAL(18,2) NULL 0,
    net_received DECIMAL(18,2) NULL,
    monthly_payment DECIMAL(18,2) NULL,
    total_installments INT NULL,
    paid_installments INT NULL 0,
    remaining_amount DECIMAL(18,2) NULL,
    interest_rate DECIMAL(9,4) NULL,
    calc_method NVARCHAR(50) NULL,
    total_interest DECIMAL(18,2) NULL,
    total_repay DECIMAL(18,2) NULL,
    due_day NVARCHAR(20) NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.loan_payments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.loan_payments (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    loan_id UNIQUEIDENTIFIER NULL,
    installment_no INT NULL,
    amount DECIMAL(18,2) NULL,
    paid_at NVARCHAR(30) NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.contacts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.contacts (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    phones NVARCHAR(100) NULL,
    mobile NVARCHAR(50) NULL,
    phone2 NVARCHAR(50) NULL,
    work_phone NVARCHAR(50) NULL,
    home_phone NVARCHAR(50) NULL,
    email NVARCHAR(200) NULL,
    address NVARCHAR(500) NULL,
    category NVARCHAR(100) NULL,
    birthday NVARCHAR(20) NULL,
    notes NVARCHAR(MAX) NULL,
    attachments NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.tasks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tasks (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(300) NOT NULL,
    description NVARCHAR(MAX) NULL,
    priority NVARCHAR(50) NULL N'متوسط',
    status NVARCHAR(50) NULL N'باز',
    is_completed BIT NOT NULL DEFAULT 0,
    due_date NVARCHAR(20) NULL,
    due_time NVARCHAR(20) NULL,
    reminder_minutes INT NULL 0,
    attachments NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.notes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.notes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(300) NULL,
    content NVARCHAR(MAX) NULL,
    category NVARCHAR(100) NULL,
    color NVARCHAR(50) NULL N'blue',
    type NVARCHAR(50) NULL N'عادی',
    password NVARCHAR(200) NULL,
    attachments NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.activity_logs (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    action NVARCHAR(200) NULL,
    details NVARCHAR(MAX) NULL,
    meta NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'dbo.calendar_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.calendar_events (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    title NVARCHAR(300) NOT NULL,
    event_date NVARCHAR(20) NULL,
    event_time NVARCHAR(20) NULL,
    description NVARCHAR(MAX) NULL,
    color NVARCHAR(50) NULL N'blue',
    remind BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

PRINT N'schema SQL Server آماده است.';
GO
