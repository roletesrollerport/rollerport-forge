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
import {
  FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck,
  Eye, Printer, Target, Save, Edit, ArrowLeft, Trash2, X,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/* ------------------------------------------------------------------ */
/*  Clickable status chip                                              */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Top-level stat card (Orçamentos / Pedidos / Clientes / O.S.)       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Status progress bar                                                */
/* ------------------------------------------------------------------ */
function StatusBar({ label, value, max, color, onClick }: { label: string; value: number; max: number; color: string; onClick?: (e?: React.MouseEvent) => void }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <button onClick={onClick} className="flex items-center gap-3 text-xs w-full hover:bg-muted/30 rounded px-1 py-0.5 transition-colors">
      <span className="w-28 text-muted-foreground truncate text-left">{label}</span>
      <div className="flex-1"><Progress value={pct} className={`h-2 ${color}`} /></div>
      <span className="w-8 text-right font-mono font-medium">{value}</span>
    </button>
  );
}

type DashView = 'main' | 'vendor-detail' | 'vendor-print' | 'report-detail' | 'report-print' | 'conversion-detail' | 'conversion-print';

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

  const { usuarios: dbUsuarios, loading: usersLoading } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId) || null;
  const isMaster = currentUser?.nivel === 'master';
  const currentUserName = currentUser?.nome || '';
  const { onlineUserIds } = usePresenceContext();

  /* ---------------------------------------------------------------- */
  /*  Data loading - Direct from Supabase DB only                      */
  /* ---------------------------------------------------------------- */
  const loadingRef = useRef(false);

  const doLoadFromDb = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [orcRes, pedRes, cliRes, osRes, metRes] = await Promise.all([
        supabase.from('orcamentos').select('data'),
        supabase.from('pedidos').select('data'),
        supabase.from('clientes').select('data'),
        supabase.from('ordens_servico').select('data'),
        supabase.from('metas_vendedores').select('data'),
      ]);

      const orcData = (orcRes.data || []).map((r: any) => r.data);
      const pedData = (pedRes.data || []).map((r: any) => r.data);
      const cliData = (cliRes.data || []).map((r: any) => r.data);
      const osData = (osRes.data || []).map((r: any) => r.data);
      const metData = (metRes.data || []).map((r: any) => r.data);

      // Fallback: if DB clientes is empty, use local seed
      setData({
        orcamentos: orcData,
        pedidos: pedData,
        clientes: cliData.length > 0 ? cliData : store.getClientes(),
        os: osData,
      });
      setMetas(metData.length > 0 ? metData : store.getMetas());
      setDataLoaded(true);
    } catch (err) {
      console.error('[Dashboard] DB load error, using localStorage:', err);
      setData({
        orcamentos: store.getOrcamentos(),
        pedidos: store.getPedidos(),
        clientes: store.getClientes(),
        os: store.getOrdensServico(),
      });
      setMetas(store.getMetas());
      setDataLoaded(true);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Realtime: ONLY DB subscriptions + periodic (no localStorage)     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    doLoadFromDb();

    // Realtime subscriptions — fires AFTER data is committed to DB
    const channel = supabase
      .channel('dashboard-rt-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_vendedores' }, () => doLoadFromDb())
      .subscribe();

    // Periodic safety net
    const interval = setInterval(() => doLoadFromDb(), 10000);

    // Reload on tab focus
    const handleVis = () => { if (document.visibilityState === 'visible') doLoadFromDb(); };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [doLoadFromDb]);

  /* ---------------------------------------------------------------- */
  /*  Derived counts                                                   */
  /* ---------------------------------------------------------------- */
  const countByStatus = (items: any[], field: string, status: string) => items.filter(i => i[field] === status).length;

  const getOrcStats = (orcs: any[]) => ({
    total: orcs.length,
    rascunho: countByStatus(orcs, 'status', 'RASCUNHO'),
    enviado: countByStatus(orcs, 'status', 'ENVIADO'),
    aguardando: countByStatus(orcs, 'status', 'AGUARDANDO'),
    aprovado: countByStatus(orcs, 'status', 'APROVADO'),
    reprovado: countByStatus(orcs, 'status', 'REPROVADO'),
  });

  const getPedStats = (peds: any[]) => ({
    total: peds.length,
    pendente: countByStatus(peds, 'status', 'PENDENTE'),
    confirmado: countByStatus(peds, 'status', 'CONFIRMADO'),
    producao: countByStatus(peds, 'status', 'EM_PRODUCAO'),
    concluido: countByStatus(peds, 'status', 'CONCLUIDO'),
    entregue: countByStatus(peds, 'status', 'ENTREGUE'),
  });

  const getOsStats = (osList: any[]) => ({
    total: osList.length,
    aberta: countByStatus(osList, 'status', 'ABERTA'),
    emAndamento: countByStatus(osList, 'status', 'EM_ANDAMENTO'),
    concluida: countByStatus(osList, 'status', 'CONCLUIDA'),
  });

  // Per-user data helpers (fuzzy matching: "karen" matches "Karen Ferreira")
  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    // Exact match, or one contains the other, or first name match
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };
  const getUserOrcs = (nome: string) => data.orcamentos.filter((o: any) => nameMatch(o.vendedor, nome));
  const getUserPeds = (nome: string) => data.pedidos.filter((p: any) => {
    const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
    return nameMatch((orc as any)?.vendedor, nome);
  });
  const getUserOS = (nome: string) => data.os.filter((os: any) => {
    const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
    if (!ped) return false;
    const orc = data.orcamentos.find((o: any) => o.id === (ped as any).orcamentoId);
    return nameMatch((orc as any)?.vendedor, nome);
  });

  // Global stats
  const globalOrc = getOrcStats(isMaster ? data.orcamentos : getUserOrcs(currentUserName));
  const globalPed = getPedStats(isMaster ? data.pedidos : getUserPeds(currentUserName));
  const globalOs = getOsStats(isMaster ? data.os : getUserOS(currentUserName));

  const taxaConversao = globalOrc.total > 0 ? +((globalOrc.aprovado / globalOrc.total) * 100).toFixed(1) : 0;

  /* ---------------------------------------------------------------- */
  /*  Meta helpers                                                     */
  /* ---------------------------------------------------------------- */
  const saveMeta = (vendedorNome: string, valor: number) => {
    const existing = metas.find(m => m.vendedor === vendedorNome);
    let updated;
    if (existing) { updated = metas.map(m => m.vendedor === vendedorNome ? { ...m, metaMensal: valor } : m); }
    else { updated = [...metas, { vendedor: vendedorNome, metaMensal: valor }]; }
    store.saveMetas(updated); setMetas(updated); setEditingMeta(null); toast.success('Meta salva!');
  };

  const deleteOrcamento = (id: string) => {
    const updated = data.orcamentos.filter((o: any) => o.id !== id);
    store.saveOrcamentos(updated);
    doLoadFromDb();
    toast.success('Orçamento excluído!');
  };

  const deletePedido = (id: string) => {
    const updated = data.pedidos.filter((p: any) => p.id !== id);
    store.savePedidos(updated);
    doLoadFromDb();
    toast.success('Pedido excluído!');
  };

  /* ================================================================ */
  /*  VENDOR DETAIL / PRINT VIEW                                       */
  /* ================================================================ */
  if ((dashView === 'vendor-detail' || dashView === 'vendor-print') && selectedVendor) {
    const userOrcs = getUserOrcs(selectedVendor);
    const userPeds = getUserPeds(selectedVendor);
    const orcS = getOrcStats(userOrcs);
    const pedS = getPedStats(userPeds);
    const totalVendido = userPeds.reduce((s: number, p: any) => s + p.valorTotal, 0);
    const meta = metas.find(m => m.vendedor === selectedVendor);
    const metaPct = meta && meta.metaMensal > 0 ? Math.min((totalVendido / meta.metaMensal) * 100, 100) : 0;
    const conversao = orcS.total > 0 ? ((orcS.aprovado / orcS.total) * 100).toFixed(1) : '0';

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => { setDashView('main'); setSelectedVendor(null); }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'vendor-detail' && (
            <Button variant="outline" onClick={() => setDashView('vendor-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          )}
          {dashView === 'vendor-print' && (
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-4xl mx-auto print:border-0 print:shadow-none">
          <h2 className="text-xl font-bold mb-6">Vendedor: {selectedVendor}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="border rounded p-3"><span className="text-muted-foreground">Orçamentos:</span> <strong>{orcS.total}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Aprovados:</span> <strong className="text-success">{orcS.aprovado}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Pedidos:</span> <strong>{pedS.total}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Total Vendido:</span> <strong>{fmt(totalVendido)}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">% Conversão:</span> <strong>{conversao}%</strong></div>
            <div className="border rounded p-3">
              <span className="text-muted-foreground">Meta:</span>
              {meta && meta.metaMensal > 0 ? (
                <div className="flex items-center gap-2 mt-1"><Progress value={metaPct} className="h-3 flex-1" /><strong>{metaPct.toFixed(0)}%</strong></div>
              ) : <strong> Não definida</strong>}
            </div>
          </div>

          <h3 className="font-semibold text-sm mt-4 mb-2">Orçamentos</h3>
          <table className="w-full text-xs border-collapse mb-4">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Data</th>
              <th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
              {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
            </tr></thead>
            <tbody>
              {userOrcs.map((o: any) => (
                <tr key={o.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td>
                  <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                  <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                  {isMaster && (
                    <td className="p-2 print:hidden">
                      <div className="flex gap-1">
                        <button onClick={() => navigate('/orcamentos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => deleteOrcamento(o.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {userOrcs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum orçamento.</td></tr>}
            </tbody>
          </table>

          <h3 className="font-semibold text-sm mt-4 mb-2">Pedidos</h3>
          <table className="w-full text-xs border-collapse">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th>
              <th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
              {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
            </tr></thead>
            <tbody>
              {userPeds.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                  <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                  {isMaster && (
                    <td className="p-2 print:hidden">
                      <div className="flex gap-1">
                        <button onClick={() => navigate('/pedidos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => deletePedido(p.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {userPeds.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
        {dashView === 'vendor-print' && (
          <style>{`@media print { @page { margin: 1cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  REPORT DETAIL                                                    */
  /* ================================================================ */
  if (dashView === 'report-detail' || dashView === 'report-print') {
    const fv = selectedReportVendor;
    const reportOrcs = fv ? getUserOrcs(fv) : (isMaster ? data.orcamentos : getUserOrcs(currentUserName));
    const reportPeds = fv ? getUserPeds(fv) : (isMaster ? data.pedidos : getUserPeds(currentUserName));
    const reportOS = fv ? getUserOS(fv) : (isMaster ? data.os : getUserOS(currentUserName));
    const vendedores = dbUsuarios.filter(u => u.nivel !== 'master' && u.ativo);

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => { setDashView('main'); setSelectedReportVendor(null); }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'report-detail' && <Button variant="outline" onClick={() => setDashView('report-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>}
          {dashView === 'report-print' && <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>}
          {isMaster && (
            <select value={selectedReportVendor || ''} onChange={e => setSelectedReportVendor(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="">Todos os Usuários</option>
              {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
            </select>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold">Relatório Comercial {fv ? `- ${fv}` : '- Todos'}</h2>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Orçamentos ({reportOrcs.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vendedor</th>
                  <th className="text-left p-2">Data</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportOrcs.map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td><td className="p-2">{o.vendedor}</td>
                      <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                      <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-secondary" /> Pedidos ({reportPeds.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Entrega</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportPeds.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                      <td className="p-2">{p.dataEntrega}</td>
                      <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Factory className="h-4 w-4 text-accent" /> Ordens de Serviço ({reportOS.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">O.S.</th><th className="text-left p-2">Empresa</th><th className="text-left p-2">Pedido</th>
                  <th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportOS.map((os: any) => (
                    <tr key={os.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{os.numero}</td><td className="p-2">{os.empresa}</td><td className="p-2">{os.pedidoNumero}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${os.status === 'CONCLUIDA' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{os.status?.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {dashView === 'report-print' && (
          <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  CONVERSION DETAIL                                                */
  /* ================================================================ */
  if (dashView === 'conversion-detail' || dashView === 'conversion-print') {
    const vendedores = dbUsuarios.filter(u => u.ativo && u.nivel !== 'master');
    const convData = vendedores.map(v => {
      const orcV = getUserOrcs(v.nome);
      const pedV = getUserPeds(v.nome);
      const totalVendido = pedV.reduce((s: number, p: any) => s + p.valorTotal, 0);
      const conv = orcV.length > 0 ? ((orcV.filter((o: any) => o.status === 'APROVADO').length / orcV.length) * 100) : 0;
      return {
        nome: v.nome, orcTotal: orcV.length,
        aprovados: countByStatus(orcV, 'status', 'APROVADO'),
        reprovados: countByStatus(orcV, 'status', 'REPROVADO'),
        enviados: countByStatus(orcV, 'status', 'ENVIADO'),
        aguardando: countByStatus(orcV, 'status', 'AGUARDANDO'),
        rascunho: countByStatus(orcV, 'status', 'RASCUNHO'),
        conversao: +conv.toFixed(1), totalVendido,
      };
    });
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setDashView('main')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'conversion-detail' && <Button variant="outline" onClick={() => setDashView('conversion-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>}
          {dashView === 'conversion-print' && <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Relatório de Taxa de Conversão</h2>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Orçamento → Pedido</p>
              <p className="text-3xl font-bold text-primary">{taxaConversao}%</p>
              <p className="text-xs text-muted-foreground">{globalOrc.aprovado} de {globalOrc.total}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Pedidos Entregues</p>
              <p className="text-3xl font-bold text-primary">{globalPed.total > 0 ? ((globalPed.entregue / globalPed.total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">{globalPed.entregue} de {globalPed.total}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">O.S. Ativas</p>
              <p className="text-3xl font-bold text-primary">{globalOs.total}</p>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nome</th><th className="text-center p-2">Orçamentos</th>
              <th className="text-center p-2">Aprovados</th><th className="text-center p-2">Reprovados</th>
              <th className="text-center p-2">Enviados</th><th className="text-center p-2">Aguardando</th>
              <th className="text-center p-2">Rascunho</th><th className="text-center p-2">% Conversão</th>
              <th className="text-right p-2">Total Vendido</th>
            </tr></thead>
            <tbody>
              {convData.map((v, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{v.nome}</td>
                  <td className="p-2 text-center">{v.orcTotal}</td>
                  <td className="p-2 text-center text-success font-medium">{v.aprovados}</td>
                  <td className="p-2 text-center text-destructive">{v.reprovados}</td>
                  <td className="p-2 text-center">{v.enviados}</td>
                  <td className="p-2 text-center">{v.aguardando}</td>
                  <td className="p-2 text-center">{v.rascunho}</td>
                  <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.conversao >= 50 ? 'bg-success/10 text-success' : v.conversao >= 25 ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>{v.conversao}%</span></td>
                  <td className="p-2 text-right font-mono">{fmt(v.totalVendido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dashView === 'conversion-print' && (
          <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  USER CARD COMPONENT (used for both Master and Common views)      */
  /* ================================================================ */
  const renderUserCard = (usuario: any, fullWidth = false) => {
    const isOnline = onlineUserIds.has(usuario.id);
    const userPeds = getUserPeds(usuario.nome);
    const totalVendido = userPeds.reduce((s: number, p: any) => s + p.valorTotal, 0);
    const meta = metas.find(m => m.vendedor === usuario.nome);
    const metaPct = meta && meta.metaMensal > 0 ? Math.min((totalVendido / meta.metaMensal) * 100, 100) : 0;

    return (
      <Card key={usuario.id} className={`hover:shadow-md transition-shadow ${fullWidth ? 'col-span-full max-w-md' : ''}`}>
        <CardContent className="p-5 space-y-4">
          {/* Foto + Nome */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-14 w-14">
                {usuario.foto ? <AvatarImage src={usuario.foto} alt={usuario.nome} /> : null}
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {usuario.nome?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOnline ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-success border-2 border-card"></span>
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex rounded-full h-4 w-4 bg-muted-foreground/40 border-2 border-card"></span>
              )}
            </div>
            <div>
              <p className="font-semibold text-base">{usuario.nome}</p>
              <span className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-muted-foreground'}`}>
                {isOnline ? '● Online' : '● Offline'}
              </span>
            </div>
          </div>

          {/* Meta do Mês */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Meta do Mês</span>
              {isMaster && editingMeta?.vendedor === usuario.nome ? (
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" className="h-6 w-24 text-xs px-1" value={editingMeta.valor || ''} onChange={e => setEditingMeta({ ...editingMeta, valor: +e.target.value })} autoFocus />
                  <button onClick={() => saveMeta(usuario.nome, editingMeta.valor)} className="text-success hover:text-success/80"><Save className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditingMeta(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <strong>{meta && meta.metaMensal > 0 ? fmt(meta.metaMensal) : 'Não definida'}</strong>
                  {isMaster && <button onClick={() => setEditingMeta({ vendedor: usuario.nome, valor: meta?.metaMensal || 0 })} className="text-muted-foreground hover:text-primary"><Edit className="h-3.5 w-3.5" /></button>}
                </div>
              )}
            </div>
            {meta && meta.metaMensal > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <Progress value={metaPct} className="h-2 flex-1" />
                  <span className="text-[11px] font-mono font-medium">{metaPct.toFixed(0)}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{fmt(totalVendido)} de {fmt(meta.metaMensal)}</p>
              </>
            )}
          </div>

          {/* Botões - Ver Relatório e Imprimir (Master vê todos, comum só o próprio) */}
          {(isMaster || usuario.id === loggedUserId) && (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-detail'); }}>
                <Eye className="h-3.5 w-3.5" /> Ver Relatório
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-print'); }}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  /* ================================================================ */
  /*  MAIN DASHBOARD VIEW                                              */
  /* ================================================================ */
  return (
    <div>
      {/* TOPO */}
      <div className="mb-2">
        <h1 className="page-header">Início</h1>
        <p className="page-subtitle">Sistema Rollerport</p>
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* 4 Cards globais - contagens persistentes e clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Orçamentos" value={globalOrc.total} color="bg-primary/10 text-primary" onClick={() => navigate('/orcamentos')} />
        <StatCard icon={ShoppingCart} label="Pedidos" value={globalPed.total} color="bg-secondary/20 text-secondary" onClick={() => navigate('/pedidos')} />
        <StatCard icon={Users} label="Clientes" value={data.clientes.length} color="bg-info/10 text-info" onClick={() => navigate('/clientes')} />
        <StatCard icon={Factory} label="Ordens de Serviço" value={globalOs.total} color="bg-accent/10 text-accent" onClick={() => navigate('/producao')} />
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* 3 Cards de Status - clicáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/orcamentos')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Status dos Orçamentos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Rascunho" value={globalOrc.rascunho} max={globalOrc.total} color="[&>div]:bg-muted-foreground" onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=RASCUNHO'); }} />
            <StatusBar label="Aprovado" value={globalOrc.aprovado} max={globalOrc.total} color="[&>div]:bg-success" onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=APROVADO'); }} />
            <StatusBar label="Cancelado" value={globalOrc.reprovado} max={globalOrc.total} color="[&>div]:bg-destructive" onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=REPROVADO'); }} />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pedidos')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-secondary" /> Status dos Pedidos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Pendente" value={globalPed.pendente} max={globalPed.total} color="[&>div]:bg-muted-foreground" onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=PENDENTE'); }} />
            <StatusBar label="Confirmado" value={globalPed.confirmado} max={globalPed.total} color="[&>div]:bg-info" onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=CONFIRMADO'); }} />
            <StatusBar label="Em Produção" value={globalPed.producao} max={globalPed.total} color="[&>div]:bg-secondary" onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=EM_PRODUCAO'); }} />
            <StatusBar label="Concluído" value={globalPed.concluido} max={globalPed.total} color="[&>div]:bg-primary" onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=CONCLUIDO'); }} />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/producao')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2"><Factory className="h-4 w-4 text-accent" /> Status das O.S.</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Aberta" value={globalOs.aberta} max={globalOs.total} color="[&>div]:bg-muted-foreground" onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=ABERTA'); }} />
            <StatusBar label="Em Andamento" value={globalOs.emAndamento} max={globalOs.total} color="[&>div]:bg-secondary" onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=EM_ANDAMENTO'); }} />
            <StatusBar label="Concluída" value={globalOs.concluida} max={globalOs.total} color="[&>div]:bg-success" onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=CONCLUIDA'); }} />
            <StatusBar label="Entregue" value={globalOs.total > 0 ? globalOs.concluida : 0} max={globalOs.total} color="[&>div]:bg-primary" onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=CONCLUIDA'); }} />
          </CardContent>
        </Card>
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* Taxa de Conversão */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDashView('conversion-detail')}>
        <CardHeader className="pb-2">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Taxa de Conversão
            <span className="text-[10px] text-muted-foreground ml-2">(clique para relatório completo)</span>
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Orçamento → Pedido</span></div>
              <p className="text-3xl font-bold text-primary">{taxaConversao}%</p>
              <p className="text-xs text-muted-foreground mt-1">{globalOrc.aprovado} aprovados de {globalOrc.total}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><Truck className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Pedidos Entregues</span></div>
              <p className="text-3xl font-bold text-primary">{globalPed.total > 0 ? ((globalPed.entregue / globalPed.total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">{globalPed.entregue} de {globalPed.total} pedidos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><Factory className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">O.S. Ativas</span></div>
              <p className="text-3xl font-bold text-primary">{globalOs.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Ordens em andamento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* Cards dos Usuários */}
      <div>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> {isMaster ? 'Vendedores' : 'Equipe'}
        </h2>
        {usersLoading || !dataLoaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div></div></CardHeader>
                <CardContent className="space-y-3 pt-0"><div className="grid grid-cols-3 gap-2"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></div></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dbUsuarios.filter(u => u.ativo && u.nivel !== 'master').map(u => renderUserCard(u))}
          </div>
        )}
      </div>
    </div>
  );
}
