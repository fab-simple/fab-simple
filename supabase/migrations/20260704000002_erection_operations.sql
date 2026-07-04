-- Migration: Erection Operations
-- Adds Crane/Rigging fields, OSHA Subpart R Safety Gates, Site Readiness,
-- Weather/Delay Logs, Field RCSC Bolt-Up Inspections, Crew Tracking, Punch Lists, and Audit Logs.

-- 1. Extend erection_sequence table with Crane/Rigging and OSHA Safety Gate columns
ALTER TABLE public.erection_sequence
  ADD COLUMN IF NOT EXISTS crane_assigned VARCHAR(128),
  ADD COLUMN IF NOT EXISTS capacity_at_radius NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pick_type VARCHAR(32) DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS ground_bearing_req VARCHAR(255),
  ADD COLUMN IF NOT EXISTS critical_lift BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS critical_lift_plan_file_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concrete_cure_certified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS concrete_cure_cert_file_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS perimeter_cables_installed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS multiple_lift_rigging_doc_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_readiness_cleared BOOLEAN DEFAULT true;

-- 2. Create crews table
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  foreman_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_equipment VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crews_company_id ON public.crews(company_id);

-- 3. Create erection_delays table
CREATE TABLE IF NOT EXISTS public.erection_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL DEFAULT 'weather',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  zone_affected VARCHAR(128),
  steps_affected JSONB,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erection_delays_project ON public.erection_delays(project_id);

-- 4. Create field_bolt_inspections table (RCSC Field Bolt-up Signoff)
CREATE TABLE IF NOT EXISTS public.field_bolt_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
  part_mark VARCHAR(64) NOT NULL,
  inspection_method VARCHAR(64) NOT NULL DEFAULT 'turn_of_nut',
  result VARCHAR(32) NOT NULL DEFAULT 'pass',
  inspector_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_bolt_inspections_part ON public.field_bolt_inspections(part_id);

-- 5. Create punch_list_items table
CREATE TABLE IF NOT EXISTS public.punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  grid_location VARCHAR(128),
  piece_mark VARCHAR(64),
  responsible_party VARCHAR(128) DEFAULT 'Erector',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  photo_attachment_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_punch_list_project ON public.punch_list_items(project_id);

-- 6. Create erection_audit_logs table for Safety Gate Overrides & Sequence Replanning
CREATE TABLE IF NOT EXISTS public.erection_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.erection_sequence(id) ON DELETE CASCADE,
  action VARCHAR(128) NOT NULL,
  override_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erection_audit_step ON public.erection_audit_logs(step_id);
