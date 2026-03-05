import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios } from '@/hooks/useUsuarios';
import { usePresenceContext } from '@/contexts/PresenceContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck,
  Eye, Printer, Target, Save, Edit, ArrowLeft, Trash2, X,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')}`;

const formatCurrencyInput = (value: number): string => {
  if (!value && value !== 0) return '';
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1');
};

function StatusChip({ label, count, colorClass, onClick }: { label: string; count: number; colorClass: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all hover:scale-105 hover:shadow-sm ${colorClass} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {label}: {count}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: string | number; color: string; onClick?: () => void }) {
  return (
    <div
      className={`stat-card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all' : ''}`}
      onClick={onClick}
    >
      <div className={`flex items-center justify-center h-12 w-12 rounded-lg ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function StatusBar({ label, value, max, color, extra, onClick }: { label: string; value: number; max: number; color: string; extra?: string; onClick?: (e?: React.MouseEvent) => void }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <button onClick={onClick} className="flex items-center gap-3 text-xs w-full hover:bg-muted/30 rounded px-1 py-0.5 transition-colors">
      <span className="w-28 text-muted-foreground truncate text-left">{label}</span>
      <div className="flex-1"><Progress value={pct} className={`h-2 ${color}`} /></div>
      <span className="w-8 text-right font-mono font-medium">{value}</span>
      {extra && <span className="w-12 text-right text-[10px] text-muted-foreground">{extra}</span>}
    </button>
  );
}

type DashView = 'main' | 'vendor-detail' | 'vendor-print' | 'report-detail' | 'report-print' | 'conversion-detail' | 'conversion-print';

const fmtDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('pt-BR');

const daysBetweenDates = (a: string, b: string): string => {
  if (!a || !b) return '—';
  const diffMs = Math.max(0, new Date(b).getTime() - new Date(a).getTime());
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return diffHours > 0 ? `${diffHours}h` : '<1h';
  const remainHours = diffHours - (diffDays * 24);
  return remainHours > 0 ? `${diffDays}d ${remainHours}h` : `${diffDays}d`;
};

const findStatusDate = (item: any, statusName: string) => 
  item?.statusHistory?.find((h: any) => h.status === statusName)?.date;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    orcamentos: [] as any[], pedidos: [] as any[], clientes: [] as any[], os: [] as any[],
  });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [metas, setMetas] = useState(store.getMetas());
  const [editingMeta, setEditingMeta] = useState<{ vendedor: string; valor: number } | null>(null);
  const [dashView, setDashView] = useState<DashView>('main');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedReportVendor, setSelectedReportVendor] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>('');
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [aiReportText, setAiReportText] = useState('');
  const [aiReportLoading, setAiReportLoading] = useState(false);

  const { usuarios: dbUsuarios, loading: usersLoading } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId) || null;
  const isMaster = currentUser?.nivel === 'master';
  const currentUserName = currentUser?.nome || '';
  const { onlineUserIds } = usePresenceContext();

  useEffect(() => {
    const syncData = async () => {
      const orcs = store.getOrcamentos();
      const peds = store.getPedidos();
      const cls = store.getClientes();
      const oss = store.getOrdensServico();
      setData({ orcamentos: orcs, pedidos: peds, clientes: cls, os: oss });
      setDataLoaded(true);
    };
    syncData();
    window.addEventListener('rp-data-synced', syncData);
    return () => window.removeEventListener('rp-data-synced', syncData);
  }, []);

  const deleteOrcamento = (id: string) => {
    store.saveOrcamentos(data.orcamentos.filter(o => o.id !== id));
    setData(d => ({ ...d, orcamentos: d.orcamentos.filter(o => o.id !== id) }));
    toast.success('Orçamento excluído!');
  };

  const deletePedido = (id: string) => {
    store.savePedidos(data.pedidos.filter(p => p.id !== id));
    setData(d => ({ ...d, pedidos: d.pedidos.filter(p => p.id !== id) }));
    toast.success('Pedido excluído!');
  };

  const generateAIReport = async (vendorName: string) => {
    setAiReportLoading(true);
    setAiReportText('');
    setAiReportOpen(true);
    try {
      const vendorOrcs = data.orcamentos.filter((o: any) => o.vendedor === vendorName);
      const vendorPeds = data.pedidos.filter((p: any) => p.vendedor === vendorName);
      const vendorOS = data.os.filter((o: any) => o.vendedor === vendorName);
      const tvend = vendorPeds.reduce((s: number, p: any) => s + (p.valorTotal || 0), 0);
      const metaObj = metas.find((m: any) => m.vendedor === vendorName);
      const metaVal = metaObj?.metaMensal || 0;
      const conv = vendorOrcs.length > 0 ? ((vendorOrcs.filter((o: any) => o.status === 'APROVADO').length / vendorOrcs.length) * 100).toFixed(1) : '0';

      const prompt = `Analise o desempenho do vendedor "${vendorName}" e gere um relatório motivacional completo.

DADOS:
- Orçamentos: ${vendorOrcs.length} (Aprovados: ${vendorOrcs.filter((o: any) => o.status === 'APROVADO').length}, Reprovados: ${vendorOrcs.filter((o: any) => o.status === 'REPROVADO').length})
- Taxa de conversão: ${conv}%
- Pedidos: ${vendorPeds.length} (Entregues: ${vendorPeds.filter((p: any) => p.status === 'ENTREGUE').length})
- Total vendido: R$ ${tvend.toFixed(2)}
- Meta mensal: R$ ${metaVal.toFixed(2)}
- Falta para meta: R$ ${Math.max(0, metaVal - tvend).toFixed(2)}
- % da meta alcançado: ${metaVal > 0 ? ((tvend / metaVal) * 100).toFixed(1) : 'Sem meta definida'}%
- O.S. geradas: ${vendorOS.length} (Concluídas: ${vendorOS.filter((o: any) => o.status === 'CONCLUIDA').length})

Gere um relatório contendo:
1. **Resumo do Desempenho** - Análise objetiva dos números
2. **Pontos Fortes** - O que está indo bem
3. **Pontos de Melhoria** - Onde pode melhorar com dicas práticas
4. **Plano de Ação** - Passos concretos para alcançar a meta
5. **Mensagem Motivacional** - Uma mensagem inspiradora e encorajadora para o vendedor não desanimar e continuar focado

Use emojis relevantes para tornar mais visual. Responda em português do Brasil.`;

      const sessionToken = localStorage.getItem('rp_session_token');
      const resp = await supabase.functions.invoke('chat', {
        body: { messages: [{ role: 'user', content: prompt }], mode: 'ia', sessionToken },
      });

      if (resp.error) throw resp.error;
      const result = resp.data;

      if (result instanceof ReadableStream) {
        const reader = result.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\\n').filter((l: string) => l.startsWith('data: '));
          for (const line of lines) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              fullText += content;
              setAiReportText(fullText);
            } catch {}
          }
        }
      } else if (typeof result === 'string') {
        setAiReportText(result);
      } else {
        setAiReportText(result?.choices?.[0]?.message?.content || 'Não foi possível gerar o relatório.');
      }
    } catch (err) {
      console.error('AI report error:', err);
      setAiReportText('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setAiReportLoading(false);
    }
  };

  const totalOrcamentos = data.orcamentos.length;
  const aprOrcamentos = data.orcamentos.filter(o => o.status === 'APROVADO').length;
  const totalPedidos = data.pedidos.length;
  const totalOS = data.os.length;
  const concOS = data.os.filter(o => o.status === 'CONCLUIDA').length;

  // MAIN VIEW
  if (dashView === 'main') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subtitle">Visão geral de vendas e produção</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Orçamentos" value={totalOrcamentos} color="bg-blue-500/10 text-blue-600" onClick={() => setDashView('report-detail')} />
          <StatCard icon={ShoppingCart} label="Pedidos" value={totalPedidos} color="bg-green-500/10 text-green-600" />
          <StatCard icon={Factory} label="O.S. Totais" value={totalOS} color="bg-purple-500/10 text-purple-600" />
          <StatCard icon={CheckCircle} label="O.S. Concluídas" value={concOS} color="bg-success/10 text-success" />
        </div>

        {isMaster ? (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" /> Vendedores
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dbUsuarios.filter(u => u.nivel !== 'master').map(vendor => {
                const vendorOrcs = data.orcamentos.filter(o => o.vendedor === vendor.nome);
                const vendorPeds = data.pedidos.filter(p => p.vendedor === vendor.nome);
                const totalVendido = vendorPeds.reduce((s, p) => s + (p.valorTotal || 0), 0);
                const meta = metas.find(m => m.vendedor === vendor.nome);
                const metaPct = meta && meta.metaMensal > 0 ? (totalVendido / meta.metaMensal) * 100 : 0;
                const metaRestante = meta ? Math.max(0, meta.metaMensal - totalVendido) : 0;

                return (
                  <Card key={vendor.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setSelectedVendor(vendor.nome); setDashView('vendor-detail'); }}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <h3 className="font-semibold text-sm">{vendor.nome}</h3>
                      {Array.from(onlineUserIds).includes(vendor.id) && <Badge className="bg-success/20 text-success">Online</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <StatusChip label="Orç." count={vendorOrcs.length} colorClass="bg-blue-500/10 text-blue-600" />
                      <StatusChip label="Ped." count={vendorPeds.length} colorClass="bg-green-500/10 text-green-600" />
                      <div><span className="text-muted-foreground">Vendido:</span> <strong>{fmt(totalVendido)}</strong></div>
                      {meta && meta.metaMensal > 0 ? (
                        <>
                          <div className="flex items-center gap-2"><Progress value={metaPct} className="h-2 flex-1" /><span className="text-[10px] font-mono">{metaPct.toFixed(0)}%</span></div>
                          <p className="text-[10px] text-muted-foreground">Falta: {fmt(metaRestante)}</p>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">{currentUserName}</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Orçamentos:</span> <strong>{data.orcamentos.filter(o => o.vendedor === currentUserName).length}</strong></div>
              <div><span className="text-muted-foreground">Pedidos:</span> <strong>{data.pedidos.filter(p => p.vendedor === currentUserName).length}</strong></div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={() => navigate('/orcamentos')} variant="outline" className="gap-2"><FileText className="h-4 w-4" /> Orçamentos</Button>
          <Button onClick={() => navigate('/pedidos')} variant="outline" className="gap-2"><ShoppingCart className="h-4 w-4" /> Pedidos</Button>
          <Button onClick={() => navigate('/producao')} variant="outline" className="gap-2"><Factory className="h-4 w-4" /> Produção</Button>
        </div>
      </div>
    );
  }

  // VENDOR DETAIL VIEW
  if (dashView === 'vendor-detail' && selectedVendor) {
    const userOrcs = data.orcamentos.filter(o => o.vendedor === selectedVendor);
    const userPeds = data.pedidos.filter(p => p.vendedor === selectedVendor);
    const userOS = data.os.filter(o => o.vendedor === selectedVendor);
    const totalVendido = userPeds.reduce((s, p) => s + (p.valorTotal || 0), 0);
    const meta = metas.find(m => m.vendedor === selectedVendor);
    const metaPct = meta && meta.metaMensal > 0 ? (totalVendido / meta.metaMensal) * 100 : 0;
    const metaRestante = meta ? Math.max(0, meta.metaMensal - totalVendido) : 0;

    const orcS = { total: userOrcs.length, aprovado: userOrcs.filter(o => o.status === 'APROVADO').length };
    const pedS = { total: userPeds.length };

    return (
      <div className="space-y-6">
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={() => setDashView('main')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button onClick={() => generateAIReport(selectedVendor)} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
            <TrendingUp className="h-4 w-4" /> Relatório de Desempenho IA
          </Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-7xl mx-auto">
          <h2 className="text-xl font-bold mb-6">Vendedor: {selectedVendor}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
            <div className="border rounded p-3"><span className="text-muted-foreground">Orçamentos:</span> <strong>{orcS.total}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Aprovados:</span> <strong className="text-success">{orcS.aprovado}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Pedidos:</span> <strong>{pedS.total}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Total Vendido:</span> <strong>{fmt(totalVendido)}</strong></div>
            {meta && meta.metaMensal > 0 && (
              <div className="border rounded p-3">
                <span className="text-muted-foreground">Meta:</span>
                <div className="space-y-1 mt-1">
                  <div className="flex items-center gap-2"><Progress value={metaPct} className="h-3 flex-1" /><strong>{metaPct.toFixed(0)}%</strong></div>
                  <p className="text-[11px] text-muted-foreground">{fmt(totalVendido)} de {fmt(meta.metaMensal)}</p>
                  <p className="text-[11px] font-medium">Falta: {fmt(metaRestante)}</p>
                </div>
              </div>
            )}
          </div>

          {/* ORÇAMENTOS TABLE */}
          <h3 className="font-semibold text-sm mt-4 mb-2">Orçamentos</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2 whitespace-nowrap">Nº</th><th className="text-left p-2 whitespace-nowrap">Cliente</th><th className="text-left p-2 whitespace-nowrap">Criação</th>
                <th className="text-left p-2 whitespace-nowrap">Aprovação</th><th className="text-left p-2 whitespace-nowrap">Dias</th>
                <th className="text-right p-2 whitespace-nowrap">Valor</th><th className="text-left p-2 whitespace-nowrap">Status</th><th className="text-left p-2 whitespace-nowrap">Motivo Cancel.</th>
                {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
              </tr></thead>
              <tbody>
                {userOrcs.map((o: any) => {
                  const criacao = o.dataOrcamento || o.createdAt;
                  const aprovacao = o.dataAprovacao || findStatusDate(o, 'APROVADO');
                  return (
                    <tr key={o.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(criacao)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(aprovacao)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(criacao, aprovacao)}</td>
                      <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                      <td className="p-2 text-destructive max-w-xs">{o.status === 'REPROVADO' && o.motivoCancelamento ? <button onClick={() => { setSelectedCancelReason(o.motivoCancelamento); setCancelDialogOpen(true); }} className="text-destructive hover:underline cursor-pointer text-truncate max-w-[200px]">{o.motivoCancelamento}</button> : ''}</td>
                      {isMaster && (
                        <td className="p-2 print:hidden">
                          <div className="flex gap-1">
                            <button onClick={() => navigate('/orcamentos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                            <button onClick={() => deleteOrcamento(o.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {userOrcs.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhum orçamento.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* PEDIDOS TABLE */}
          <h3 className="font-semibold text-sm mt-4 mb-2">Pedidos</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2 whitespace-nowrap">Nº</th><th className="text-left p-2 whitespace-nowrap">Cliente</th>
                <th className="text-left p-2 whitespace-nowrap">Criação</th><th className="text-left p-2 whitespace-nowrap">Confirmado</th>
                <th className="text-left p-2 whitespace-nowrap">Produção</th><th className="text-left p-2 whitespace-nowrap">Concluído</th>
                <th className="text-left p-2 whitespace-nowrap">Entregue</th>
                <th className="text-left p-2 whitespace-nowrap">Criação→Confirm.</th>
                <th className="text-left p-2 whitespace-nowrap">Confirm.→Produção</th>
                <th className="text-left p-2 whitespace-nowrap">Produção→Concluído</th>
                <th className="text-left p-2 whitespace-nowrap">Total</th>
                <th className="text-right p-2 whitespace-nowrap">Valor</th><th className="text-left p-2 whitespace-nowrap">Status</th>
                <th className="text-left p-2 whitespace-nowrap">Motivo Cancel.</th>
                {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
              </tr></thead>
              <tbody>
                {userPeds.map((p: any) => {
                  const criacao = p.createdAt;
                  const dtConfirmado = findStatusDate(p, 'CONFIRMADO');
                  const dtProducao = findStatusDate(p, 'EM_PRODUCAO');
                  const dtConcluido = findStatusDate(p, 'CONCLUIDO');
                  const dtEntregue = findStatusDate(p, 'ENTREGUE');
                  const lastDate = dtEntregue || dtConcluido || dtProducao || dtConfirmado || null;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(criacao)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtConfirmado)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtProducao)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtConcluido)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtEntregue)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(criacao, dtConfirmado)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(dtConfirmado, dtProducao)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(dtProducao, dtConcluido)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(criacao, lastDate || new Date().toISOString())}</td>
                      <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status?.replace('_', ' ')}</span></td>
                      <td className="p-2 text-destructive max-w-xs">{p.motivoCancelamento ? <button onClick={() => { setSelectedCancelReason(p.motivoCancelamento); setCancelDialogOpen(true); }} className="text-destructive hover:underline cursor-pointer text-truncate max-w-[200px]">{p.motivoCancelamento}</button> : ''}</td>
                      {isMaster && (
                        <td className="p-2 print:hidden">
                          <div className="flex gap-1">
                            <button onClick={() => navigate('/pedidos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                            <button onClick={() => deletePedido(p.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {userPeds.length === 0 && <tr><td colSpan={15} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* OS TABLE */}
          <h3 className="font-semibold text-sm mt-4 mb-2">Ordens de Serviço</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2 whitespace-nowrap">O.S.</th><th className="text-left p-2 whitespace-nowrap">Empresa</th><th className="text-left p-2 whitespace-nowrap">Vendedor</th><th className="text-left p-2 whitespace-nowrap">Pedido</th>
                <th className="text-left p-2 whitespace-nowrap">Emissão</th><th className="text-left p-2 whitespace-nowrap">Em Andamento</th><th className="text-left p-2 whitespace-nowrap">Concluída</th>
                <th className="text-left p-2 whitespace-nowrap">Aberta→Andamento</th><th className="text-left p-2 whitespace-nowrap">Andamento→Concluída</th><th className="text-left p-2 whitespace-nowrap">Total</th>
                <th className="text-left p-2 whitespace-nowrap">Status</th><th className="text-left p-2 whitespace-nowrap">Motivo Cancel.</th>
              </tr></thead>
              <tbody>
                {userOS.map((os: any) => {
                  const emissao = os.emissao || os.createdAt;
                  const dtAndamento = findStatusDate(os, 'EM_ANDAMENTO');
                  const dtConcluida = findStatusDate(os, 'CONCLUIDA');
                  const lastOs = dtConcluida || dtAndamento || null;
                  return (
                    <tr key={os.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{os.numero}</td><td className="p-2">{os.empresa}</td><td className="p-2">{os.vendedor || '-'}</td><td className="p-2">{os.pedidoNumero}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(emissao)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtAndamento)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(dtConcluida)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(emissao, dtAndamento)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(dtAndamento, dtConcluida)}</td>
                      <td className="p-2 text-center font-mono">{daysBetweenDates(emissao, lastOs || new Date().toISOString())}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${os.status === 'CONCLUIDA' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{os.status?.replace('_', ' ')}</span></td>
                      <td className="p-2 text-destructive max-w-xs">{os.motivoCancelamento ? <button onClick={() => { setSelectedCancelReason(os.motivoCancelamento); setCancelDialogOpen(true); }} className="text-destructive hover:underline cursor-pointer text-truncate max-w-[200px]">{os.motivoCancelamento}</button> : ''}</td>
                    </tr>
                  );
                })}
                {userOS.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">Nenhuma O.S.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setDashView('main')}>Voltar</Button>
      <Card>
        <CardContent className="pt-6">Carregando...</CardContent>
      </Card>

      {/* Dialog para motivo de cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo do Cancelamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap break-words">{selectedCancelReason}</p>
        </DialogContent>
      </Dialog>

      {/* Dialog relatório IA */}
      <Dialog open={aiReportOpen} onOpenChange={setAiReportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Relatório de Desempenho IA</DialogTitle>
          </DialogHeader>
          {aiReportLoading && !aiReportText ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3 text-muted-foreground">Gerando relatório...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
              {aiReportText}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
