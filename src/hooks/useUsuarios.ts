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
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*');

      if (error) {
        console.error('[useUsuarios] Erro ao carregar usuários:', error);
      } else if (data) {
        setUsuarios(data.map(parseUsuario));
      }
    } catch (err) {
      console.error('[useUsuarios] Exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    try {
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

      if (u.id) {
        const { error } = await supabase
          .from('usuarios')
          .update(userData)
          .eq('id', u.id);
        if (error) throw error;
      } else {
        if (!userData.senha) throw new Error('Senha é obrigatória para novo usuário');
        const { error } = await supabase
          .from('usuarios')
          .insert(userData);
        if (error) throw error;
      }

      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error saving user:', err);
      throw err;
    }
  };

  const deleteUsuario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchUsuarios();
    } catch (err: any) {
      console.error('[useUsuarios] Error deleting user:', err);
      throw err;
    }
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; authSession: any } | null> => {
    try {
      const { data: userRow, error: lookupError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('login', loginStr.trim())
        .maybeSingle();

      if (lookupError || !userRow) {
        console.warn('[useUsuarios] Login lookup failed:', lookupError?.message || 'User not found');
        return null;
      }

      const syntheticEmail = `${userRow.login}@rollerport.app`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: senha,
      });

      if (authError || !authData?.user) {
        console.warn('[useUsuarios] Auth login failed:', authError?.message);
        return null;
      }

      const { data: profile } = await supabase
        .from('usuarios')
        .select('*')
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

  const getUserCredentials = async (_userId: string) => {
    return { password: '••••••', isPlain: false };
  };

  const generateTempPassword = async (_userId: string) => {
    return { tempPassword: Math.random().toString(36).slice(-8) };
  };

  const logoutUser = async (_userId: string) => {
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
