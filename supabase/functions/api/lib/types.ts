// Shared types for the FabSimple API Edge Function.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Role =
  | "owner"
  | "pm"
  | "estimator"
  | "foreman"
  | "qc"
  | "accounting"
  | "worker";

export interface Ctx {
  req: Request;
  url: URL;
  user: {
    id: string;        // public.users.id (internal)
    auth_id: string;   // auth.users.id
    company_id: string;
    role: Role;
    full_name: string;
    email: string;
  };
  sb: SupabaseClient;       // user-scoped (RLS enforced)
  sbAdmin: SupabaseClient;  // service role (RLS bypass — use sparingly)
  bearer: string;
  ip: string;
  ua: string;
}

export type TableConfig = {
  table: string;
  insertable: Role[];
  updatable: Role[];
  deletable: Role[];
  readable: Role[];
  hasCompanyId: boolean;
  sequence?: { prefix: string; field: string; width?: number };
  activity?: { entity_type: string; label_field?: string };
};
