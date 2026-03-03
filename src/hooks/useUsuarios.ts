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
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setUsuarios(data.map(parseUsuario));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const saveUsuario = async (u: Partial<UsuarioDB> & { id?: string }) => {
    let senhaToSave = u.senha;

    // Hash password via edge function if it's a new password (not already hashed)
    if (senhaToSave && !senhaToSave.startsWith('$2') && senhaToSave !== '••••••') {
      try {
        const { data, error } = await supabase.functions.invoke('hash-password', {
          body: { action: 'hash', password: senhaToSave },
        });
        if (!error && data?.hash) {
          senhaToSave = data.hash;
        }
      } catch {
        // If hashing fails, still save (will be auto-migrated on login)
      }
    }

    const payload: Record<string, any> = {
      nome: u.nome,
      email: u.email,
      telefone: u.telefone,
      whatsapp: u.whatsapp,
      login: u.login,
      nivel: u.nivel,
      genero: u.genero || null,
      ativo: u.ativo,
      foto: u.foto || null,
      permissoes: u.permissoes as any,
    };

    // Only update senha if provided and changed
    if (senhaToSave && senhaToSave !== '••••••') {
      payload.senha = senhaToSave;
    }

    if (u.id) {
      await supabase.from('usuarios').update(payload).eq('id', u.id);
    } else {
      payload.senha = senhaToSave;
      await supabase.from('usuarios').insert(payload as any);
    }
    await fetchUsuarios();
  };

  const deleteUsuario = async (id: string) => {
    await supabase.from('usuarios').delete().eq('id', id);
    await fetchUsuarios();
  };

  const login = async (loginStr: string, senha: string): Promise<UsuarioDB | null> => {
    try {
      // Use server-side login via edge function (password never compared client-side)
      const { data, error } = await supabase.functions.invoke('hash-password', {
        body: { action: 'login', loginStr: loginStr.trim(), password: senha },
      });
      if (error || !data?.user) return null;
      return parseUsuario(data.user);
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

  return { usuarios, loading, fetchUsuarios, saveUsuario, deleteUsuario, login, getById };
}
