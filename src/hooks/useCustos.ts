import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';

// DB row types
interface TuboRow { id: string; diametro: number; parede: number; valor_metro: number; imagem: string | null; }
interface EixoRow { id: string; diametro: string; valor_metro: number; imagem: string | null; }
interface ConjuntoRow { id: string; codigo: string; valor: number; imagem: string | null; }
interface RevestimentoRow { id: string; tipo: string; valor_metro_ou_peca: number; imagem: string | null; }
interface EncaixeRow { id: string; tipo: string; preco: number; imagem: string | null; }

const toTubo = (r: TuboRow): Tubo => ({ id: r.id, diametro: r.diametro, parede: r.parede, valorMetro: r.valor_metro, imagem: r.imagem || undefined });
const toEixo = (r: EixoRow): Eixo => ({ id: r.id, diametro: r.diametro, valorMetro: r.valor_metro, imagem: r.imagem || undefined });
const toConj = (r: ConjuntoRow): Conjunto => ({ id: r.id, codigo: r.codigo, valor: r.valor, imagem: r.imagem || undefined });
const toRev = (r: RevestimentoRow): Revestimento => ({ id: r.id, tipo: r.tipo, valorMetroOuPeca: r.valor_metro_ou_peca, imagem: r.imagem || undefined });
const toEnc = (r: EncaixeRow): Encaixe => ({ id: r.id, tipo: r.tipo, preco: r.preco, imagem: r.imagem || undefined });

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

  // CRUD operations
  const saveTubo = async (t: Tubo) => {
    const row = { diametro: t.diametro, parede: t.parede, valor_metro: t.valorMetro, imagem: t.imagem || null };
    if (t.id && !t.id.startsWith('new_')) {
      await supabase.from('custos_tubos' as any).update(row).eq('id', t.id);
    } else {
      await supabase.from('custos_tubos' as any).insert(row);
    }
  };

  const saveEixo = async (e: Eixo) => {
    const row = { diametro: e.diametro, valor_metro: e.valorMetro, imagem: e.imagem || null };
    if (e.id && !e.id.startsWith('new_')) {
      await supabase.from('custos_eixos' as any).update(row).eq('id', e.id);
    } else {
      await supabase.from('custos_eixos' as any).insert(row);
    }
  };

  const saveConjunto = async (c: Conjunto) => {
    const row = { codigo: c.codigo, valor: c.valor, imagem: c.imagem || null };
    if (c.id && !c.id.startsWith('new_')) {
      await supabase.from('custos_conjuntos' as any).update(row).eq('id', c.id);
    } else {
      await supabase.from('custos_conjuntos' as any).insert(row);
    }
  };

  const saveRevestimento = async (r: Revestimento) => {
    const row = { tipo: r.tipo, valor_metro_ou_peca: r.valorMetroOuPeca, imagem: r.imagem || null };
    if (r.id && !r.id.startsWith('new_')) {
      await supabase.from('custos_revestimentos' as any).update(row).eq('id', r.id);
    } else {
      await supabase.from('custos_revestimentos' as any).insert(row);
    }
  };

  const saveEncaixe = async (e: Encaixe) => {
    const row = { tipo: e.tipo, preco: e.preco, imagem: e.imagem || null };
    if (e.id && !e.id.startsWith('new_')) {
      await supabase.from('custos_encaixes' as any).update(row).eq('id', e.id);
    } else {
      await supabase.from('custos_encaixes' as any).insert(row);
    }
  };

  const deleteTubo = async (id: string) => { await supabase.from('custos_tubos' as any).delete().eq('id', id); };
  const deleteEixo = async (id: string) => { await supabase.from('custos_eixos' as any).delete().eq('id', id); };
  const deleteConjunto = async (id: string) => { await supabase.from('custos_conjuntos' as any).delete().eq('id', id); };
  const deleteRevestimento = async (id: string) => { await supabase.from('custos_revestimentos' as any).delete().eq('id', id); };
  const deleteEncaixe = async (id: string) => { await supabase.from('custos_encaixes' as any).delete().eq('id', id); };

  const deleteAllTubos = async () => { await supabase.from('custos_tubos' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'); };
  const deleteAllEixos = async () => { await supabase.from('custos_eixos' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'); };
  const deleteAllConjuntos = async () => { await supabase.from('custos_conjuntos' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'); };
  const deleteAllRevestimentos = async (tipo: 'spiraflex' | 'aneis') => {
    if (tipo === 'spiraflex') {
      await supabase.from('custos_revestimentos' as any).delete().ilike('tipo', '%SPIRAFLEX%');
    } else {
      await supabase.from('custos_revestimentos' as any).delete().ilike('tipo', '%ABI%');
    }
  };
  const deleteAllEncaixes = async () => { await supabase.from('custos_encaixes' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'); };

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
