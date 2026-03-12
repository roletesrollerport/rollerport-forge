import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { forcePull } from '@/hooks/useDataSync';
import { RefreshCw } from 'lucide-react';

// Order is important for restoration to respect foreign key constraints
const TABLES_TO_MANAGE = [
  'usuarios',
  'clientes',
  'fornecedores',
  'custos_tubos',
  'custos_eixos',
  'custos_conjuntos',
  'custos_encaixes',
  'custos_revestimentos',
  'produtos',
  'orcamentos',
  'pedidos',
  'ordens_servico',
  'estoque',
  'metas_vendedores',
  'chat_messages',
  'sessions'
];

export default function GerenciamentoPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ table: string; status: 'pending' | 'loading' | 'done' | 'error'; message?: string }[]>([]);

  const handleExport = async () => {
    setExporting(true);
    setProgress(TABLES_TO_MANAGE.map(t => ({ table: t, status: 'pending' })));
    
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const table of TABLES_TO_MANAGE) {
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'loading' } : p));
        
        const { data, error } = await supabase.from(table as any).select('*');
        
        if (error) {
          console.error(`Erro ao exportar ${table}:`, error);
          setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'error', message: error.message } : p));
          // If we can't read users, we continue but warn the user later
          if (table === 'usuarios' && error.message.includes('permission denied')) {
            backupData[table] = [];
            continue;
          }
          throw new Error(`Falha na tabela ${table}: ${error.message}`);
        }
        
        backupData[table] = data || [];
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'done' } : p));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_sistema_rp_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup exportado com sucesso!');
    } catch (error: any) {
      console.error('Erro no backup:', error);
      toast.error('Erro ao exportar backup: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('AVISO: Esta operação irá inserir ou atualizar registros existentes com o mesmo ID em todas as tabelas. Deseja continuar?')) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    setProgress(TABLES_TO_MANAGE.map(t => ({ table: t, status: 'pending' })));

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      for (const table of TABLES_TO_MANAGE) {
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'loading' } : p));
        
        let data = backupData[table];
        if (data && data.length > 0) {
          // Identify if we need to wrap the data into a 'data' column
          // Tables known to be simplified JSONB now:
          const TABLES_WITH_DATA_COL = [
            'usuarios', 'sessions', 'chat_messages', 
            'custos_tubos', 'custos_eixos', 'custos_conjuntos', 
            'custos_revestimentos', 'custos_encaixes',
            'clientes', 'produtos', 'orcamentos', 'pedidos', 
            'ordens_servico', 'estoque', 'fornecedores', 'metas_vendedores'
          ];


          if (TABLES_WITH_DATA_COL.includes(table)) {
            data = data.map((row: any) => {
              // If it already has 'data' and nothing else (besides id/created_at), it's already wrapped
              if (row.data && Object.keys(row).length <= 4) return row;
              
              // Otherwise, wrap everything except 'id' and audit columns into 'data'
              const { id, created_at, updated_at, ...rest } = row;
              
              // Only include created_at/updated_at if they are not undefined
              // and the table is likely to have them (usuarios, sessions, etc.)
              // But for safety in simplified mode, we can just put them into the 'data' blob
              // and let the DB use its default now() if the column is missing.
              
              const result: any = { id, data: { ...rest } };
              
              // If we want to preserve original times, we put them inside 'data' too
              if (created_at) result.data.created_at = created_at;
              if (updated_at) result.data.updated_at = updated_at;
              
              // We only add them to the root if we're sure the table has them.
              // For all simplified tables in the latest V2 script, we added them.
              if (created_at) result.created_at = created_at;
              if (updated_at) result.updated_at = updated_at;
              
              return result;
            });
          }

          const chunkSize = 50;
          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const { error } = await supabase.from(table as any).upsert(chunk);
            if (error) {
              console.error(`Erro no upsert da tabela ${table}:`, error);
              setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'error', message: error.message } : p));
              throw new Error(`Erro na tabela ${table}: ${error.message}`);
            }
          }
        }
        
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'done' } : p));
      }


      await forcePull();
      toast.success('Restauração e Sincronização concluídas!');
    } catch (error: any) {
      console.error('Erro na restauração:', error);
      toast.error('Erro ao restaurar dados: ' + (error.message || 'Erro de formato de arquivo'));
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Dados</h1>
        <p className="text-muted-foreground">Exporte ou restaure todos os dados do sistema diretamente pelo seu navegador.</p>
      </div>


      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <RefreshCw className="h-5 w-5" />
              Sincronização Global
            </CardTitle>
            <CardDescription>
              Força a atualização de todos os dados locais com o que está no banco de dados. Use isso se os dados não aparecerem automaticamente após uma restauração.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button 
              variant="default"
              onClick={async () => {
                const close = toast.loading('Sincronizando todas as tabelas...');
                await forcePull();
                toast.dismiss(close);
                toast.success('Sistema sincronizado com sucesso!');
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Sincronizar Agora
            </Button>
            

            <Button 
              variant="outline"
              onClick={async () => {
                const close = toast.loading('Analisando vínculos...');
                try {
                  const { data: users } = await supabase.from('usuarios_public' as any).select('nome');
                  const { data: orcs } = await supabase.from('orcamentos').select('data');
                  
                  const userNames = (users || []).map((u: any) => (u.nome || '').toLowerCase());
                  const orcamentos = (orcs || []).map((o: any) => o.data);
                  
                  const orphans = orcamentos.filter(o => {
                    const vend = (o.vendedor || '').toLowerCase();
                    return vend && !userNames.some((un: string) => un.includes(vend) || vend.includes(un));
                  });

                  await forcePull();
                  toast.dismiss(close);
                  
                  if (orphans.length > 0) {
                    toast.warning(`Sincronizado! Encontramos ${orphans.length} orçamentos com nomes de vendedores que não batem com os usuários atuais.`);
                  } else {
                    toast.success('Sincronizado! Todos os orçamentos estão vinculados corretamente aos usuários atuais.');
                  }
                } catch (e: any) {
                  toast.error('Erro: ' + e.message);
                }
              }}
              className="gap-2"
            >
              Vincular Dados aos Usuários
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Baixe todos os registros das 16 tabelas principais em formato JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleExport} 
              disabled={exporting || importing}
              className="w-full"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lendo tabelas...
                </>
              ) : (
                'Exportar Backup Completo'
              )}
            </Button>

            {exporting && (
              <div className="mt-4 space-y-1 border rounded-md p-3 bg-muted/30 max-h-60 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Progresso da Leitura:</p>
                {progress.map((p) => (
                  <div key={p.table} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="capitalize">{p.table.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      {p.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      {p.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      {p.status === 'error' && <span className="text-destructive font-bold">ERRO</span>}
                      {p.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurar Dados
            </CardTitle>
            <CardDescription>
              Selecione um arquivo de backup para restaurar no banco de dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>Os dados serão inseridos respeitando a ordem de dependência das tabelas.</p>
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing || exporting}
              />
            </div>

            {importing && (
              <div className="mt-4 space-y-1 border rounded-md p-3 bg-muted/30 max-h-60 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Progresso da Gravação:</p>
                {progress.map((p) => (
                  <div key={p.table} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="capitalize">{p.table.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      {p.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      {p.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      {p.status === 'error' && <span className="text-destructive font-bold" title={p.message}>ERRO</span>}
                      {p.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
