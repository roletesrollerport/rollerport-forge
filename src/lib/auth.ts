import { supabase } from '@/integrations/supabase/client';

/**
 * Get the current Supabase Auth access token for use in edge function calls.
 * Returns the token string or null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Build Authorization headers for edge function calls.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
