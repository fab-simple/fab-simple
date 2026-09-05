-- Add original file path to vendor quotes
alter table vendor_quotes add column original_file_path text;

-- Replace fn_create_vendor_quote to accept p_original_file_path
create or replace function fn_create_vendor_quote(
  p_company_id       uuid,
  p_rfq_id           uuid,
  p_vendor_id        uuid,
  p_lead_time_days   integer,
  p_freight_cost     numeric,
  p_validity_date    date,
  p_notes            text,
  p_lines            jsonb,
  p_created_by       uuid,
  p_original_file_path text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_quote_id uuid;
begin
  insert into vendor_quotes (
    company_id, rfq_id, vendor_id, status, lead_time_days, freight_cost, validity_date, notes, created_by, original_file_path
  ) values (
    p_company_id, p_rfq_id, p_vendor_id, 'submitted', p_lead_time_days, p_freight_cost, p_validity_date, p_notes, p_created_by, p_original_file_path
  ) returning id into v_quote_id;

  insert into vendor_quote_lines (company_id, vendor_quote_id, rfq_line_id, unit_price, mill_name, rolling_schedule)
  select
    p_company_id, v_quote_id, (l->>'rfq_line_id')::uuid, (l->>'unit_price')::numeric,
    l->>'mill_name', l->>'rolling_schedule'
  from jsonb_array_elements(p_lines) l;

  return v_quote_id;
end;
$$;
