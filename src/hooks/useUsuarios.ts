import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';
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
    senha: row.senha || '',
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
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setUsuarios(data.map(parseUsuario));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const payload: any = {
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
      payload.senha = u.senha.trim();
    }

    if (u.id) {
      const { error } = await supabase.from('usuarios').update(payload).eq('id', u.id);
      if (error) throw error;
    } else {
      if (!payload.senha) throw new Error('Password required for new user');
      const { error } = await supabase.from('usuarios').insert(payload);
      if (error) throw error;
    }

    await fetchUsuarios();
  };

  const deleteUsuario = async (id: string) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const { data: target } = await supabase.from('usuarios').select('nivel').eq('id', id).maybeSingle();
    if (target?.nivel === 'master') {
      throw new Error('Cannot delete master user');
    }

    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) throw error;

    await fetchUsuarios();
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; sessionToken: string } | null> => {
    try {
      const loginClean = loginStr.trim();
      const { data: users, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`login.ilike.${loginClean},email.ilike.${loginClean}`)
        .eq('ativo', true)
        .limit(1);

      if (error || !users || users.length === 0) return null;
      
      const user = users[0];
      
      let valid = false;
      if (user.senha.startsWith('$2')) {
        valid = bcrypt.compareSync(senha, user.senha);
      } else {
        valid = user.senha === senha;
      }

      if (!valid) return null;

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: sessionError } = await supabase.from('sessions').insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: expiresAt
      });

      if (sessionError) return null;

      return { user: parseUsuario(user), sessionToken };
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

    const { data: targetUser, error } = await supabase.from('usuarios').select('senha').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (!targetUser) throw new Error('User not found');

    const isPlain = !targetUser.senha.startsWith('$2');
    return {
      password: targetUser.senha,
      isPlain
    };
  };

  const generateTempPassword = async (userId: string) => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) throw new Error('Not authenticated');

    const length = Math.floor(Math.random() * 5) + 4; // 4 to 8 characters
    let tempPassword = '';
    for (let i = 0; i < length; i++) {
      tempPassword += Math.floor(Math.random() * 10).toString();
    }

    const { error } = await supabase.from('usuarios').update({ senha: tempPassword }).eq('id', userId);
    if (error) throw error;

    return { tempPassword };
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
