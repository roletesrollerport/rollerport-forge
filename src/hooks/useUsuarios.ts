import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { NivelAcesso, Genero, PermissoesUsuario } from '@/lib/types';

const SESSION_EXPIRED_EVENT = 'rp-session-expired';

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

function clearSessionAndNotify() {
  localStorage.removeItem('rp_logged_user');
  localStorage.removeItem('rp_session_token');
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function readEdgeErrorMessage(error: any): Promise<string | null> {
  if (!error) return null;

  const fallbackMessage = typeof error?.message === 'string' ? error.message : null;

  try {
    const jsonReader = error?.context?.json;
    if (typeof jsonReader === 'function') {
      const payload = await jsonReader.call(error.context);
      if (typeof payload?.error === 'string' && payload.error.length > 0) {
        return payload.error;
      }
    }
  } catch {
    // Ignore parse issues, fallback to generic message
  }

  return fallbackMessage;
}

function isSessionExpiredError(message: string | null, error: any): boolean {
  if (error?.context?.status === 401) return true;
  const text = (message || '').toLowerCase();
  return text.includes('invalid or expired session') || text.includes('missing session token');
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at')
      .order('created_at', { ascending: true });
    if (!error && data) {
      const lista = data.map(parseUsuario).filter(u => u.nome?.toLowerCase() !== 'sistema rollerport');
      setUsuarios(lista);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const requireSessionToken = () => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) {
      clearSessionAndNotify();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return sessionToken;
  };

  const invokeUserApi = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('user-api', { body });

    if (error) {
      const message = await readEdgeErrorMessage(error);
      if (isSessionExpiredError(message, error)) {
        clearSessionAndNotify();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      throw new Error(message || 'Erro ao processar requisição');
    }

    if (data?.error) {
      const message = String(data.error);
      if (isSessionExpiredError(message, null)) {
        clearSessionAndNotify();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      throw new Error(message);
    }

    return data;
  };

  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    const sessionToken = requireSessionToken();

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

    await invokeUserApi({ action: 'save_user', sessionToken, userData });
    await fetchUsuarios();
  };

  const deleteUsuario = async (id: string) => {
    const sessionToken = requireSessionToken();
    await invokeUserApi({ action: 'delete_user', sessionToken, userId: id });
    await fetchUsuarios();
  };

  const login = async (loginStr: string, senha: string): Promise<{ user: UsuarioDB; sessionToken: string } | null> => {
    const payload = { action: 'login', loginStr: loginStr.trim(), password: senha };

    try {
      // Primary path
      const { data, error } = await supabase.functions.invoke('hash-password', { body: payload });
      if (!error && data?.user && data?.sessionToken) {
        return { user: parseUsuario(data.user), sessionToken: data.sessionToken };
      }
    } catch {
      // Fallback below
    }

    try {
      // Fallback path: direct fetch avoids sporadic invoke transport failures in browser
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/hash-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.user || !data?.sessionToken) return null;

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
    const sessionToken = requireSessionToken();
    const data = await invokeUserApi({ action: 'get_user_credentials', sessionToken, userId });

    return {
      password: data.password,
      isPlain: data.isPlain
    };
  };

  const generateTempPassword = async (userId: string) => {
    const sessionToken = requireSessionToken();
    const data = await invokeUserApi({ action: 'generate_temp_password', sessionToken, userId });
    return { tempPassword: data.tempPassword };
  };

  const logoutUser = async (userId: string) => {
    requireSessionToken();

    const { error } = await supabase.from('sessions').delete().eq('user_id', userId);
    if (error) throw error;

    return { success: true };
  };

  const logoutAllCommonUsers = async () => {
    requireSessionToken();

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
