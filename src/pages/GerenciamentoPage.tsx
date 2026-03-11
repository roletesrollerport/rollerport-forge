import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function GerenciamentoPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ table: string; status: 'pending' | 'loading' | 'done' | 'error' }[]>([]);

  const handleExport = async () => {
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) {
      toast.error('Sessão não encontrada. Faça login novamente.');
      return;
    }

    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-api', {
        body: { action: 'export_backup', sessionToken },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data.backupData, null, 2)], { type: 'application/json' });
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
      toast.error('Erro ao exportar backup: ' + (error.message || 'Erro interno'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) {
      toast.error('Sessão não encontrada.');
      return;
    }

    if (!confirm('AVISO CRÍTICO: Esta operação irá sobrescrever dados existentes com o mesmo ID em TODAS as tabelas. Deseja continuar?')) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    // Since the Edge Function handles everything in one call for reliability, 
    // we show a global progress instead of per-table live updates unless we split the calls.
    // Splitting calls is safer for timeouts, but one call is easier for atomicity.
    // Let's stick to one call for now as the data isn't huge.
    
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke('user-api', {
        body: { action: 'import_backup', sessionToken, backupData },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Restauração concluída com sucesso!');
    } catch (error: any) {
      console.error('Erro na restauração:', error);
      toast.error('Erro ao restaurar dados: ' + (error.message || 'Erro interno'));
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Dados</h1>
        <p className="text-muted-foreground">Exporte ou restaure todos os dados do sistema com segurança via API Master.</p>
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
                  Processando no Servidor...
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
              <p>Esta ação é irreversível e utiliza permissões de Service Role para processar os dados.</p>
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
              <div className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground animate-pulse">Restaurando tabelas e chaves estrangeiras...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
