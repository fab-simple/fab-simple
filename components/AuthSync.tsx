"use client";

// Bridges Supabase auth state → Redux + FabAPI in-memory token. Runs once at
// mount, then listens for SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT events.

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/hooks/useAppRedux";
import { setUser, clearUser } from "@/store/authSlice";
import { createClient } from "@/lib/supabase/client";
import { setSession } from "@/lib/api";
import { installGlobalErrorHandlers, setUser as obsSetUser } from "@/lib/observability";

const ROLE_COLORS: Record<string, string> = {
  owner:      "#4F46E5",
  pm:         "#2563EB",
  estimator:  "#7C3AED",
  foreman:    "#EA580C",
  qc:         "#DC2626",
  accounting: "#0D9488",
  worker:     "#475569",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function AuthSync({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    installGlobalErrorHandlers();
    const supabase = createClient();

    async function load(session: import("@supabase/supabase-js").Session | null) {
      if (!session) {
        setSession(null, null);
        dispatch(clearUser());
        return;
      }
      const authId = session.user.id;
      const { data: profile } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("auth_id", authId)
        .maybeSingle();

      if (!profile) {
        setSession(session.access_token, null);
        // Surface the "loaded but no profile" state to the UI so it can render
        // an empty header instead of falling back to stale defaults.
        dispatch(setUser({ userId: null, name: "", email: "", role: "", initials: "" }));
        return;
      }
      setSession(session.access_token, profile.role as string);
      obsSetUser({ id: profile.id as string, email: profile.email as string, role: profile.role as string });
      dispatch(setUser({
        userId: profile.id as string,
        name: profile.full_name as string,
        email: profile.email as string,
        role: profile.role as string,
        avatarColor: ROLE_COLORS[profile.role as string] ?? "#4F46E5",
        initials: initials(profile.full_name as string),
      }));
    }

    supabase.auth.getSession().then(({ data }) => load(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}
