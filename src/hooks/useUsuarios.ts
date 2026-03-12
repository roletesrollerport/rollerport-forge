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
  auth_id?: string;
}

function parseUsuario(row: any): UsuarioDB {
  return {
    id: row.id,
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    whatsapp: row.whatsapp || '',
    login: row.login || '',
    senha: '••••••',
    nivel: row.nivel as NivelAcesso,
    genero: row.genero as Genero | undefined,
    ativo: row.ativo !== undefined ? row.ativo : true,
    foto: row.foto || undefined,
    permissoes: row.permissoes || { ver: [], editar: [] },
    created_at: row.created_at,
    auth_id: row.auth_id || undefined,
  };
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at, auth_id');

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

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  };

  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    try {
      const token = await getAuthToken();

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

      if (u.senha && u.senha.trim() !== '' && u.senha !== '••••••') {
        userData.senha = u.senha.trim();
      }

      const action = u.id ? 'update_user' : 'create_user';
      if (u.id) userData.id = u.id;

      const { data, error } = await supabase.functions.invoke('auth-admin', {
        body: { action, userData },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to save user');
      }

      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error saving user:', err);
      throw err;
    }
  };

  const deleteUsuario = async (id: string) => {
    try {
      const token = await getAuthToken();

      const { data, error } = await supabase.functions.invoke('auth-admin', {
        body: { action: 'delete_user', userId: id },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to delete user');
      }

      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error deleting user:', err);
      throw err;
    }
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; authSession: any } | null> => {
    try {
      // Step 1: Look up the username in usuarios table to build synthetic email
      const { data: userRow, error: lookupError } = await supabase
        .from('usuarios')
        .select('login, auth_id')
        .eq('login', loginStr.trim())
        .maybeSingle();

      if (lookupError || !userRow) {
        console.warn('[useUsuarios] Login lookup failed:', lookupError?.message || 'User not found');
        return null;
      }

      const syntheticEmail = `${userRow.login}@rollerport.app`;

      // Step 2: Sign in with Supabase Auth using the synthetic email
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: senha,
      });

      if (authError || !authData?.user) {
        console.warn('[useUsuarios] Auth login failed:', authError?.message);
        return null;
      }

      // Step 3: Get the full user profile
      const { data: profile } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at, auth_id')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      if (!profile) {
        console.warn('[useUsuarios] Profile not found for auth user');
        await supabase.auth.signOut();
        return null;
      }

      return { user: parseUsuario(profile), authSession: authData.session };
    } catch (err) {
      console.error('[useUsuarios] Login error:', err);
      return null;
    }
  };

  const getById = async (id: string): Promise<UsuarioDB | null> => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at, auth_id')
      .eq('id', id)
      .maybeSingle();
    return data ? parseUsuario(data) : null;
  };

  const getByAuthId = async (authId: string): Promise<UsuarioDB | null> => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at, auth_id')
      .eq('auth_id', authId)
      .maybeSingle();
    return data ? parseUsuario(data) : null;
  };

  const getUserCredentials = async (userId: string) => {
    try {
      const token = await getAuthToken();

      const { data, error } = await supabase.functions.invoke('auth-admin', {
        body: { action: 'get_user_credentials', userId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to get credentials');
      }

      return { password: data.password, isPlain: data.isPlain };
    } catch (err: any) {
      console.error('[useUsuarios] Error fetching credentials:', err);
      throw err;
    }
  };

  const generateTempPassword = async (userId: string) => {
    try {
      const token = await getAuthToken();

      const { data, error } = await supabase.functions.invoke('auth-admin', {
        body: { action: 'generate_temp_password', userId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to generate temp password');
      }

      return { tempPassword: data.tempPassword };
    } catch (err: any) {
      console.error('[useUsuarios] Error generating temp pass:', err);
      throw err;
    }
  };

  const logoutUser = async (userId: string) => {
    // With Supabase Auth, we can't force-logout other users easily
    // This is a no-op placeholder
    return { success: true };
  };

  const logoutAllCommonUsers = async () => {
    return { success: true };
  };

  return {
    usuarios, loading, fetchUsuarios, saveUsuario, deleteUsuario, login, getById,
    getByAuthId, getUserCredentials, generateTempPassword, logoutUser, logoutAllCommonUsers,
  };
}
