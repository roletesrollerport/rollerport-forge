import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Share2, AlertCircle, CheckCircle2, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Tables to export/import in dependency order
const TABLES_CONFIG = [
  { name: 'usuarios', label: 'Usuários', dependency: 0 },
  { name: 'custos_tubos', label: 'Custos: Tubos', dependency: 1 },
  { name: 'custos_eixos', label: 'Custos: Eixos', dependency: 1 },
  { name: 'custos_conjuntos', label: 'Custos: Conjuntos', dependency: 1 },
  { name: 'custos_revestimentos', label: 'Custos: Revestimentos', dependency: 1 },
  { name: 'custos_encaixes', label: 'Custos: Encaixes', dependency: 1 },
  { name: 'clientes', label: 'Clientes', dependency: 1 },
  { name: 'fornecedores', label: 'Fornecedores', dependency: 1 },
  { name: 'produtos', label: 'Produtos', dependency: 1 },
  { name: 'estoque', label: 'Estoque', dependency: 1 },
  { name: 'metas_vendedores', label: 'Metas Vendedores', dependency: 1 },
  { name: 'chat_messages', label: 'Mensagens do Chat', dependency: 1 },
  { name: 'orcamentos', label: 'Orçamentos', dependency: 2 },
  { name: 'pedidos', label: 'Pedidos', dependency: 3 },
  { name: 'ordens_servico', label: 'Ordens de Serviço', dependency: 4 },
];

export default function GestaoDadosPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Auth guard
  useState(() => {
    const checkAuth = async () => {
      const loggedUserId = localStorage.getItem('rp_logged_user');
      if (!loggedUserId) {
        navigate("/");
        return;
      }
      const { data } = await supabase.from('usuarios').select('nivel').eq('id', loggedUserId).single();
      if (data?.nivel === 'admin' || data?.nivel === 'master') {
        setIsAuthorized(true);
      } else {
        toast.error("Acesso negado. Nível de permissão insuficiente.");
        navigate("/");
      }
      setCheckingAuth(false);
    };
    checkAuth();
  });

  if (checkingAuth) return <div className="p-8 text-center">Verificando permissões...</div>;
  if (!isAuthorized) return null;

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
    console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const clearLogs = () => setLogs([]);

  // --- EXPORT logic ---
  const handleExport = async () => {
    setExporting(true);
    clearLogs();
    addLog("Iniciando exportação consolidada...");

    try {
      const results = await Promise.all(
        TABLES_CONFIG.map(async table => {
          addLog(`Lendo tabela ${table.label}...`);
          const { data, error } = await supabase.from(table.name as any).select('*');
          if (error) throw new Error(`Erro na tabela ${table.name}: ${error.message}`);
          return { table: table.name, data };
        })
      );

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          source: window.location.origin,
          version: "1.0",
        },
        payload: results,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rollerport_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog("Exportação concluída com sucesso!", "success");
      toast.success("Dados exportados com sucesso!");
    } catch (error: any) {
      addLog(`Falha na exportação: ${error.message}`, "error");
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(false);
    }
  };

  // --- IMPORT logic ---
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    clearLogs();
    addLog(`Lendo arquivo: ${file.name}`);

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.payload || !Array.isArray(importData.payload)) {
        throw new Error("Formato de arquivo inválido. 'payload' não encontrado.");
      }

      addLog("Validando integridade dos dados...");

      // Sort by dependency to avoid FK errors
      const sortedPayload = importData.payload.sort((a: any, b: any) => {
        const depA = TABLES_CONFIG.find(t => t.name === a.table)?.dependency || 0;
        const depB = TABLES_CONFIG.find(t => t.name === b.table)?.dependency || 0;
        return depA - depB;
      });

      addLog("Iniciando importação (Upsert)...");
      addLog("Note: Gatilhos (triggers) podem disparar se não desabilitados no servidor.", "warn");

      for (const item of sortedPayload) {
        addLog(`Importando ${item.table} (${item.data?.length || 0} registros)...`);
        
        if (!item.data || item.data.length === 0) {
          addLog(`Tabela ${item.table} vazia, pulando.`, "info");
          continue;
        }

        // preserving original IDs via upsert
        const { error } = await supabase.from(item.table).upsert(item.data, { onConflict: 'id' });
        
        if (error) {
          addLog(`Erro ao importar ${item.table}: ${error.message}`, "error");
          if (confirm(`Erro na tabela ${item.table}. Deseja interromper o processo?`)) {
            throw new Error("Importação interrompida pelo usuário.");
          }
        } else {
          addLog(`${item.table}: OK`, "success");
        }
      }

      addLog("Importação finalizada!", "success");
      toast.success("Dados importados com sucesso!");
    } catch (error: any) {
      addLog(`Falha na importação: ${error.message}`, "error");
      toast.error("Erro ao importar dados.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- BRIDGE MIGRATION logic ---
  const handleBridgeMigration = async () => {
    if (!targetUrl || !targetKey) {
      toast.error("Preencha a URL e a KEY do Supabase de destino.");
      return;
    }

    setMigrating(true);
    clearLogs();
    addLog("Iniciando Migração em Ponte (Bridge)...");

    try {
      const targetClient = createClient(targetUrl, targetKey);
      addLog("Conexão com destino estabelecida.");

      for (const tableConfig of TABLES_CONFIG) {
        addLog(`Migrando ${tableConfig.label}...`);
        
        // Fetch from source
        const { data: sourceData, error: fetchError } = await supabase.from(tableConfig.name as any).select('*');
        if (fetchError) throw fetchError;

        if (!sourceData || sourceData.length === 0) {
          addLog(`${tableConfig.name}: Tabela vazia na origem.`, "info");
          continue;
        }

        // Batch upload (50 records at a time)
        const batchSize = 50;
        for (let i = 0; i < sourceData.length; i += batchSize) {
          const batch = sourceData.slice(i, i + batchSize);
          addLog(`Enviando lote ${Math.floor(i/batchSize) + 1} de ${tableConfig.name}...`);
          
          const { error: upsertError } = await targetClient.from(tableConfig.name).upsert(batch, { onConflict: 'id' });
          if (upsertError) {
            addLog(`Erro no lote ${tableConfig.name}: ${upsertError.message}`, "error");
            throw upsertError;
          }
          
          addLog(`Progresso ${tableConfig.name}: ${Math.min(i + batchSize, sourceData.length)}/${sourceData.length}`, "info");
        }
        addLog(`${tableConfig.label}: Migração Concluída.`, "success");
      }

      addLog("Migração entre instâncias finalizada com sucesso!", "success");
      toast.success("Migração concluída!");
    } catch (error: any) {
      addLog(`Falha na migração: ${error.message}`, "error");
      toast.error("Erro crítico na migração.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Dados</h1>
          <p className="text-muted-foreground">Exportação, importação e migração entre instâncias do Supabase.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>Voltar ao Início</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* EXPORT CARD */}
        <Card className="border-primary/20 shadow-sm border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              Exportador Robusto
            </CardTitle>
            <CardDescription>Gere um backup consolidado em formato JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={handleExport} 
              disabled={exporting || importing || migrating}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Tudo (.json)
            </Button>
          </CardContent>
        </Card>

        {/* IMPORT CARD */}
        <Card className="border-primary/20 shadow-sm border-t-4 border-t-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-500" />
              Importador
            </CardTitle>
            <CardDescription>Upload de backup respeitando dependências.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
            />
            <Button 
              variant="outline" 
              className="w-full border-green-500 text-green-700 hover:bg-green-50" 
              onClick={() => fileInputRef.current?.click()}
              disabled={exporting || importing || migrating}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Selecionar Arquivo
            </Button>
            <p className="text-[10px] text-muted-foreground italic">
              * Nota: Triggers de auditoria não podem ser desabilitados via client-side. Recomenda-se cautela.
            </p>
          </CardContent>
        </Card>

        {/* BRIDGE CARD */}
        <Card className="border-primary/20 shadow-sm border-t-4 border-t-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-purple-500" />
              Migrador (Bridge)
            </CardTitle>
            <CardDescription>Migre dados para outra instância do Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetUrl">Target Supabase URL</Label>
              <Input 
                id="targetUrl" 
                placeholder="https://xxx.supabase.co" 
                value={targetUrl} 
                onChange={e => setTargetUrl(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetKey">Target Supabase Key (service_role recomendada)</Label>
              <Input 
                id="targetKey" 
                type="password" 
                placeholder="eyJhbG..." 
                value={targetKey} 
                onChange={e => setTargetKey(e.target.value)} 
              />
            </div>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700" 
              onClick={handleBridgeMigration}
              disabled={exporting || importing || migrating}
            >
              {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Iniciar Transmissão
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* LOG SECTION */}
      <Card className="bg-slate-950 text-slate-50 border-none shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-800">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            Console de Operações (Log em Tempo Real)
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-white" onClick={clearLogs}>Limpar</Button>
        </CardHeader>
        <CardContent className="p-4 font-mono text-xs max-h-[400px] overflow-y-auto space-y-1">
          {logs.length === 0 && <p className="text-slate-500 italic py-2">Nenhuma operação em execução...</p>}
          {logs.map((log, idx) => (
            <div key={idx} className={`flex items-start gap-2 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'warn' ? 'text-yellow-400' : 'text-slate-300'
            }`}>
              <span className="shrink-0 opacity-50">[{new Date().toLocaleTimeString()}]</span>
              {log.type === 'success' && <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />}
              <span>{log.msg}</span>
            </div>
          ))}
          {(exporting || importing || migrating) && (
            <div className="flex items-center gap-2 text-blue-400 animate-pulse font-bold">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processando... não feche esta aba.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
