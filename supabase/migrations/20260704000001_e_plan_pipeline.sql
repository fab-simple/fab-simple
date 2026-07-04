-- Migration: E-Plan Pipeline
-- Adds support for Erection Plans (GA drawings), sheet/zone level tracking,
-- erection sequence pointers, print log audit for outdated print warnings, and user language preferences.

-- 1. Create e_plan_sheets table
CREATE TABLE IF NOT EXISTS public.e_plan_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  sheet_number VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  zone VARCHAR(128),
  grid_bounds JSONB,
  file_attachment_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e_plan_sheets_drawing_id ON public.e_plan_sheets(drawing_id);
CREATE INDEX IF NOT EXISTS idx_e_plan_sheets_company_id ON public.e_plan_sheets(company_id);

-- 2. Add pointer columns to erection_sequence
ALTER TABLE public.erection_sequence
  ADD COLUMN IF NOT EXISTS e_plan_sheet_id UUID REFERENCES public.e_plan_sheets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grid_location VARCHAR(128),
  ADD COLUMN IF NOT EXISTS x_ratio NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS y_ratio NUMERIC(5,2);

-- 3. Create print_logs table for enforced freshness tracking & outdated print warnings
CREATE TABLE IF NOT EXISTS public.print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(64) NOT NULL DEFAULT 'parts',
  entity_id UUID NOT NULL,
  drawing_id UUID REFERENCES public.drawings(id) ON DELETE SET NULL,
  e_plan_sheet_id UUID REFERENCES public.e_plan_sheets(id) ON DELETE SET NULL,
  printed_revision VARCHAR(32) NOT NULL,
  ifc_status VARCHAR(64) NOT NULL,
  printed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_logs_entity ON public.print_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_company ON public.print_logs(company_id);

-- 4. Add language preference column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';
