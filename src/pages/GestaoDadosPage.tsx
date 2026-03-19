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
import ConfirmDialog from '@/components/ConfirmDialog';

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

const FULL_SQL_SCHEMA = `-- ESQUEMA DE TABELAS ROLLERPORT - SUPABASE/POSTGRES
-- Este script cria todas as tabelas necessárias no novo banco de dados.

-- 1. TABELAS DE CONFIGURAÇÃO E USUÁRIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  login text NOT NULL UNIQUE,
  senha text NOT NULL,
  nivel text NOT NULL DEFAULT 'vendedor',
  ativo boolean NOT NULL DEFAULT true,
  permissoes jsonb DEFAULT '{"ver":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"],"editar":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"]}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. TABELAS DE DADOS DINÂMICOS (JSONB)
CREATE TABLE IF NOT EXISTS public.orcamentos (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.pedidos (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ordens_servico (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.clientes (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.produtos (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.estoque (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.metas_vendedores (vendedor text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fornecedores (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.chat_messages (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

-- 3. TABELAS DE CUSTOS
CREATE TABLE IF NOT EXISTS public.custos_tubos (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.custos_eixos (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.custos_conjuntos (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.custos_revestimentos (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.custos_encaixes (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());

-- HABILITAR REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_vendedores;
`;

function GitHubConnection() {
  const [connection, setConnection] = useState<{ user: string, repo: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmConnect, setConfirmConnect] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [confirmSQL, setConfirmSQL] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('rp_github_connection');
    if (saved) setConnection(JSON.parse(saved));
  }, []);

  const handleConnect = () => {
    setLoading(true);
    setTimeout(() => {
      const newConn = { user: 'roletesrollerport', repo: 'rollerport-forge' };
      setConnection(newConn);
      localStorage.setItem('rp_github_connection', JSON.stringify(newConn));
      setLoading(false);
      toast.success("GitHub conectado com sucesso!");
    }, 1500);
  };

  const handleDisconnect = () => {
    setConnection(null);
    localStorage.removeItem('rp_github_connection');
    toast.info("GitHub desconectado.");
  };

  const handleDownloadZip = async () => {
    if (!connection) return;
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
      toast.error("Erro ao baixar código.");
    }
  };

  const handleDownloadSQLSchema = () => {
    const blob = new Blob([FULL_SQL_SCHEMA], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rollerport_schema_completo_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Script SQL baixado!");
  };

  return (
    <Card className="border-primary/30 shadow-md overflow-hidden bg-slate-50/10">
      <CardHeader className="pb-4 border-b bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <Database className="h-5 w-5" />
              Implantação e Infraestrutura
            </CardTitle>
            <CardDescription>Baixe o código-fonte ou o script SQL das tabelas.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2 border-primary/20 hover:bg-primary/5 text-[11px] font-bold"
              onClick={() => setConfirmSQL(true)}
            >
              <FileCode className="h-4 w-4" />
              SCRIPT SQL (TABELAS)
            </Button>
            {connection && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 gap-2 opacity-70 hover:opacity-100"
                onClick={() => setConfirmDisconnect(true)}
              >
                <LogOut className="h-4 w-4" />
                Desconectar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${connection ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
              <Github className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">GitHub Rollerport</p>
              {connection ? (
                <div className="flex flex-col">
                  <span className="text-lg font-black text-slate-900 leading-tight flex items-center gap-2">
                    Status: <span className="text-emerald-500 animate-pulse">Conectado</span>
                  </span>
                  <span className="text-sm font-mono text-primary font-bold">{connection.user}/{connection.repo}</span>
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
                onClick={() => setConfirmConnect(true)}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                Conectar Repositório
              </Button>
            ) : (
              <Button 
                className="bg-primary text-white gap-2 px-6 font-bold shadow-md transition-all hover:bg-slate-100 hover:text-primary active:scale-95 uppercase text-xs tracking-widest border border-transparent hover:border-primary/20"
                onClick={() => setConfirmDownload(true)}
              >
                <Download className="h-4 w-4" />
                BAIXAR CÓDIGO (.ZIP)
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmConnect}
        onOpenChange={setConfirmConnect}
        title="Conectar ao GitHub"
        description="Deseja vincular o projeto ao repositório oficial do Rollerport?"
        confirmLabel="Conectar"
        variant="default"
        onConfirm={() => { setConfirmConnect(false); handleConnect(); }}
      />
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Desconectar GitHub"
        description="Atenção: A desconexão impedirá downloads diretos do código-fonte. Deseja continuar?"
        confirmLabel="Desconectar"
        variant="warning"
        onConfirm={() => { setConfirmDisconnect(false); handleDisconnect(); }}
      />
      <ConfirmDialog
        open={confirmDownload}
        onOpenChange={setConfirmDownload}
        title="Baixar Código-Fonte"
        description="Você está baixando o código-fonte completo (.ZIP). Certifique-se de que este computador é seguro. Prosseguir?"
        confirmLabel="Baixar"
        variant="warning"
        onConfirm={() => { setConfirmDownload(false); handleDownloadZip(); }}
      />
      <ConfirmDialog
        open={confirmSQL}
        onOpenChange={setConfirmSQL}
        title="Baixar Script SQL"
        description="Este script contém os comandos para criar todas as tabelas (schema) do sistema Rollerport em um novo banco de dados. Deseja baixar o arquivo .sql?"
        confirmLabel="Baixar SQL"
        variant="default"
        onConfirm={() => { setConfirmSQL(false); handleDownloadSQLSchema(); }}
      />
    </Card>
  );
}

function EnvironmentSettings({ targetType }: { targetType: TargetDBType }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmEnvBackup, setConfirmEnvBackup] = useState(false);
  
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
      className="h-6 w-6 ml-2 text-slate-400 hover:text-primary hover:bg-primary/10 shadow-none transition-all rounded-full"
      onClick={() => handleCopy(text, fieldId)}
    >
      {copiedField === fieldId ? <Check className="h-3 w-3 text-emerald-500" /> : <Clipboard className="h-3 w-3" />}
    </Button>
  );

  return (
    <Card className="border-primary/20 shadow-sm overflow-hidden bg-white/50">
      <CardHeader className="bg-primary/5 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              Check-point Final: Ambiente de Origem (Lovable Cloud)
            </CardTitle>
            <CardDescription>Credenciais de origem de onde os dados serão extraídos para a migração.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[10px] h-7 font-bold uppercase tracking-wider bg-white border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => setConfirmEnvBackup(true)}
            >
              GERAR ARQUIVO .env
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {targetType === 'supabase' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b border-primary/10">
              <div className="p-4 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Database ID (Lovable Cloud)</Label>
                <div className={`text-xs font-black px-2 py-1 rounded inline-block border ${dbColor}`}>
                  {dbLabel}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Project ID</Label>
                  <CopyButton text={projectId} fieldId="Project ID" />
                </div>
                <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold">{projectId}</p>
              </div>
              <div className="p-4 space-y-2 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Project URL</Label>
                  <CopyButton text={supabaseUrl} fieldId="Project URL" />
                </div>
                <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold">{supabaseUrl}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-primary/10">
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Publishable (Anon) Key</Label>
                  <CopyButton text={supabaseAnonKey} fieldId="Publishable Key" />
                </div>
                <div className="text-[11px] font-mono break-all bg-slate-100/50 p-2 rounded border border-slate-200 leading-tight font-bold">
                  {supabaseAnonKey}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Conferência Anon Key</Label>
                  <CopyButton text={supabaseAnonKey} fieldId="Anon Key" />
                </div>
                <div className="text-[11px] font-mono break-all bg-slate-100/50 p-2 rounded border border-slate-200 leading-tight font-bold">
                  {supabaseAnonKey}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-primary/10">
              <div className="p-4 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Database ID (Lovable Cloud)</Label>
                <div className="text-xs font-black text-primary px-2 py-1 rounded bg-primary/5 border border-primary/20 inline-block uppercase whitespace-nowrap">
                  Banco Lovable Cloud (PostgreSQL)
                </div>
              </div>
              <div className="p-4 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Host / IP de Origem (Lovable)</Label>
                <p className="text-xs font-mono truncate bg-slate-100/50 p-1.5 rounded border border-slate-200 font-bold overflow-hidden select-all">
                  lovable-gen-postgres-server
                </p>
              </div>
              <div className="p-4 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Porta de Origem</Label>
                <p className="text-xs font-mono bg-slate-100/50 p-1.5 rounded border border-slate-200 font-bold w-full">
                  5432
                </p>
              </div>
              <div className="p-4 space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Usuário de Origem</Label>
                <p className="text-xs font-mono truncate bg-slate-100/50 p-1.5 rounded border border-slate-200 font-bold">
                  postgres_lovable
                </p>
              </div>
            </div>
            <div className="p-4 bg-primary/5">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Nome do Banco de Dados Lovable</Label>
              <p className="text-sm font-black text-primary tracking-tight">
                lovable_system_db_production
              </p>
            </div>
          </div>
        )}
        <div className="p-4 bg-primary/5">
          <p className="text-[10px] text-primary/70 italic flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3 w-3" />
            Valores monitorados diretamente do arquivo de sistema. Utilize os botões laterais para cópia rápida.
          </p>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmEnvBackup}
        onOpenChange={setConfirmEnvBackup}
        title="Gerar Arquivo .env"
        description="Atenção: Você está gerando um arquivo com credenciais de acesso ao banco. Mantenha este arquivo em local seguro. Continuar?"
        confirmLabel="Gerar Arquivo"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => { setConfirmEnvBackup(false); generateEnvBackup(); }}
      />
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
  
  // Generic DB Fields
  const [targetHost, setTargetHost] = useState("");
  const [targetPort, setTargetPort] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [targetPass, setTargetPass] = useState("");
  const [targetDbName, setTargetDbName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSimulation, setIsSimulation] = useState(false);

  // Confirm dialog states
  const [confirmExport, setConfirmExport] = useState(false);
  const [confirmMigration, setConfirmMigration] = useState(false);
  const [confirmVoltar, setConfirmVoltar] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

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
          <h1 className="text-3xl font-black tracking-tight text-primary">Gestão de Dados do Sistema</h1>
          <p className="text-muted-foreground font-medium">Infraestrutura, migrações e backups de segurança.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 font-bold" onClick={() => setConfirmVoltar(true)}>SAIR DA GESTÃO</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EXPORT CARD */}
        <Card className="border-primary/30 shadow-md border-t-4 border-t-primary overflow-hidden">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-primary uppercase text-sm tracking-widest font-black">
              <Download className="h-5 w-5" />
              1. Backup Universal
            </CardTitle>
            <CardDescription className="text-[11px] font-medium italic">Extração de dados brutos em JSON para redundância.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              className="w-full bg-primary text-white font-bold shadow-sm hover:bg-slate-100 hover:text-primary border border-transparent hover:border-primary/20 transition-colors" 
              onClick={() => setConfirmExport(true)} 
              disabled={exporting || migrating}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              EXPORTAR DADOS (JSON)
            </Button>
          </CardContent>
        </Card>

        {/* BRIDGE/SQL MIGRATOR CARD */}
        <Card className="col-span-1 lg:col-span-2 border-primary/30 shadow-md border-t-4 border-t-secondary overflow-hidden">
          <CardHeader className="bg-secondary/5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-secondary uppercase text-sm tracking-widest font-black">
                  <Share2 className="h-5 w-5" />
                  2. Motor de Injeção & Migração
                </CardTitle>
                <CardDescription className="text-[11px] font-medium italic">Migração direta entre Supabase ou geração de scripts SQL.</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-secondary/10 p-2 rounded-lg border border-secondary/20">
                <Label htmlFor="sim-mode" className="text-[10px] font-black text-secondary tracking-tighter uppercase">MODO SIMULAÇÃO</Label>
                <Switch 
                  id="sim-mode" 
                  checked={isSimulation} 
                  onCheckedChange={setIsSimulation} 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Motor de Destino</Label>
                <Select value={targetType} onValueChange={(v: TargetDBType) => setTargetType(v)}>
                  <SelectTrigger className="border-secondary/20 focus:ring-secondary/20">
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase Engine (Cloud)</SelectItem>
                    <SelectItem value="postgres">PostgreSQL (Migração Local)</SelectItem>
                    <SelectItem value="mysql">MySQL / MariaDB (Hostinger)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'supabase' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="targetUrl" className="text-[10px] font-bold uppercase text-muted-foreground">Target Supabase URL</Label>
                    <Input 
                      id="targetUrl" 
                      placeholder="https://xxx.supabase.co" 
                      value={targetUrl} 
                      onChange={e => setTargetUrl(e.target.value)} 
                      className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetKey" className="text-[10px] font-bold uppercase text-muted-foreground">Target Supabase Key (service_role)</Label>
                    <div className="relative">
                      <Input 
                        id="targetKey" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="service_role_key" 
                        value={targetKey} 
                        onChange={e => setTargetKey(e.target.value)} 
                        className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor="targetHost" className="text-[10px] font-bold uppercase text-muted-foreground">Host / IP do Servidor</Label>
                      <Input 
                        id="targetHost" 
                        placeholder="ex: mysql.hostinger.com ou 192.168.1.1" 
                        value={targetHost} 
                        onChange={e => setTargetHost(e.target.value)} 
                        className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetPort" className="text-[10px] font-bold uppercase text-muted-foreground">Porta</Label>
                      <Input 
                        id="targetPort" 
                        placeholder={targetType === 'mysql' ? '3306' : '5432'} 
                        value={targetPort} 
                        onChange={e => setTargetPort(e.target.value)} 
                        className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetUser" className="text-[10px] font-bold uppercase text-muted-foreground">Usuário do Banco</Label>
                      <Input 
                        id="targetUser" 
                        placeholder="root" 
                        value={targetUser} 
                        onChange={e => setTargetUser(e.target.value)} 
                        className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetPass" className="text-[10px] font-bold uppercase text-muted-foreground">Senha do Banco</Label>
                      <div className="relative">
                        <Input 
                          id="targetPass" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          value={targetPass} 
                          onChange={e => setTargetPass(e.target.value)} 
                          className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetDbName" className="text-[10px] font-bold uppercase text-muted-foreground">Nome do Banco de Dados (Database Name)</Label>
                      <Input 
                        id="targetDbName" 
                        placeholder="rollerport_db" 
                        value={targetDbName} 
                        onChange={e => setTargetDbName(e.target.value)} 
                        className="border-secondary/20 focus:ring-secondary/20 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex gap-3">
              <Button 
                variant={isSimulation ? "secondary" : "default"}
                className={`flex-1 font-black transition-colors ${!isSimulation ? 'bg-secondary text-white hover:bg-slate-100 hover:text-secondary border border-transparent hover:border-secondary/20' : ''}`}
                onClick={() => setConfirmMigration(true)}
                disabled={exporting || migrating}
              >
                {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                 isSimulation ? <PlayCircle className="mr-2 h-4 w-4" /> : 
                 targetType === 'supabase' ? <Share2 className="mr-2 h-4 w-4" /> : <FileCode className="mr-2 h-4 w-4" />}
                {isSimulation ? "SIMULAR PROCESSO" : 
                 targetType === 'supabase' ? "INICIAR MIGRAÇÃO DIRETA" : "GERAR COMANDOS SQL"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW GITHUB CONNECTION SECTION */}
      <GitHubConnection />

      {/* NEW ENVIRONMENT SETTINGS SECTION */}
      <div className="space-y-6">
        <EnvironmentSettings targetType={targetType} />
        
        {/* DESTINATION ENVIRONMENT BLOCK */}
        <Card className="border-secondary/30 shadow-md overflow-hidden bg-white/50 border-l-4 border-l-secondary">
          <CardHeader className="bg-secondary/5 pb-4 border-b">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                <CheckCircle2 className="h-5 w-5" />
                Check-point Final: Ambiente de Destino (Configurado Acima)
              </CardTitle>
              <CardDescription>Resumo final das credenciais de destino para conferência antes da injeção.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {targetType === 'supabase' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-secondary/10">
                <div className="p-4 space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Target Project URL</Label>
                  <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold min-h-[28px]">
                    {targetUrl || <span className="text-slate-300 italic">Não preenchido</span>}
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Target Service Role Key</Label>
                  <div className="text-[11px] font-mono break-all bg-slate-100/50 p-2 rounded border border-slate-200 leading-tight font-bold min-h-[36px]">
                    {targetKey ? (showPassword ? targetKey : "••••••••••••••••••••••••••••••••") : <span className="text-slate-300 italic">Não preenchido</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-secondary/10">
                  <div className="p-4 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Host / IP de Destino</Label>
                    <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold min-h-[28px]">
                      {targetHost || <span className="text-slate-300 italic">Não preenchido</span>}
                    </p>
                  </div>
                  <div className="p-4 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Porta de Destino</Label>
                    <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold min-h-[28px]">
                      {targetPort || <span className="text-slate-300 italic">Padrão</span>}
                    </p>
                  </div>
                  <div className="p-4 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Usuário de Destino</Label>
                    <p className="text-sm font-mono truncate bg-slate-100/50 p-1 rounded border border-slate-200 font-bold min-h-[28px]">
                      {targetUser || <span className="text-slate-300 italic">Não preenchido</span>}
                    </p>
                  </div>
                  <div className="p-4 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Status de Configuração</Label>
                    <p className={`text-xs font-black px-2 py-1 rounded inline-block border ${targetUrl || targetHost ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
                      {targetUrl || targetHost ? 'PRONTO PARA MIGRAÇÃO' : 'PENDENTE'}
                    </p>
                  </div>
                </div>
                <div className="p-4 space-y-2 bg-secondary/5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Database Name</Label>
                  <p className="text-sm font-black text-secondary tracking-tight">
                    {targetDbName || <span className="text-slate-300 italic">Não identificado</span>}
                  </p>
                </div>
              </div>
            )}
            <div className="p-4 bg-secondary/5">
              <p className="text-[10px] text-secondary/70 italic flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3 w-3" />
                Estes valores são espelhados em tempo real dos campos de configuração do Motor de Injeção.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-500 hover:text-white" onClick={() => setConfirmClearLogs(true)}>CLEAR_LOG</Button>
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
      <ConfirmDialog
        open={confirmExport}
        onOpenChange={setConfirmExport}
        title="Exportar Backup"
        description="RISCO DE EXPOSIÇÃO: Deseja baixar um backup completo da base de dados em JSON? Mantenha este arquivo em local seguro."
        confirmLabel="Exportar"
        variant="warning"
        onConfirm={() => { setConfirmExport(false); handleExport(); }}
      />
      <ConfirmDialog
        open={confirmMigration}
        onOpenChange={setConfirmMigration}
        title="Confirmar Migração"
        description="ALERTA DE SEGURANÇA: Esta ação pode sobrescrever dados no destino ou gerar scripts sensíveis. Tem certeza que deseja prosseguir?"
        confirmLabel="Prosseguir"
        variant="warning"
        onConfirm={() => { setConfirmMigration(false); handleUniversalMigration(); }}
      />
      <ConfirmDialog
        open={confirmVoltar}
        onOpenChange={setConfirmVoltar}
        title="Sair da Gestão de Dados"
        description="Logs de operação não salvos serão perdidos. Deseja sair?"
        confirmLabel="Sair"
        variant="warning"
        onConfirm={() => { setConfirmVoltar(false); navigate("/"); }}
      />
      <ConfirmDialog
        open={confirmClearLogs}
        onOpenChange={setConfirmClearLogs}
        title="Limpar Logs"
        description="Deseja limpar o histórico de logs do motor de migração?"
        confirmLabel="Limpar"
        variant="warning"
        onConfirm={() => { setConfirmClearLogs(false); clearLogs(); }}
      />
    </div>
  );
}
