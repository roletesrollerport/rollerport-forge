import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the current authenticated user's profile ID (from the `usuarios` table).
 * This replaces localStorage.getItem('rp_logged_user').
 */
export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUserId(null);
        return;
      }
      const { data } = await supabase
        .from('usuarios_public' as any)
        .select('id')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      setUserId(data?.id || null);
    };

    fetchProfileId();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfileId();
    });

    return () => subscription.unsubscribe();
  }, []);

  return userId;
}
