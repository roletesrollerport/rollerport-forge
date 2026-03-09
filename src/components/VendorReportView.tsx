import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Printer, FileText, ShoppingCart, Factory, Brain, Loader2, Save, Edit, Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')}`;

/* Calculates elapsed time from a date string to now in "Xd Xh Xm" */
function elapsedTime(dateStr: string): string {
  if (!dateStr) return '-';
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return '-';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return '0m';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusColor(status: string) {
  switch (status) {
    case 'APROVADO': case 'CONCLUIDO': case 'CONCLUIDA': case 'ENTREGUE': return 'bg-success/10 text-success';
    case 'REPROVADO': case 'CANCELADO': return 'bg-destructive/10 text-destructive';
    case 'EM_PRODUCAO': case 'EM_ANDAMENTO': case 'CONFIRMADO': return 'bg-secondary/10 text-secondary';
    default: return 'bg-muted text-muted-foreground';
  }
}

const statusLabel = (s: string) => s?.replace(/_/g, ' ') || '-';

interface VendorReportViewProps {
  vendorName: string;
  orcamentos: any[];
  pedidos: any[];
  ordensServico: any[];
  metas: any[];
  isMaster: boolean;
  isPrint?: boolean;
  onBack: () => void;
  onPrint: () => void;
  masterPrompt?: string;
  onSaveMasterPrompt?: (prompt: string) => void;
}

const DEFAULT_AI_PROMPT = `Você é um consultor de vendas sênior da Rollerport. Analise o relatório do vendedor e:
1. Avalie o desempenho geral (bateu a meta? por quê?)
2. Identifique padrões de cancelamentos e dê dicas para evitar perdas
3. Dê dicas motivacionais personalizadas
4. Sugira como melhorar os textos de e-mail/orçamento para fechar mais vendas
5. Busque na internet e sugira 3 potenciais clientes que consomem roletes para correias transportadoras (inclua nome da empresa, telefone e e-mail se possível)
6. Se o vendedor bateu a meta, parabenize com entusiasmo mas incentive a ir mais alto
Responda em português do Brasil, de forma clara e motivadora.`;

export default function VendorReportView({
  vendorName, orcamentos, pedidos, ordensServico, metas,
  isMaster, isPrint, onBack, onPrint, masterPrompt, onSaveMasterPrompt,
}: VendorReportViewProps) {
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(masterPrompt || DEFAULT_AI_PROMPT);
  const abortRef = useRef<AbortController | null>(null);

  const meta = metas.find(m => m.vendedor === vendorName);
  const totalVendido = pedidos.reduce((s: number, p: any) => s + (p.valorTotal || 0), 0);
  const metaPct = meta && meta.metaMensal > 0 ? Math.min((totalVendido / meta.metaMensal) * 100, 100) : 0;
  const bateuMeta = meta && meta.metaMensal > 0 && totalVendido >= meta.metaMensal;

  const buildReportText = () => {
    let text = `## Relatório do Vendedor: ${vendorName}\n\n`;
    text += `**Meta Mensal:** ${meta ? fmt(meta.metaMensal) : 'Não definida'}\n`;
    text += `**Total Vendido:** ${fmt(totalVendido)}\n`;
    text += `**Atingimento:** ${metaPct.toFixed(1)}%\n`;
    text += `**Bateu a meta:** ${bateuMeta ? 'SIM ✅' : 'NÃO ❌'}\n\n`;

    text += `### Orçamentos (${orcamentos.length})\n`;
    orcamentos.forEach(o => {
      text += `- Nº ${o.numero} | ${o.clienteNome} | ${fmt(o.valorTotal || 0)} | Status: ${o.status} | Tempo no status: ${elapsedTime(o.dataOrcamento || o.createdAt)}`;
      if (o.status === 'REPROVADO' && o.motivoCancelamento) text += ` | Motivo: ${o.motivoCancelamento}`;
      text += '\n';
    });

    text += `\n### Pedidos (${pedidos.length})\n`;
    pedidos.forEach(p => {
      text += `- Nº ${p.numero} | ${p.clienteNome} | ${fmt(p.valorTotal || 0)} | Status: ${p.status} | Tempo no status: ${elapsedTime(p.createdAt)}`;
      if ((p.status === 'CANCELADO' || p.motivoCancelamento) && p.motivoCancelamento) text += ` | Motivo: ${p.motivoCancelamento}`;
      text += '\n';
    });

    text += `\n### Ordens de Serviço (${ordensServico.length})\n`;
    ordensServico.forEach(os => {
      text += `- O.S. ${os.numero} | ${os.empresa} | Pedido: ${os.pedidoNumero} | Status: ${os.status} | Tempo no status: ${elapsedTime(os.createdAt)}`;
      if (os.motivoCancelamento) text += ` | Motivo: ${os.motivoCancelamento}`;
      text += '\n';
    });

    return text;
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiResponse('');
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) { toast.error('Sessão expirada'); setAiLoading(false); return; }

    const reportText = buildReportText();
    const systemPrompt = masterPrompt || DEFAULT_AI_PROMPT;

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${systemPrompt}\n\n---\n\n${reportText}` }],
          mode: 'ia',
          sessionToken,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) { toast.error('Limite de requisições. Tente novamente em instantes.'); }
        else if (resp.status === 402) { toast.error('Créditos insuficientes.'); }
        else { toast.error('Erro ao analisar relatório.'); }
        setAiLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setAiResponse(full); }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { toast.error('Erro na análise de IA.'); console.error(e); }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSavePrompt = () => {
    setEditingPrompt(false);
    onSaveMasterPrompt?.(promptText);
    toast.success('Prompt da IA salvo!');
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        <Button variant="outline" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        {!isPrint ? (
          <Button variant="outline" onClick={onPrint} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
        ) : (
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        )}

        {/* AI Button - common users: analyze; master: edit prompt */}
        {isMaster ? (
          <Button variant="outline" onClick={() => setEditingPrompt(!editingPrompt)} className="gap-2 ml-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Edit className="h-4 w-4" /> {editingPrompt ? 'Fechar Editor IA' : 'Editar Prompt IA'}
          </Button>
        ) : (
          <Button
            onClick={runAiAnalysis}
            disabled={aiLoading}
            className="gap-2 ml-auto bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? 'Analisando...' : 'Análise IA'}
          </Button>
        )}
      </div>

      {/* Master prompt editor */}
      {isMaster && editingPrompt && (
        <Card className="mb-4 print:hidden">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Prompt de Treinamento da IA</h3>
            <p className="text-xs text-muted-foreground">Edite o texto abaixo para treinar como a IA avalia e motiva os vendedores.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              rows={10}
              className="text-xs font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSavePrompt} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar Prompt</Button>
              <Button size="sm" variant="outline" onClick={() => { setPromptText(DEFAULT_AI_PROMPT); }} className="gap-1.5">Restaurar Padrão</Button>
              <Button size="sm" variant="secondary" onClick={runAiAnalysis} disabled={aiLoading} className="gap-1.5 ml-auto">
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Testar Análise
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Response */}
      {aiResponse && (
        <Card className="mb-4 border-primary/30 print:hidden">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Análise da IA</h3>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
              <ReactMarkdown>{aiResponse}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-card border rounded-lg p-6 max-w-6xl mx-auto print:border-0 print:shadow-none space-y-6">
        <h2 className="text-xl font-bold">Relatório: {vendorName}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="border rounded p-3 text-center">
            <p className="text-xs text-muted-foreground">Orçamentos</p>
            <p className="text-xl font-bold">{orcamentos.length}</p>
          </div>
          <div className="border rounded p-3 text-center">
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-xl font-bold">{pedidos.length}</p>
          </div>
          <div className="border rounded p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Vendido</p>
            <p className="text-xl font-bold text-success">{fmt(totalVendido)}</p>
          </div>
          <div className="border rounded p-3 text-center">
            <p className="text-xs text-muted-foreground">Meta</p>
            <p className={`text-xl font-bold ${bateuMeta ? 'text-success' : 'text-destructive'}`}>
              {metaPct.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* ORÇAMENTOS TABLE */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Orçamentos ({orcamentos.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2">Nº</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Data</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Tempo</th>
                <th className="text-left p-2">Motivo</th>
              </tr></thead>
              <tbody>
                {orcamentos.map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-mono">{o.numero}</td>
                    <td className="p-2">{o.clienteNome}</td>
                    <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                    <td className="p-2 text-right font-mono">{fmt(o.valorTotal || 0)}</td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(o.status)}`}>{statusLabel(o.status)}</span></td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground">{elapsedTime(o.dataOrcamento || o.createdAt)}</td>
                    <td className="p-2 text-[10px] max-w-[200px] truncate" title={o.motivoCancelamento || ''}>
                      {o.status === 'REPROVADO' && o.motivoCancelamento ? o.motivoCancelamento : '-'}
                    </td>
                  </tr>
                ))}
                {orcamentos.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum orçamento.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* PEDIDOS TABLE */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-secondary" /> Pedidos ({pedidos.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2">Nº</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Data</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Tempo</th>
                <th className="text-left p-2">Motivo</th>
              </tr></thead>
              <tbody>
                {pedidos.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-mono">{p.numero}</td>
                    <td className="p-2">{p.clienteNome}</td>
                    <td className="p-2">{p.dataEntrega || p.createdAt}</td>
                    <td className="p-2 text-right font-mono">{fmt(p.valorTotal || 0)}</td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground">{elapsedTime(p.createdAt)}</td>
                    <td className="p-2 text-[10px] max-w-[200px] truncate" title={p.motivoCancelamento || ''}>
                      {p.motivoCancelamento ? p.motivoCancelamento : '-'}
                    </td>
                  </tr>
                ))}
                {pedidos.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ORDENS DE SERVIÇO TABLE */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Factory className="h-4 w-4 text-accent" /> Ordens de Serviço ({ordensServico.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2">O.S.</th>
                <th className="text-left p-2">Cliente/Empresa</th>
                <th className="text-left p-2">Pedido</th>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Tempo</th>
                <th className="text-left p-2">Motivo</th>
              </tr></thead>
              <tbody>
                {ordensServico.map((os: any) => (
                  <tr key={os.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-mono">{os.numero}</td>
                    <td className="p-2">{os.empresa}</td>
                    <td className="p-2 font-mono">{os.pedidoNumero}</td>
                    <td className="p-2">{os.emissao || os.createdAt}</td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(os.status)}`}>{statusLabel(os.status)}</span></td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground">{elapsedTime(os.createdAt)}</td>
                    <td className="p-2 text-[10px] max-w-[200px] truncate" title={os.motivoCancelamento || ''}>
                      {os.motivoCancelamento ? os.motivoCancelamento : '-'}
                    </td>
                  </tr>
                ))}
                {ordensServico.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhuma O.S.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isPrint && (
        <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
      )}
    </div>
  );
}
