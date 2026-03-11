import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TABLES_TO_BACKUP = [
  'usuarios',
  'clientes',
  'custos_tubos',
  'custos_eixos',
  'custos_conjuntos',
  'custos_encaixes',
  'custos_revestimentos',
  'estoque',
  'fornecedores',
  'metas_vendedores',
  'produtos',
  'orcamentos',
  'pedidos',
  'ordens_servico',
  'chat_messages',
  'sessions'
];

export default function GerenciamentoPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ table: string; status: 'pending' | 'loading' | 'done' | 'error' }[]>([]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const table of TABLES_TO_BACKUP) {
        const { data, error } = await supabase.from(table as any).select('*');
        if (error) throw error;
        backupData[table] = data || [];
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
      toast.error('Erro ao exportar backup: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('AVISO CRÍTICO: Esta operação irá sobrescrever dados existentes com o mesmo ID. Deseja continuar?')) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    setProgress(TABLES_TO_BACKUP.map(t => ({ table: t, status: 'pending' })));

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      for (const table of TABLES_TO_BACKUP) {
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'loading' } : p));
        
        const data = backupData[table];
        if (data && data.length > 0) {
          const { error } = await supabase.from(table as any).upsert(data);
          if (error) {
            setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'error' } : p));
            throw new Error(`Erro na tabela ${table}: ${error.message}`);
          }
        }
        
        setProgress(prev => prev.map(p => p.table === table ? { ...p, status: 'done' } : p));
      }

      toast.success('Restauração concluída com sucesso!');
    } catch (error: any) {
      console.error('Erro na restauração:', error);
      toast.error('Erro ao restaurar dados: ' + error.message);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Dados</h1>
        <p className="text-muted-foreground">Exporte ou restaure todos os dados do sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Gera um arquivo JSON contendo todos os registros das 16 tabelas do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleExport} 
              disabled={exporting}
              className="w-full"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando arquivo...
                </>
              ) : (
                'Exportar Backup Completo'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurar Dados
            </CardTitle>
            <CardDescription>
              Importa um arquivo de backup para o banco de dados atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>Esta ação é irreversível se feita em um banco com dados reais.</p>
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
              />
            </div>

            {importing && (
              <div className="mt-4 space-y-2 border rounded-md p-3 bg-muted/50 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold uppercase text-muted-foreground px-1">Progresso da Restauração:</p>
                {progress.map((p) => (
                  <div key={p.table} className="flex items-center justify-between text-sm py-1 border-b last:border-0 border-muted">
                    <span className="capitalize">{p.table.replace('_', ' ')}</span>
                    {p.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {p.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {p.status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {p.status === 'pending' && <div className="h-2 w-2 rounded-full bg-slate-200" />}
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
