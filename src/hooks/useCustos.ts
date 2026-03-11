import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';

// DB row types
interface TuboRow { id: string; diametro: number; parede: number; preco_barra_6000mm: number; imagem: string | null; }
interface EixoRow { id: string; diametro: string; preco_barra_6000mm: number; imagem: string | null; }
interface ConjuntoRow { id: string; codigo: string; valor: number; imagem: string | null; }
interface RevestimentoRow { id: string; tipo: string; valor_metro_ou_peca: number; imagem: string | null; }
interface EncaixeRow { id: string; tipo: string; preco: number; imagem: string | null; }

const toTubo = (r: TuboRow): Tubo => ({ id: r.id, diametro: r.diametro, parede: r.parede, precoBarra6000mm: r.preco_barra_6000mm, imagem: r.imagem || undefined });
const toEixo = (r: EixoRow): Eixo => ({ id: r.id, diametro: r.diametro, precoBarra6000mm: r.preco_barra_6000mm, imagem: r.imagem || undefined });
const toConj = (r: ConjuntoRow): Conjunto => ({ id: r.id, codigo: r.codigo, valor: r.valor, imagem: r.imagem || undefined });
const toRev = (r: RevestimentoRow): Revestimento => ({ id: r.id, tipo: r.tipo, valorMetroOuPeca: r.valor_metro_ou_peca, imagem: r.imagem || undefined });
const toEnc = (r: EncaixeRow): Encaixe => ({ id: r.id, tipo: r.tipo, preco: r.preco, imagem: r.imagem || undefined });

function getSessionToken() {
  return localStorage.getItem('rp_session_token') || '';
}

async function invokeDataApi(body: any) {
  const { data, error } = await supabase.functions.invoke('data-api', { body: { ...body, sessionToken: getSessionToken() } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useCustos() {
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [eixos, setEixos] = useState<Eixo[]>([]);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [revestimentos, setRevestimentos] = useState<Revestimento[]>([]);
  const [encaixes, setEncaixes] = useState<Encaixe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [t, e, c, r, enc] = await Promise.all([
      supabase.from('custos_tubos' as any).select('*').order('diametro'),
      supabase.from('custos_eixos' as any).select('*').order('diametro'),
      supabase.from('custos_conjuntos' as any).select('*').order('codigo'),
      supabase.from('custos_revestimentos' as any).select('*').order('tipo'),
      supabase.from('custos_encaixes' as any).select('*').order('tipo'),
    ]);
    if (t.data) setTubos((t.data as any[]).map(toTubo));
    if (e.data) setEixos((e.data as any[]).map(toEixo));
    if (c.data) setConjuntos((c.data as any[]).map(toConj));
    if (r.data) setRevestimentos((r.data as any[]).map(toRev));
    if (enc.data) setEncaixes((enc.data as any[]).map(toEnc));
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // CRUD operations via edge function
  const saveTubo = async (t: Tubo) => {
    const row = { diametro: t.diametro, parede: t.parede, preco_barra_6000mm: t.precoBarra6000mm, imagem: t.imagem || null };
    if (t.id && !t.id.startsWith('new_')) {
      await invokeDataApi({ action: 'update', table: 'custos_tubos', rows: [row], ids: [t.id] });
    } else {
      await invokeDataApi({ action: 'insert', table: 'custos_tubos', rows: [row] });
    }
  };

  const saveEixo = async (e: Eixo) => {
    const row = { diametro: e.diametro, preco_barra_6000mm: e.precoBarra6000mm, imagem: e.imagem || null };
    if (e.id && !e.id.startsWith('new_')) {
      await invokeDataApi({ action: 'update', table: 'custos_eixos', rows: [row], ids: [e.id] });
    } else {
      await invokeDataApi({ action: 'insert', table: 'custos_eixos', rows: [row] });
    }
  };

  const saveConjunto = async (c: Conjunto) => {
    const row = { codigo: c.codigo, valor: c.valor, imagem: c.imagem || null };
    if (c.id && !c.id.startsWith('new_')) {
      await invokeDataApi({ action: 'update', table: 'custos_conjuntos', rows: [row], ids: [c.id] });
    } else {
      await invokeDataApi({ action: 'insert', table: 'custos_conjuntos', rows: [row] });
    }
  };

  const saveRevestimento = async (r: Revestimento) => {
    const row = { tipo: r.tipo, valor_metro_ou_peca: r.valorMetroOuPeca, imagem: r.imagem || null };
    if (r.id && !r.id.startsWith('new_')) {
      await invokeDataApi({ action: 'update', table: 'custos_revestimentos', rows: [row], ids: [r.id] });
    } else {
      await invokeDataApi({ action: 'insert', table: 'custos_revestimentos', rows: [row] });
    }
  };

  const saveEncaixe = async (e: Encaixe) => {
    const row = { tipo: e.tipo, preco: e.preco, imagem: e.imagem || null };
    if (e.id && !e.id.startsWith('new_')) {
      await invokeDataApi({ action: 'update', table: 'custos_encaixes', rows: [row], ids: [e.id] });
    } else {
      await invokeDataApi({ action: 'insert', table: 'custos_encaixes', rows: [row] });
    }
  };

  const deleteTubo = async (id: string) => { await invokeDataApi({ action: 'delete', table: 'custos_tubos', ids: [id] }); };
  const deleteEixo = async (id: string) => { await invokeDataApi({ action: 'delete', table: 'custos_eixos', ids: [id] }); };
  const deleteConjunto = async (id: string) => { await invokeDataApi({ action: 'delete', table: 'custos_conjuntos', ids: [id] }); };
  const deleteRevestimento = async (id: string) => { await invokeDataApi({ action: 'delete', table: 'custos_revestimentos', ids: [id] }); };
  const deleteEncaixe = async (id: string) => { await invokeDataApi({ action: 'delete', table: 'custos_encaixes', ids: [id] }); };

  const deleteAllTubos = async () => { await invokeDataApi({ action: 'delete_filtered', table: 'custos_tubos', filters: { neq: { column: 'id', value: '00000000-0000-0000-0000-000000000000' } } }); };
  const deleteAllEixos = async () => { await invokeDataApi({ action: 'delete_filtered', table: 'custos_eixos', filters: { neq: { column: 'id', value: '00000000-0000-0000-0000-000000000000' } } }); };
  const deleteAllConjuntos = async () => { await invokeDataApi({ action: 'delete_filtered', table: 'custos_conjuntos', filters: { neq: { column: 'id', value: '00000000-0000-0000-0000-000000000000' } } }); };
  const deleteAllRevestimentos = async (tipo: 'spiraflex' | 'aneis') => {
    const pattern = tipo === 'spiraflex' ? '%SPIRAFLEX%' : '%ABI%';
    await invokeDataApi({ action: 'delete_filtered', table: 'custos_revestimentos', filters: { ilike: { column: 'tipo', value: pattern } } });
  };
  const deleteAllEncaixes = async () => { await invokeDataApi({ action: 'delete_filtered', table: 'custos_encaixes', filters: { neq: { column: 'id', value: '00000000-0000-0000-0000-000000000000' } } }); };

  const saveAllTubos = async (items: Tubo[]) => { for (const t of items) await saveTubo(t); };
  const saveAllEixos = async (items: Eixo[]) => { for (const e of items) await saveEixo(e); };
  const saveAllConjuntos = async (items: Conjunto[]) => { for (const c of items) await saveConjunto(c); };
  const saveAllRevestimentos = async (items: Revestimento[]) => { for (const r of items) await saveRevestimento(r); };
  const saveAllEncaixes = async (items: Encaixe[]) => { for (const e of items) await saveEncaixe(e); };

  return {
    tubos, eixos, conjuntos, revestimentos, encaixes, loading,
    setTubos, setEixos, setConjuntos, setRevestimentos, setEncaixes,
    saveTubo, saveEixo, saveConjunto, saveRevestimento, saveEncaixe,
    deleteTubo, deleteEixo, deleteConjunto, deleteRevestimento, deleteEncaixe,
    deleteAllTubos, deleteAllEixos, deleteAllConjuntos, deleteAllRevestimentos, deleteAllEncaixes,
    saveAllTubos, saveAllEixos, saveAllConjuntos, saveAllRevestimentos, saveAllEncaixes,
    reload: loadAll,
  };
}
