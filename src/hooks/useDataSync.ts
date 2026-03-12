import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Maps localStorage keys to Supabase table names and ID field names.
 */
const SYNC_MAP: Record<string, { table: string; idField: string; isFlat?: boolean }> = {
  rp_orcamentos: { table: 'orcamentos', idField: 'id' },
  rp_pedidos: { table: 'pedidos', idField: 'id' },
  rp_os: { table: 'ordens_servico', idField: 'id' },
  rp_clientes: { table: 'clientes', idField: 'id' },
  rp_fornecedores: { table: 'fornecedores', idField: 'id' },
  rp_produtos: { table: 'produtos', idField: 'id' },
  rp_estoque: { table: 'estoque', idField: 'id' },
  rp_metas: { table: 'metas_vendedores', idField: 'vendedor' },
};

const SYNCED_KEYS = Object.keys(SYNC_MAP);

// Track known IDs per table to detect deletes
const knownIds: Record<string, Set<string>> = {};

function getLocalData(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Push local data for a given key to Supabase.
 * Upserts all current items and deletes removed ones.
 */
async function pushToDb(key: string) {
  const config = SYNC_MAP[key];
  if (!config) return;

  // Tabela de usuários é sincronizada apenas via fluxos dedicados (edge functions/useUsuarios)
  // para evitar exposição de credenciais e estouro de armazenamento local.

  const localData = getLocalData(key);
  
  // NEVER push empty data to DB - this would erase real data
  if (localData.length === 0) {
    console.log(`[DataSync] Skipping push for ${config.table} - no local data`);
    return;
  }

  const currentIds = new Set<string>();
  const rows = localData.map((item: any) => {
    const id = config.idField === 'vendedor' ? item.vendedor : item.id;
    currentIds.add(id);
    
    if (config.isFlat) {
      // Map properties directly (flat table)
      return { ...item, [config.idField]: id };
    } else {
      // JSON blob pattern
      return { [config.idField]: id, data: item, updated_at: new Date().toISOString() };
    }
  });

  // Batch upsert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from(config.table as any)
      .upsert(chunk as any, { onConflict: config.idField });
    if (error) console.error(`[DataSync] Upsert error for ${config.table}:`, error);
  }

  // Only delete items that were explicitly known before and are now removed
  const prevIds = knownIds[key];
  if (prevIds && prevIds.size > 0) {
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        const { error } = await supabase
          .from(config.table as any)
          .delete()
          .eq(config.idField, id);
        if (error) console.error(`[DataSync] Delete error for ${config.table}:`, error);
      }
    }
  }

  knownIds[key] = currentIds;
}

/**
 * Pull all data from Supabase for a given key and update localStorage.
 */
async function pullFromDb(key: string): Promise<boolean> {
  const config = SYNC_MAP[key];
  if (!config) return false;

  const { data, error } = await supabase
    .from(config.table as any)
    .select('*')
    .order(config.isFlat ? 'created_at' : 'updated_at', { ascending: true });

  if (error) {
    console.error(`[DataSync] Pull error for ${config.table}:`, error);
    return false;
  }

  if (data && data.length > 0) {
    const items = (data as any[]).map((row: any) => {
      if (config.isFlat) {
        // Flat table: row is the item
        return row;
      } else {
        // Blob table: item is in row.data
        return row.data;
      }
    });

    localStorage.setItem(key, JSON.stringify(items));

    // Track IDs
    const ids = new Set<string>();
    (data as any[]).forEach((row: any) => ids.add(row[config.idField]));
    knownIds[key] = ids;

    return true;
  }

  return false;
}


/**
 * Force pulling all data from DB to localStorage.
 * Useful after a manual import in GerenciamentoPage.
 */
export async function forcePull() {
  console.log('[DataSync] Forcing pull of all tables...');
  await Promise.allSettled(SYNCED_KEYS.map((key) => pullFromDb(key)));
  window.dispatchEvent(new CustomEvent('rp-data-synced'));
  console.log('[DataSync] Force pull complete');
}

/**
 * Initial sync: for each key, check if DB has data.
 * If DB has data → pull to localStorage.
 * If DB is empty but localStorage has data → push to DB (migration).
 */
async function initialSync() {
  console.log('[DataSync] Starting initial sync...');

  const results = await Promise.allSettled(
    SYNCED_KEYS.map(async (key) => {
      const config = SYNC_MAP[key];
      try {
        const { count } = await supabase
          .from(config.table as any)
          .select('*', { count: 'exact', head: true });

        if (count !== null && count > 0) {
          await pullFromDb(key);
          console.log(`[DataSync] Pulled ${count} rows for ${config.table}`);
        } else {
          const localData = getLocalData(key);
          if (localData.length > 0) {
            await pushToDb(key);
            console.log(`[DataSync] Migrated ${localData.length} items to ${config.table}`);
          }
        }
      } catch (err) {
        console.warn(`[DataSync] Failed to sync ${config.table}, skipping:`, err);
      }
    })
  );

  // Notify all pages that data is ready
  window.dispatchEvent(new CustomEvent('rp-data-synced'));
  console.log('[DataSync] Initial sync complete');
}

/**
 * React hook that manages bidirectional sync between localStorage and Supabase.
 * Mount this ONCE in App.tsx.
 */
export function useDataSync() {
  const initializedRef = useRef(false);
  const suppressPullRef = useRef<Set<string>>(new Set());

  // Handle store save events → push to DB
  const handleStoreSave = useCallback((e: Event) => {
    const { key } = (e as CustomEvent).detail;
    if (SYNC_MAP[key]) {
      // Suppress pull for this table briefly to avoid echo
      suppressPullRef.current.add(key);
      pushToDb(key).then(() => {
        setTimeout(() => suppressPullRef.current.delete(key), 2000);
      });
    }
  }, []);

  // Handle realtime changes → pull from DB → notify pages
  const handleRealtimeChange = useCallback((table: string) => {
    const key = Object.entries(SYNC_MAP).find(([, v]) => v.table === table)?.[0];
    if (!key || suppressPullRef.current.has(key)) return;

    pullFromDb(key).then((changed) => {
      if (changed) {
        window.dispatchEvent(new CustomEvent('rp-data-synced'));
      }
    });
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Do initial sync
    initialSync();

    // Listen for store save events
    window.addEventListener('rp-store-save', handleStoreSave);

    // Subscribe to realtime for all synced tables
    const channel = supabase
      .channel('data-sync-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => handleRealtimeChange('orcamentos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => handleRealtimeChange('pedidos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => handleRealtimeChange('ordens_servico'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => handleRealtimeChange('clientes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => handleRealtimeChange('produtos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, () => handleRealtimeChange('estoque'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_vendedores' }, () => handleRealtimeChange('metas_vendedores'))
      .subscribe();

    return () => {
      window.removeEventListener('rp-store-save', handleStoreSave);
      supabase.removeChannel(channel);
    };
  }, [handleStoreSave, handleRealtimeChange]);
}

