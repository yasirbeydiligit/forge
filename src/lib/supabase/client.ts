"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/** Browser-side Supabase client (runs as the signed-in user; RLS enforced). */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
