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
  return {
    id: row.id,
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    whatsapp: row.whatsapp || '',
    login: row.login,
    senha: row.senha || '••••••',
    nivel: row.nivel as NivelAcesso,
    genero: row.genero as Genero | undefined,
    ativo: row.ativo,
    foto: row.foto || undefined,
    permissoes: (row.permissoes as any) || { ver: [], editar: [] },
    created_at: row.created_at,
  };
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at')
      .order('created_at', { ascending: true });

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
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const userData: any = {
      id: u.id || undefined,
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

    const { data, error } = await supabase.functions.invoke('user-api', {
      body: { action: 'save_user', sessionToken, userData },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await fetchUsuarios();
  };

  const deleteUsuario = async (id: string) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('user-api', {
      body: { action: 'delete_user', sessionToken, userId: id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await fetchUsuarios();
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; sessionToken: string } | null> => {
    try {
      // Use server-side login via edge function (password never compared client-side)
      const { data, error } = await supabase.functions.invoke('hash-password', {
        body: { action: 'login', loginStr: loginStr.trim(), password: senha },
      });
      if (error || !data?.user || !data?.sessionToken) return null;
      return { user: parseUsuario(data.user), sessionToken: data.sessionToken };
    } catch {
      return null;
    }
  };

  const getById = async (id: string): Promise<UsuarioDB | null> => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at')
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
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('user-api', {
      body: { action: 'get_user_credentials', sessionToken, userId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      password: data.password,
      isPlain: data.isPlain
    };
  };

  const generateTempPassword = async (userId: string) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('user-api', {
      body: { action: 'generate_temp_password', sessionToken, userId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return { tempPassword: data.tempPassword };
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
