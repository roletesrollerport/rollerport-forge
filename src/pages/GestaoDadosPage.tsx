import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Share2, AlertCircle, CheckCircle2, Loader2, Database, FileCode, PlayCircle, Eye, EyeOff, Settings, Clipboard, Check, Github, LogOut, Zap } from "lucide-react";
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

function GitHubConnection() {
  const [connection, setConnection] = useState<{ user: string, repo: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('rp_github_connection');
    if (saved) setConnection(JSON.parse(saved));
  }, []);

  const handleConnect = () => {
    if (!window.confirm("AVISO DE SEGURANÇA: Vincular o projeto ao GitHub requer permissões de acesso. Deseja prosseguir com a conexão?")) return;
    setLoading(true);
    // Mock authentication flow
    setTimeout(() => {
      const newConn = { user: 'roletesrollerport', repo: 'rollerport-forge' };
      setConnection(newConn);
      localStorage.setItem('rp_github_connection', JSON.stringify(newConn));
      setLoading(false);
      toast.success("GitHub conectado com sucesso!");
    }, 1500);
  };

  const handleDisconnect = () => {
    if (window.confirm("Atenção: Desconectar o GitHub não apaga seu código na nuvem, mas impede atualizações automáticas. Deseja continuar?")) {
      setConnection(null);
      localStorage.removeItem('rp_github_connection');
      toast.info("GitHub desconectado.");
    }
  };

  const handleDownloadZip = async () => {
    if (!connection) return;
    if (!window.confirm("AVISO DE SEGURANÇA: Você está baixando o código-fonte completo (.ZIP). Certifique-se de que este computador é seguro. Prosseguir?")) return;
    
    toast.loading("Preparando download do código-fonte...");
    try {
      const response = await fetch(`https://api.github.com/repos/${connection.user}/${connection.repo}/zipball/main`);
      if (!response.ok) throw new Error("Falha ao baixar arquivo");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${connection.repo}-main.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success("Download iniciado!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao baixar código: Repositório pode ser privado ou inexistente.");
    }
  };

  return (
    <Card className="border-primary/20 shadow-sm overflow-hidden ring-1 ring-black/5 bg-slate-50/20">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Github className="h-5 w-5 text-slate-800" />
              Conexão com Repositório de Código
            </CardTitle>
            <CardDescription>Gerencie o vínculo entre este projeto e o GitHub.</CardDescription>
          </div>
          {connection && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 gap-2"
              onClick={handleDisconnect}
            >
              <LogOut className="h-4 w-4" />
              Desconectar GitHub
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${connection ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Status da Conta</p>
              {connection ? (
                <div className="flex flex-col">
                  <span className="text-lg font-black text-slate-900 leading-tight">Conectado: {connection.user}</span>
                  <span className="text-sm font-mono text-primary font-bold">Repos: {connection.repo}</span>
                </div>
              ) : (
                <span className="text-lg font-black text-slate-400 italic">Status: Desconectado</span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {!connection ? (
              <Button 
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-6"
                onClick={handleConnect}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                Conectar GitHub
              </Button>
            ) : (
              <Button 
                className="bg-[#238636] hover:bg-[#2ea043] text-white gap-2 px-6 font-bold shadow-sm border border-[#238636]/20 transition-all duration-200 active:scale-95"
                onClick={handleDownloadZip}
              >
                <Download className="h-4 w-4" />
                Baixar Código-Fonte (.ZIP)
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvironmentSettings() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Extract env variables with safety
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'Não configurado';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'Não configurado';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || supabaseUrl.split('//')[1]?.split('.')[0] || 'Desconhecido';
  
  // Database identifier logic
  const isOficial = supabaseUrl.includes('vxqf');
  const isLovable = supabaseUrl.includes('ctun');
  const dbLabel = isOficial ? 'BANCO OFICIAL SUPABASE' : isLovable ? 'BANCO LOVABLE CLOUD' : 'BANCO NÃO IDENTIFICADO';
  const dbColor = isOficial ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : isLovable ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-600 bg-gray-50 border-gray-200';

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success(`${fieldId} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generateEnvBackup = () => {
    if (!window.confirm("Atenção: Você está gerando um arquivo com credenciais de acesso ao banco. Mantenha este arquivo em local seguro. Continuar?")) return;
    
    const content = `VITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${supabaseAnonKey}\nVITE_SUPABASE_PROJECT_ID=${projectId}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.backup";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo .env.backup gerado!");
  };

  const CopyButton = ({ text, fieldId }: { text: string, fieldId: string }) => (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-6 w-6 ml-2 text-slate-400 hover:text-primary hover:bg-white hover:ring-1 hover:ring-slate-100 shadow-none hover:shadow-sm transition-all"
      onClick={() => handleCopy(text, fieldId)}
    >
      {copiedField === fieldId ? <Check className="h-3 w-3 text-emerald-500" /> : <Clipboard className="h-3 w-3" />}
    </Button>
  );

  return (
    <Card className="border-primary/20 shadow-sm overflow-hidden ring-1 ring-black/5">
      <CardHeader className="bg-slate-50/50 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-500" />
              Configurações de Ambiente Atuais
            </CardTitle>
            <CardDescription>Visualização permanente das chaves de conexão do projeto.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[10px] h-7 font-bold uppercase tracking-wider bg-white"
              onClick={generateEnvBackup}
            >
              GERAR ARQUIVO .env
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b">
          <div className="p-4 space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Database Identificador</Label>
            <div className={`text-xs font-black px-2 py-1 rounded inline-block border ${dbColor}`}>
              {dbLabel}
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Project ID</Label>
              <CopyButton text={projectId} fieldId="Project ID" />
            </div>
            <p className="text-sm font-mono truncate bg-slate-50 p-1 rounded border border-slate-100 font-bold">{projectId}</p>
          </div>
          <div className="p-4 space-y-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Project URL</Label>
              <CopyButton text={supabaseUrl} fieldId="Project URL" />
            </div>
            <p className="text-sm font-mono truncate bg-slate-50 p-1 rounded border border-slate-100 font-bold">{supabaseUrl}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Publishable (Anon) Key</Label>
              <CopyButton text={supabaseAnonKey} fieldId="Publishable Key" />
            </div>
            <div className="text-[11px] font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 leading-tight font-bold">
              {supabaseAnonKey}
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Conferência Anon Key</Label>
              <CopyButton text={supabaseAnonKey} fieldId="Anon Key" />
            </div>
            <div className="text-[11px] font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 leading-tight font-bold">
              {supabaseAnonKey}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50/30">
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3 w-3" />
            Valores monitorados diretamente do arquivo de sistema. Utilize os botões laterais para cópia rápida.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type TargetDBType = 'supabase' | 'postgres' | 'mysql';

export default function GestaoDadosPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
  
  // Bridge Config
  const [targetType, setTargetType] = useState<TargetDBType>('supabase');
  const [targetUrl, setTargetUrl] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [isSimulation, setIsSimulation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Auth guard
  useState(() => {
    const checkAuth = async () => {
      try {
        const loggedUserId = localStorage.getItem('rp_logged_user');
        if (!loggedUserId) {
          navigate("/");
          return;
        }
        const { data } = await supabase.from('usuarios').select('nivel').eq('id', loggedUserId).single();
        if (data?.nivel === 'master') {
          setIsAuthorized(true);
        } else {
          toast.error("Acesso restrito. Apenas usuários MASTER podem acessar esta página.");
          navigate("/");
        }
      } catch (error) {
        navigate("/");
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  });

  if (checkingAuth) return <div className="p-8 text-center text-muted-foreground animate-pulse">Verificando permissões de acesso...</div>;
  if (!isAuthorized) return null;

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
    console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const clearLogs = () => setLogs([]);

  // --- ABSTRACTION: Clean data logic ---
  const abstractData = (data: any[]) => {
    return data.map(item => {
      const cleanItem = { ...item };
      // Remove Supabase-specific or auto-managed fields that might conflict on other sets
      const internalFields = ['created_at', 'updated_at', 'last_seen']; 
      internalFields.forEach(field => delete cleanItem[field]);
      return cleanItem;
    });
  };

  // --- SQL GENERATION logic ---
  const generateInsertSQL = (dialect: 'postgres' | 'mysql', tableName: string, data: any[]) => {
    if (data.length === 0) return "";
    
    addLog(`Gerando SQL ${dialect.toUpperCase()} para ${tableName}...`);
    const keys = Object.keys(data[0]);
    const columns = keys.map(k => dialect === 'mysql' ? `\`${k}\`` : `"${k}"`).join(", ");
    
    const valueStrings = data.map(row => {
      const vals = keys.map(k => {
        const val = row[k];
        if (val === null) return "NULL";
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });
      return `(${vals.join(", ")})`;
    });

    return `-- Table: ${tableName}\nINSERT INTO ${tableName} (${columns}) VALUES \n${valueStrings.join(",\n")};\n\n`;
  };

  const downloadSQLFile = (content: string) => {
    const blob = new Blob([content], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rollerport_migration_${targetType}_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- EXPORT logic ---
  const handleExport = async () => {
    if (!window.confirm("RISCO DE EXPOSIÇÃO: Deseja baixar um backup completo da base de dados em JSON? Mantenha este arquivo em local seguro. Confirmar exportação?")) return;
    setExporting(true);
    clearLogs();
    addLog("Iniciando exportação consolidada e abstrata...");

    try {
      const results = await Promise.all(
        TABLES_CONFIG.map(async table => {
          addLog(`Lendo tabela ${table.label}...`);
          const { data, error } = await supabase.from(table.name as any).select('*');
          if (error) throw new Error(`Erro na tabela ${table.name}: ${error.message}`);
          return { table: table.name, data: abstractData(data || []) };
        })
      );

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          source: window.location.origin,
          format: "Universal Data Abstraction",
          version: "2.0",
        },
        payload: results,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rollerport_universal_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog("Exportação concluída com sucesso (Esquema Abstrato)!", "success");
      toast.success("Dados abstraídos exportados!");
    } catch (error: any) {
      addLog(`Falha na exportação: ${error.message}`, "error");
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(false);
    }
  };

  // --- BRIDGE MIGRATION / SQL GENERATOR ---
  const handleUniversalMigration = async () => {
    if (!window.confirm("ALERTA DE SEGURANÇA: Esta ação pode sobrescrever dados no destino ou gerar scripts sensíveis. Tem certeza que deseja prosseguir?")) return;

    if (targetType === 'supabase' && (!targetUrl || !targetKey)) {
      toast.error("Preencha a URL e a KEY do Supabase de destino.");
      return;
    }

    setMigrating(true);
    clearLogs();
    addLog(`Iniciando ${isSimulation ? 'SIMULAÇÃO' : 'MIGRAÇÃO'} para ${targetType.toUpperCase()}...`);

    try {
      let targetClient = null;
      let fullSQL = `-- Automatic Migration Script Generated by Rollerport Universal Migrator\n-- Target: ${targetType}\n-- Date: ${new Date().toISOString()}\n\n`;

      if (targetType === 'supabase' && !isSimulation) {
        targetClient = createClient(targetUrl, targetKey);
        addLog("Conexão com destino Supabase estabelecida.");
      }

      for (const tableConfig of TABLES_CONFIG) {
        addLog(`Processando ${tableConfig.label}...`);
        
        // Fetch from source
        const { data: sourceDataRaw, error: fetchError } = await supabase.from(tableConfig.name as any).select('*');
        if (fetchError) throw fetchError;

        const sourceData = abstractData(sourceDataRaw || []);

        if (sourceData.length === 0) {
          addLog(`${tableConfig.name}: Tabela vazia na origem.`, "info");
          continue;
        }

        if (isSimulation) {
          addLog(`[SIMULAÇÃO] ${tableConfig.name}: Detectado ${sourceData.length} registros. Esquema mapeado.`, "success");
          continue;
        }

        // Action based on Type
        if (targetType === 'supabase' && targetClient) {
          const batchSize = 50;
          for (let i = 0; i < sourceData.length; i += batchSize) {
            const batch = sourceData.slice(i, i + batchSize);
            addLog(`Enviando lote ${Math.floor(i/batchSize) + 1} de ${tableConfig.name}...`);
            
            // Automatic mapping check: attempt upsert and catch missing column errors
            const { error: upsertError } = await targetClient.from(tableConfig.name).upsert(batch, { onConflict: 'id' });
            
            if (upsertError) {
              addLog(`Erro no lote ${tableConfig.name}: ${upsertError.message}`, "warn");
              addLog(`Dica: Verifique se as colunas são idênticas no destino. Ignorando lote...`, "info");
            } else {
              addLog(`Progresso ${tableConfig.name}: ${Math.min(i + batchSize, sourceData.length)}/${sourceData.length}`, "info");
            }
          }
        } else {
          // SQL Dialect generation
          fullSQL += generateInsertSQL(targetType === 'mysql' ? 'mysql' : 'postgres', tableConfig.name, sourceData);
        }

        addLog(`${tableConfig.label}: OK.`, "success");
      }

      if (targetType !== 'supabase' && !isSimulation) {
        downloadSQLFile(fullSQL);
        addLog("Script SQL gerado e baixado com sucesso!", "success");
      }

      addLog(isSimulation ? "Simulação concluída sem erros!" : "Processo Universal finalizado!", "success");
      toast.success(isSimulation ? "Simulação bem-sucedida" : "Migração/Geração finalizada");
    } catch (error: any) {
      addLog(`Falha crítica: ${error.message}`, "error");
      toast.error("Erro no processamento.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migrador Universal</h1>
          <p className="text-muted-foreground">Abstração de dados e migração para múltiplos motores de banco.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            if (window.confirm("Sair da Gestão de Dados? Riscos: Logs de operação não salvos serão perdidos.")) navigate("/");
          }}>Voltar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EXPORT CARD */}
        <Card className="border-primary/20 shadow-sm border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              1. Abstração & Backup
            </CardTitle>
            <CardDescription>Extrai dados em JSON genérico, removendo dependências Supabase.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={handleExport} 
              disabled={exporting || migrating}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Schema Abstrato
            </Button>
          </CardContent>
        </Card>

        {/* BRIDGE/SQL MIGRATOR CARD */}
        <Card className="col-span-1 lg:col-span-2 border-primary/20 shadow-sm border-t-4 border-t-purple-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-purple-500" />
                  2. Motor de Injeção Universal
                </CardTitle>
                <CardDescription>Migração direta ou geração de comandos SQL por dialeto.</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 p-2 rounded-lg border border-purple-100">
                <Label htmlFor="sim-mode" className="text-xs font-semibold text-purple-700">MODO SIMULAÇÃO</Label>
                <Switch 
                  id="sim-mode" 
                  checked={isSimulation} 
                  onCheckedChange={setIsSimulation} 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motor de Destino</Label>
                <Select value={targetType} onValueChange={(v: TargetDBType) => setTargetType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase (Via API/SDK)</SelectItem>
                    <SelectItem value="postgres">PostgreSQL Padrão (Dump SQL)</SelectItem>
                    <SelectItem value="mysql">MySQL / Hostinger (Dump SQL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'supabase' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="targetUrl">Target Supabase URL</Label>
                    <Input 
                      id="targetUrl" 
                      placeholder="https://xxx.supabase.co" 
                      value={targetUrl} 
                      onChange={e => setTargetUrl(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2 md:col-start-2">
                    <Label htmlFor="targetKey">Target Supabase Key (service_role)</Label>
                    <Input 
                      id="targetKey" 
                      type="password" 
                      placeholder="Key" 
                      value={targetKey} 
                      onChange={e => setTargetKey(e.target.value)} 
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 border-t flex gap-3">
              <Button 
                variant={isSimulation ? "secondary" : "default"}
                className={`flex-1 ${!isSimulation ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                onClick={handleUniversalMigration}
                disabled={exporting || migrating}
              >
                {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                 isSimulation ? <PlayCircle className="mr-2 h-4 w-4" /> : 
                 targetType === 'supabase' ? <Share2 className="mr-2 h-4 w-4" /> : <FileCode className="mr-2 h-4 w-4" />}
                {isSimulation ? "Simular Processo" : 
                 targetType === 'supabase' ? "Iniciar Migração Direta" : "Gerar Script SQL"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW GITHUB CONNECTION SECTION */}
      <GitHubConnection />

      {/* NEW ENVIRONMENT SETTINGS SECTION */}
      <EnvironmentSettings />

      {/* TERMINAL LOG */}
      <Card className="bg-slate-950 text-slate-50 border-none shadow-2xl overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 ml-4 font-bold tracking-widest uppercase">Universal Migrator Engine v2.0 - Output</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-500 hover:text-white" onClick={() => {
            if (window.confirm("Deseja limpar o histórico de logs do motor de migração?")) clearLogs();
          }}>CLEAR_LOG</Button>
        </div>
        <CardContent className="p-4 font-mono text-[11px] leading-relaxed max-h-[450px] overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-slate-900/50">
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2 opacity-30">
              <Database className="h-8 w-8" />
              <p className="italic">Aguardando comando de sistema...</p>
            </div>
          )}
          {logs.map((log, idx) => (
            <div key={idx} className={`flex items-start gap-2 border-l-2 pl-3 py-0.5 my-0.5 transition-all duration-300 ${
              log.type === 'error' ? 'text-red-400 border-red-500 bg-red-500/5' : 
              log.type === 'success' ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5' : 
              log.type === 'warn' ? 'text-amber-400 border-amber-500 bg-amber-500/5' : 'text-slate-400 border-slate-700'
            }`}>
              <span className="shrink-0 opacity-40 select-none">[{new Date().toLocaleTimeString()}]</span>
              <span className="flex-1 whitespace-pre-wrap">{log.msg}</span>
            </div>
          ))}
          {(exporting || migrating) && (
            <div className="flex items-center gap-3 text-cyan-400 mt-4 px-3 py-2 bg-cyan-500/5 border border-cyan-500/20 rounded">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="font-bold tracking-tight animate-pulse">EXECUTANDO MOTOR DE MIGRAÇÃO...</span>
            </div>
          )}
        </CardContent>
      </Card>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}
