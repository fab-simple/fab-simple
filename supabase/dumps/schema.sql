


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."adjustment_type" AS ENUM (
    'received',
    'consumed',
    'manual',
    'damaged'
);


ALTER TYPE "public"."adjustment_type" OWNER TO "postgres";


CREATE TYPE "public"."ai_insight_type" AS ENUM (
    'bottleneck',
    'reorder',
    'schedule',
    'cost',
    'qc'
);


ALTER TYPE "public"."ai_insight_type" OWNER TO "postgres";


CREATE TYPE "public"."ai_message_role" AS ENUM (
    'user',
    'assistant',
    'system'
);


ALTER TYPE "public"."ai_message_role" OWNER TO "postgres";


CREATE TYPE "public"."aisc_status" AS ENUM (
    'open',
    'done',
    'hold',
    'na'
);


ALTER TYPE "public"."aisc_status" OWNER TO "postgres";


CREATE TYPE "public"."billing_status" AS ENUM (
    'draft',
    'submitted',
    'certified',
    'paid'
);


ALTER TYPE "public"."billing_status" OWNER TO "postgres";


CREATE TYPE "public"."co_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."co_status" OWNER TO "postgres";


CREATE TYPE "public"."drawing_status" AS ENUM (
    'in_progress',
    'submitted',
    'approved',
    'released',
    'superseded'
);


ALTER TYPE "public"."drawing_status" OWNER TO "postgres";


CREATE TYPE "public"."drawing_type" AS ENUM (
    'shop',
    'erection',
    'connection'
);


ALTER TYPE "public"."drawing_type" OWNER TO "postgres";


CREATE TYPE "public"."estimate_status" AS ENUM (
    'draft',
    'submitted',
    'won',
    'lost'
);


ALTER TYPE "public"."estimate_status" OWNER TO "postgres";


CREATE TYPE "public"."inspection_result" AS ENUM (
    'pass',
    'fail',
    'hold',
    'pending'
);


ALTER TYPE "public"."inspection_result" OWNER TO "postgres";


CREATE TYPE "public"."inventory_status" AS ENUM (
    'ok',
    'low',
    'out'
);


ALTER TYPE "public"."inventory_status" OWNER TO "postgres";


CREATE TYPE "public"."mtr_status" AS ENUM (
    'pending',
    'received',
    'verified'
);


ALTER TYPE "public"."mtr_status" OWNER TO "postgres";


CREATE TYPE "public"."ncr_status" AS ENUM (
    'open',
    'in_progress',
    're_inspected',
    'closed'
);


ALTER TYPE "public"."ncr_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'cert_expiry',
    'inventory_low',
    'qc_failure',
    'ncr_created',
    'co_approved',
    'info'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."part_status" AS ENUM (
    'not_started',
    'in_progress',
    'complete',
    'shipped',
    'on_hold'
);


ALTER TYPE "public"."part_status" OWNER TO "postgres";


CREATE TYPE "public"."plan_tier" AS ENUM (
    'starter',
    'professional',
    'enterprise'
);


ALTER TYPE "public"."plan_tier" OWNER TO "postgres";


CREATE TYPE "public"."po_status" AS ENUM (
    'draft',
    'issued',
    'partial',
    'received',
    'closed'
);


ALTER TYPE "public"."po_status" OWNER TO "postgres";


CREATE TYPE "public"."project_status" AS ENUM (
    'active',
    'on_hold',
    'completed',
    'archived'
);


ALTER TYPE "public"."project_status" OWNER TO "postgres";


CREATE TYPE "public"."rfi_status" AS ENUM (
    'open',
    'answered',
    'closed'
);


ALTER TYPE "public"."rfi_status" OWNER TO "postgres";


CREATE TYPE "public"."shipping_status" AS ENUM (
    'pending',
    'loaded',
    'in_transit',
    'delivered'
);


ALTER TYPE "public"."shipping_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'pm',
    'estimator',
    'foreman',
    'qc',
    'accounting',
    'worker'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_assembly_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_assembly_id uuid;
begin
  select id into v_assembly_id from assemblies
  where company_id = NEW.company_id
    and project_id = NEW.project_id
    and assembly_mark = NEW.assembly_mark;
  if v_assembly_id is null then return NEW; end if;

  update assemblies set
    total_parts = (select count(*) from parts
                   where company_id = NEW.company_id and assembly_mark = NEW.assembly_mark),
    completed_parts = (select count(*) from parts
                       where company_id = NEW.company_id and assembly_mark = NEW.assembly_mark
                         and status in ('complete','shipped'))
  where id = v_assembly_id;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_assembly_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auto_ncr_on_inspection_fail"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ncr_number text;
  v_actor uuid;
  v_user_name text;
  v_inspection_type text;
  v_ref_label text;
begin
  if NEW.result <> 'fail' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.result = 'fail' then
    return NEW;  -- already failed; don't double-create
  end if;

  v_ncr_number := next_sequence_number(NEW.company_id, 'ncr_reports', 'NCR', 4);
  v_actor := coalesce(NEW.inspector_id, get_user_internal_id());

  if TG_TABLE_NAME = 'paint_inspections' then
    v_inspection_type := 'paint';
    v_ref_label := coalesce(NEW.insp_number, NEW.id::text);
  else
    v_inspection_type := 'weld';
    v_ref_label := coalesce(NEW.weld_number, NEW.id::text);
  end if;

  insert into ncr_reports(
    company_id, project_id, part_id, ncr_number,
    source_inspection_id, source_inspection_type,
    description, status, blocks_shipping, assigned_to, created_by
  ) values (
    NEW.company_id, NEW.project_id, NEW.part_id, v_ncr_number,
    NEW.id, v_inspection_type,
    'Auto-generated from failed ' || v_inspection_type || ' inspection ' || v_ref_label,
    'open', true, v_actor, v_actor
  );

  select full_name into v_user_name from users where id = v_actor;
  insert into activity_feed(company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata)
  values (NEW.company_id, v_actor, coalesce(v_user_name, 'System'),
          'created NCR from failed inspection', 'ncr_reports', NEW.id,
          v_ncr_number, jsonb_build_object('inspection_type', v_inspection_type));

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_auto_ncr_on_inspection_fail"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_billing_pct_monotonic"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_prev numeric;
begin
  select max(pct_complete) into v_prev
  from billing_applications
  where project_id = NEW.project_id
    and application_number < NEW.application_number;
  if v_prev is not null and NEW.pct_complete < v_prev then
    raise exception 'pct_complete (%) cannot be less than previous application (%)', NEW.pct_complete, v_prev;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_billing_pct_monotonic"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_drawing_supersede"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.current_revision then
    update drawings
      set current_revision = false, status = 'superseded'
      where company_id = NEW.company_id
        and project_id = NEW.project_id
        and drawing_number = NEW.drawing_number
        and id <> NEW.id;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_drawing_supersede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_heat_parts_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.heat_number is null then return NEW; end if;
  update heat_numbers
    set parts_count = (
      select count(*) from parts
      where company_id = NEW.company_id and heat_number = NEW.heat_number
    )
    where company_id = NEW.company_id and heat_number = NEW.heat_number;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_heat_parts_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_co_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    perform fn_notify_roles(
      new.company_id,
      array['pm','estimator','accounting','owner'],
      'co_approved'::notification_type,
      'CO approved: ' || new.co_number,
      'Amount $' || coalesce(new.amount, 0)::text,
      'change_orders', new.id,
      '/dashboard/change-orders'
    );
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."fn_notify_co_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_inspection_failed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  label text;
begin
  if new.result <> 'fail' then return new; end if;
  if tg_table_name = 'paint_inspections' then label := new.insp_number;
  else label := new.weld_number;
  end if;

  perform fn_notify_roles(
    new.company_id,
    array['qc','pm'],
    'qc_failure'::notification_type,
    'Inspection failed: ' || label,
    'Auto-NCR will be opened',
    tg_table_name, new.id,
    '/dashboard/' || replace(tg_table_name, '_', '-')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notify_inspection_failed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_inventory_low"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.reorder_point is not null
     and new.quantity <= new.reorder_point
     and (tg_op = 'INSERT' or (old.quantity is null or old.quantity > new.reorder_point))
  then
    perform fn_notify_roles(
      new.company_id,
      array['foreman','pm','owner'],
      'inventory_low'::notification_type,
      'Low stock: ' || new.profile,
      'Quantity ' || new.quantity || ' (reorder at ' || new.reorder_point || ')',
      'inventory', new.id,
      '/dashboard/inventory'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notify_inventory_low"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_ncr_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform fn_notify_roles(
    new.company_id,
    array['qc','pm','owner'],
    'ncr_created'::notification_type,
    'New NCR: ' || new.ncr_number,
    coalesce(new.description, 'Non-conformance report opened'),
    'ncr_reports', new.id,
    '/dashboard/paint-inspection'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notify_ncr_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_po_received"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'received' and (old.status is null or old.status <> 'received') then
    perform fn_notify_roles(
      new.company_id,
      array['foreman','pm','owner'],
      'info'::notification_type,
      'PO received: ' || new.po_number,
      'Material from ' || coalesce(new.vendor_name, 'vendor') || ' arrived',
      'purchase_orders', new.id,
      '/dashboard/receiving'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notify_po_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_rfi_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform fn_notify_roles(
    new.company_id,
    array['pm','owner','estimator'],
    'info'::notification_type,
    'New RFI: ' || new.rfi_number,
    coalesce(new.question, 'Request for information'),
    'rfis', new.id,
    '/dashboard/rfis'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_notify_rfi_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_roles"("p_company_id" "uuid", "p_roles" "text"[], "p_type" "public"."notification_type", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into notifications (company_id, user_id, type, title, message, entity_type, entity_id, entity_link)
  select p_company_id, u.id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_link
  from users u
  where u.company_id = p_company_id
    and u.is_active = true
    and u.role::text = any(p_roles);
end;
$$;


ALTER FUNCTION "public"."fn_notify_roles"("p_company_id" "uuid", "p_roles" "text"[], "p_type" "public"."notification_type", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_paint_auto_result"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.required_min > 0 then
    if NEW.total_dft >= NEW.required_min then
      NEW.result := 'pass';
    else
      NEW.result := 'fail';
    end if;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_paint_auto_result"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recompute_job_cost"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update job_costs jc set actual_amount = coalesce(t.actual, 0)
  from (
    select project_id, 'material' as cost_code, sum(total_amount) as actual
    from purchase_orders
    where project_id = p_project_id and status in ('received','partial','closed')
    group by project_id
  ) t
  where jc.project_id = t.project_id and jc.cost_code = t.cost_code;
end;
$$;


ALTER FUNCTION "public"."fn_recompute_job_cost"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select company_id from public.users where auth_id = auth.uid() limit 1;
$$;


ALTER FUNCTION "public"."get_user_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_internal_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;


ALTER FUNCTION "public"."get_user_internal_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.users where auth_id = auth.uid() limit 1;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_sequence_number"("p_company_id" "uuid", "p_table_name" "text", "p_prefix" "text", "p_width" integer DEFAULT 4) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_next bigint;
  v_width int := coalesce(p_width, 4);
begin
  insert into sequence_counters(company_id, table_name, prefix, current_value, width)
  values (p_company_id, p_table_name, p_prefix, 1, v_width)
  on conflict (company_id, table_name, prefix)
    do update set
      current_value = sequence_counters.current_value + 1,
      updated_at = now()
  returning current_value into v_next;
  return p_prefix || '-' || lpad(v_next::text, v_width, '0');
end;
$$;


ALTER FUNCTION "public"."next_sequence_number"("p_company_id" "uuid", "p_table_name" "text", "p_prefix" "text", "p_width" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS TABLE("over_limit" boolean, "used" integer, "reset_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_window_start timestamptz;
  v_used         int;
begin
  v_window_start := now() - make_interval(secs => p_window_seconds);

  -- Reset stale bucket atomically
  insert into rate_limit_buckets (id, count, window_start, updated_at)
  values (p_key, 1, now(), now())
  on conflict (id) do update
  set count = case
                when rate_limit_buckets.window_start < v_window_start then 1
                else rate_limit_buckets.count + 1
              end,
      window_start = case
                       when rate_limit_buckets.window_start < v_window_start then now()
                       else rate_limit_buckets.window_start
                     end,
      updated_at = now()
  returning rate_limit_buckets.count, rate_limit_buckets.window_start
  into v_used, v_window_start;

  over_limit := v_used > p_max;
  used := v_used;
  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  return next;
end
$$;


ALTER FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_feed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_name" "text",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "entity_label" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."activity_feed" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "public"."ai_message_role" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ai_chat_history" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "insight_type" "public"."ai_insight_type" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "suggested_action" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "is_resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ai_insights" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aisc_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "section_ref" "text" NOT NULL,
    "item_text" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "public"."aisc_status" DEFAULT 'open'::"public"."aisc_status" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "cleared_at" timestamp with time zone,
    "cleared_by" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."aisc_checklist" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."aisc_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assemblies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "assembly_mark" "text" NOT NULL,
    "description" "text",
    "total_weight" numeric(10,2),
    "total_parts" integer DEFAULT 0 NOT NULL,
    "completed_parts" integer DEFAULT 0 NOT NULL,
    "status" "public"."part_status" DEFAULT 'not_started'::"public"."part_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."assemblies" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."assemblies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "application_number" integer NOT NULL,
    "period_to" "date" NOT NULL,
    "original_contract" numeric(14,2) DEFAULT 0 NOT NULL,
    "change_orders_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "completed_to_date" numeric(14,2) DEFAULT 0 NOT NULL,
    "materials_stored" numeric(14,2) DEFAULT 0 NOT NULL,
    "retainage_percent" numeric(5,2) DEFAULT 10 NOT NULL,
    "retainage_withheld" numeric(14,2) DEFAULT 0 NOT NULL,
    "previous_billed" numeric(14,2) DEFAULT 0 NOT NULL,
    "amount_due" numeric(14,2) DEFAULT 0 NOT NULL,
    "pct_complete" numeric(5,2) DEFAULT 0 NOT NULL,
    "status" "public"."billing_status" DEFAULT 'draft'::"public"."billing_status" NOT NULL,
    "pdf_url" "text",
    "notes" "text",
    "submitted_at" timestamp with time zone,
    "certified_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."billing_applications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cert_type" "text" NOT NULL,
    "holder_name" "text" NOT NULL,
    "cert_number" "text",
    "issue_date" "date",
    "expiry_date" "date" NOT NULL,
    "alert_days" integer DEFAULT 30 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."certifications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "co_number" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" "public"."co_status" DEFAULT 'pending'::"public"."co_status" NOT NULL,
    "drawing_rev" "text",
    "submitted_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."change_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."change_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "aisc_cert" boolean DEFAULT false NOT NULL,
    "plan" "public"."plan_tier" DEFAULT 'starter'::"public"."plan_tier" NOT NULL,
    "max_parts" integer DEFAULT 5000 NOT NULL,
    "max_projects" integer DEFAULT 10 NOT NULL,
    "max_users" integer DEFAULT 10 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."companies" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cut_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "profile" "text" NOT NULL,
    "stock_length" numeric(10,3) NOT NULL,
    "kerf" numeric(6,3) DEFAULT 0.125 NOT NULL,
    "min_remnant" numeric(10,3) DEFAULT 6 NOT NULL,
    "cuts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "waste_percentage" numeric(5,2),
    "total_bars" integer DEFAULT 0 NOT NULL,
    "total_yield_pct" numeric(5,2),
    "parameters_json" "jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."cut_plans" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."cut_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_production_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "shift" "text",
    "station" "text" NOT NULL,
    "operators" "text"[],
    "parts_completed" integer DEFAULT 0 NOT NULL,
    "hours_worked" numeric(6,2) DEFAULT 0 NOT NULL,
    "operation_type" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."daily_production_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_production_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "part_mark" "text" NOT NULL,
    "assembly_mark" "text",
    "profile" "text" NOT NULL,
    "grade" "text",
    "length" numeric(10,3),
    "weight" numeric(10,2),
    "quantity" integer DEFAULT 1 NOT NULL,
    "status" "public"."part_status" DEFAULT 'not_started'::"public"."part_status" NOT NULL,
    "phase" "text",
    "heat_number" "text",
    "drawing_id" "uuid",
    "assigned_user_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."parts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."parts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "number" "text" NOT NULL,
    "gc_name" "text",
    "gc_contact" "text",
    "gc_phone" "text",
    "contract_value" numeric(14,2),
    "contract_type" "text",
    "est_tonnage" numeric(10,2),
    "status" "public"."project_status" DEFAULT 'active'::"public"."project_status" NOT NULL,
    "pm_id" "uuid",
    "start_date" "date",
    "deadline" "date",
    "description" "text",
    "color" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."projects" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."dashboard_project_progress" AS
 SELECT "p"."id" AS "project_id",
    "p"."company_id",
    "count"("pa"."id") AS "total_parts",
    "count"(*) FILTER (WHERE ("pa"."status" = ANY (ARRAY['complete'::"public"."part_status", 'shipped'::"public"."part_status"]))) AS "completed_parts",
        CASE
            WHEN ("count"("pa"."id") = 0) THEN (0)::numeric
            ELSE "round"(((("count"(*) FILTER (WHERE ("pa"."status" = ANY (ARRAY['complete'::"public"."part_status", 'shipped'::"public"."part_status"]))))::numeric / ("count"("pa"."id"))::numeric) * (100)::numeric))
        END AS "progress_pct"
   FROM ("public"."projects" "p"
     LEFT JOIN "public"."parts" "pa" ON (("pa"."project_id" = "p"."id")))
  GROUP BY "p"."id", "p"."company_id";


ALTER VIEW "public"."dashboard_project_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."dashboard_project_progress" IS 'Per-project parts progress for the dashboard. Reads through RLS on parts/projects.';



CREATE TABLE IF NOT EXISTS "public"."drawings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "drawing_number" "text" NOT NULL,
    "revision" "text" DEFAULT 'A'::"text" NOT NULL,
    "title" "text",
    "type" "public"."drawing_type" DEFAULT 'shop'::"public"."drawing_type" NOT NULL,
    "status" "public"."drawing_status" DEFAULT 'in_progress'::"public"."drawing_status" NOT NULL,
    "current_revision" boolean DEFAULT true NOT NULL,
    "date_issued" "date",
    "approved_by" "uuid",
    "file_url" "text",
    "parts_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."drawings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."drawings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erection_sequence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "sequence_number" integer NOT NULL,
    "part_id" "uuid",
    "description" "text",
    "load_number" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "phase" "text",
    "status" "public"."part_status" DEFAULT 'not_started'::"public"."part_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."erection_sequence" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."erection_sequence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "estimate_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "labor_hours" numeric(10,2),
    "total" numeric(14,2) GENERATED ALWAYS AS (("quantity" * "unit_cost")) STORED,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."estimate_line_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimate_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "estimate_number" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "gc_name" "text",
    "status" "public"."estimate_status" DEFAULT 'draft'::"public"."estimate_status" NOT NULL,
    "total_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "bid_per_lb" numeric(10,4),
    "bid_per_ton" numeric(10,2),
    "structural_tons" numeric(10,2),
    "misc_metal_lbs" numeric(10,2),
    "margin_pct" numeric(5,2),
    "bid_due_date" "date",
    "scenarios" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "submitted_at" timestamp with time zone,
    "won_at" timestamp with time zone,
    "converted_project_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."estimates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."file_attachments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gc_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "gc_company" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "role" "text",
    "email" "text",
    "phone" "text",
    "notes" "text",
    "last_contact" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."gc_contacts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."gc_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."heat_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "heat_number" "text" NOT NULL,
    "material_grade" "text" NOT NULL,
    "mill_name" "text",
    "supplier" "text",
    "mtr_status" "public"."mtr_status" DEFAULT 'pending'::"public"."mtr_status" NOT NULL,
    "mtr_file_url" "text",
    "receipt_number" "text",
    "parts_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."heat_numbers" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."heat_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profile" "text" NOT NULL,
    "grade" "text",
    "length" numeric(10,3),
    "quantity" numeric(10,2) DEFAULT 0 NOT NULL,
    "location" "text",
    "reorder_point" numeric(10,2) DEFAULT 0 NOT NULL,
    "max_stock" numeric(10,2),
    "unit_cost" numeric(10,2),
    "status" "public"."inventory_status" GENERATED ALWAYS AS (
CASE
    WHEN ("quantity" <= (0)::numeric) THEN 'out'::"public"."inventory_status"
    WHEN ("quantity" <= "reorder_point") THEN 'low'::"public"."inventory_status"
    ELSE 'ok'::"public"."inventory_status"
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."inventory" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "adjustment_type" "public"."adjustment_type" NOT NULL,
    "quantity_change" numeric(10,2) NOT NULL,
    "reason" "text",
    "reference_id" "uuid",
    "reference_type" "text",
    "adjusted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."inventory_adjustments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "cost_code" "text" NOT NULL,
    "description" "text",
    "budget_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "actual_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "committed" numeric(14,2) DEFAULT 0 NOT NULL,
    "variance" numeric(14,2) GENERATED ALWAYS AS (("budget_amount" - "actual_amount")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."job_costs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ncr_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "part_id" "uuid",
    "ncr_number" "text" NOT NULL,
    "source_inspection_id" "uuid",
    "source_inspection_type" "text",
    "description" "text" NOT NULL,
    "root_cause" "text",
    "corrective_action" "text",
    "status" "public"."ncr_status" DEFAULT 'open'::"public"."ncr_status" NOT NULL,
    "blocks_shipping" boolean DEFAULT true NOT NULL,
    "assigned_to" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ncr_reports" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ncr_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'info'::"public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "entity_link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."notifications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."osha_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "section_ref" "text" NOT NULL,
    "item_text" "text" NOT NULL,
    "category" "text",
    "status" "public"."aisc_status" DEFAULT 'open'::"public"."aisc_status" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "cleared_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."osha_checklists" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."osha_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paint_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "part_id" "uuid",
    "insp_number" "text" NOT NULL,
    "surface_prep" "text" NOT NULL,
    "primer_dft" numeric(6,1) DEFAULT 0 NOT NULL,
    "topcoat_dft" numeric(6,1) DEFAULT 0 NOT NULL,
    "total_dft" numeric(6,1) GENERATED ALWAYS AS (("primer_dft" + "topcoat_dft")) STORED,
    "required_min" numeric(6,1) DEFAULT 0 NOT NULL,
    "inspector_id" "uuid",
    "inspector_name" "text",
    "result" "public"."inspection_result" DEFAULT 'pending'::"public"."inspection_result" NOT NULL,
    "ambient_temp" numeric(5,1),
    "humidity_pct" numeric(5,1),
    "notes" "text",
    "inspection_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."paint_inspections" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."paint_inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "po_number" "text" NOT NULL,
    "vendor" "text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "qty_ordered" numeric(10,2),
    "qty_received" numeric(10,2) DEFAULT 0 NOT NULL,
    "receiving_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status" "public"."po_status" DEFAULT 'draft'::"public"."po_status" NOT NULL,
    "issued_date" "date",
    "expected_date" "date",
    "received_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."purchase_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" (
    "id" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rfis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "rfi_number" "text" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text",
    "status" "public"."rfi_status" DEFAULT 'open'::"public"."rfi_status" NOT NULL,
    "submitted_by" "uuid",
    "submitted_to" "text",
    "responded_by" "uuid",
    "date_answered" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."rfis" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."rfis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."security_audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sequence_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "current_value" bigint DEFAULT 0 NOT NULL,
    "width" integer DEFAULT 4 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."sequence_counters" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."sequence_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipping_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "ticket_number" "text" NOT NULL,
    "load_number" "text",
    "truck_number" "text",
    "carrier" "text",
    "driver_name" "text",
    "ship_date" "date",
    "destination" "text",
    "parts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_pieces" integer DEFAULT 0 NOT NULL,
    "total_weight" numeric(10,2),
    "bol_url" "text",
    "status" "public"."shipping_status" DEFAULT 'pending'::"public"."shipping_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."shipping_tickets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "plan" "public"."plan_tier" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status" NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "max_users" integer NOT NULL,
    "max_projects" integer NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'worker'::"public"."user_role" NOT NULL,
    "invited_by" "uuid",
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_invitations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'worker'::"public"."user_role" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weld_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "part_id" "uuid",
    "weld_number" "text" NOT NULL,
    "joint_type" "text" NOT NULL,
    "fillet_size" "text",
    "weld_process" "text" NOT NULL,
    "filler_metal" "text" NOT NULL,
    "inspection_method" "text" NOT NULL,
    "cwi_reference" "text",
    "inspector_id" "uuid",
    "inspector_name" "text",
    "result" "public"."inspection_result" DEFAULT 'pending'::"public"."inspection_result" NOT NULL,
    "aws_d11_reference" "text",
    "notes" "text",
    "inspection_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."weld_inspections" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."weld_inspections" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_history"
    ADD CONSTRAINT "ai_chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aisc_checklist"
    ADD CONSTRAINT "aisc_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assemblies"
    ADD CONSTRAINT "assemblies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_applications"
    ADD CONSTRAINT "billing_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cut_plans"
    ADD CONSTRAINT "cut_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_production_log"
    ADD CONSTRAINT "daily_production_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erection_sequence"
    ADD CONSTRAINT "erection_sequence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gc_contacts"
    ADD CONSTRAINT "gc_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."heat_numbers"
    ADD CONSTRAINT "heat_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."osha_checklists"
    ADD CONSTRAINT "osha_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paint_inspections"
    ADD CONSTRAINT "paint_inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sequence_counters"
    ADD CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_tickets"
    ADD CONSTRAINT "shipping_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weld_inspections"
    ADD CONSTRAINT "weld_inspections_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_company_idx" ON "public"."activity_feed" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "activity_feed_co_created_idx" ON "public"."activity_feed" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "ai_chat_session_idx" ON "public"."ai_chat_history" USING "btree" ("session_id", "created_at");



CREATE INDEX "ai_insights_company_idx" ON "public"."ai_insights" USING "btree" ("company_id", "is_resolved", "created_at" DESC);



CREATE INDEX "aisc_company_idx" ON "public"."aisc_checklist" USING "btree" ("company_id");



CREATE INDEX "aisc_project_idx" ON "public"."aisc_checklist" USING "btree" ("project_id");



CREATE INDEX "assemblies_company_idx" ON "public"."assemblies" USING "btree" ("company_id");



CREATE UNIQUE INDEX "assemblies_company_mark_idx" ON "public"."assemblies" USING "btree" ("company_id", "project_id", "assembly_mark");



CREATE INDEX "assemblies_project_idx" ON "public"."assemblies" USING "btree" ("project_id");



CREATE INDEX "audit_log_company_idx" ON "public"."audit_log" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_log_table_idx" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE UNIQUE INDEX "billing_app_num_idx" ON "public"."billing_applications" USING "btree" ("project_id", "application_number");



CREATE INDEX "billing_company_idx" ON "public"."billing_applications" USING "btree" ("company_id");



CREATE INDEX "billing_project_idx" ON "public"."billing_applications" USING "btree" ("project_id");



CREATE INDEX "certifications_co_exp_idx" ON "public"."certifications" USING "btree" ("company_id", "expiry_date");



CREATE INDEX "certifications_company_idx" ON "public"."certifications" USING "btree" ("company_id");



CREATE INDEX "certifications_expiry_idx" ON "public"."certifications" USING "btree" ("company_id", "expiry_date");



CREATE INDEX "change_orders_co_status_idx" ON "public"."change_orders" USING "btree" ("company_id", "status");



CREATE INDEX "change_orders_company_idx" ON "public"."change_orders" USING "btree" ("company_id");



CREATE INDEX "change_orders_project_idx" ON "public"."change_orders" USING "btree" ("project_id");



CREATE INDEX "cut_plans_company_idx" ON "public"."cut_plans" USING "btree" ("company_id");



CREATE INDEX "daily_log_company_idx" ON "public"."daily_production_log" USING "btree" ("company_id");



CREATE INDEX "daily_log_date_idx" ON "public"."daily_production_log" USING "btree" ("company_id", "log_date" DESC);



CREATE INDEX "drawings_company_idx" ON "public"."drawings" USING "btree" ("company_id");



CREATE UNIQUE INDEX "drawings_company_num_rev_idx" ON "public"."drawings" USING "btree" ("company_id", "project_id", "drawing_number", "revision");



CREATE INDEX "drawings_project_idx" ON "public"."drawings" USING "btree" ("project_id");



CREATE INDEX "erection_company_idx" ON "public"."erection_sequence" USING "btree" ("company_id");



CREATE INDEX "erection_project_idx" ON "public"."erection_sequence" USING "btree" ("project_id");



CREATE INDEX "estimate_lines_company_idx" ON "public"."estimate_line_items" USING "btree" ("company_id");



CREATE INDEX "estimate_lines_est_idx" ON "public"."estimate_line_items" USING "btree" ("estimate_id");



CREATE INDEX "estimates_company_idx" ON "public"."estimates" USING "btree" ("company_id");



CREATE INDEX "file_attach_company_idx" ON "public"."file_attachments" USING "btree" ("company_id");



CREATE INDEX "file_attach_entity_idx" ON "public"."file_attachments" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "gc_contacts_company_idx" ON "public"."gc_contacts" USING "btree" ("company_id");



CREATE UNIQUE INDEX "heat_company_num_idx" ON "public"."heat_numbers" USING "btree" ("company_id", "heat_number");



CREATE INDEX "inv_adj_company_idx" ON "public"."inventory_adjustments" USING "btree" ("company_id");



CREATE INDEX "inv_adj_inventory_idx" ON "public"."inventory_adjustments" USING "btree" ("inventory_id");



CREATE INDEX "inventory_co_status_idx" ON "public"."inventory" USING "btree" ("company_id", "status");



CREATE INDEX "inventory_company_idx" ON "public"."inventory" USING "btree" ("company_id");



CREATE INDEX "inventory_status_idx" ON "public"."inventory" USING "btree" ("company_id", "status");



CREATE INDEX "job_costs_company_idx" ON "public"."job_costs" USING "btree" ("company_id");



CREATE INDEX "job_costs_project_idx" ON "public"."job_costs" USING "btree" ("project_id");



CREATE INDEX "ncr_company_idx" ON "public"."ncr_reports" USING "btree" ("company_id");



CREATE INDEX "ncr_project_idx" ON "public"."ncr_reports" USING "btree" ("project_id");



CREATE INDEX "ncr_reports_co_status_idx" ON "public"."ncr_reports" USING "btree" ("company_id", "status");



CREATE INDEX "ncr_status_idx" ON "public"."ncr_reports" USING "btree" ("company_id", "status");



CREATE INDEX "notifications_user_idx" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "osha_company_idx" ON "public"."osha_checklists" USING "btree" ("company_id");



CREATE INDEX "paint_company_idx" ON "public"."paint_inspections" USING "btree" ("company_id");



CREATE INDEX "paint_project_idx" ON "public"."paint_inspections" USING "btree" ("project_id");



CREATE INDEX "parts_assigned_idx" ON "public"."parts" USING "btree" ("assigned_user_id") WHERE ("assigned_user_id" IS NOT NULL);



CREATE INDEX "parts_company_idx" ON "public"."parts" USING "btree" ("company_id");



CREATE UNIQUE INDEX "parts_company_mark_idx" ON "public"."parts" USING "btree" ("company_id", "project_id", "part_mark");



CREATE INDEX "parts_company_status_idx" ON "public"."parts" USING "btree" ("company_id", "status");



CREATE INDEX "parts_project_idx" ON "public"."parts" USING "btree" ("project_id");



CREATE INDEX "parts_project_status_idx" ON "public"."parts" USING "btree" ("project_id", "status");



CREATE INDEX "parts_status_idx" ON "public"."parts" USING "btree" ("company_id", "status");



CREATE INDEX "po_company_idx" ON "public"."purchase_orders" USING "btree" ("company_id");



CREATE INDEX "po_project_idx" ON "public"."purchase_orders" USING "btree" ("project_id");



CREATE INDEX "projects_co_status_deadline_idx" ON "public"."projects" USING "btree" ("company_id", "status", "deadline");



CREATE INDEX "projects_company_idx" ON "public"."projects" USING "btree" ("company_id");



CREATE INDEX "projects_pm_idx" ON "public"."projects" USING "btree" ("pm_id");



CREATE INDEX "projects_status_idx" ON "public"."projects" USING "btree" ("company_id", "status");



CREATE INDEX "rate_limit_buckets_window_idx" ON "public"."rate_limit_buckets" USING "btree" ("window_start");



CREATE INDEX "rfis_co_status_idx" ON "public"."rfis" USING "btree" ("company_id", "status");



CREATE INDEX "rfis_company_idx" ON "public"."rfis" USING "btree" ("company_id");



CREATE INDEX "rfis_project_idx" ON "public"."rfis" USING "btree" ("project_id");



CREATE INDEX "sec_audit_event_idx" ON "public"."security_audit_log" USING "btree" ("event_type", "created_at" DESC);



CREATE UNIQUE INDEX "seq_counters_unique_idx" ON "public"."sequence_counters" USING "btree" ("company_id", "table_name", "prefix");



CREATE INDEX "shipping_company_idx" ON "public"."shipping_tickets" USING "btree" ("company_id");



CREATE INDEX "subscriptions_company_idx" ON "public"."subscriptions" USING "btree" ("company_id");



CREATE INDEX "user_invitations_company_idx" ON "public"."user_invitations" USING "btree" ("company_id");



CREATE INDEX "user_invitations_token_idx" ON "public"."user_invitations" USING "btree" ("token");



CREATE INDEX "users_auth_idx" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "users_company_idx" ON "public"."users" USING "btree" ("company_id");



CREATE INDEX "weld_company_idx" ON "public"."weld_inspections" USING "btree" ("company_id");



CREATE INDEX "weld_project_idx" ON "public"."weld_inspections" USING "btree" ("project_id");



CREATE OR REPLACE TRIGGER "trg_aisc_checklist_updated_at" BEFORE UPDATE ON "public"."aisc_checklist" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_assemblies_updated_at" BEFORE UPDATE ON "public"."assemblies" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_billing_applications_updated_at" BEFORE UPDATE ON "public"."billing_applications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_billing_monotonic" BEFORE INSERT OR UPDATE ON "public"."billing_applications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_billing_pct_monotonic"();



CREATE OR REPLACE TRIGGER "trg_certifications_updated_at" BEFORE UPDATE ON "public"."certifications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_change_orders_updated_at" BEFORE UPDATE ON "public"."change_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cut_plans_updated_at" BEFORE UPDATE ON "public"."cut_plans" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_daily_production_log_updated_at" BEFORE UPDATE ON "public"."daily_production_log" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_drawing_supersede" AFTER INSERT OR UPDATE ON "public"."drawings" FOR EACH ROW EXECUTE FUNCTION "public"."fn_drawing_supersede"();



CREATE OR REPLACE TRIGGER "trg_drawings_updated_at" BEFORE UPDATE ON "public"."drawings" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_erection_sequence_updated_at" BEFORE UPDATE ON "public"."erection_sequence" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_estimates_updated_at" BEFORE UPDATE ON "public"."estimates" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gc_contacts_updated_at" BEFORE UPDATE ON "public"."gc_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_heat_numbers_updated_at" BEFORE UPDATE ON "public"."heat_numbers" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_updated_at" BEFORE UPDATE ON "public"."inventory" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_job_costs_updated_at" BEFORE UPDATE ON "public"."job_costs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ncr_reports_updated_at" BEFORE UPDATE ON "public"."ncr_reports" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notify_co_approved" AFTER INSERT OR UPDATE ON "public"."change_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_co_approved"();



CREATE OR REPLACE TRIGGER "trg_notify_inv_low" AFTER INSERT OR UPDATE ON "public"."inventory" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_inventory_low"();



CREATE OR REPLACE TRIGGER "trg_notify_ncr_created" AFTER INSERT ON "public"."ncr_reports" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_ncr_created"();



CREATE OR REPLACE TRIGGER "trg_notify_paint_failed" AFTER INSERT ON "public"."paint_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_inspection_failed"();



CREATE OR REPLACE TRIGGER "trg_notify_po_received" AFTER UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_po_received"();



CREATE OR REPLACE TRIGGER "trg_notify_rfi_created" AFTER INSERT ON "public"."rfis" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_rfi_created"();



CREATE OR REPLACE TRIGGER "trg_notify_weld_failed" AFTER INSERT ON "public"."weld_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_inspection_failed"();



CREATE OR REPLACE TRIGGER "trg_osha_checklists_updated_at" BEFORE UPDATE ON "public"."osha_checklists" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_paint_auto_ncr" AFTER INSERT OR UPDATE ON "public"."paint_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auto_ncr_on_inspection_fail"();



CREATE OR REPLACE TRIGGER "trg_paint_auto_result" BEFORE INSERT OR UPDATE ON "public"."paint_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_paint_auto_result"();



CREATE OR REPLACE TRIGGER "trg_paint_inspections_updated_at" BEFORE UPDATE ON "public"."paint_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_parts_assembly_progress" AFTER INSERT OR UPDATE OF "status", "assembly_mark" ON "public"."parts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_assembly_progress"();



CREATE OR REPLACE TRIGGER "trg_parts_heat_count" AFTER INSERT OR UPDATE OF "heat_number" ON "public"."parts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_heat_parts_count"();



CREATE OR REPLACE TRIGGER "trg_parts_updated_at" BEFORE UPDATE ON "public"."parts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_purchase_orders_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rfis_updated_at" BEFORE UPDATE ON "public"."rfis" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sequence_counters_updated_at" BEFORE UPDATE ON "public"."sequence_counters" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shipping_tickets_updated_at" BEFORE UPDATE ON "public"."shipping_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_weld_auto_ncr" AFTER INSERT OR UPDATE ON "public"."weld_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auto_ncr_on_inspection_fail"();



CREATE OR REPLACE TRIGGER "trg_weld_inspections_updated_at" BEFORE UPDATE ON "public"."weld_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_chat_history"
    ADD CONSTRAINT "ai_chat_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_chat_history"
    ADD CONSTRAINT "ai_chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."aisc_checklist"
    ADD CONSTRAINT "aisc_checklist_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."aisc_checklist"
    ADD CONSTRAINT "aisc_checklist_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."aisc_checklist"
    ADD CONSTRAINT "aisc_checklist_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aisc_checklist"
    ADD CONSTRAINT "aisc_checklist_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assemblies"
    ADD CONSTRAINT "assemblies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assemblies"
    ADD CONSTRAINT "assemblies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_applications"
    ADD CONSTRAINT "billing_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_applications"
    ADD CONSTRAINT "billing_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_applications"
    ADD CONSTRAINT "billing_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certifications"
    ADD CONSTRAINT "certifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_orders"
    ADD CONSTRAINT "change_orders_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cut_plans"
    ADD CONSTRAINT "cut_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cut_plans"
    ADD CONSTRAINT "cut_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cut_plans"
    ADD CONSTRAINT "cut_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_production_log"
    ADD CONSTRAINT "daily_production_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_production_log"
    ADD CONSTRAINT "daily_production_log_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_production_log"
    ADD CONSTRAINT "daily_production_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drawings"
    ADD CONSTRAINT "drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."erection_sequence"
    ADD CONSTRAINT "erection_sequence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."erection_sequence"
    ADD CONSTRAINT "erection_sequence_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."erection_sequence"
    ADD CONSTRAINT "erection_sequence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_converted_project_id_fkey" FOREIGN KEY ("converted_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gc_contacts"
    ADD CONSTRAINT "gc_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gc_contacts"
    ADD CONSTRAINT "gc_contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."heat_numbers"
    ADD CONSTRAINT "heat_numbers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ncr_reports"
    ADD CONSTRAINT "ncr_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."osha_checklists"
    ADD CONSTRAINT "osha_checklists_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."osha_checklists"
    ADD CONSTRAINT "osha_checklists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paint_inspections"
    ADD CONSTRAINT "paint_inspections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paint_inspections"
    ADD CONSTRAINT "paint_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paint_inspections"
    ADD CONSTRAINT "paint_inspections_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paint_inspections"
    ADD CONSTRAINT "paint_inspections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pm_id_fkey" FOREIGN KEY ("pm_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rfis"
    ADD CONSTRAINT "rfis_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sequence_counters"
    ADD CONSTRAINT "sequence_counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipping_tickets"
    ADD CONSTRAINT "shipping_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipping_tickets"
    ADD CONSTRAINT "shipping_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipping_tickets"
    ADD CONSTRAINT "shipping_tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weld_inspections"
    ADD CONSTRAINT "weld_inspections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weld_inspections"
    ADD CONSTRAINT "weld_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weld_inspections"
    ADD CONSTRAINT "weld_inspections_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weld_inspections"
    ADD CONSTRAINT "weld_inspections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE "public"."activity_feed" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_select" ON "public"."activity_feed" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."ai_chat_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_own" ON "public"."ai_chat_history" USING ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"()))) WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"())));



CREATE POLICY "ai_ins_select" ON "public"."ai_insights" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "ai_ins_update" ON "public"."ai_insights" FOR UPDATE USING (("company_id" = "public"."get_user_company_id"())) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aisc_checklist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aisc_select" ON "public"."aisc_checklist" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "aisc_write" ON "public"."aisc_checklist" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."assemblies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assemblies_select" ON "public"."assemblies" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "assemblies_write" ON "public"."assemblies" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_select_owner" ON "public"."audit_log" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role")));



CREATE POLICY "audit_select_self" ON "public"."audit_log" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"())));



CREATE POLICY "bill_select" ON "public"."billing_applications" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role"]))));



CREATE POLICY "bill_write" ON "public"."billing_applications" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."billing_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cert_select" ON "public"."certifications" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "cert_write" ON "public"."certifications" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."change_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "co_select" ON "public"."change_orders" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "co_write" ON "public"."change_orders" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_select" ON "public"."companies" FOR SELECT USING (("id" = "public"."get_user_company_id"()));



CREATE POLICY "companies_update_owner" ON "public"."companies" FOR UPDATE USING ((("id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role"))) WITH CHECK (("id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."cut_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cut_select" ON "public"."cut_plans" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "cut_write" ON "public"."cut_plans" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'foreman'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."daily_production_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dpl_select" ON "public"."daily_production_log" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "dpl_write" ON "public"."daily_production_log" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'foreman'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."drawings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "drawings_select" ON "public"."drawings" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "drawings_write" ON "public"."drawings" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "erec_select" ON "public"."erection_sequence" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "erec_write" ON "public"."erection_sequence" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."erection_sequence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "est_select" ON "public"."estimates" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'estimator'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role"]))));



CREATE POLICY "est_write" ON "public"."estimates" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'estimator'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."estimate_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estli_select" ON "public"."estimate_line_items" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'estimator'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role"]))));



CREATE POLICY "estli_write" ON "public"."estimate_line_items" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'estimator'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."file_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_select" ON "public"."file_attachments" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "file_write" ON "public"."file_attachments" USING (("company_id" = "public"."get_user_company_id"())) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."gc_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gc_select" ON "public"."gc_contacts" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "gc_write" ON "public"."gc_contacts" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'estimator'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."heat_numbers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "heat_select" ON "public"."heat_numbers" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "heat_write" ON "public"."heat_numbers" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role", 'accounting'::"public"."user_role", 'foreman'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "inv_select" ON "public"."inventory" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "inv_write" ON "public"."inventory" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'foreman'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "invadj_select" ON "public"."inventory_adjustments" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "invadj_write" ON "public"."inventory_adjustments" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'foreman'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invite_select_owner" ON "public"."user_invitations" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role")));



CREATE POLICY "invite_write_owner" ON "public"."user_invitations" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role"))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "jc_select" ON "public"."job_costs" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role", 'estimator'::"public"."user_role"]))));



CREATE POLICY "jc_write" ON "public"."job_costs" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."job_costs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ncr_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ncr_select" ON "public"."ncr_reports" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "ncr_write" ON "public"."ncr_reports" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "notif_select_own" ON "public"."notifications" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"())));



CREATE POLICY "notif_update_own" ON "public"."notifications" FOR UPDATE USING ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"()))) WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("user_id" = "public"."get_user_internal_id"())));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."osha_checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "osha_select" ON "public"."osha_checklists" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "osha_write" ON "public"."osha_checklists" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role", 'foreman'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."paint_inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "paint_select" ON "public"."paint_inspections" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "paint_write" ON "public"."paint_inspections" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."parts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parts_delete" ON "public"."parts" FOR DELETE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role"]))));



CREATE POLICY "parts_insert" ON "public"."parts" FOR INSERT WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role"]))));



CREATE POLICY "parts_select" ON "public"."parts" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND (("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role", 'qc'::"public"."user_role", 'estimator'::"public"."user_role", 'accounting'::"public"."user_role"])) OR (("public"."get_user_role"() = 'worker'::"public"."user_role") AND ("assigned_user_id" = "public"."get_user_internal_id"())) OR ("public"."get_user_role"() = 'worker'::"public"."user_role"))));



CREATE POLICY "parts_update_staff" ON "public"."parts" FOR UPDATE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role", 'qc'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "parts_update_worker" ON "public"."parts" FOR UPDATE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'worker'::"public"."user_role") AND ("assigned_user_id" = "public"."get_user_internal_id"()))) WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("assigned_user_id" = "public"."get_user_internal_id"())));



CREATE POLICY "po_select" ON "public"."purchase_orders" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role", 'foreman'::"public"."user_role"]))));



CREATE POLICY "po_write" ON "public"."purchase_orders" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_delete" ON "public"."projects" FOR DELETE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role")));



CREATE POLICY "projects_insert" ON "public"."projects" FOR INSERT WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role"]))));



CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "projects_update" ON "public"."projects" FOR UPDATE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rfis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rfis_select" ON "public"."rfis" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "rfis_write" ON "public"."rfis" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'foreman'::"public"."user_role", 'qc'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seq_select" ON "public"."sequence_counters" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."sequence_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ship_select" ON "public"."shipping_tickets" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "ship_write" ON "public"."shipping_tickets" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'pm'::"public"."user_role", 'accounting'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



ALTER TABLE "public"."shipping_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subs_select_owner" ON "public"."subscriptions" FOR SELECT USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role")));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_owner" ON "public"."users" FOR INSERT WITH CHECK ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role")));



CREATE POLICY "users_select" ON "public"."users" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "users_update_owner" ON "public"."users" FOR UPDATE USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = 'owner'::"public"."user_role"))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "users_update_self" ON "public"."users" FOR UPDATE USING (("auth_id" = "auth"."uid"())) WITH CHECK (("auth_id" = "auth"."uid"()));



ALTER TABLE "public"."weld_inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weld_select" ON "public"."weld_inspections" FOR SELECT USING (("company_id" = "public"."get_user_company_id"()));



CREATE POLICY "weld_write" ON "public"."weld_inspections" USING ((("company_id" = "public"."get_user_company_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['owner'::"public"."user_role", 'qc'::"public"."user_role"])))) WITH CHECK (("company_id" = "public"."get_user_company_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."fn_assembly_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_assembly_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assembly_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auto_ncr_on_inspection_fail"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auto_ncr_on_inspection_fail"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auto_ncr_on_inspection_fail"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_billing_pct_monotonic"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_billing_pct_monotonic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_billing_pct_monotonic"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_drawing_supersede"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_drawing_supersede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_drawing_supersede"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_heat_parts_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_heat_parts_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_heat_parts_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_co_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_co_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_co_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_inspection_failed"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_inspection_failed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_inspection_failed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_inventory_low"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_inventory_low"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_inventory_low"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_ncr_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_ncr_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_ncr_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_po_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_po_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_po_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_rfi_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_rfi_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_rfi_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_roles"("p_company_id" "uuid", "p_roles" "text"[], "p_type" "public"."notification_type", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_roles"("p_company_id" "uuid", "p_roles" "text"[], "p_type" "public"."notification_type", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_roles"("p_company_id" "uuid", "p_roles" "text"[], "p_type" "public"."notification_type", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_paint_auto_result"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_paint_auto_result"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_paint_auto_result"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recompute_job_cost"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recompute_job_cost"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recompute_job_cost"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_internal_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_internal_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_internal_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_sequence_number"("p_company_id" "uuid", "p_table_name" "text", "p_prefix" "text", "p_width" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."next_sequence_number"("p_company_id" "uuid", "p_table_name" "text", "p_prefix" "text", "p_width" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_sequence_number"("p_company_id" "uuid", "p_table_name" "text", "p_prefix" "text", "p_width" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rl_check"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."activity_feed" TO "anon";
GRANT ALL ON TABLE "public"."activity_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_feed" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."ai_insights" TO "anon";
GRANT ALL ON TABLE "public"."ai_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insights" TO "service_role";



GRANT ALL ON TABLE "public"."aisc_checklist" TO "anon";
GRANT ALL ON TABLE "public"."aisc_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."aisc_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."assemblies" TO "anon";
GRANT ALL ON TABLE "public"."assemblies" TO "authenticated";
GRANT ALL ON TABLE "public"."assemblies" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."billing_applications" TO "anon";
GRANT ALL ON TABLE "public"."billing_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_applications" TO "service_role";



GRANT ALL ON TABLE "public"."certifications" TO "anon";
GRANT ALL ON TABLE "public"."certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."certifications" TO "service_role";



GRANT ALL ON TABLE "public"."change_orders" TO "anon";
GRANT ALL ON TABLE "public"."change_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."change_orders" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."cut_plans" TO "anon";
GRANT ALL ON TABLE "public"."cut_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."cut_plans" TO "service_role";



GRANT ALL ON TABLE "public"."daily_production_log" TO "anon";
GRANT ALL ON TABLE "public"."daily_production_log" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_production_log" TO "service_role";



GRANT ALL ON TABLE "public"."parts" TO "anon";
GRANT ALL ON TABLE "public"."parts" TO "authenticated";
GRANT ALL ON TABLE "public"."parts" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_project_progress" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_project_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_project_progress" TO "service_role";



GRANT ALL ON TABLE "public"."drawings" TO "anon";
GRANT ALL ON TABLE "public"."drawings" TO "authenticated";
GRANT ALL ON TABLE "public"."drawings" TO "service_role";



GRANT ALL ON TABLE "public"."erection_sequence" TO "anon";
GRANT ALL ON TABLE "public"."erection_sequence" TO "authenticated";
GRANT ALL ON TABLE "public"."erection_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_line_items" TO "anon";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."estimates" TO "anon";
GRANT ALL ON TABLE "public"."estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimates" TO "service_role";



GRANT ALL ON TABLE "public"."file_attachments" TO "anon";
GRANT ALL ON TABLE "public"."file_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."file_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."gc_contacts" TO "anon";
GRANT ALL ON TABLE "public"."gc_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."gc_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."heat_numbers" TO "anon";
GRANT ALL ON TABLE "public"."heat_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."heat_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."inventory_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."job_costs" TO "anon";
GRANT ALL ON TABLE "public"."job_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_costs" TO "service_role";



GRANT ALL ON TABLE "public"."ncr_reports" TO "anon";
GRANT ALL ON TABLE "public"."ncr_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ncr_reports" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."osha_checklists" TO "anon";
GRANT ALL ON TABLE "public"."osha_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."osha_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."paint_inspections" TO "anon";
GRANT ALL ON TABLE "public"."paint_inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."paint_inspections" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "service_role";



GRANT ALL ON TABLE "public"."rfis" TO "anon";
GRANT ALL ON TABLE "public"."rfis" TO "authenticated";
GRANT ALL ON TABLE "public"."rfis" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."sequence_counters" TO "anon";
GRANT ALL ON TABLE "public"."sequence_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."sequence_counters" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_tickets" TO "anon";
GRANT ALL ON TABLE "public"."shipping_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."weld_inspections" TO "anon";
GRANT ALL ON TABLE "public"."weld_inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."weld_inspections" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































