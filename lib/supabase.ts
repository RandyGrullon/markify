import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador (singleton).
 * Usa autenticación con Google (OAuth) y detecta la sesión que viene en la URL
 * tras el login, sin necesidad de una ruta de callback en el servidor.
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa tu archivo .env.local"
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return _client;
}

/** ¿Está Supabase configurado? (para mostrar avisos amigables en la UI). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const STORAGE_BUCKET = "conversions";

export type Conversion = {
  id: string;
  user_id: string;
  original_name: string;
  markdown_name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
};
