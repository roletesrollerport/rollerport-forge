import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { NivelAcesso, Genero, PermissoesUsuario } from '@/lib/types';

export interface UsuarioDB {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp: string;
  login: string;
  senha: string;
  nivel: NivelAcesso;
  genero?: Genero;
  ativo: boolean;
  foto?: string;
  permissoes: PermissoesUsuario;
  created_at: string;
}

function parseUsuario(row: any): UsuarioDB {
  const data = row.data || {};
  return {
    id: row.id,
    nome: data.nome || row.nome || '',
    email: data.email || row.email || '',
    telefone: data.telefone || row.telefone || '',
    whatsapp: data.whatsapp || row.whatsapp || '',
    login: data.login || row.login || '',
    senha: data.senha || row.senha || '••••••',
    nivel: (data.nivel || row.nivel) as NivelAcesso,
    genero: (data.genero || row.genero) as Genero | undefined,
    ativo: data.ativo !== undefined ? data.ativo : (row.ativo !== undefined ? row.ativo : true),
    foto: data.foto || row.foto || undefined,
    permissoes: (data.permissoes || row.permissoes) || { ver: [], editar: [] },
    created_at: row.created_at,
  };
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = useCallback(async () => {
    // Attempt to fetch columns or fallback to 'data'
    const { data, error } = await supabase
      .from('usuarios' as any)
      .select('id, data, created_at');

    if (error) {
      console.error('[useUsuarios] Erro ao carregar usuários:', error);
      setLoading(false);
      return;
    }

    if (data) {
      setUsuarios(data.map(parseUsuario));
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);


  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    try {
      const sessionToken = localStorage.getItem('rp_session_token');
      if (!sessionToken) throw new Error('Not authenticated');

      const userData: any = {
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        whatsapp: u.whatsapp,
        login: u.login,
        nivel: u.nivel,
        genero: u.genero || null,
        ativo: u.ativo,
        foto: u.foto || null,
        permissoes: u.permissoes,
      };

      if (u.senha && u.senha.trim() !== '') {
        userData.senha = u.senha.trim();
      }

      // First try: Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('user-api', {
          body: { action: 'save_user', sessionToken, userData: { ...userData, id: u.id } },
        });
        if (!error && !data?.error) {
          await fetchUsuarios();
          return;
        }
        console.warn('[useUsuarios] save_user Edge Function failed, trying direct DB...');
      } catch (efError) {
        console.warn('[useUsuarios] save_user EF error:', efError);
      }

      // Second try: Direct DB Upsert (Simplified JSONB)
      const id = u.id || crypto.randomUUID();
      const dbRow = {
        id,
        data: userData,
        updated_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('usuarios' as any)
        .upsert(dbRow);

      if (dbError) throw dbError;
      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error saving user:', err);
      throw err;
    }
  };

  const deleteUsuario = async (id: string) => {
    try {
      const sessionToken = localStorage.getItem('rp_session_token');
      if (!sessionToken) throw new Error('Not authenticated');

      // First try: Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('user-api', {
          body: { action: 'delete_user', sessionToken, userId: id },
        });
        if (!error && !data?.error) {
          await fetchUsuarios();
          return;
        }
        console.warn('[useUsuarios] delete_user Edge Function failed, trying direct DB...');
      } catch (efError) {
        console.warn('[useUsuarios] delete_user EF error:', efError);
      }

      // Second try: Direct DB Delete
      const { error: dbError } = await supabase
        .from('usuarios' as any)
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error deleting user:', err);
      throw err;
    }
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; sessionToken: string } | null> => {
    try {
      // First try: Edge Function (Secure & Supports session sync)
      try {
        const { data, error } = await supabase.functions.invoke('hash-password', {
          body: { action: 'login', loginStr: loginStr.trim(), password: senha },
        });

        if (!error && data?.user && data?.sessionToken) {
          return { user: parseUsuario(data.user), sessionToken: data.sessionToken };
        }
      } catch (efError) {
        console.warn('[useUsuarios] Edge Function login failed, attempting fallback:', efError);
      }


      // Second try: Client-side fallback for JSONB structure
      console.log('[useUsuarios] Attempting client-side login fallback (JSONB)...', loginStr);
      const { data: user, error: dbError } = await (supabase
        .from('usuarios' as any)
        .select('*')
        .filter('data->>login', 'ilike', loginStr.trim())
        .maybeSingle() as any);

      if (dbError) {
        console.error('[useUsuarios] Fallback query failed:', dbError);
        return null;
      }

      if (!user) {
        console.warn('[useUsuarios] Fallback failed: no user found with login:', loginStr);
        return null;
      }

      const userData = user.data || {};
      const isAtivo = userData.ativo === true || userData.ativo === 'true' || user.ativo === true;
      
      console.log('[useUsuarios] User found in fallback. Ativo:', isAtivo);

      if (!isAtivo) {
        console.warn('[useUsuarios] User is not active');
        return null;
      }

      if (userData.senha === senha) {
        console.log('[useUsuarios] Password correct. Logging in...');
        const sessionToken = `local_${user.id}_${Date.now()}`;
        return { user: parseUsuario(user), sessionToken };
      } else {
        console.warn('[useUsuarios] Password mismatch');
      }

      return null;
    } catch (err) {
      console.error('[useUsuarios] Login error:', err);
      return null;
    }
  };

  const getById = async (id: string): Promise<UsuarioDB | null> => {
    const { data } = await supabase
      .from('usuarios' as any)
      .select('id, data, created_at')
      .eq('id', id)
      .maybeSingle();
    return data ? parseUsuario(data) : null;
  };

  const requestPasswordReset = async (loginStr: string) => {
    const { data, error } = await supabase.functions.invoke('password-recovery', {
      body: { action: 'request_reset', loginStr },
    });
    if (error) throw error;
    return data;
  };

  const verifyResetCode = async (loginStr: string, code: string) => {
    const { data, error } = await supabase.functions.invoke('password-recovery', {
      body: { action: 'verify_code', loginStr, code },
    });
    if (error) throw error;
    return data;
  };

  const resetPassword = async (loginStr: string, code: string, newPassword: string) => {
    const { data, error } = await supabase.functions.invoke('password-recovery', {
      body: { action: 'reset_password', loginStr, code, newPassword },
    });
    if (error) throw error;
    return data;
  };


  const getUserCredentials = async (userId: string) => {
    try {
      const sessionToken = localStorage.getItem('rp_session_token');
      if (!sessionToken) throw new Error('Not authenticated');

      // First try: Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('user-api', {
          body: { action: 'get_user_credentials', sessionToken, userId },
        });
        if (!error && !data?.error) {
          return { password: data.password, isPlain: data.isPlain };
        }
      } catch (efError) {
        console.warn('[useUsuarios] getUserCredentials EF error:', efError);
      }

      // Second try: Direct DB (Simplified JSONB + Legacy Columns)
      const { data: user, error: dbError } = await supabase
        .from('usuarios' as any)
        .select('id, data, senha' as any)
        .eq('id', userId)
        .maybeSingle();

      if (dbError || !user) throw new Error('User not found');
      
      const row = user as any;
      const data = row.data || {};
      
      // Try to find password in multiple locations/names
      const password = data.senha || data.password || data.pass || row.senha || row.password || row.pass || '••••••';
      
      return {
        password: password,
        isPlain: true // In simplified mode, we store plain passwords
      };
    } catch (err: any) {
      console.error('[useUsuarios] Error fetching credentials:', err);
      throw err;
    }
  };

  const generateTempPassword = async (userId: string) => {
    try {
      const sessionToken = localStorage.getItem('rp_session_token');
      if (!sessionToken) throw new Error('Not authenticated');

      // First try: Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('user-api', {
          body: { action: 'generate_temp_password', sessionToken, userId },
        });
        if (!error && !data?.error) {
          return { tempPassword: data.tempPassword };
        }
      } catch (efError) {
        console.warn('[useUsuarios] generateTempPassword EF error:', efError);
      }

      // Second try: Direct DB Update (Simplified JSONB)
      const tempPass = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { data: user, error: fetchError } = await supabase
        .from('usuarios' as any)
        .select('data')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError || !user) throw new Error('User not found');

      const newData = { ...(user as any).data, senha: tempPass };

      const { error: updateError } = await supabase
        .from('usuarios' as any)
        .update({ data: newData, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;
      
      return { tempPassword: tempPass };
    } catch (err: any) {
      console.error('[useUsuarios] Error generating temp pass:', err);
      throw err;
    }
  };

  const logoutUser = async (userId: string) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { error } = await supabase.from('sessions').delete().eq('user_id', userId);
    if (error) throw error;

    return { success: true };
  };

  const logoutAllCommonUsers = async () => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { data: users, error: selectError } = await supabase.from('usuarios').select('id').neq('nivel', 'master');
    if (selectError) throw selectError;

    if (!users || users.length === 0) return { success: true };

    const userIds = users.map(u => u.id);
    const { error } = await supabase.from('sessions').delete().in('user_id', userIds);
    if (error) throw error;

    return { success: true };
  };

  return { 
    usuarios, loading, fetchUsuarios, saveUsuario, deleteUsuario, login, getById,
    requestPasswordReset, verifyResetCode, resetPassword, getUserCredentials, 
    generateTempPassword, logoutUser, logoutAllCommonUsers
  };
}
