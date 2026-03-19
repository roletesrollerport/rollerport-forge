import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IASettings {
  openai_key: string;
  anthropic_key: string;
  markup_padrao: number;
  preco_aco_kg: number;
  modelo_padrao: string;
}

export function useIASettings() {
  const [settings, setSettings] = useState<IASettings>({
    openai_key: '',
    anthropic_key: '',
    markup_padrao: 1.8,
    preco_aco_kg: 7.50,
    modelo_padrao: 'gpt-4o'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ia_settings')
        .select('*');

      if (!error && data) {
        const newSettings = { ...settings };
        data.forEach((row: any) => {
          if (row.key_name === 'openai_key') newSettings.openai_key = row.key_value;
          if (row.key_name === 'anthropic_key') newSettings.anthropic_key = row.key_value;
          if (row.key_name === 'markup_padrao') newSettings.markup_padrao = parseFloat(row.key_value);
          if (row.key_name === 'preco_aco_kg') newSettings.preco_aco_kg = parseFloat(row.key_value);
          if (row.key_name === 'modelo_padrao') newSettings.modelo_padrao = row.key_value;
        });
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Error fetching IA settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: keyof IASettings, value: string | number) => {
    const stringValue = String(value);
    const { error } = await supabase
      .from('ia_settings')
      .upsert({ key_name: key, key_value: stringValue, updated_at: new Date().toISOString() });

    if (!error) {
      setSettings(prev => ({ ...prev, [key]: value }));
      return true;
    }
    return false;
  };

  return { settings, loading, updateSetting, refresh: fetchSettings };
}
