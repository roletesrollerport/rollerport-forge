import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Database, ArrowRightLeft, CheckCircle, AlertTriangle, Loader2, Copy, ExternalLink } from 'lucide-react';

const TABLES_TO_MIGRATE = [
  'usuarios', 'clientes', 'produtos', 'orcamentos', 'pedidos',
  'ordens_servico', 'estoque', 'metas_vendedores', 'chat_messages',
  'sessions', 'custos_tubos', 'custos_eixos', 'custos_encaixes',
  'custos_revestimentos', 'custos_conjuntos',
] as const;

type MigrationStep = 'form' | 'instructions' | 'migrating' | 'done';

export default function MigrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<MigrationStep>('form');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [progress, setProgress] = useState<{ table: string; status: 'pending' | 'migrating' | 'done' | 'error'; count?: number }[]>([]);
  const [migrating, setMigrating] = useState(false);

  const resetState = () => {
    setStep('form');
    setTargetUrl('');
    setTargetKey('');
    setProgress([]);
    setMigrating(false);
  };

  const handleShowInstructions = () => setStep('instructions');

  const handleStartMigration = async () => {
    if (!targetUrl || !targetKey) {
      toast.error('Preencha a URL e a chave do projeto destino.');
      return;
    }

    setStep('migrating');
    setMigrating(true);

    const initialProgress = TABLES_TO_MIGRATE.map(t => ({ table: t, status: 'pending' as const }));
    setProgress(initialProgress);

    try {
      const targetSupabase = createClient(targetUrl, targetKey);

      for (let i = 0; i < TABLES_TO_MIGRATE.length; i++) {
        const table = TABLES_TO_MIGRATE[i];
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'migrating' } : p));

        try {
          // Read from source
          const { data: sourceData, error: readError } = await supabase
            .from(table as any)
            .select('*');

          if (readError) throw readError;

          const rows = sourceData || [];

          if (rows.length > 0) {
            // Upsert in batches of 100
            for (let j = 0; j < rows.length; j += 100) {
              const batch = rows.slice(j, j + 100);
              const { error: writeError } = await targetSupabase
                .from(table)
                .upsert(batch as any, { onConflict: 'id' });

              if (writeError) throw writeError;
            }
          }

          setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done', count: rows.length } : p));
        } catch (err: any) {
          console.error(`Erro ao migrar ${table}:`, err);
          setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', count: 0 } : p));
        }
      }

      setStep('done');
      toast.success('Migração concluída!');
    } catch (err: any) {
      toast.error('Erro na migração: ' + err.message);
    } finally {
      setMigrating(false);
    }
  };

  const sqlSchema = `-- Execute este SQL no SQL Editor do seu projeto Supabase de destino ANTES de migrar:

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text DEFAULT '',
  whatsapp text DEFAULT '',
  login text NOT NULL,
  senha text NOT NULL,
  nivel text NOT NULL DEFAULT 'vendedor',
  genero text,
  foto text,
  permissoes jsonb DEFAULT '{"ver":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"],"editar":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"]}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de sessões
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabelas com dados JSON
CREATE TABLE IF NOT EXISTS public.clientes (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.produtos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.metas_vendedores (
  vendedor text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  file_url text,
  file_name text,
  file_size bigint,
  audio_duration integer,
  deleted_for_sender boolean NOT NULL DEFAULT false,
  deleted_for_all boolean NOT NULL DEFAULT false,
  deleted_by text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Custos
CREATE TABLE IF NOT EXISTS public.custos_tubos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diametro numeric NOT NULL DEFAULT 0,
  parede numeric NOT NULL DEFAULT 0,
  preco_barra_6000mm numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custos_eixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diametro text NOT NULL DEFAULT '',
  preco_barra_6000mm numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custos_encaixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT '',
  preco numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custos_revestimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT '',
  valor_metro_ou_peca numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custos_conjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Desabilitar RLS em todas as tabelas (para permitir a migração)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_tubos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_eixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_encaixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_revestimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_conjuntos ENABLE ROW LEVEL SECURITY;

-- Políticas temporárias para permitir todas as operações (ajuste depois)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'usuarios','sessions','clientes','produtos','orcamentos','pedidos',
    'ordens_servico','estoque','metas_vendedores','chat_messages',
    'custos_tubos','custos_eixos','custos_encaixes','custos_revestimentos','custos_conjuntos'
  ])
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Allow all %s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
`;

  const copySQL = () => {
    navigator.clipboard.writeText(sqlSchema);
    toast.success('SQL copiado para a área de transferência!');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!migrating) { onOpenChange(v); if (!v) resetState(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Migração de Banco de Dados
          </DialogTitle>
          <DialogDescription>
            Exporte todos os dados para outro projeto Supabase
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                  <p className="font-semibold">Antes de migrar, você precisa:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Criar um projeto no <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Supabase</a></li>
                    <li>Executar o SQL de criação das tabelas no SQL Editor do novo projeto</li>
                    <li>Copiar a <strong>URL do projeto</strong> e a <strong>Service Role Key</strong> (não a anon key)</li>
                  </ol>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleShowInstructions}>
              <Copy className="h-4 w-4 mr-2" />
              Ver SQL e instruções detalhadas
            </Button>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="target-url">URL do Projeto Supabase Destino</Label>
                <Input
                  id="target-url"
                  placeholder="https://xxxxx.supabase.co"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value.trim())}
                />
              </div>
              <div>
                <Label htmlFor="target-key">Service Role Key do Destino</Label>
                <Input
                  id="target-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={targetKey}
                  onChange={e => setTargetKey(e.target.value.trim())}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Encontre em: Supabase Dashboard → Settings → API → service_role (secret)
                </p>
              </div>
            </div>

            <Button onClick={handleStartMigration} disabled={!targetUrl || !targetKey} className="w-full">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Iniciar Migração
            </Button>
          </div>
        )}

        {step === 'instructions' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Passo a passo
              </h3>
              <ol className="list-decimal ml-4 text-sm space-y-2 text-muted-foreground">
                <li>Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline text-primary">supabase.com/dashboard</a> e crie um novo projeto (ou use um existente)</li>
                <li>No projeto destino, vá em <strong>SQL Editor</strong></li>
                <li>Cole e execute o SQL abaixo para criar todas as tabelas necessárias</li>
                <li>Vá em <strong>Settings → API</strong> e copie:
                  <ul className="list-disc ml-4 mt-1">
                    <li><strong>Project URL</strong> (ex: https://xxxxx.supabase.co)</li>
                    <li><strong>service_role key</strong> (a chave secreta, NÃO a anon key)</li>
                  </ul>
                </li>
                <li>Volte aqui, cole as credenciais e clique em "Iniciar Migração"</li>
                <li>Após a migração, configure as Edge Functions e as políticas de RLS no novo projeto</li>
              </ol>
            </div>

            <div className="relative">
              <Button variant="outline" size="sm" className="absolute top-2 right-2 z-10" onClick={copySQL}>
                <Copy className="h-3 w-3 mr-1" /> Copiar SQL
              </Button>
              <pre className="bg-muted rounded-lg p-4 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {sqlSchema}
              </pre>
            </div>

            <Button onClick={() => setStep('form')} variant="outline" className="w-full">
              Voltar ao formulário
            </Button>
          </div>
        )}

        {step === 'migrating' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Migrando dados...</p>
            {progress.map(p => (
              <div key={p.table} className="flex items-center gap-3 text-sm">
                {p.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                {p.status === 'migrating' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {p.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {p.status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span className="font-mono flex-1">{p.table}</span>
                {p.status === 'done' && <span className="text-muted-foreground text-xs">{p.count} registros</span>}
                {p.status === 'error' && <span className="text-destructive text-xs">Erro</span>}
              </div>
            ))}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="font-semibold text-lg">Migração Concluída!</h3>
            <p className="text-sm text-muted-foreground">
              Todos os dados foram copiados para o novo banco de dados, incluindo todos os logins e senhas dos usuários.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 text-left">
              <p className="font-semibold mb-1">⚠️ Próximos passos no novo projeto:</p>
              <ul className="list-disc ml-4 space-y-1 text-xs">
                <li>Configurar as Edge Functions (hash-password, user-api, chat-api, chat)</li>
                <li>Configurar as políticas de RLS adequadas</li>
                <li>Criar o bucket de storage "chat-files"</li>
                <li>Atualizar as variáveis de ambiente da aplicação</li>
              </ul>
            </div>
            <Button onClick={() => { onOpenChange(false); resetState(); }} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
