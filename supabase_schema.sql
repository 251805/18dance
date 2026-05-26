-- ====================================================================
-- Theory11 PCC DTR System - Supabase Production Database Schema
-- Paste this entire file into your Supabase SQL Editor (https://supabase.com)
-- to automatically provision the table objects, indices, and RLS policies.
-- ====================================================================

-- Drop existing tables if re-running script to prevent conflicts
DROP TABLE IF EXISTS public.attendance_sessions CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.attendance_logs CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- 1) Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id SERIAL PRIMARY KEY,
    eid VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    full_name VARCHAR(255),
    rate_per_day NUMERIC(12, 2) DEFAULT 0.00,
    philhealth NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching employees by EID
CREATE INDEX IF NOT EXISTS employees_eid_idx ON public.employees(eid);

-- 2) Create attendance_logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id SERIAL PRIMARY KEY,
    eid VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    date DATE,
    remarks TEXT,
    tardiness INTEGER DEFAULT 0,
    undertime INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast report queries indices
CREATE INDEX IF NOT EXISTS attendance_logs_eid_idx ON public.attendance_logs(eid);
CREATE INDEX IF NOT EXISTS attendance_logs_date_idx ON public.attendance_logs(date);
CREATE INDEX IF NOT EXISTS attendance_logs_eid_date_idx ON public.attendance_logs(eid, date);

-- 3) Enable Row Level Security (RLS) for privacy & audit compliance
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies: Allowing anonymous/authenticated users to browse and log timesheets
-- You can tighten these policies later inside the Supabase Auth system if needed.

-- Employees access policies
CREATE POLICY "Allow read access to employees for anyone" 
    ON public.employees FOR SELECT 
    USING (true);

CREATE POLICY "Allow insert/write access to employees for anyone" 
    ON public.employees FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow update access to employees for anyone" 
    ON public.employees FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow delete access to employees for anyone" 
    ON public.employees FOR DELETE 
    USING (true);

-- Attendance logs access policies
CREATE POLICY "Allow read access to logs for anyone" 
    ON public.attendance_logs FOR SELECT 
    USING (true);

CREATE POLICY "Allow insert access to logs for anyone" 
    ON public.attendance_logs FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow update access to logs for anyone" 
    ON public.attendance_logs FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow delete access to logs for anyone" 
    ON public.attendance_logs FOR DELETE 
    USING (true);

-- ====================================================================
-- 5) Create attendance table and sessions table for Universal QR matching
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'LOGIN' or 'LOGOUT'
    source VARCHAR(50) DEFAULT 'SCAN',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    login_at TIMESTAMPTZ NOT NULL,
    logout_at TIMESTAMPTZ, -- null when shift is active/open
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for these new tables
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for attendance
CREATE POLICY "Allow read access to attendance for anyone" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow insert access to attendance for anyone" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to attendance for anyone" ON public.attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to attendance for anyone" ON public.attendance FOR DELETE USING (true);

-- Policies for sessions
CREATE POLICY "Allow read access to sessions for anyone" ON public.attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Allow insert access to sessions for anyone" ON public.attendance_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to sessions for anyone" ON public.attendance_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to sessions for anyone" ON public.attendance_sessions FOR DELETE USING (true);

-- ====================================================================
-- 6) Seed Default Employees
-- ====================================================================
INSERT INTO public.employees (eid, name, full_name, rate_per_day, philhealth) VALUES
('251805', 'LEE LUZADAS', 'LEE LUZADAS', 1500.00, 250.00),
('1', 'GIDDEL MACALIPAY', 'GIDDEL MACALIPAY', 850.00, 120.00),
('2', 'MARVIN RIVERO', 'MARVIN RIVERO', 850.00, 120.00),
('3', 'LEANDRO VALIDO', 'LEANDRO VALIDO', 850.00, 120.00),
('4', 'GERSON MENDOZA', 'GERSON MENDOZA', 850.00, 120.00),
('5', 'MARK ANCEL GUTIERREZ', 'MARK ANCEL GUTIERREZ', 900.00, 150.00),
('6', 'JAGER MIK AGUILA', 'JAGER MIK AGUILA', 850.00, 120.00),
('7', 'CARL ANDRE NOCUM', 'CARL ANDRE NOCUM', 850.00, 120.00),
('8', 'JACK KIRBY UY', 'JACK KIRBY UY', 850.00, 120.00),
('9', 'JERSON AMBAL', 'JERSON AMBAL', 850.00, 120.00),
('10', 'ANGELO ALBAÑO', 'ANGELO ALBAÑO', 850.00, 120.00),
('11', 'GLENIEL PIONILLA', 'GLENIEL PIONILLA', 850.00, 120.00),
('12', 'JHON JOVERICK SOGOCIO', 'JHON JOVERICK SOGOCIO', 850.00, 120.00),
('13', 'JULIE ANN ALVAREZ', 'JULIE ANN ALVAREZ', 850.00, 120.00),
('14', 'JERONCIUS LABIAL', 'JERONCIUS LABIAL', 850.00, 120.00),
('15', 'ANGELO MARTINEZ', 'ANGELO MARTINEZ', 850.00, 120.00),
('16', 'KENT SIMOUNE PIÑOL', 'KENT SIMOUNE PIÑOL', 850.00, 120.00),
('17', 'MARY GRACE DIMATULAC', 'MARY GRACE DIMATULAC', 850.00, 120.00),
('18', 'JONH WILFRED ZARSUELO', 'JONH WILFRED ZARSUELO', 850.00, 120.00),
('19', 'MARK JOHNCELL REGIO', 'MARK JOHNCELL REGIO', 850.00, 120.00),
('20', 'JOHN PAUL PORTE', 'JOHN PAUL PORTE', 850.00, 120.00)
ON CONFLICT (eid) DO UPDATE SET 
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    rate_per_day = EXCLUDED.rate_per_day,
    philhealth = EXCLUDED.philhealth;

